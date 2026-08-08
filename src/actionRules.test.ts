import { describe, expect, it } from 'vitest';
import { canTransition, daysUntilDue, isOverdue, nextStatuses, sortActionItems } from './actionRules';
import type { ActionItem } from './types';

const TODAY = '2026-07-27';

const item = (patch: Partial<ActionItem> = {}): ActionItem => ({
  id: 'ACT-T',
  title: '테스트 액션',
  owner: '미정',
  due: '',
  status: '대기',
  sourceKind: '안건',
  sourceId: '',
  sourceLabel: '',
  createdAt: '2026-07-01',
  outcome: '',
  reviewReason: '',
  ...patch,
});

describe('상태 전이', () => {
  it('대기에서 진행중으로 갈 수 있다', () => {
    expect(canTransition('대기', '진행중')).toBe(true);
  });

  it('완료에서 대기로 되돌아갈 수 없다', () => {
    // 이미 적용해본 것을 되돌리는 일은 '재검토'로만 다뤄야
    // "해봤는데 안 됐다"와 "아직 안 했다"가 구분된다
    expect(canTransition('완료', '대기')).toBe(false);
    expect(canTransition('완료', '진행중')).toBe(false);
    expect(nextStatuses('완료')).toEqual(['재검토']);
  });

  it('해본 적 없는 항목은 재검토로 갈 수 없다', () => {
    expect(canTransition('대기', '재검토')).toBe(false);
    expect(canTransition('진행중', '재검토')).toBe(false);
  });

  it('재검토에서 다시 진행하거나 완료할 수 있다', () => {
    expect(nextStatuses('재검토')).toEqual(['진행중', '완료']);
  });
});

describe('지연 판정', () => {
  it('목표일이 지났고 완료되지 않았으면 지연', () => {
    expect(isOverdue(item({ due: '2026-07-26', status: '진행중' }), TODAY)).toBe(true);
  });

  it('완료된 항목은 목표일이 지나도 지연이 아니다', () => {
    expect(isOverdue(item({ due: '2026-07-26', status: '완료' }), TODAY)).toBe(false);
  });

  it('오늘이 목표일이면 아직 지연이 아니다', () => {
    expect(isOverdue(item({ due: TODAY }), TODAY)).toBe(false);
  });

  it('목표일이 없으면 지연도 남은 일수도 판정하지 않는다', () => {
    expect(isOverdue(item({ due: '' }), TODAY)).toBe(false);
    expect(daysUntilDue(item({ due: '' }), TODAY)).toBeNull();
  });

  it('남은 일수는 과거 목표일에 음수가 된다', () => {
    // 화면은 이 부호를 보고 'N일 지남'과 'N일 남음'을 가른다
    expect(daysUntilDue(item({ due: '2026-07-26' }), TODAY)).toBe(-1);
    expect(daysUntilDue(item({ due: '2026-07-30' }), TODAY)).toBe(3);
  });
});

describe('sortActionItems', () => {
  it('지연 → 마감 임박 → 목표일 미정 → 완료 순으로 정렬한다', () => {
    const list = [
      item({ id: 'done', due: '2026-07-01', status: '완료' }),
      item({ id: 'nodate', due: '', status: '대기' }),
      item({ id: 'soon', due: '2026-07-28', status: '대기' }),
      item({ id: 'late', due: '2026-07-20', status: '진행중' }),
      item({ id: 'later', due: '2026-08-10', status: '대기' }),
    ];

    expect(sortActionItems(list, TODAY).map((i) => i.id)).toEqual(['late', 'soon', 'later', 'nodate', 'done']);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const list = [item({ id: 'b', due: '2026-08-10' }), item({ id: 'a', due: '2026-07-28' })];
    sortActionItems(list, TODAY);
    expect(list.map((i) => i.id)).toEqual(['b', 'a']);
  });
});
