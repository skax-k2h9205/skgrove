// 로컬 슬랙 프록시 (테스트용) — api/notify.ts와 동일 로직 + 브라우저 CORS 허용.
// 실행: node scripts/notify-proxy.mjs   (설정은 .env.notify.local 에서 읽음, Node 18+ 필요)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// .env.notify.local 로드 (KEY=VALUE 단순 파서)
const env = {};
try {
  const text = readFileSync(new URL('../.env.notify.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch {
  console.warn('⚠️  .env.notify.local 없음 — 슬랙 전송 휴면(프론트는 인앱만). 설정: cp .env.notify.example .env.notify.local');
}

const PORT = Number(env.PORT || 8787);
const TOKEN = env.SLACK_BOT_TOKEN;
const APP_BASE_URL = env.APP_BASE_URL; // 있으면 알림에 화면 진입 링크를 붙인다.
const SLACK = 'https://slack.com/api';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function slackPost(method, body) {
  const res = await fetch(`${SLACK}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  return res.json();
}
async function slackGet(method, params) {
  const res = await fetch(`${SLACK}/${method}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  return res.json();
}
const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(obj));
};

// 종류별: 이모지·헤더 + 커넥셔너/팀이 취할 다음 액션 안내(cta) + 이동할 화면(hash·버튼 문구).
const KIND_META = {
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

function link(hash, label) {
  if (!APP_BASE_URL || !hash) return '';
  return `👉 <${APP_BASE_URL.replace(/\/+$/, '')}/${hash}|${label}>`;
}

// 슬랙 메시지를 Block Kit으로 구성: 헤더(종류) + 제목(굵게) + 내용 + 안내/링크.
// 시스템 알림엔 '보낸이'를 생략하고, 사람이 보낸 DM에만 표시한다.
function buildMessage(kind, title, text, from) {
  const meta = KIND_META[kind] || { emoji: '🔔', label: '알림', cta: '', hash: '', button: '' };
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
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `${meta.emoji} ${meta.label}`, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: `티미팅 세션 제안이 접수되었습니다.\n\n${list}` } },
    ];
    if (guide) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: guide } });
    return { text: '티미팅 세션 제안 접수', blocks };
  }
  // 그 외: "새 안건 · {항목}" → " · " 뒤 항목만 제목으로.
  const headline = title.split(' · ').slice(1).join(' · ') || title;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `${meta.emoji} ${meta.label}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `*${headline}*` } },
  ];
  if (text) blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
  if (guide) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: guide } });
  return { text: `${meta.label}: ${headline}`, blocks };
}

// 종류별 좌측 색 바(인앱 색과 통일).
const KIND_COLOR = {
  agenda: '#2f58b5',
  deadline: '#d9822b',
  tea: '#7a5230',
  issue: '#1f7a52',
  action: '#2b7a5b',
  message: '#6b46b5',
};
const colorForKind = (kind) => KIND_COLOR[kind] || '#17352f';

// blocks를 좌측 색 바 attachment로 감싼 카드. fallback은 푸시 알림용(채널엔 안 보임) → 카드 위 첫 줄 없음.
const card = (color, msg) => ({ attachments: [{ color, fallback: msg.text, blocks: msg.blocks }] });

// 공지문 → 헤더 + 세션정보 + 구분선 + 그룹 카드(다크그린 바).
function announceCard(text) {
  const [head, ...rest] = text.split('\n\n');
  const headLines = head.split('\n');
  const title = (headLines[0] || '이번 티미팅 안내').replace(/\*/g, '');
  const sessionInfo = headLines.slice(1).join('\n');
  const groups = rest.join('\n\n');
  const blocks = [{ type: 'header', text: { type: 'plain_text', text: title, emoji: true } }];
  if (sessionInfo) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: sessionInfo } });
  if (groups) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: groups } });
  }
  return { attachments: [{ color: '#17352f', fallback: '이번 티미팅 안내', blocks }] };
}

export function handleNotify(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { ok: false, reason: 'method' });
    return;
  }
  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', async () => {
    if (!TOKEN) {
      send(res, 200, { ok: false, reason: 'SLACK_BOT_TOKEN 미설정' });
      return;
    }
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      send(res, 400, { ok: false, reason: 'bad json' });
      return;
    }
    const msg = buildMessage(p.kind, p.title || '', p.text || '', p.from || '시스템');
    try {
      // 티미팅 공지문: 완성된 안내문을 채널에 그대로 게시.
      if (p.announce) {
        const channelId = p.channel === 'team' ? env.SLACK_CHANNEL_TEAM : env.SLACK_CHANNEL_CONNECTOR;
        if (!channelId) {
          send(res, 200, { ok: false, reason: `channel id 미설정 (${p.channel})` });
          return;
        }
        const sent = await slackPost('chat.postMessage', { channel: channelId, ...announceCard(p.text || '') });
        console.log(`[announce ${p.channel}] →`, sent.ok ? 'OK' : sent.error);
        send(res, 200, { ok: sent.ok, reason: sent.error });
        return;
      }
      if (p.dm) {
        if (env.SLACK_DM_ENABLED !== 'true') {
          send(res, 200, { ok: false, reason: 'DM disabled' });
          return;
        }
        const look = await slackGet('users.lookupByEmail', { email: p.recipientEmail || '' });
        if (!look.ok) {
          send(res, 200, { ok: false, reason: `lookup ${look.error}` });
          return;
        }
        const open = await slackPost('conversations.open', { users: look.user.id });
        const sent = await slackPost('chat.postMessage', {
          channel: open.channel.id,
          ...card(colorForKind(p.kind), msg),
        });
        console.log('DM →', p.recipientEmail, sent.ok ? 'OK' : sent.error);
        send(res, 200, { ok: sent.ok, reason: sent.error });
        return;
      }
      const channelId = p.channel === 'team' ? env.SLACK_CHANNEL_TEAM : env.SLACK_CHANNEL_CONNECTOR;
      if (!channelId) {
        send(res, 200, { ok: false, reason: `channel id 미설정 (${p.channel})` });
        return;
      }
      const sent = await slackPost('chat.postMessage', { channel: channelId, ...card(colorForKind(p.kind), msg) });
      console.log(`[${p.channel}] ${p.title} →`, sent.ok ? 'OK' : sent.error);
      send(res, 200, { ok: sent.ok, reason: sent.error });
    } catch (error) {
      send(res, 502, { ok: false, reason: String(error) });
    }
  });
}

// 단독 실행일 때만 서버를 띄운다(통합 실행 시엔 import 만).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  createServer(handleNotify).listen(PORT, () => {
    console.log(`🔔 notify-proxy 실행 중 → http://127.0.0.1:${PORT}/api/notify`);
  });
}
