import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession } from './session';
import type { CurrentUser } from './types';

// vitest 는 node 환경이라 window 가 없다. session.ts 가 쓰는 window.localStorage 를 목으로 채운다.
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: mockStorage };
});
afterEach(() => {
  mockStorage.clear();
});

const user = { name: '김승현', email: 'k2h9205@sk.com', part: 'ITS혁신파트' } as unknown as CurrentUser;

describe('session', () => {
  it('저장한 세션을 복원한다', () => {
    saveSession(user);
    expect(loadSession()?.email).toBe('k2h9205@sk.com');
  });

  it('없으면 null', () => {
    expect(loadSession()).toBeNull();
  });

  it('clearSession 후에는 복원되지 않는다', () => {
    saveSession(user);
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('만료(14일 초과)된 세션은 버린다', () => {
    store['skgrove:session'] = JSON.stringify({ user, savedAt: Date.now() - 15 * 24 * 60 * 60 * 1000 });
    expect(loadSession()).toBeNull();
  });

  it('깨진 값이면 null(예외 없이)', () => {
    store['skgrove:session'] = '{not json';
    expect(loadSession()).toBeNull();
  });
});
