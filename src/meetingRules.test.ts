import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CALENDAR_WINDOW_DAYS,
  WEEKLY_MEETING_BUDGET_HOURS,
  calendarWeeks,
  formatHours,
  meetingBudgetUsage,
  meetingHealth,
  weeklyMeetingHours,
  weeklyMinutes,
} from './meetingRules';

describe('calendarWeeks', () => {
  it('90일은 약 12.9주다', () => {
    expect(calendarWeeks(90)).toBeCloseTo(12.857, 2);
  });

  it('7일은 1주다', () => {
    expect(calendarWeeks(7)).toBe(1);
  });

  it('7일보다 짧아도 최소 1주로 본다', () => {
    // 3일치를 0.43주로 나누면 값이 2배 넘게 부풀어 과부하로 잡힌다.
    expect(calendarWeeks(3)).toBe(1);
  });

  it('값이 없으면 기본 기간을 쓴다', () => {
    expect(calendarWeeks(undefined)).toBe(calendarWeeks(DEFAULT_CALENDAR_WINDOW_DAYS));
  });

  it('0이나 음수도 기본 기간으로 떨어진다', () => {
    expect(calendarWeeks(0)).toBe(1);
    expect(calendarWeeks(-30)).toBe(1);
  });
});

describe('weeklyMinutes', () => {
  it('90일 합계를 주당으로 나눈다', () => {
    // 주 9시간(540분)씩 12.857주 = 6943분
    expect(weeklyMinutes(6943, 90)).toBe(540);
  });

  it('7일 기간이면 그대로 둔다', () => {
    expect(weeklyMinutes(540, 7)).toBe(540);
  });

  it('0은 0이다', () => {
    expect(weeklyMinutes(0, 90)).toBe(0);
  });

  it('음수는 0으로 막는다', () => {
    expect(weeklyMinutes(-100, 90)).toBe(0);
  });
});

describe('meetingHealth', () => {
  it('예산 안이면 긴 회의 비율만큼만 깎는다', () => {
    // 주 10시간(600분), 긴 회의 0% → 감점 없음
    expect(meetingHealth(200, 400, 0)).toBe(100);
  });

  it('예산을 넘기면 시간당 3점씩 깎는다', () => {
    // 주 15시간 → 3시간 초과 × 3 = 9점 감점
    expect(meetingHealth(300, 600, 0)).toBe(91);
  });

  it('긴 회의 비율도 깎는다', () => {
    // 예산 안 + 긴 회의 50% → 35점 감점
    expect(meetingHealth(200, 400, 50)).toBe(65);
  });

  it('0점 아래로 내려가지 않는다', () => {
    expect(meetingHealth(6000, 6000, 100)).toBe(0);
  });

  it('90일 합계를 그대로 넣으면 0이 된다 — 정규화가 필요한 이유', () => {
    // 주 9시간짜리 파트의 90일 합계(6943분)를 주당 값인 척 넣으면 바닥친다.
    expect(meetingHealth(0, 6943, 0)).toBe(0);
    // 정규화하면 만점권으로 돌아온다.
    expect(meetingHealth(0, weeklyMinutes(6943, 90), 0)).toBe(100);
  });
});

// 실제로 캘린더를 붙였을 때 벌어지는 일. 이 회귀를 다시 겪지 않으려고 남긴다.
describe('90일 실데이터 시나리오', () => {
  // 파트당 13주 × (원온원 180분 + 파트회의 360분) — 주 9시간 회의하는 파트
  const oneOnOneTotal = 13 * 180;
  const meetingTotal = 13 * 360;
  const WINDOW = 90;

  it('정규화 없이 넣으면 회의 건강도가 0으로 바닥친다', () => {
    expect(meetingHealth(oneOnOneTotal, meetingTotal, 100)).toBe(0);
  });

  it('정규화하면 주 9시간대로 돌아온다', () => {
    const oneOnOne = weeklyMinutes(oneOnOneTotal, WINDOW);
    const partMeeting = weeklyMinutes(meetingTotal, WINDOW);
    expect(weeklyMeetingHours(oneOnOne, partMeeting)).toBeCloseTo(9.1, 1);
  });

  it('정규화 후에는 긴 회의 감점만 남는다', () => {
    const oneOnOne = weeklyMinutes(oneOnOneTotal, WINDOW);
    const partMeeting = weeklyMinutes(meetingTotal, WINDOW);
    // 주 9.1시간이라 예산(12시간) 안 → 과부하 감점 0, 긴 회의 100% × 0.7 = 70점 감점
    expect(meetingHealth(oneOnOne, partMeeting, 100)).toBe(30);
  });
});

describe('weeklyMeetingHours', () => {
  it('분을 시간으로 바꾸고 소수 한 자리로 줄인다', () => {
    expect(weeklyMeetingHours(200, 364)).toBe(9.4);
  });

  it('회의가 없으면 0이다', () => {
    expect(weeklyMeetingHours(0, 0)).toBe(0);
  });
});

describe('formatHours', () => {
  it('60분 미만은 분으로 둔다', () => {
    expect(formatHours(45)).toBe('45분');
  });

  it('60분 이상은 시간으로 바꾼다', () => {
    expect(formatHours(90)).toBe('1.5시간');
    expect(formatHours(364)).toBe('6.1시간');
  });

  it('0과 음수는 0분이다', () => {
    expect(formatHours(0)).toBe('0분');
    expect(formatHours(-10)).toBe('0분');
  });
});

describe('meetingBudgetUsage', () => {
  it('예산의 절반이면 50%다', () => {
    expect(meetingBudgetUsage(0, WEEKLY_MEETING_BUDGET_HOURS * 30)).toBe(50);
  });

  it('예산을 꽉 채우면 100%다', () => {
    expect(meetingBudgetUsage(0, WEEKLY_MEETING_BUDGET_HOURS * 60)).toBe(100);
  });

  it('넘기면 100을 넘는 값을 그대로 돌려준다 — 넘겼다는 사실을 화면에서 감추지 않는다', () => {
    expect(meetingBudgetUsage(0, WEEKLY_MEETING_BUDGET_HOURS * 90)).toBe(150);
  });
});
