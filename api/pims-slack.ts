// PIMS 회의실 슬랙 봇 — 슬래시 커맨드 `/회의실 [날짜]` → 해당 날짜 빈 회의실 조회.
// 토큰은 Supabase Storage(pims/session.json)에 리프레셔가 저장해둔 걸 읽어 씀.
//
// Vercel 환경변수: SLACK_SIGNING_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Socket Mode OFF, Slash Commands 에 /회의실 → 이 URL 등록.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';

const PIMS = 'https://npims.skax.co.kr/api/pms';
const PROJECT = '661';
const OPEN = 9 * 60, CLOSE = 18 * 60; // 업무시간 09:00~18:00

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

async function getPimsToken(): Promise<string | null> {
  const url = env('VITE_SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  const res = await fetch(`${url}/storage/v1/object/pims/session.json`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const j = (await res.json().catch(() => null)) as { access_token?: string } | null;
  return j?.access_token ?? null;
}

type Room = { conferenceRoomName?: string; limitNumber?: number; scheduleTimeList?: { startTime?: string; endTime?: string; eventName?: string }[] };

async function viewRooms(token: string, y: number, m: number, d: number): Promise<Room[]> {
  const res = await fetch(`${PIMS}/schedule-management/conference-romm/view/${PROJECT}?year=${y}&month=${m}&day=${d}`, {
    headers: { Authorization: `Bearer ${token}`, 'project-uid': PROJECT },
  });
  const j = (await res.json().catch(() => null)) as { data?: Room[] } | null;
  return Array.isArray(j?.data) ? j!.data! : [];
}

function parseDate(text: string): { y: number; m: number; d: number } {
  const t = (text || '').trim();
  const now = new Date();
  if (/내일/.test(t)) { const x = new Date(now.getTime() + 86400000); return { y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate() }; }
  const md = t.match(/(\d{1,2})\s*[/월.\-]\s*(\d{1,2})/);
  if (md) return { y: now.getFullYear(), m: Number(md[1]), d: Number(md[2]) };
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

const toMin = (hhmm: string) => { const [h, mi] = hhmm.split(':').map(Number); return h * 60 + mi; };
const fromMin = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;

function freeSlots(bookings: { s: string; e: string }[]): string[] {
  const busy = bookings.map((b) => [toMin(b.s), toMin(b.e)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = []; let cur = OPEN;
  for (const [s, e] of busy) { if (s > cur) free.push([cur, Math.min(s, CLOSE)]); cur = Math.max(cur, e); if (cur >= CLOSE) break; }
  if (cur < CLOSE) free.push([cur, CLOSE]);
  return free.filter(([s, e]) => e > s).map(([s, e]) => `${fromMin(s)}~${fromMin(e)}`);
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];

function format(rooms: Room[], y: number, m: number, d: number): string {
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const wd = WD[new Date(y, m - 1, d).getDay()];
  if (!rooms.length) return `${date} 회의실 정보를 못 가져왔어요. (토큰 만료면 리프레셔 확인)`;
  let out = `📅 *${date} (${wd}) 회의실 현황*  _09:00~18:00_`;
  for (const r of rooms) {
    const bookings = (r.scheduleTimeList || [])
      .filter((s) => s.startTime && s.endTime)
      .map((s) => ({ s: s.startTime!.slice(11, 16), e: s.endTime!.slice(11, 16), name: s.eventName || '' }))
      .sort((a, b) => toMin(a.s) - toMin(b.s));
    const free = freeSlots(bookings);
    out += `\n\n*${r.conferenceRoomName}*  ·  정원 ${r.limitNumber}명`;
    out += `\n🟢 *예약 가능*  ${free.length ? free.join('   |   ') : '없음 (종일 예약)'}`;
    if (bookings.length) {
      out += `\n🔴 예약됨`;
      for (const b of bookings) out += `\n      • ${b.s}~${b.e}  ${b.name}`;
    }
  }
  return out;
}

async function post(url: string, text: string): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'ephemeral', text }),
  }).catch(() => {});
}

async function handle(text: string, responseUrl: string): Promise<void> {
  const { y, m, d } = parseDate(text);
  const token = await getPimsToken();
  if (!token) { await post(responseUrl, '⚠️ PIMS 토큰이 없어요. 리프레셔가 돌고 있는지 확인해주세요.'); return; }
  const rooms = await viewRooms(token, y, m, d);
  await post(responseUrl, format(rooms, y, m, d));
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const ts = request.headers.get('x-slack-request-timestamp');
  const sig = request.headers.get('x-slack-signature');
  if (!verifySignature(raw, ts, sig)) return new Response('bad signature', { status: 401 });

  const params = new URLSearchParams(raw);
  const text = params.get('text') ?? '';
  const responseUrl = params.get('response_url') ?? '';
  if (responseUrl) waitUntil(handle(text, responseUrl));
  return Response.json({ response_type: 'ephemeral', text: '🔎 회의실 조회 중…' });
}
