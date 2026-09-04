// SKonnection 슬랙 이벤트 수신 — 채널에서 @멘션하면 Claude가 티미팅 아젠다 아이디에이션을 돕는다.
//
// 슬랙 설정: Event Subscriptions 켜기 → Request URL = https://<배포>/api/slack-events
//   → Subscribe to bot events: app_mention → 저장 → 재설치.
// 스코프: app_mentions:read, chat:write, channels:history(스레드 맥락 읽기).
//
// 서버 환경변수:
//   SLACK_SIGNING_SECRET : 슬랙 앱 Basic Information 의 Signing Secret(서명 검증용)
//   SLACK_BOT_TOKEN      : 봇 토큰(xoxb-...)
//   OPENROUTER_API_KEY   : OpenRouter 키(sk-or-...)
//   OPENROUTER_MODEL     : 모델(기본 anthropic/claude-haiku-4.5)
import { createHmac, timingSafeEqual } from 'node:crypto';

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
  '간결하고 실용적으로, 한국어로, 슬랙에 어울리게 답합니다(과한 마크다운 금지).';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function stripMentions(text: string): string {
  return String(text || '').replace(/<@[A-Z0-9]+>/g, '').replace(/\s+/g, ' ').trim();
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
    return data?.choices?.[0]?.message?.content?.trim() || '음… 조금만 더 구체적으로 말씀해 주실래요?';
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

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  // 서명 검증(챌린지 포함 모든 요청이 서명됨).
  if (!verifySignature(raw, request.headers.get('x-slack-request-timestamp'), request.headers.get('x-slack-signature'))) {
    await dbg({ stage: 'bad_signature', hasSecret: Boolean(env('SLACK_SIGNING_SECRET')) });
    return new Response('bad signature', { status: 401 });
  }

  let body: { type?: string; challenge?: string; event?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad request', { status: 400 });
  }

  // URL 검증 챌린지.
  if (body.type === 'url_verification') {
    return Response.json({ challenge: body.challenge });
  }

  // 3초 내 ack 실패 시 슬랙이 재시도한다 → 재시도는 스킵해 중복 답변을 막는다.
  // (첫 요청은 함수가 끝까지 살아서 답을 게시한다 — Vercel 함수는 3초에 죽지 않음.)
  if (request.headers.get('x-slack-retry-num')) {
    return new Response('ok');
  }

  const token = env('SLACK_BOT_TOKEN');
  const event = body.event as
    | { type?: string; text?: string; channel?: string; ts?: string; thread_ts?: string; bot_id?: string }
    | undefined;

  // 봇 자신의 메시지(bot_id)는 무시(무한루프 방지). app_mention 만 처리.
  console.log('[slack-events] event.type=', event?.type, 'hasToken=', Boolean(token), 'bot_id=', event?.bot_id);
  // 처리 중 무슨 일이 나도 슬랙엔 항상 200을 준다 — 실패 응답이 쌓이면 슬랙이 이벤트 배달을 꺼버린다.
  try {
    if (token && event && event.type === 'app_mention' && !event.bot_id && event.channel && event.ts) {
      const channel = event.channel;
      const threadTs = event.thread_ts || event.ts;
      const history = await threadMessages(token, channel, threadTs);
      const messages: ChatMessage[] = history.length
        ? history
        : [{ role: 'user', content: stripMentions(event.text ?? '') }];
      const reply = await callClaude(messages);
      const sent = await slackPost('chat.postMessage', token, { channel, thread_ts: threadTs, text: reply });
      await dbg({
        stage: 'processed',
        channel,
        replyLen: reply.length,
        postOk: sent.ok,
        postError: (sent as { error?: string }).error ?? null,
        hasToken: Boolean(token),
      });
    } else {
      await dbg({ stage: 'skipped', eventType: event?.type, hasToken: Boolean(token), botId: event?.bot_id ?? null });
    }
  } catch (error) {
    await dbg({ stage: 'error', message: String(error) });
  }

  return new Response('ok');
}
