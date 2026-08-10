// 서버 인증(api/auth) 클라이언트. 서버가 아직 설정되지 않았으면(키 미주입) 조용히
// 클라이언트 검증으로 물러난다 — 키를 넣기 전에도 로그인이 깨지지 않게 하기 위해서다.
//
// 서버가 붙으면: 해시가 클라이언트로 나오지 않고, 비번 변경·초기화가 전부 서버에서 된다.
// 서버가 없으면: 지금까지처럼 브라우저에서 해시를 검증한다(기능 동일, 보안만 약함).
import { hashPassword, verifyPassword } from './passwordHash';
import type { CurrentUser, ManagedAccount } from './types';

// 배포에선 같은 도메인의 /api/auth. 로컬은 VITE_AUTH_ENDPOINT(프록시) 또는 미설정(→폴백).
const ENDPOINT =
  (import.meta.env as Record<string, string | undefined>).VITE_AUTH_ENDPOINT ||
  (import.meta.env.PROD ? '/api/auth' : undefined);

type ServerUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  part: string;
  status: string;
  photoUrl?: string;
  isConnectioner: boolean;
};

async function call(body: Record<string, unknown>): Promise<
  { ok: true; [k: string]: unknown } | { ok: false; reason?: string } | { unavailable: true }
> {
  if (!ENDPOINT) return { unavailable: true };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok: boolean; reason?: string; [k: string]: unknown }
      | null;
    // 키 미주입이면 서버가 이 사유를 준다 → 폴백 신호.
    if (data && !data.ok && data.reason === 'SUPABASE_SERVICE_ROLE_KEY not configured') {
      return { unavailable: true };
    }
    if (!data) return { ok: false, reason: '서버 응답을 읽지 못했어요.' };
    return data as { ok: true } | { ok: false; reason?: string };
  } catch {
    // 네트워크 오류는 폴백하지 않는다 — 진짜 실패로 알린다(무한 폴백 방지).
    return { ok: false, reason: '서버에 연결하지 못했어요.' };
  }
}

const toCurrentUser = (u: ServerUser): CurrentUser => ({
  name: u.name,
  email: u.email,
  role: u.role as CurrentUser['role'],
  part: u.part as CurrentUser['part'],
  connectioner: u.isConnectioner,
});

/** 서버 인증이 실제로 켜져 있는지(키 주입됨). 초기화 UI 노출 여부를 정하는 데 쓴다. */
export async function isServerAuthEnabled(): Promise<boolean> {
  const r = await call({ action: 'ping' });
  // 'ping' 은 서버가 모르는 액션 → 키가 있으면 {ok:false,'알 수 없는 요청'}, 없으면 unavailable.
  return !('unavailable' in r);
}

export type LoginResult =
  | { ok: true; user: CurrentUser; mustChange: boolean }
  | { ok: false; error: string };

/**
 * 로그인. 서버가 있으면 서버에서 해시를 검증하고, 없으면 넘겨받은 account 로 브라우저에서 검증한다.
 * account 는 폴백 전용 — 서버 경로에서는 쓰지 않는다.
 */
export async function login(
  email: string,
  password: string,
  fallbackAccount: ManagedAccount | undefined,
): Promise<LoginResult> {
  const r = await call({ action: 'login', email, password });
  if ('unavailable' in r) {
    // ── 폴백: 클라이언트 검증 ──
    if (!fallbackAccount?.passwordHash) return { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    const ok = await verifyPassword(password, fallbackAccount.passwordHash);
    if (!ok) return { ok: false, error: '비밀번호가 일치하지 않아요.' };
    return {
      ok: true,
      user: {
        name: fallbackAccount.name,
        email: fallbackAccount.email,
        role: fallbackAccount.role,
        part: fallbackAccount.part,
        connectioner: fallbackAccount.connectioner ?? false,
      },
      mustChange: Boolean(fallbackAccount.mustChangePassword),
    };
  }
  if (!r.ok) return { ok: false, error: r.reason ?? '로그인에 실패했어요.' };
  const data = r as unknown as { user: ServerUser; mustChange?: boolean };
  return { ok: true, user: toCurrentUser(data.user), mustChange: Boolean(data.mustChange) };
}

/** 현재 비번 확인 후 새 비번으로. 첫 로그인 강제 변경도 이걸 쓴다. */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
  fallbackSetHash: ((email: string, hash: string) => void) | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const r = await call({ action: 'set-password', email, currentPassword, newPassword });
  if ('unavailable' in r) {
    // 폴백: 브라우저에서 해시 만들어 anon 으로 저장(REVOKE 적용 전에만 동작).
    if (!fallbackSetHash) return { ok: false, error: '비밀번호를 바꿀 수 없어요.' };
    const hash = await hashPassword(newPassword);
    fallbackSetHash(email, hash);
    return { ok: true };
  }
  return r.ok ? { ok: true } : { ok: false, error: r.reason };
}

/** 초기화 인증번호 요청(슬랙 DM). 계정 유무를 노출하지 않으려 항상 성공처럼 응답한다. */
export async function requestReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const r = await call({ action: 'reset-request', email });
  if ('unavailable' in r) return { ok: false, error: '초기화 기능이 아직 설정되지 않았어요. 관리자에게 문의해 주세요.' };
  return r.ok ? { ok: true } : { ok: false, error: r.reason };
}

/** 인증번호 + 새 비번으로 초기화 확정. */
export async function confirmReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await call({ action: 'reset-confirm', email, code, newPassword });
  if ('unavailable' in r) return { ok: false, error: '초기화 기능이 아직 설정되지 않았어요.' };
  return r.ok ? { ok: true } : { ok: false, error: r.reason };
}
