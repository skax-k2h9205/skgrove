// 서버측 인증 — 비밀번호 검증·변경·초기화를 한곳에서 처리한다.
//
// 왜 서버로 옮겼나: 이 앱은 공개 anon 키로 accounts 를 직접 쓸 수 있어, 누구나 남의
// password_hash 를 덮어써 로그인할 수 있었다(치명적). auth-security.sql 로 anon 의
// password_hash 쓰기 권한을 회수했고, 이제 그 컬럼은 오직 이 함수만 만진다 —
// service_role 키로 RLS·컬럼권한을 우회한다. **service_role 키는 절대 클라이언트로
// 나가면 안 된다.** 이 파일은 서버(Vercel 함수)에서만 돈다.
//
// 규격: POST /api/auth  { action, ... }
//   login          { email, password }                 → { ok, user?, mustChange? }
//   set-password   { email, currentPassword, newPassword } → { ok }
//   reset-request  { email }                            → { ok }  (존재 여부 노출 안 함)
//   reset-confirm  { email, code, newPassword }         → { ok }
import { pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const MIN_PASSWORD = 6;
const CODE_TTL_MIN = 5;
const MAX_ATTEMPTS = 5;

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

// ── PBKDF2: 웹(Web Crypto)이 만든 기존 해시와 **바이트 단위로 호환**된다.
//   형식 pbkdf2$<iter>$<saltB64>$<hashB64>. 기존 123123 해시가 그대로 검증된다.
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, 'sha256');
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iter = Number(parts[1]);
  if (!Number.isFinite(iter) || iter <= 0) return false;
  const want = Buffer.from(parts[3], 'base64');
  const got = pbkdf2Sync(password, Buffer.from(parts[2], 'base64'), iter, want.length, 'sha256');
  return got.length === want.length && timingSafeEqual(got, want);
}

// 인증번호도 해시로만 저장한다(테이블이 새도 대입을 늦추려고 salt+pbkdf2).
function hashCode(code: string, salt: Buffer): string {
  return pbkdf2Sync(code, salt, 50_000, 32, 'sha256').toString('base64');
}

// ── Supabase REST (service_role) ─────────────────────────────────
function sb() {
  const url = env('SUPABASE_URL') || 'https://sjymcpjbmsqapsptvlml.supabase.co';
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) return null;
  const base = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  return {
    async get<T>(path: string): Promise<T[]> {
      const res = await fetch(`${base}/${path}`, { headers });
      return res.ok ? ((await res.json()) as T[]) : [];
    },
    async patch(path: string, body: unknown): Promise<boolean> {
      const res = await fetch(`${base}/${path}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });
      return res.ok;
    },
    async upsert(path: string, body: unknown): Promise<boolean> {
      const res = await fetch(`${base}/${path}`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body),
      });
      return res.ok;
    },
    async del(path: string): Promise<boolean> {
      const res = await fetch(`${base}/${path}`, { method: 'DELETE', headers });
      return res.ok;
    },
  };
}

type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  part: string;
  status: string;
  photo_url: string | null;
  is_connectioner: boolean | null;
  password_hash: string | null;
  must_change_password: boolean | null;
};

const enc = (s: string) => encodeURIComponent(s);

async function fetchAccount(db: NonNullable<ReturnType<typeof sb>>, email: string) {
  const rows = await db.get<AccountRow>(`accounts?email=eq.${enc(email.toLowerCase())}&limit=1`);
  return rows[0];
}

// 로그인 응답에는 해시를 절대 담지 않는다. 클라이언트가 쓰는 필드만 추린다.
function publicUser(a: AccountRow) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    part: a.part,
    status: a.status,
    photoUrl: a.photo_url ?? undefined,
    isConnectioner: Boolean(a.is_connectioner),
  };
}

// ── Slack DM (notify.ts 와 같은 경로) ────────────────────────────
async function slackDm(email: string, code: string): Promise<boolean> {
  const token = env('SLACK_BOT_TOKEN');
  if (!token) return false;
  const api = 'https://slack.com/api';
  const get = async (m: string, p: Record<string, string>) =>
    (await (await fetch(`${api}/${m}?${new URLSearchParams(p)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()) as { ok: boolean; user?: { id: string }; channel?: { id: string }; error?: string };
  const post = async (m: string, b: Record<string, unknown>) =>
    (await (await fetch(`${api}/${m}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
      body: JSON.stringify(b),
    })).json()) as { ok: boolean; channel?: { id: string }; error?: string };

  const lookup = await get('users.lookupByEmail', { email });
  if (!lookup.ok || !lookup.user) return false;
  const opened = await post('conversations.open', { users: lookup.user.id });
  if (!opened.ok || !opened.channel) return false;
  const sent = await post('chat.postMessage', {
    channel: opened.channel.id,
    text: `SKonnection 비밀번호 초기화 인증번호: ${code}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🔐 비밀번호 초기화', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: `인증번호  *${code}*` } },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `${CODE_TTL_MIN}분 안에 입력하세요. 요청한 적이 없다면 무시하셔도 됩니다.` }],
      },
    ],
  });
  return sent.ok;
}

const ok = (extra: Record<string, unknown> = {}) => Response.json({ ok: true, ...extra });
const fail = (reason: string, status = 200) => Response.json({ ok: false, reason }, { status });

// Vercel Node 함수는 기본 export 를 (req,res) 로 취급해 반환 Response 를 버린다.
// named export(POST)로 Web API 시그니처를 쓴다(api/chat.ts·notify.ts 와 동일).
export async function POST(request: Request): Promise<Response> {
  const db = sb();
  if (!db) return fail('SUPABASE_SERVICE_ROLE_KEY not configured');

  let body: Record<string, string>;
  try {
    body = (await request.json()) as Record<string, string>;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const action = body.action;
  const email = (body.email ?? '').trim().toLowerCase();

  // ── 로그인 ──
  if (action === 'login') {
    const account = await fetchAccount(db, email);
    // 계정 없음/비번 틀림을 같은 메시지로 — 어느 이메일이 가입돼 있는지 노출하지 않는다.
    if (!account || !verifyPassword(body.password ?? '', account.password_hash)) {
      return fail('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    return ok({ user: publicUser(account), mustChange: Boolean(account.must_change_password) });
  }

  // ── 비번 변경(현재 비번 확인 필요) ── 첫 로그인 강제 변경도 이 경로를 쓴다.
  if (action === 'set-password') {
    const account = await fetchAccount(db, email);
    if (!account || !verifyPassword(body.currentPassword ?? '', account.password_hash)) {
      return fail('현재 비밀번호가 올바르지 않습니다.');
    }
    const next = body.newPassword ?? '';
    if (next.length < MIN_PASSWORD) return fail(`새 비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`);
    if (verifyPassword(next, account.password_hash)) return fail('이전과 다른 비밀번호로 정해주세요.');
    const done = await db.patch(`accounts?id=eq.${enc(account.id)}`, {
      password_hash: hashPassword(next),
      must_change_password: false,
      updated_at: new Date().toISOString(),
    });
    return done ? ok() : fail('변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }

  // ── 초기화 요청: 인증번호를 슬랙 DM 으로 ──
  if (action === 'reset-request') {
    const account = await fetchAccount(db, email);
    // 계정이 없어도 ok 를 돌려준다 — 어느 이메일이 있는지 캐내지 못하게.
    if (account) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const salt = randomBytes(16);
      // salt 를 code_hash 안에 함께 담는다(형식: <saltB64>:<hashB64>).
      const stored = `${salt.toString('base64')}:${hashCode(code, salt)}`;
      const expires = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
      await db.upsert('password_resets?on_conflict=email', {
        email,
        code_hash: stored,
        expires_at: expires,
        attempts: 0,
        created_at: new Date().toISOString(),
      });
      // 슬랙 DM 실패해도 ok — 존재 여부·발송 결과를 알려주지 않는다(계정 열거 방지).
      await slackDm(account.email, code);
    }
    return ok();
  }

  // ── 초기화 확인: 인증번호 + 새 비번 ──
  if (action === 'reset-confirm') {
    const rows = await db.get<{ code_hash: string; expires_at: string; attempts: number }>(
      `password_resets?email=eq.${enc(email)}&limit=1`,
    );
    const row = rows[0];
    if (!row) return fail('인증번호를 먼저 요청해 주세요.');
    if (row.attempts >= MAX_ATTEMPTS) {
      await db.del(`password_resets?email=eq.${enc(email)}`);
      return fail('시도 횟수를 초과했어요. 처음부터 다시 요청해 주세요.');
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await db.del(`password_resets?email=eq.${enc(email)}`);
      return fail('인증번호가 만료됐어요. 다시 요청해 주세요.');
    }
    const [saltB64, wantB64] = row.code_hash.split(':');
    const gotB64 = hashCode(body.code ?? '', Buffer.from(saltB64, 'base64'));
    const match =
      gotB64.length === (wantB64 ?? '').length &&
      timingSafeEqual(Buffer.from(gotB64), Buffer.from(wantB64));
    if (!match) {
      await db.patch(`password_resets?email=eq.${enc(email)}`, { attempts: row.attempts + 1 });
      return fail('인증번호가 올바르지 않습니다.');
    }
    const next = body.newPassword ?? '';
    if (next.length < MIN_PASSWORD) return fail(`새 비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`);
    const account = await fetchAccount(db, email);
    if (!account) return fail('계정을 찾을 수 없어요.');
    const done = await db.patch(`accounts?id=eq.${enc(account.id)}`, {
      password_hash: hashPassword(next),
      must_change_password: false,
      updated_at: new Date().toISOString(),
    });
    if (!done) return fail('변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
    await db.del(`password_resets?email=eq.${enc(email)}`);
    return ok();
  }

  return fail('알 수 없는 요청입니다.', 400);
}
