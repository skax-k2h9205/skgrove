import { describe, expect, it } from 'vitest';
import {
  RESPONSE_DUE_DAYS,
  daysSinceCreated,
  isAwaitingResponse,
  isResponseOverdue,
  oldestWaitingDays,
  statusNeedsReason,
} from './issueRules';
import type { Issue } from './types';

const issue = (patch: Partial<Issue> = {}): Issue => ({
  id: 'SOOP-T',
  title: '테스트 의견',
  category: '회의문화',
  author: '익명',
  target: '리더 전체',
  status: '접수',
  urgency: '보통',
  body: '본문',
  expectedChange: '',
  visibility: '리더만 보기',
  createdAt: '2026-08-01',
  ...patch,
});

describe('isAwaitingResponse', () => {
  it('리더 응답이 하나도 없으면 대기 상태다', () => {
    expect(isAwaitingResponse(issue())).toBe(true);
  });

  it('답변·1on1·액션 중 하나라도 있으면 대기가 아니다', () => {
    expect(isAwaitingResponse(issue({ leaderReply: '검토했습니다' }))).toBe(false);
    expect(isAwaitingResponse(issue({ oneOnOneNote: '다음 주에 봬요' }))).toBe(false);
    expect(isAwaitingResponse(issue({ actionItem: '아젠다 양식 배포' }))).toBe(false);
  });

  it('회수·종료된 건은 응답을 기다리지 않는다', () => {
    expect(isAwaitingResponse(issue({ status: '회수' }))).toBe(false);
    expect(isAwaitingResponse(issue({ status: '종료' }))).toBe(false);
  });
});

describe('daysSinceCreated', () => {
  it('접수일로부터 지난 일수를 센다', () => {
    expect(daysSinceCreated(issue({ createdAt: '2026-08-01' }), '2026-08-09')).toBe(8);
  });

  it('같은 날 접수는 0일이다', () => {
    expect(daysSinceCreated(issue({ createdAt: '2026-08-09' }), '2026-08-09')).toBe(0);
  });

  it('접수일이 없는 과거 데이터는 계산하지 않는다', () => {
    expect(daysSinceCreated(issue({ createdAt: '' }), '2026-08-09')).toBeNull();
  });

  it('접수일이 미래여도 음수가 되지 않는다', () => {
    expect(daysSinceCreated(issue({ createdAt: '2026-08-20' }), '2026-08-09')).toBe(0);
  });
});

describe('isResponseOverdue', () => {
  it(`응답 없이 ${RESPONSE_DUE_DAYS}일을 채우면 지연이다`, () => {
    expect(isResponseOverdue(issue({ createdAt: '2026-08-01' }), '2026-08-08')).toBe(true);
  });

  it('기준 일수 직전에는 아직 지연이 아니다', () => {
    expect(isResponseOverdue(issue({ createdAt: '2026-08-01' }), '2026-08-07')).toBe(false);
  });

  it('이미 답변한 건은 아무리 오래돼도 지연이 아니다', () => {
    const answered = issue({ createdAt: '2026-01-01', leaderReply: '검토했습니다' });
    expect(isResponseOverdue(answered, '2026-08-09')).toBe(false);
  });

  it('접수일을 모르면 지연으로 단정하지 않는다', () => {
    expect(isResponseOverdue(issue({ createdAt: '' }), '2026-08-09')).toBe(false);
  });
});

describe('oldestWaitingDays', () => {
  it('미응답 건 중 가장 오래된 경과일을 돌려준다', () => {
    const issues = [
      issue({ id: 'A', createdAt: '2026-08-07' }),
      issue({ id: 'B', createdAt: '2026-07-20' }),
      issue({ id: 'C', createdAt: '2026-08-01' }),
    ];
    expect(oldestWaitingDays(issues, '2026-08-09')).toBe(20);
  });

  it('이미 처리된 건은 세지 않는다', () => {
    const issues = [
      issue({ id: 'A', createdAt: '2026-01-01', leaderReply: '답변' }),
      issue({ id: 'B', createdAt: '2026-08-07' }),
    ];
    expect(oldestWaitingDays(issues, '2026-08-09')).toBe(2);
  });

  it('대기 중인 건이 없으면 null이다', () => {
    expect(oldestWaitingDays([issue({ status: '종료' })], '2026-08-09')).toBeNull();
  });
});

describe('statusNeedsReason', () => {
  it('보류·종료는 사유 없이 넘길 수 없다', () => {
    expect(statusNeedsReason('보류')).toBe(true);
    expect(statusNeedsReason('종료')).toBe(true);
  });

  it('진행성 상태는 사유를 요구하지 않는다', () => {
    expect(statusNeedsReason('접수')).toBe(false);
    expect(statusNeedsReason('검토중')).toBe(false);
    expect(statusNeedsReason('답변완료')).toBe(false);
  });
});
