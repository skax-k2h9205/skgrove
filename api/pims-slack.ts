// PIMS 회의실 슬랙 봇.
//   /회의실 [날짜]       → 빈시간 조회(ephemeral)
//   /회의실예약          → 예약 모달 팝업 → 제출 시 PIMS 예약
// 토큰은 Supabase Storage(pims/session.json)에 리프레셔가 저장한 걸 읽어 씀.
//
// Vercel env: SLACK_SIGNING_SECRET, SLACK_BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Slack 설정: Socket Mode OFF / Slash Commands(/회의실, /회의실예약)·Interactivity Request URL = 이 라우트.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';

const PIMS = 'https://npims.skax.co.kr/api/pms';
const PROJECT = '661';
const MENU = 45164;
const OPEN = 9 * 60, CLOSE = 18 * 60;
const SLACK = 'https://slack.com/api';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function verifySignature(raw: string, ts: string | null, sig: string | null): boolean {
  const secret = env('SLACK_SIGNING_SECRET');
  if (!secret || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const mac = 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex');
  try { return timingSafeEqual(Buffer.from(mac), Buffer.from(sig)); } catch { return false; }
}

const toMin = (hhmm: string) => { const [h, mi] = hhmm.split(':').map(Number); return h * 60 + mi; };
const fromMin = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;

// ── PIMS ──
async function getPimsToken(): Promise<string | null> {
  const url = env('VITE_SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  const res = await fetch(`${url}/storage/v1/object/pims/session.json`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  const j = (await res.json().catch(() => null)) as { access_token?: string } | null;
  return j?.access_token ?? null;
}

type Room = { conferenceRoomManagementUid?: number; conferenceRoomName?: string; limitNumber?: number; scheduleTimeList?: { startTime?: string; endTime?: string; eventName?: string }[] };
type PimsUser = { projectUserUid?: number; userId?: string; nickName?: string };

async function viewRooms(token: string, y: number, m: number, d: number): Promise<Room[]> {
  const res = await fetch(`${PIMS}/schedule-management/conference-romm/view/${PROJECT}?year=${y}&month=${m}&day=${d}`, { headers: { Authorization: `Bearer ${token}`, 'project-uid': PROJECT } });
  const j = (await res.json().catch(() => null)) as { data?: Room[] } | null;
  return Array.isArray(j?.data) ? j!.data! : [];
}

async function fetchUsers(token: string): Promise<PimsUser[]> {
  const res = await fetch(`${PIMS}/${PROJECT}/projects/users/list/id`, { headers: { Authorization: `Bearer ${token}`, 'project-uid': PROJECT } });
  const j = (await res.json().catch(() => null)) as PimsUser[] | { data?: PimsUser[] } | null;
  const arr = Array.isArray(j) ? j : j?.data;
  return Array.isArray(arr) ? arr : [];
}

async function pimsCreate(token: string, p: { roomUid: number; startTime: string; endTime: string; title: string; users: number[] }): Promise<number> {
  const body = {
    projectUid: Number(PROJECT), eventName: p.title, eventTypeCode: 'SCHEDULE',
    startTime: p.startTime, endTime: p.endTime, conferenceRoomManagementUid: p.roomUid,
    isAllDayEvent: false, isRepeatEvent: false, menuUid: MENU, repeatEvents: [], eventCode: null,
    projectUsers: p.users, authorityGroups: [],
  };
  const res = await fetch(`${PIMS}/schedule-management/create`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'project-uid': PROJECT }, body: JSON.stringify(body) });
  return res.status;
}

// ── Slack ──
async function slackApi(method: string, body: Record<string, unknown>): Promise<{ ok?: boolean }> {
  const token = env('SLACK_BOT_TOKEN');
  const res = await fetch(`${SLACK}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean };
}

async function ephemeral(responseUrl: string, text: string): Promise<void> {
  await fetch(responseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response_type: 'ephemeral', text }) }).catch(() => {});
}

// ── 조회 포맷 ──
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function freeSlots(bookings: { s: string; e: string }[]): string[] {
  const busy = bookings.map((b) => [toMin(b.s), toMin(b.e)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = []; let cur = OPEN;
  for (const [s, e] of busy) { if (s > cur) free.push([cur, Math.min(s, CLOSE)]); cur = Math.max(cur, e); if (cur >= CLOSE) break; }
  if (cur < CLOSE) free.push([cur, CLOSE]);
  return free.filter(([s, e]) => e > s).map(([s, e]) => `${fromMin(s)}~${fromMin(e)}`);
}
function parseDate(text: string): { y: number; m: number; d: number } {
  const t = (text || '').trim(); const now = new Date();
  if (/내일/.test(t)) { const x = new Date(now.getTime() + 86400000); return { y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate() }; }
  const md = t.match(/(\d{1,2})\s*[/월.\-]\s*(\d{1,2})/);
  if (md) return { y: now.getFullYear(), m: Number(md[1]), d: Number(md[2]) };
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}
function formatView(rooms: Room[], y: number, m: number, d: number): string {
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const wd = WD[new Date(y, m - 1, d).getDay()];
  if (!rooms.length) return `${date} 회의실 정보를 못 가져왔어요. (토큰 만료면 리프레셔 확인)`;
  let out = `📅 *${date} (${wd}) 회의실 현황*  _09:00~18:00_`;
  for (const r of rooms) {
    const bk = (r.scheduleTimeList || []).filter((s) => s.startTime && s.endTime).map((s) => ({ s: s.startTime!.slice(11, 16), e: s.endTime!.slice(11, 16), name: s.eventName || '' })).sort((a, b) => toMin(a.s) - toMin(b.s));
    const free = freeSlots(bk);
    out += `\n\n*${r.conferenceRoomName}*  ·  정원 ${r.limitNumber}명`;
    out += `\n🟢 *예약 가능*  ${free.length ? free.join('   |   ') : '없음 (종일 예약)'}`;
    if (bk.length) { out += `\n🔴 예약됨`; for (const b of bk) out += `\n      • ${b.s}~${b.e}  ${b.name}`; }
  }
  return out;
}

// ── 예약 모달 ──
function timeOptions() {
  const opts = [];
  for (let mm = OPEN; mm <= CLOSE; mm += 30) { const t = fromMin(mm); opts.push({ text: { type: 'plain_text', text: t }, value: t }); }
  return opts;
}
function buildModal(rooms: Room[], users: PimsUser[], channelId: string) {
  const roomOpts = rooms.map((r) => ({ text: { type: 'plain_text', text: `${r.conferenceRoomName} (정원 ${r.limitNumber})` }, value: String(r.conferenceRoomManagementUid) }));
  const userOpts = users.map((u) => ({ text: { type: 'plain_text', text: `${u.nickName} (${u.userId})` }, value: String(u.projectUserUid) }));
  const durOpts = [['30분', '30'], ['1시간', '60'], ['1시간 30분', '90'], ['2시간', '120']].map(([t, v]) => ({ text: { type: 'plain_text', text: t }, value: v }));
  const today = new Date().toISOString().slice(0, 10);
  const t14 = { text: { type: 'plain_text', text: '14:00' }, value: '14:00' };
  return {
    type: 'modal', callback_id: 'pims_book', private_metadata: channelId,
    title: { type: 'plain_text', text: '회의실 예약' },
    submit: { type: 'plain_text', text: '예약하기' }, close: { type: 'plain_text', text: '취소' },
    blocks: [
      { type: 'input', block_id: 'date', label: { type: 'plain_text', text: '날짜' }, element: { type: 'datepicker', action_id: 'v', initial_date: today } },
      { type: 'input', block_id: 'start', label: { type: 'plain_text', text: '시작 시간' }, element: { type: 'static_select', action_id: 'v', options: timeOptions(), initial_option: t14 } },
      { type: 'input', block_id: 'dur', label: { type: 'plain_text', text: '길이' }, element: { type: 'static_select', action_id: 'v', options: durOpts, initial_option: durOpts[1] } },
      { type: 'input', block_id: 'room', label: { type: 'plain_text', text: '회의실' }, element: { type: 'static_select', action_id: 'v', options: roomOpts, ...(roomOpts[0] ? { initial_option: roomOpts[0] } : {}) } },
      { type: 'input', block_id: 'users', label: { type: 'plain_text', text: '참석자 (예약자로 등록됨)' }, element: { type: 'multi_static_select', action_id: 'v', options: userOpts } },
      { type: 'input', block_id: 'title', label: { type: 'plain_text', text: '제목' }, element: { type: 'plain_text_input', action_id: 'v', initial_value: '회의' } },
    ],
  };
}

async function openBookingModal(triggerId: string, channelId: string): Promise<Response> {
  const token = await getPimsToken();
  if (!token) return Response.json({ response_type: 'ephemeral', text: '⚠️ PIMS 토큰이 없어요. 리프레셔 확인.' });
  const now = new Date();
  const [rooms, users] = await Promise.all([viewRooms(token, now.getFullYear(), now.getMonth() + 1, now.getDate()), fetchUsers(token)]);
  await slackApi('views.open', { trigger_id: triggerId, view: buildModal(rooms, users, channelId) });
  return new Response('');
}

// ── 모달 제출 처리 ──
type Sub = { type?: string; user?: { id?: string }; view?: { private_metadata?: string; state?: { values?: Record<string, Record<string, { selected_date?: string; selected_option?: { value?: string }; selected_options?: { value?: string }[]; value?: string }>> } } };
async function handleSubmission(payload: Sub): Promise<Response> {
  if (payload.type !== 'view_submission') return new Response('');
  const v = payload.view?.state?.values || {};
  const date = v.date?.v?.selected_date || '';
  const start = v.start?.v?.selected_option?.value || '';
  const dur = Number(v.dur?.v?.selected_option?.value || '60');
  const roomUid = Number(v.room?.v?.selected_option?.value || '0');
  const users = (v.users?.v?.selected_options || []).map((o) => Number(o.value)).filter(Boolean);
  const title = (v.title?.v?.value || '회의').trim();
  const channelId = payload.view?.private_metadata || '';
  const userId = payload.user?.id || '';

  if (!users.length) return Response.json({ response_action: 'errors', errors: { users: '참석자를 1명 이상 선택하세요.' } });
  if (!date || !start || !roomUid) return Response.json({ response_action: 'errors', errors: { date: '날짜·시간·회의실을 확인하세요.' } });

  const endMin = toMin(start) + dur;
  const startTime = `${date}T${start}:00.000Z`;
  const endTime = `${date}T${fromMin(endMin)}:00.000Z`;

  const token = await getPimsToken();
  if (!token) return Response.json({ response_action: 'errors', errors: { title: 'PIMS 토큰이 없어요. 리프레셔 확인.' } });

  const status = await pimsCreate(token, { roomUid, startTime, endTime, title, users });
  if (status === 201) {
    const who = userId ? `<@${userId}> ` : '';
    const msg = `✅ ${who}회의실 예약 완료 — *${date} ${start}~${fromMin(endMin)}* · ${title}`;
    // 실행한 채널/DM 에 게시. 봇이 없는 채널이면 실패하니 본인 DM 으로 폴백.
    const r = channelId ? await slackApi('chat.postMessage', { channel: channelId, text: msg }) : { ok: false };
    if (!r.ok && userId) await slackApi('chat.postMessage', { channel: userId, text: msg });
    return Response.json({ response_action: 'clear' });
  }
  if (status === 409) return Response.json({ response_action: 'errors', errors: { start: '그 시간엔 이미 예약이 있어요. 다른 시간을 선택하세요.' } });
  return Response.json({ response_action: 'errors', errors: { title: `예약 실패 (status ${status})` } });
}

// ── 진입점 ──
async function handleView(text: string, responseUrl: string): Promise<void> {
  const { y, m, d } = parseDate(text);
  const token = await getPimsToken();
  if (!token) { await ephemeral(responseUrl, '⚠️ PIMS 토큰이 없어요. 리프레셔가 돌고 있는지 확인해주세요.'); return; }
  const rooms = await viewRooms(token, y, m, d);
  await ephemeral(responseUrl, formatView(rooms, y, m, d));
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-slack-request-timestamp'), request.headers.get('x-slack-signature'))) {
    return new Response('bad signature', { status: 401 });
  }
  const params = new URLSearchParams(raw);

  // 대화형(모달 제출/버튼) — payload= 로 옴
  const payloadRaw = params.get('payload');
  if (payloadRaw) {
    try { return await handleSubmission(JSON.parse(payloadRaw) as Sub); } catch { return new Response(''); }
  }

  // 슬래시 커맨드
  const command = params.get('command') || '';
  if (command.includes('예약')) {
    return openBookingModal(params.get('trigger_id') || '', params.get('channel_id') || '');
  }
  const responseUrl = params.get('response_url') ?? '';
  if (responseUrl) waitUntil(handleView(params.get('text') ?? '', responseUrl));
  return Response.json({ response_type: 'ephemeral', text: '🔎 회의실 조회 중…' });
}
