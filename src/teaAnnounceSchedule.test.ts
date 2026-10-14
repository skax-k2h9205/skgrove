import { describe, expect, it } from 'vitest';
import { formatTeaSchedule } from './features/meetings/Meetings';

describe('formatTeaSchedule', () => {
  it('날짜에 요일, 시간 범위를 붙인다', () => {
    expect(formatTeaSchedule('2026-10-16', '16:00', '17:00')).toBe('2026-10-16(금) 16:00~17:00');
  });
  it('종료 시간이 없으면 시작만', () => {
    expect(formatTeaSchedule('2026-10-14', '15:30', '')).toBe('2026-10-14(수) 15:30~');
  });
  it('빈 값은 미정으로', () => {
    expect(formatTeaSchedule('', '', '')).toBe('날짜 미정 시간 미정');
  });
});
