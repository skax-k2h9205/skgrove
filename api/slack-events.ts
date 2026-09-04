// SKonnection 슬랙 봇 — @멘션 또는 /티미팅 슬래시로 Claude가 티미팅 아젠다 아이디에이션을 돕는다.
//
// ⚠️ Socket Mode 는 반드시 OFF. 켜져 있으면 슬랙이 이 HTTP Request URL 로 안 보내고
//    WebSocket 으로만 보내서, 이벤트/커맨드가 하나도 안 온다(서버리스는 상시 소켓 유지 불가).
//
// 슬랙 설정:
//   - Event Subscriptions ON → Request URL = https://<배포>/api/slack-events
//       → Subscribe to bot events: app_mention
//   - Slash Commands → /티미팅 → 같은 Request URL
//   - 저장 후 재설치.
// 스코프: app_mentions:read, chat:write, channels:history(스레드 맥락 읽기), commands.
//
// 서버 환경변수:
//   SLACK_SIGNING_SECRET : 슬랙 앱 Basic Information 의 Signing Secret(서명 검증용)
//   SLACK_BOT_TOKEN      : 봇 토큰(xoxb-...)
//   OPENROUTER_API_KEY   : OpenRouter 키(sk-or-...)
//   OPENROUTER_MODEL     : 모델(기본 anthropic/claude-haiku-4.5)
import { createHmac, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const SLACK_API = 'https://slack.com/api';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

const SYSTEM =
  "당신은 SK 팀의 '티미팅 아젠다 아이디에이션 파트너'입니다. " +
  '티미팅은 팀원이 돌아가며 발표·공유하는 가벼운 세미나예요(기술세미나·여행기·팀워크샵·팀내 공유 등). ' +
  '사용자가 주제를 던지면: ' +
  '(1) 방향이 모호하면 1~2개의 짧은 확인 질문을 먼저 합니다(대상·목적·성격). ' +
  '(2) 구체적이면 바로 티미팅 아젠다 후보 3~5개를 제안합니다. 각 후보는 "제목 · 한 줄 설명 · 세션 유형" 형식으로. ' +
  '(3) 이어지는 대화에서 고른 후보를 함께 다듬어 갑니다. ' +
  '간결하고 실용적으로, 한국어로 답합니다. ' +
  '슬랙 서식만 사용하세요: 굵게는 *별표 하나* (예: *대상*), 절대 **별표 두 개**를 쓰지 마세요. #, ## 같은 헤더 문법도 쓰지 마세요.';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function stripMentions(text: string): string {
  return String(text || '').replace(/<@[A-Z0-9]+>/g, '').replace(/\s+/g, ' ').trim();
}

// 마크다운(**굵게**, ### 헤더)을 슬랙 mrkdwn 으로 정리. 모델이 **를 자주 흘려서 안전망으로 변환.
function toSlackMrkdwn(text: string): string {
  return String(text || '')
    .replace(/\*\*([^*\n]+?)\*\*/g, '*$1*') // **굵게** → *굵게*
    .replace(/^#{1,6}\s+/gm, ''); // 헤더 문법 제거
}

async function callClaude(messages: ChatMessage[]): Promise<string> {
  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) return '지금은 AI가 설정되지 않았어요. (OPENROUTER_API_KEY 필요)';
  const model = env('OPENROUTER_MODEL') || 'anthropic/claude-haiku-4.5';
  try {
    const res = await fetch(OPENROUTER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'X-Title': 'SKonnection' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
        temperature: 0.7,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[] }
      | null;
    return toSlackMrkdwn(data?.choices?.[0]?.message?.content?.trim() || '') || '음… 조금만 더 구체적으로 말씀해 주실래요?';
  } catch (error) {
    return `답변 생성 중 오류가 났어요: ${String(error)}`;
  }
}

// 진단 로그를 Supabase(slack_debug)에 남긴다 — Vercel CLI 로그엔 함수 stdout 이 안 떠서.
async function dbg(info: Record<string, unknown>): Promise<void> {
  const url = env('VITE_SUPABASE_URL');
  const anon = env('VITE_SUPABASE_ANON_KEY');
  if (!url || !anon) return;
  try {
    await fetch(`${url}/rest/v1/slack_debug`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ info }),
    });
  } catch {
    /* 진단 실패는 무시 */
  }
}

async function slackPost(method: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; messages?: SlackMsg[] };
}

type SlackMsg = { text?: string; bot_id?: string; user?: string };

// 스레드의 이전 대화를 Claude 메시지로. 봇 메시지(bot_id 있음)=assistant, 사람=user.
async function threadMessages(token: string, channel: string, threadTs: string): Promise<ChatMessage[]> {
  const res = await fetch(`${SLACK_API}/conversations.replies?channel=${channel}&ts=${threadTs}&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => null)) as { messages?: SlackMsg[] } | null;
  const msgs = Array.isArray(data?.messages) ? data!.messages! : [];
  return msgs
    .map((m): ChatMessage => ({ role: m.bot_id ? 'assistant' : 'user', content: stripMentions(m.text ?? '') }))
    .filter((m) => m.content);
}

// v0 서명 검증(HMAC-SHA256). 5분 넘은 요청은 재생공격으로 보고 거부.
function verifySignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = env('SLACK_SIGNING_SECRET');
  if (!secret || !timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const mac = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(mac), Buffer.from(signature));
  } catch {
    return false;
  }
}

// 진단: 설치된 봇 토큰의 정체성 + 실제 부여된 스코프(x-oauth-scopes 헤더)를 돌려준다.
// app_mentions:read 가 없으면 → 재설치가 스코프를 안 붙인 것(멘션 이벤트 안 옴의 원인).
export async function GET(): Promise<Response> {
  const token = env('SLACK_BOT_TOKEN');
  if (!token) return Response.json({ ok: false, reason: 'SLACK_BOT_TOKEN not set' });

  const res = await fetch(`${SLACK_API}/auth.test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const scopes = res.headers.get('x-oauth-scopes');
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return Response.json({
    ok: Boolean(data?.ok),
    team: data?.team ?? null,
    botUser: data?.user ?? null,
    botId: data?.bot_id ?? null,
    error: data?.error ?? null,
    scopes,
    hasAppMentionsRead: (scopes ?? '').split(',').map((s) => s.trim()).includes('app_mentions:read'),
    hasChatWrite: (scopes ?? '').split(',').map((s) => s.trim()).includes('chat:write'),
  });
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  const ts = request.headers.get('x-slack-request-timestamp');
  const sig = request.headers.get('x-slack-signature');
  const sigOk = verifySignature(raw, ts, sig);

  // 슬래시 커맨드는 form-encoded 로 온다(이벤트 JSON 이 아님) → 여기서 먼저 처리.
  // 3초 규칙: 즉시 임시 응답(ephemeral)을 주고, 실제 답변은 waitUntil 로 response_url 에 보낸다.
  const ctype = request.headers.get('content-type') || '';
  if (ctype.includes('application/x-www-form-urlencoded')) {
    if (!sigOk) return new Response('bad signature', { status: 401 });
    const params = new URLSearchParams(raw);
    const text = params.get('text') ?? '';
    const responseUrl = params.get('response_url') ?? '';
    if (responseUrl) waitUntil(handleSlash(text, responseUrl));
    return Response.json({ response_type: 'ephemeral', text: '💡 티미팅 아이디어를 뽑는 중이에요… 잠시만요.' });
  }

  let body: { type?: string; challenge?: string; event?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad request', { status: 400 });
  }

  // URL 검증 챌린지(서명 통과 시에만).
  if (body.type === 'url_verification') {
    if (!sigOk) return new Response('bad signature', { status: 401 });
    return Response.json({ challenge: body.challenge });
  }

  // 서명 검증 실패는 거부.
  if (!sigOk) return new Response('bad signature', { status: 401 });

  // 재시도는 스킵(중복 방지). 아래에서 즉시 200을 주므로 사실상 재시도는 안 오지만 안전장치.
  if (request.headers.get('x-slack-retry-num')) {
    return new Response('ok');
  }

  const token = env('SLACK_BOT_TOKEN');
  const event = body.event as
    | { type?: string; text?: string; channel?: string; ts?: string; thread_ts?: string; bot_id?: string }
    | undefined;

  // 핵심: 슬랙엔 즉시 200을 주고(3초 규칙), Claude 호출·게시는 waitUntil 로 백그라운드 처리한다.
  // 동기로 처리하면 응답이 5초씩 늦어 슬랙이 '배달 실패'로 보고 배달을 조여버린다.
  if (token && event && event.type === 'app_mention' && !event.bot_id && event.channel && event.ts) {
    const channel = event.channel;
    const threadTs = event.thread_ts || event.ts;
    const text = event.text ?? '';
    waitUntil(handleMention(token, channel, threadTs, text));
  }

  return new Response('ok');
}

// 슬래시 커맨드 백그라운드 처리: 입력을 Claude 에 넘겨 티미팅 아젠다 아이디어를 받아
// response_url 로 답한다(ephemeral — 명령을 친 본인에게만 보임). response_url 은 30분·5회 유효.
async function handleSlash(text: string, responseUrl: string): Promise<void> {
  try {
    const prompt = stripMentions(text).trim() || '팀 티미팅(가벼운 사내 세미나) 아젠다 아이디어를 추천해줘.';
    const reply = await callClaude([{ role: 'user', content: prompt }]);
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'ephemeral', text: reply }),
    });
  } catch (error) {
    await dbg({ stage: 'slash_error', message: String(error) });
  }
}

// 백그라운드 처리: 스레드 맥락 → Claude → 답글 게시. dbg 로 결과 기록.
async function handleMention(token: string, channel: string, threadTs: string, text: string): Promise<void> {
  try {
    const history = await threadMessages(token, channel, threadTs);
    const messages: ChatMessage[] = history.length ? history : [{ role: 'user', content: stripMentions(text) }];
    const reply = await callClaude(messages);
    const sent = await slackPost('chat.postMessage', token, { channel, thread_ts: threadTs, text: reply });
    await dbg({ stage: 'processed', channel, replyLen: reply.length, postOk: sent.ok, postError: (sent as { error?: string }).error ?? null });
  } catch (error) {
    await dbg({ stage: 'error', message: String(error) });
  }
}
