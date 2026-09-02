import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scopeCachesToTenant } from './cacheScope';

// node 환경이라 localStorage 가 없다 — Map 기반 목을 globalThis 에 심는다.
function installStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  const storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  return map;
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('scopeCachesToTenant', () => {
  it('테넌트가 바뀌면 skgrove: 콘텐츠 캐시를 비우고 마커를 갱신한다', () => {
    const map = installStorage({
      'skgrove:cacheTenant': 'tenant-demo',
      'skgrove:agendas': '[{"old":true}]',
      'skgrove:humorposts': '[]',
      'guideSeen:v1:x@sk.com': '1', // skgrove: 아님 → 보존
    });
    scopeCachesToTenant('tenant-sk');
    expect(map.has('skgrove:agendas')).toBe(false);
    expect(map.has('skgrove:humorposts')).toBe(false);
    expect(map.get('guideSeen:v1:x@sk.com')).toBe('1');
    expect(map.get('skgrove:cacheTenant')).toBe('tenant-sk');
  });

  it('같은 테넌트면 캐시를 그대로 둔다(오프라인 복원력)', () => {
    const map = installStorage({
      'skgrove:cacheTenant': 'tenant-sk',
      'skgrove:agendas': '[{"keep":true}]',
    });
    scopeCachesToTenant('tenant-sk');
    expect(map.get('skgrove:agendas')).toBe('[{"keep":true}]');
  });

  it('마커가 없으면(최초/업그레이드) 한 번 비우고 마커를 심는다', () => {
    const map = installStorage({ 'skgrove:agendas': '[{"stale":true}]' });
    scopeCachesToTenant('tenant-sk');
    expect(map.has('skgrove:agendas')).toBe(false);
    expect(map.get('skgrove:cacheTenant')).toBe('tenant-sk');
  });

  it('테넌트가 null(로그인 전)이면 아무것도 하지 않는다', () => {
    const map = installStorage({ 'skgrove:agendas': '[{"keep":true}]' });
    scopeCachesToTenant(null);
    expect(map.get('skgrove:agendas')).toBe('[{"keep":true}]');
  });
});
