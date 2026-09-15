// 캔미팅 세션은 참여 파트만 쓴다. 다른 파트는 읽기 전용.
import { describe, expect, it } from 'vitest';
import { canDeleteOwnOpinion, canWriteCanSession, isMyOpinion } from './canRules';
import type { CanOpinion, CurrentUser } from './types';

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

// ── 본인 의견 삭제 ──

const op = (over: Partial<CanOpinion> = {}): CanOpinion => ({
  id: 'CAN-O-1',
  sessionId: 'CAN-S-1',
  part: 'AI',
  step: 'speakout',
  content: '내용',
  author: '익명',
  authorName: '',
  selected: false,
  ...over,
});
const collect = { parts: ['AI'], stage: 'collect' as const };

describe('isMyOpinion', () => {
  it('이 브라우저가 기억하는 제출이면 내 것', () => {
    expect(isMyOpinion(user('AI'), op(), ['CAN-O-1'])).toBe(true);
  });

  it('기억에 없는 익명 의견은 내 것이 아니다 — DB 에 작성자가 없으므로 알 방법이 없다', () => {
    expect(isMyOpinion(user('AI'), op(), [])).toBe(false);
  });

  it('실명 제출은 이름으로 맞춘다 — 다른 기기에서도 뜬다', () => {
    const mine = op({ author: '실명', authorName: '테스트' });
    expect(isMyOpinion(user('AI'), mine, [])).toBe(true);
    expect(isMyOpinion({ ...user('AI'), name: '남' }, mine, [])).toBe(false);
  });
});

describe('canDeleteOwnOpinion', () => {
  it('수집 중인 내 의견은 지운다', () => {
    expect(canDeleteOwnOpinion(user('AI'), op(), collect, ['CAN-O-1'])).toBe(true);
  });

  it('진행자가 이미 선정했으면 못 지운다 — 결과·PPT 가 그 의견을 쓰고 있다', () => {
    expect(canDeleteOwnOpinion(user('AI'), op({ selected: true }), collect, ['CAN-O-1'])).toBe(false);
  });

  it('수집이 끝난 뒤에는 못 지운다', () => {
    const shared = { parts: ['AI'], stage: 'share' as const };
    expect(canDeleteOwnOpinion(user('AI'), op(), shared, ['CAN-O-1'])).toBe(false);
  });

  it('참여 파트가 아니면 못 지운다', () => {
    expect(canDeleteOwnOpinion(user('인프라'), op(), collect, ['CAN-O-1'])).toBe(false);
  });

  it('남의 의견은 못 지운다', () => {
    expect(canDeleteOwnOpinion(user('AI'), op(), collect, [])).toBe(false);
  });
});
