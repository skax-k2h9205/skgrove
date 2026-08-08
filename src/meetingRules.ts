// 회의량 계산 규칙.
//
// 파트지수의 '회의 건강도'는 주당 회의 시간을 본다. 그런데 구글 캘린더는 90일치를 읽어온다.
// 90일 합계를 그대로 주당 값으로 쓰면 12.9주치가 1주로 들어가, 어떤 파트든 과부하로 잡혀
// 회의 건강도가 0으로 바닥친다. 읽어온 기간으로 나눠 주당 값으로 맞춘 뒤 쓴다.

/** 캘린더를 읽지 않았을 때의 기준 기간. 추정식은 이미 주당 값이다. */
export const DEFAULT_CALENDAR_WINDOW_DAYS = 7;

/** 파트지수가 과부하로 보기 시작하는 주당 회의 시간. */
export const WEEKLY_MEETING_BUDGET_HOURS = 12;

/** 이 길이 이상이면 '긴 회의'로 센다. */
export const LONG_MEETING_MINUTES = 60;

/** 조회 기간(일)을 주 수로. 0이나 음수가 들어와도 나눗셈이 깨지지 않게 최소 1주로 둔다. */
export function calendarWeeks(windowDays: number | undefined): number {
  const days = windowDays && windowDays > 0 ? windowDays : DEFAULT_CALENDAR_WINDOW_DAYS;
  return Math.max(1, days / 7);
}

/** 기간 합계 분 → 주당 평균 분. */
export function weeklyMinutes(totalMinutes: number, windowDays: number | undefined): number {
  if (totalMinutes <= 0) return 0;
  return Math.round(totalMinutes / calendarWeeks(windowDays));
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 회의 건강도.
 * 주당 예산(12시간)을 넘긴 만큼과 긴 회의 비율로 100점에서 깎는다.
 * 입력은 반드시 '주당' 분이어야 한다 — 기간 합계를 그대로 넣으면 전부 0이 된다.
 */
export function meetingHealth(
  weeklyOneOnOneMinutes: number,
  weeklyPartMeetingMinutes: number,
  longMeetingRate: number,
): number {
  const hours = (weeklyOneOnOneMinutes + weeklyPartMeetingMinutes) / 60;
  const overload = Math.max(0, hours - WEEKLY_MEETING_BUDGET_HOURS) * 3 + longMeetingRate * 0.7;
  return clampScore(100 - overload);
}

/** 주당 총 회의 시간(시간 단위, 소수 한 자리). 화면에 숫자로 보여줄 값이다. */
export function weeklyMeetingHours(weeklyOneOnOneMinutes: number, weeklyPartMeetingMinutes: number): number {
  return Math.round(((weeklyOneOnOneMinutes + weeklyPartMeetingMinutes) / 60) * 10) / 10;
}

/** 분을 화면에 쓸 시간 문구로. 60분 미만은 분으로 두는 편이 읽기 쉽다. */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return '0분';
  if (minutes < 60) return `${Math.round(minutes)}분`;
  return `${Math.round((minutes / 60) * 10) / 10}시간`;
}

/** 예산 대비 사용률(%). 막대 길이에 쓴다. 100을 넘으면 넘긴 만큼 그대로 돌려준다. */
export function meetingBudgetUsage(weeklyOneOnOneMinutes: number, weeklyPartMeetingMinutes: number): number {
  const hours = weeklyMeetingHours(weeklyOneOnOneMinutes, weeklyPartMeetingMinutes);
  return Math.round((hours / WEEKLY_MEETING_BUDGET_HOURS) * 100);
}
