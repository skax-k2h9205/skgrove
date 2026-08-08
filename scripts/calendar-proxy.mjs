// 로컬 구글 캘린더 읽기 프록시 — OAuth 코드 교환과 일정 조회.
// 단독 실행: node scripts/calendar-proxy.mjs   |   통합 실행: scripts/proxy.mjs 가 /api/calendar 로 라우팅.
// 설정은 .env.calendar.local 에만 존재(.local 은 git 제외). Node 18+.
//
// 이 파일의 동작은 api/calendar/ 의 세 파일과 같아야 한다. 런타임(서버리스 TS vs 로컬 Node .mjs)이
// 달라 공유 모듈로 묶기 어려워 두 벌을 유지한다 — 수정 시 함께 고칠 것.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const env = {};
try {
  const text = readFileSync(new URL('../.env.calendar.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch {
  console.warn('⚠️  .env.calendar.local 없음 — 캘린더 연동 휴면. 설정: cp .env.calendar.example .env.calendar.local');
}

const PORT = Number(env.CALENDAR_PORT || 8790);
const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = env.GOOGLE_REDIRECT_URI;
const APP_ORIGIN = env.CALENDAR_ALLOWED_ORIGIN || 'http://127.0.0.1:5173';

// 읽기 전용 스코프만 요청한다. 캘린더에 쓰지 않는다.
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// 읽을 캘린더. GOOGLE_CALENDAR_ID 가 없으면 접속 계정의 기본 캘린더를 읽는다.
const eventsUrl = (id) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id || 'primary')}/events`;

// 토큰이 오가는 경로다. '*' 로 열지 않고 설정된 오리진만 허용한다.
const CORS = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const configured = () => Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);

/** 구글 일정 → 프론트가 먹는 원시 형태. 필요한 것만 남긴다. */
export function normalizeEvents(items) {
  return (items || [])
    // 취소된 일정은 열리지 않은 회의다. 회의 시간에 넣으면 안 된다.
    .filter((item) => item.status !== 'cancelled')
    .filter((item) => Boolean(item.id))
    .map((item) => ({
      id: String(item.id),
      title: (item.summary || '').trim() || '(제목 없음)',
      startsAt: item.start?.dateTime || item.start?.date || '',
      endsAt: item.end?.dateTime || item.end?.date || '',
      // dateTime 이 없고 date 만 있으면 종일 일정이다.
      isAllDay: !item.start?.dateTime,
      isRecurring: Boolean(item.recurringEventId),
      attendeeEmails: (item.attendees || []).map((a) => a.email).filter(Boolean),
      organizerEmail: item.organizer?.email,
      location: item.location,
      description: item.description,
      // 회의인지 아닌지를 가르는 값들. 프론트가 이걸로 집중 시간·부재중·거절한 초대를 걸러낸다.
      eventType: item.eventType,
      selfResponse: (item.attendees || []).find((a) => a.self)?.responseStatus,
      showsAsBusy: item.transparency !== 'transparent',
    }))
    .filter((event) => event.startsAt && event.endsAt);
}

/** 토큰을 opener 로 넘기고 닫히는 콜백 페이지. postMessage 대상 오리진을 명시한다. */
function callbackPage(payload) {
  const json = JSON.stringify({ type: 'skgrove:calendar', ...payload });
  return `<!doctype html><meta charset="utf-8"><title>Connectioner</title>
<body style="font:14px/1.6 system-ui;padding:24px;color:#1d2522">
<p>연결을 마쳤습니다. 이 창은 곧 닫힙니다.</p>
<script>
  // 대상 오리진을 '*' 로 두면 아무 창이나 토큰을 받아갈 수 있다.
  try { window.opener && window.opener.postMessage(${json}, ${JSON.stringify(APP_ORIGIN)}); } catch (e) {}
  window.close();
</script></body>`;
}

// 통합/단독 공용 요청 핸들러 (/api/calendar).

/** 일회성 설정용. 갱신 토큰을 화면에만 띄운다(opener 로 보내지 않는다). */
function refreshTokenPage(refreshToken) {
  const safe = String(refreshToken).replace(/[<>&]/g, '');
  return `<!doctype html><meta charset="utf-8"><title>Connectioner — 캘린더 설정</title>
<body style="font:14px/1.7 system-ui;padding:32px;max-width:720px;color:#1f2420">
<h2 style="margin:0 0 8px">갱신 토큰을 받았습니다</h2>
<p style="color:#5a5f56;margin:0 0 16px">
  아래 값을 <code>.env.calendar.local</code> 에 넣고 프록시를 다시 띄우세요.<br>
  이 화면을 닫으면 다시 볼 수 없습니다. 이 절차는 <b>한 번만</b> 하면 됩니다.
</p>
<pre style="background:#efece4;padding:16px;border-radius:10px;white-space:pre-wrap;word-break:break-all">GOOGLE_REFRESH_TOKEN=${safe}</pre>
<p style="color:#96502f">이 값은 팀 캘린더를 계속 읽을 수 있는 열쇠입니다. 채팅·이슈에 붙여넣지 마세요.</p>
</body>`;
}

/*
  서버측 조회 — 사용자 동작 없이 갱신 토큰으로 액세스 토큰을 새로 받아 일정을 읽는다.
  액세스 토큰은 1시간짜리라 보관하지 않고 매번 새로 받는다. 보관할 게 없으면 샐 것도 없다.
*/
async function fetchWithRefreshToken(timeMin, timeMax) {
  const refreshToken = env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) return { ok: false, reason: 'no refresh token' };

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const token = await tokenRes.json().catch(() => null);
  if (!token?.access_token) {
    // invalid_grant = 토큰이 죽었다. 테스트 상태 앱의 7일 만료가 가장 흔한 원인이다.
    return { ok: false, reason: token?.error_description || token?.error || 'refresh failed' };
  }

  const query = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  if (timeMin) query.set('timeMin', timeMin);
  if (timeMax) query.set('timeMax', timeMax);
  const res = await fetch(`${eventsUrl(env.GOOGLE_CALENDAR_ID)}?${query}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return { ok: false, reason: data?.error?.message || `google ${res.status}` };
  return { ok: true, events: normalizeEvents(data.items ?? []) };
}

/*
  주기 조회 결과를 담아둔다. 화면은 이 값을 읽으므로 사용자가 기다리지 않는다.
  로컬 프록시라 메모리에 둔다 — 배포(Vercel)에서는 함수가 매번 새로 뜨므로
  Cron 이 Supabase 에 적고 화면이 거기서 읽는 구조로 바꿔야 한다.
*/
const snapshot = { ok: false, reason: 'not synced yet', events: [], syncedAt: null };

/** 앞뒤 90일을 본다. 지난 회의는 지표에, 앞으로의 회의는 예고에 쓴다. */
function syncWindow() {
  const now = Date.now();
  const day = 86400000;
  return { timeMin: new Date(now - 90 * day).toISOString(), timeMax: new Date(now + 90 * day).toISOString() };
}

export async function syncCalendar() {
  if (!configured()) return { ok: false, reason: 'disabled' };
  const { timeMin, timeMax } = syncWindow();
  const result = await fetchWithRefreshToken(timeMin, timeMax);
  snapshot.ok = result.ok;
  snapshot.reason = result.reason ?? null;
  snapshot.events = result.events ?? [];
  snapshot.syncedAt = new Date().toISOString();
  const when = new Date().toLocaleTimeString('ko-KR');
  if (result.ok) console.log(`[calendar] ${when} 동기화 ${result.events.length}건`);
  else console.warn(`[calendar] ${when} 동기화 실패: ${result.reason}`);
  return snapshot;
}

/** 30분마다. 회의 일정은 자주 바뀌지 않아 더 자주 찔러도 얻는 게 없다. */
export const SYNC_INTERVAL_MS = 30 * 60 * 1000;

export function handleCalendar(req, res) {
  const sendJson = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(obj));
  };
  const sendHtml = (body) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const action = url.searchParams.get('action');
  // 리디렉션 목적지는 쿼리 없는 경로다. 쿼리가 든 리디렉션 URI 는 구글 콘솔이 거부하는 경우가 있다.
  const isCallback = url.pathname.endsWith('/calendar/callback');

  if (!configured()) {
    // 설정 미주입 → 휴면. reason 은 반드시 'disabled' 여야 한다.
    // Metrics.tsx 는 이 문자열로만 '기능 없음'과 '호출 실패'를 가른다.
    if (isCallback) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('구글 캘린더 연동이 설정되지 않았습니다.');
      return;
    }
    sendJson(200, { ok: false, reason: 'disabled' });
    return;
  }

  // 1) 동의 화면 주소
  if (action === 'auth' && req.method === 'GET') {
    const consent = new URL(AUTH_URL);
    consent.searchParams.set('client_id', CLIENT_ID);
    consent.searchParams.set('redirect_uri', REDIRECT_URI);
    consent.searchParams.set('response_type', 'code');
    consent.searchParams.set('scope', SCOPE);
    /*
      평소에는 online — 갱신 토큰을 안 받으면 보관할 것도 없고 샐 것도 없다.
      setup=1 일 때만 offline 로 열어 갱신 토큰을 한 번 받는다. 그 토큰을
      환경변수에 넣으면 그 뒤로는 서버가 알아서 조회하고 사람은 다시 개입하지 않는다.
      prompt=consent 가 없으면 두 번째 동의부터 갱신 토큰이 오지 않는다(구글 규칙).
    */
    const setup = url.searchParams.get('setup') === '1';
    consent.searchParams.set('access_type', setup ? 'offline' : 'online');
    if (setup) consent.searchParams.set('prompt', 'consent');
    consent.searchParams.set('include_granted_scopes', 'true');
    sendJson(200, { ok: true, url: consent.toString(), setup });
    return;
  }

  // 2) 코드 → 토큰 교환 후 opener 에 전달
  if (isCallback && req.method === 'GET') {
    const error = url.searchParams.get('error');
    if (error) {
      sendHtml(callbackPage({ error }));
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      sendHtml(callbackPage({ error: 'no code' }));
      return;
    }
    fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
      .then((response) => response.json().catch(() => null))
      .then((data) => {
        if (!data?.access_token) {
          const reason = data?.error_description || data?.error || 'token exchange failed';
          console.error('[calendar] token error:', reason);
          sendHtml(callbackPage({ error: String(reason) }));
          return;
        }
        if (data.refresh_token) {
          // 일회성 설정 흐름. 이 값은 opener 로 보내지 않는다 — 브라우저 스크립트가
          // 만질 수 있는 곳에 장기 자격증명을 두지 않는다. 화면에만 띄워 사람이 옮긴다.
          sendHtml(refreshTokenPage(data.refresh_token));
          return;
        }
        sendHtml(callbackPage({ accessToken: data.access_token }));
      })
      .catch((cause) => {
        console.error('[calendar] token error:', cause);
        sendHtml(callbackPage({ error: String(cause) }));
      });
    return;
  }

  // 3) 일정 조회
  if (action === 'events' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        sendJson(400, { ok: false, reason: 'bad json' });
        return;
      }
      const accessToken = String(payload.accessToken || '').trim();
      if (!accessToken) {
        sendJson(401, { ok: false, reason: 'no token' });
        return;
      }
      const query = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
      if (payload.timeMin) query.set('timeMin', payload.timeMin);
      if (payload.timeMax) query.set('timeMax', payload.timeMax);
      try {
        const upstream = await fetch(`${eventsUrl(env.GOOGLE_CALENDAR_ID)}?${query}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await upstream.json().catch(() => null);
        if (!upstream.ok || !data) {
          const reason = data?.error?.message || `google ${upstream.status}`;
          console.error('[calendar] events error:', reason);
          sendJson(200, { ok: false, reason });
          return;
        }
        sendJson(200, { ok: true, events: normalizeEvents(data.items) });
      } catch (cause) {
        console.error('[calendar] events error:', cause);
        sendJson(200, { ok: false, reason: String(cause) });
      }
    });
    return;
  }

  // 4) 주기 조회 결과 읽기 — 사용자 토큰이 필요 없다. 화면은 이것만 부른다.
  if (action === 'snapshot' && req.method === 'GET') {
    sendJson(200, snapshot);
    return;
  }

  // 5) 지금 당장 한 번 당겨오기(수동 확인용)
  if (action === 'sync' && req.method === 'GET') {
    syncCalendar().then((result) => sendJson(200, result));
    return;
  }

  sendJson(404, { ok: false, reason: 'unknown action' });
}

// 단독 실행일 때만 서버를 띄운다. proxy.mjs 가 import 할 때는 뜨지 않는다.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  createServer(handleCalendar).listen(PORT, () => {
    console.log(`📅 calendar proxy 실행 중 → http://127.0.0.1:${PORT}`);
    console.log(`   • GET  /api/calendar?action=auth`);
    console.log(`   • GET  /api/calendar/callback      ← 구글 콘솔에 등록할 리디렉션 URI`);
    console.log(`   • POST /api/calendar?action=events`);
    if (!configured()) console.log('   ⚠️  설정 미주입 — 휴면 상태');
  });
}
