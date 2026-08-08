// 로그인 세션 보관 — 새로고침·재방문해도 로그인이 유지되게 currentUser 를 localStorage 에 남긴다.
// 비밀번호는 저장하지 않는다(이름·메일·소속·역할만). 이 프로토타입의 신뢰 모델과 일치한다.
// 오래 방치된 세션은 만료시켜, 공용 PC 등에서 무기한 로그인 상태로 남지 않게 한다.
import type { CurrentUser } from './types';

const KEY = 'skgrove:session';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14일

type Stored = { user: CurrentUser; savedAt: number };

/** 저장된 세션을 복원한다. 없거나·형식이 깨졌거나·만료됐으면 null. */
export function loadSession(): CurrentUser | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.user?.email || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

export function saveSession(user: CurrentUser) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ user, savedAt: Date.now() } satisfies Stored));
  } catch {
    /* 용량 초과 등 무시 — 세션 저장 실패가 로그인 자체를 막지는 않는다. */
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
