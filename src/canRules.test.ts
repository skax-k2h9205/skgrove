// 캔미팅 세션은 참여 파트만 쓴다. 다른 파트는 읽기 전용.
import { describe, expect, it } from 'vitest';
import { canWriteCanSession } from './canRules';
import type { CurrentUser } from './types';

const user = (part: string, role: CurrentUser['role'] = '팀원', connectioner = false): CurrentUser => ({
  name: '테스트',
  email: 't@sk.com',
  role,
  part,
  connectioner,
});
const session = (parts: string[], stage: 'setup' | 'collect' = 'collect') => ({ parts, stage });

describe('canWriteCanSession', () => {
  it('참여 파트 팀원은 쓴다', () => {
    expect(canWriteCanSession(user('AI'), session(['AI', '데이터']))).toBe(true);
  });

  it('참여 파트가 아닌 팀원은 읽기만', () => {
    expect(canWriteCanSession(user('인프라'), session(['AI', '데이터']))).toBe(false);
  });

  it('참여 파트가 아닌 파트리더도 읽기만 — 남의 파트 세션을 진행·삭제하지 못한다', () => {
    expect(canWriteCanSession(user('인프라', '파트리더'), session(['AI']))).toBe(false);
  });

  it("'전체' 파트와 팀리더·커넥셔너는 어느 세션이든 쓴다", () => {
    expect(canWriteCanSession(user('전체'), session(['AI']))).toBe(true);
    expect(canWriteCanSession(user('인프라', '팀리더'), session(['AI']))).toBe(true);
    expect(canWriteCanSession(user('인프라', '팀원', true), session(['AI']))).toBe(true);
  });

  it('준비 단계는 아직 판정하지 않는다 — 진행자가 파트를 고르는 중', () => {
    expect(canWriteCanSession(user('인프라', '파트리더'), session([], 'setup'))).toBe(true);
  });
});
