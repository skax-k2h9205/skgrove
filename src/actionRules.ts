import type { ActionItem, ActionStatus } from './types';

export const actionStatuses: ActionStatus[] = ['대기', '진행중', '완료', '재검토'];

/**
 * 상태 전이 규칙.
 *
 * '완료'에서 '대기'로 되돌아가는 길은 막았다. 이미 적용해본 것을 다시 되돌리는 것은
 * '재검토'라는 별도 상태로 다뤄야, 리더가 "해봤는데 안 됐다"와 "아직 안 했다"를
 * 구분할 수 있다.
 */
const TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  대기: ['진행중', '완료'],
  진행중: ['대기', '완료'],
  완료: ['재검토'],
  재검토: ['진행중', '완료'],
};

export function nextStatuses(current: ActionStatus) {
  return TRANSITIONS[current];
}

export function canTransition(from: ActionStatus, to: ActionStatus) {
  return TRANSITIONS[from].includes(to);
}

export function isDone(item: ActionItem) {
  return item.status === '완료';
}

export function isOverdue(item: ActionItem, today: string) {
  return Boolean(item.due) && item.due < today && item.status !== '완료';
}

/** 남은 일수. 목표일이 없으면 null. */
export function daysUntilDue(item: ActionItem, today: string) {
  if (!item.due) return null;
  return Math.round((Date.parse(item.due) - Date.parse(today)) / 86400000);
}

/** 목록 정렬: 지연된 것 → 마감 임박 → 목표일 미정 순. 완료는 항상 아래로. */
export function sortActionItems(items: ActionItem[], today: string) {
  return [...items].sort((a, b) => {
    const doneDiff = Number(isDone(a)) - Number(isDone(b));
    if (doneDiff !== 0) return doneDiff;

    const overdueDiff = Number(isOverdue(b, today)) - Number(isOverdue(a, today));
    if (overdueDiff !== 0) return overdueDiff;

    // 목표일이 없는 항목은 기한이 있는 항목 뒤로 보낸다.
    if (!a.due && !b.due) return a.createdAt.localeCompare(b.createdAt);
    if (!a.due) return 1;
    if (!b.due) return -1;

    return a.due.localeCompare(b.due);
  });
}
