// 접수 건 처리 기준. 순수 함수만 두어 단위 테스트로 회귀 검증한다(팀 관례: *Rules.ts).
import type { Issue, IssueStatus } from './types';

/**
 * 리더가 답변하지 않은 채 이 일수를 넘기면 '지연'으로 본다.
 *
 * 대나무숲은 첫 몇 건이 이후 사용률을 결정한다. 접수해놓고 아무 반응이 없으면
 * 사람들은 다시 쓰지 않는다. 그래서 '방치'를 리더 화면에서 눈에 보이게 만든다.
 */
export const RESPONSE_DUE_DAYS = 7;

/** 아직 리더의 응답이 하나도 없는 상태. 회수·종료된 건은 대상이 아니다. */
export function isAwaitingResponse(issue: Issue) {
  if (issue.status === '회수' || issue.status === '종료') return false;
  return !issue.leaderReply && !issue.oneOnOneNote && !issue.actionItem;
}

/** 접수일로부터 지난 일수. 접수일이 없는 과거 데이터는 null. */
export function daysSinceCreated(issue: Issue, today: string) {
  if (!issue.createdAt) return null;
  const diff = Date.parse(today) - Date.parse(issue.createdAt);
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.round(diff / 86400000));
}

/** 응답 없이 기준 일수를 넘긴 건. */
export function isResponseOverdue(issue: Issue, today: string) {
  if (!isAwaitingResponse(issue)) return false;
  const days = daysSinceCreated(issue, today);
  return days !== null && days >= RESPONSE_DUE_DAYS;
}

/** 미응답 건 중 가장 오래된 것의 경과일. 없으면 null. */
export function oldestWaitingDays(issues: Issue[], today: string) {
  const waiting = issues
    .filter(isAwaitingResponse)
    .map((issue) => daysSinceCreated(issue, today))
    .filter((days): days is number => days !== null);

  return waiting.length > 0 ? Math.max(...waiting) : null;
}

/**
 * 사유를 반드시 받아야 하는 상태 전환.
 *
 * 용기 내어 쓴 글이 이유 없이 '보류'로 바뀌면 그 사람은 다시 쓰지 않는다.
 * 접수자에게 결과만 통보하고 근거를 남기지 않는 전환을 막는다.
 */
export function statusNeedsReason(status: IssueStatus) {
  return status === '보류' || status === '종료';
}
