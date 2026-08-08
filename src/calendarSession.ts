// 구글 액세스 토큰을 한 세션 동안 들고 있는 곳.
//
// 왜 있나: 파트지수와 추억이 각자 connectGoogleCalendar() 를 부르면 한 번 앉은 자리에서
// 동의 팝업이 두 번 뜬다. 같은 토큰을 나눠 쓰면 한 번으로 끝난다.
//
// 어디까지만 두나: 자바스크립트 메모리에만 둔다. localStorage·sessionStorage·쿠키
// 어디에도 쓰지 않는다. 탭을 새로고침하면 사라지고 다시 동의를 받는다.
// 저장하지 않으면 XSS 로도 꺼내갈 곳이 없고, 로그아웃 시 지울 것도 남지 않는다.
// 갱신 토큰(refresh token)은 애초에 받지 않는다 — api/calendar 가 access_type=online 이다.
import { connectGoogleCalendar, type CalendarConnectResult } from './googleCalendar';

/**
 * 만료 직전 토큰으로 조회를 시작하면 응답을 받기 전에 죽는다.
 * 이만큼 일찍 만료된 것으로 친다.
 */
export const TOKEN_SAFETY_MARGIN_MS = 60000;

let cached: { accessToken: string; expiresAtMs: number } | null = null;

/**
 * 토큰을 기억한다. expiresIn(초)이 0이면 언제 죽는지 모른다는 뜻이라 기억하지 않는다 —
 * 만료를 모르는 토큰을 재사용하면 조회가 조용히 401 로 실패한다.
 */
export function rememberToken(accessToken: string, expiresIn: number, nowMs = Date.now()) {
  if (!accessToken || !expiresIn || expiresIn <= 0) {
    cached = null;
    return;
  }
  cached = { accessToken, expiresAtMs: nowMs + expiresIn * 1000 };
}

/** 아직 쓸 수 있는 토큰이 있으면 준다. 없거나 만료가 가까우면 null. */
export function cachedToken(nowMs = Date.now()): string | null {
  if (!cached) return null;
  if (nowMs >= cached.expiresAtMs - TOKEN_SAFETY_MARGIN_MS) {
    cached = null;
    return null;
  }
  return cached.accessToken;
}

/** 연결을 끊을 때 부른다. 화면이 '연결 안 됨'인데 토큰이 남아 있으면 안 된다. */
export function forgetToken() {
  cached = null;
}

/**
 * 조회에 쓸 토큰을 마련한다. 살아 있는 토큰이 있으면 그대로,
 * 없으면 동의 팝업을 띄운다. 호출부는 어느 쪽이었는지 알 필요가 없다.
 */
export async function ensureCalendarToken(nowMs = Date.now()): Promise<CalendarConnectResult> {
  const reusable = cachedToken(nowMs);
  if (reusable) return { ok: true, accessToken: reusable };

  const connected = await connectGoogleCalendar();
  if (connected.ok && connected.accessToken) {
    rememberToken(connected.accessToken, connected.expiresIn ?? 0, nowMs);
  }
  return connected;
}
