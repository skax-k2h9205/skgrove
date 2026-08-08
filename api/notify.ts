// 슬랙 전송 프록시 — SKSOOP-21, 2단계(봇 Web API).
//
// 프론트(notificationDelivery.ts)는 VITE_NOTIFY_ENDPOINT로 아래 규격을 POST한다:
//   채널: { channel: 'team'|'connector', title, text, from }
//   DM  : { dm: true, recipientEmail, title, text, from }
//
// 서버 환경변수(비밀은 서버에만):
//   SLACK_BOT_TOKEN        : 봇 토큰(xoxb-...). 없으면 전부 휴면(no-op).
//   SLACK_CHANNEL_TEAM     : 팀 전체 채널 ID(C...)
//   SLACK_CHANNEL_CONNECTOR: 커넥셔너 채널 ID(C...)
//   SLACK_DM_ENABLED       : 'true'일 때만 DM 실제 발송. (계정 이메일=슬랙 이메일 보장 전까지 꺼둠)
//
// DM 발송 코드는 완성돼 있으나 SLACK_DM_ENABLED가 켜지고 이메일 매핑이 확인되기 전까지는 동작하지 않는다.
// 양방향(버튼 콜백 등)은 상태 저장 백엔드 확정 후 별도 확장.

type NotifyPayload = {
  channel?: 'team' | 'connector';
  // 시스템 관리 화면에서 설정한 실제 채널 ID. 있으면 이걸로 게시, 없으면 env 폴백.
  channelId?: string;
  dm?: boolean;
  announce?: boolean;
  recipientEmail?: string;
  kind?: string;
  title?: string;
  text?: string;
  from?: string;
};

// 게시할 채널 ID: 프론트가 설정에서 넘긴 channelId 우선, 없으면 서버 env 폴백.
function resolveChannelId(payload: NotifyPayload): string | undefined {
  if (payload.channelId) return payload.channelId;
  return payload.channel === 'team' ? env('SLACK_CHANNEL_TEAM') : env('SLACK_CHANNEL_CONNECTOR');
}

const SLACK_API = 'https://slack.com/api';

// 종류별: 이모지·헤더 + 다음 액션 안내(cta) + 이동할 화면(hash·버튼 문구).
const KIND_META: Record<string, { emoji: string; label: string; cta: string; hash: string; button: string }> = {
  agenda: { emoji: '🗳️', label: '안건 등록', cta: '안건을 확인하고 투표해 주세요.', hash: '#agenda', button: '안건 보러 가기' },
  deadline: { emoji: '⏰', label: '투표 마감 임박', cta: '마감 전에 투표해 주세요.', hash: '#agenda', button: '투표하러 가기' },
  tea: {
    emoji: '☕',
    label: '티미팅 세션 제안',
    cta: '커넥셔너는 아래로 접속해서 제안된 세션의 상태(채택·보류 등)를 정해주세요.',
    hash: '#meetings-tea',
    button: '제안 세션 보러 가기',
  },
  issue: { emoji: '🎋', label: '대나무숲 의견 접수', cta: '리더 관리함에서 의견을 확인해 주세요.', hash: '#leader', button: '의견 확인하기' },
  action: { emoji: '✅', label: '액션아이템', cta: '', hash: '#actions', button: '액션 보러 가기' },
  message: { emoji: '✉️', label: '메시지', cta: '', hash: '', button: '' },
};

function link(hash: string, label: string) {
  const base = env('APP_BASE_URL');
  if (!base || !hash) return '';
  return `👉 <${base.replace(/\/+$/, '')}/${hash}|${label}>`;
}

// 슬랙 메시지를 Block Kit으로 구성: 헤더(종류) + 제목(굵게) + 내용 + 안내/링크.
// 시스템 알림엔 '보낸이'를 생략하고, 사람이 보낸 DM에만 표시한다.
function buildMessage(kind: string, title: string, text: string, from: string) {
  const meta = KIND_META[kind] ?? { emoji: '🔔', label: '알림', cta: '', hash: '', button: '' };
  if (kind === 'message') {
    return {
      text: `메시지: ${text}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `${meta.emoji} 메시지`, emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: text || ' ' } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `보낸이 · ${from}` }] },
      ],
    };
  }
  const guide = [meta.cta, link(meta.hash, meta.button)].filter(Boolean).join('\n');
  // 티미팅 제안: 접수 안내 + 항목별 목록(body가 이미 "- 세션 제목: ..." 형식).
  if (kind === 'tea') {
    // 항목(라벨)만 굵게: "- 세션 제목: X" → "- *세션 제목:* X"
    const list = text
      .split('\n')
      .map((line) => line.replace(/^(-\s)([^:]+):/, '$1*$2:*'))
      .join('\n');
    const blocks: Array<Record<string, unknown>> = [
      { type: 'header', text: { type: 'plain_text', text: `${meta.emoji} ${meta.label}`, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: `티미팅 세션 제안이 접수되었습니다.\n\n${list}` } },
    ];
    if (guide) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: guide } });
    return { text: '티미팅 세션 제안 접수', blocks };
  }
  const headline = title.split(' · ').slice(1).join(' · ') || title;
  const blocks: Array<Record<string, unknown>> = [
    { type: 'header', text: { type: 'plain_text', text: `${meta.emoji} ${meta.label}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `*${headline}*` } },
  ];
  if (text) blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
  if (guide) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: guide } });
  return { text: `${meta.label}: ${headline}`, blocks };
}

// 종류별 좌측 색 바(인앱 색과 통일).
const KIND_COLOR: Record<string, string> = {
  agenda: '#2f58b5',
  deadline: '#d9822b',
  tea: '#7a5230',
  issue: '#1f7a52',
  action: '#2b7a5b',
  message: '#6b46b5',
};
const colorForKind = (kind: string) => KIND_COLOR[kind] ?? '#17352f';

// blocks를 좌측 색 바 attachment로 감싼 카드. fallback은 푸시 알림용(채널엔 안 보임) → 카드 위 첫 줄 없음.
function card(color: string, msg: { text: string; blocks: unknown[] }) {
  return { attachments: [{ color, fallback: msg.text, blocks: msg.blocks }] };
}

// 공지문 → 헤더 + 세션정보 + 구분선 + 그룹 카드(다크그린 바).
function announceCard(text: string) {
  const [head, ...rest] = text.split('\n\n');
  const headLines = head.split('\n');
  const title = (headLines[0] || '이번 티미팅 안내').replace(/\*/g, '');
  const sessionInfo = headLines.slice(1).join('\n');
  const groups = rest.join('\n\n');
  const blocks: Array<Record<string, unknown>> = [
    { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
  ];
  if (sessionInfo) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: sessionInfo } });
  if (groups) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: groups } });
  }
  return { attachments: [{ color: '#17352f', fallback: '이번 티미팅 안내', blocks }] };
}

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

async function slackPost(method: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; channel?: { id: string }; user?: { id: string }; error?: string };
}

async function slackGet(method: string, token: string, params: Record<string, string>) {
  const res = await fetch(`${SLACK_API}/${method}?${new URLSearchParams(params).toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as { ok: boolean; user?: { id: string }; error?: string };
}

// Vercel Node.js 함수는 기본 export를 (req,res)=>void 로 취급해 Response를 그냥 무시한다
// (반환값이 버려져 응답이 안 나가고 300초 뒤 타임아웃). named export(POST)로 Web API 시그니처를 쓴다.
export async function POST(request: Request): Promise<Response> {
  const token = env('SLACK_BOT_TOKEN');
  if (!token) {
    // 봇 토큰 미주입 → 휴면. 프론트는 fire-and-forget이라 조용히 성공 처리.
    return Response.json({ ok: false, reason: 'SLACK_BOT_TOKEN not configured' });
  }

  let payload: NotifyPayload;
  try {
    payload = (await request.json()) as NotifyPayload;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // 빈/무의미한 요청은 슬랙에 아무것도 보내지 않는다. 예전엔 {} 만 보내도 커넥셔너
  // 채널에 빈 '알림' 카드가 게시됐다(배포 점검용 빈 POST 가 실제로 새벽에 채널로 샜다).
  // 보낼 내용이 하나도 없으면 게시 없이 막는다.
  const hasContent =
    payload.announce === true ||
    payload.dm === true ||
    Boolean((payload.title ?? '').trim()) ||
    Boolean((payload.text ?? '').trim());
  if (!hasContent) {
    return Response.json({ ok: false, reason: 'empty payload — nothing to send' });
  }

  const msg = buildMessage(payload.kind ?? '', payload.title ?? '', payload.text ?? '', payload.from ?? '시스템');

  // 티미팅 공지문: 완성된 안내문을 채널에 그대로 게시.
  if (payload.announce) {
    const channelId = resolveChannelId(payload);
    if (!channelId) {
      return Response.json({ ok: false, reason: `channel id not configured for ${payload.channel}` });
    }
    const sent = await slackPost('chat.postMessage', token, { channel: channelId, ...announceCard(payload.text ?? '') });
    return Response.json({ ok: sent.ok, reason: sent.error });
  }

  // 개인 DM: DM 허용 여부는 시스템 관리 화면(dmEnabled)에서 프론트가 결정한다.
  // 서버는 요청이 오면 발송한다(수신자 슬랙 이메일이 등록된 사람만 프론트가 보냄).
  if (payload.dm) {
    if (!payload.recipientEmail) {
      return Response.json({ ok: false, reason: 'no recipientEmail' });
    }
    const lookup = await slackGet('users.lookupByEmail', token, { email: payload.recipientEmail });
    if (!lookup.ok || !lookup.user) {
      return Response.json({ ok: false, reason: `user lookup failed: ${lookup.error ?? 'unknown'}` });
    }
    const opened = await slackPost('conversations.open', token, { users: lookup.user.id });
    if (!opened.ok || !opened.channel) {
      return Response.json({ ok: false, reason: `open dm failed: ${opened.error ?? 'unknown'}` });
    }
    const sent = await slackPost('chat.postMessage', token, {
      channel: opened.channel.id,
      ...card(colorForKind(payload.kind ?? ''), msg),
    });
    return Response.json({ ok: sent.ok, reason: sent.error });
  }

  // 채널 게시
  const channelId = resolveChannelId(payload);
  if (!channelId) {
    return Response.json({ ok: false, reason: `channel id not configured for ${payload.channel}` });
  }
  const sent = await slackPost('chat.postMessage', token, { channel: channelId, ...card(colorForKind(payload.kind ?? ''), msg) });
  return Response.json({ ok: sent.ok, reason: sent.error });
}
