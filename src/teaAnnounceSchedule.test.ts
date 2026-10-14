import { describe, expect, it } from 'vitest';
import { formatTeaSchedule } from './features/meetings/Meetings';

describe('formatTeaSchedule', () => {
  it('날짜에 요일과 시작 시간을 붙인다', () => {
    expect(formatTeaSchedule('2026-10-16', '16:00')).toBe('2026-10-16(금) 16:00');
  });
  it('빈 값은 미정으로', () => {
    expect(formatTeaSchedule('', '')).toBe('날짜 미정 시간 미정');
  });
});
