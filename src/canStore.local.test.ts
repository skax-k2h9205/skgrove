// Supabase 없이(로컬 개발) 캔미팅을 전부 지웠을 때 시드가 되살아나지 않는지.
//
// 실제 사고: 마지막 세션까지 지우고 새로고침하면 mock 세션 2건이 다시 나타났다.
// readLocal 이 저장된 빈 배열을 "저장된 게 없다"로 읽고 시드를 돌려줬기 때문이다.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabaseClient', () => ({ supabase: null }));

// vitest 는 node 환경이라 window 가 없다. canStore 가 쓰는 window.localStorage 를 목으로 채운다.
const store: Record<string, string> = {};
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  },
};

const { loadCanSessions, loadCanOpinions } = await import('./canStore');

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('loadCanSessions (Supabase 없음)', () => {
  it('전부 지운 뒤에는 빈 목록이다 — 시드로 되돌아가지 않는다', async () => {
    store['skgrove:cansessions'] = '[]';
    await expect(loadCanSessions()).resolves.toEqual([]);
  });

  it('의견도 마찬가지다', async () => {
    store['skgrove:canopinions'] = '[]';
    await expect(loadCanOpinions()).resolves.toEqual([]);
  });

  it('저장된 적이 없으면 시드를 보여준다 (첫 실행)', async () => {
    const sessions = await loadCanSessions();
    expect(sessions.length).toBeGreaterThan(0);
  });

  it('저장된 세션이 있으면 그것을 돌려준다', async () => {
    store['skgrove:cansessions'] = JSON.stringify([{ id: 'CAN-S-X', topic: '남은 세션' }]);
    const sessions = await loadCanSessions();
    expect(sessions.map((s) => s.id)).toEqual(['CAN-S-X']);
  });
});
