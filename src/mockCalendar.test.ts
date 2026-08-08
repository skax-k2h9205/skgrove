import { describe, expect, it } from 'vitest';
import { mockCalendarEvents } from './mockCalendar';
import { meetingLoadByPerson } from './googleCalendar';
import type { ManagedAccount } from './types';

function acc(name: string, email: string, part: string): ManagedAccount {
  return { id: email, name, email, part, status: '활성', joinedAt: '2026-01-01' } as unknown as ManagedAccount;
}

const accounts = [
  acc('김리더', 'a@sk.com', 'ITS혁신파트'),
  acc('이멤버', 'b@sk.com', 'ITS혁신파트'),
  acc('박멤버', 'c@sk.com', 'ITS혁신파트'),
  acc('최리더', 'd@sk.com', 'PM혁신파트'),
  acc('정멤버', 'e@sk.com', 'PM혁신파트'),
];
const ref = new Date(2026, 7, 15); // 2026-08-15

describe('mockCalendarEvents', () => {
  it('4주치 회의를 생성하고 모두 시간 일정이다', () => {
    const events = mockCalendarEvents(accounts, ref, 4);
    expect(events.length).toBeGreaterThan(10);
    expect(events.every((e) => !e.isAllDay && e.eventType === 'default')).toBe(true);
  });

  it('meetingLoadByPerson 이 모든 활성 회원에게 회의 시간을 귀속한다', () => {
    const events = mockCalendarEvents(accounts, ref, 4);
    const { loads } = meetingLoadByPerson(events, accounts);
    const names = new Set(loads.map((l) => l.name));
    accounts.forEach((a) => expect(names.has(a.name)).toBe(true)); // 파트 위클리로 전원 잡힘
    loads.forEach((l) => expect(l.totalMinutes).toBeGreaterThan(0));
  });

  it('원온원·크로스파트로 리더가 멤버보다 회의 시간이 많다', () => {
    const events = mockCalendarEvents(accounts, ref, 4);
    const { loads } = meetingLoadByPerson(events, accounts);
    const leader = loads.find((l) => l.name === '김리더')!;
    const member = loads.find((l) => l.name === '박멤버')!;
    expect(leader.totalMinutes).toBeGreaterThan(member.totalMinutes);
  });

  it('비활성 계정은 회의에서 제외된다', () => {
    const withInactive = [...accounts, { ...acc('퇴사자', 'z@sk.com', 'ITS혁신파트'), status: '비활성' } as unknown as ManagedAccount];
    const events = mockCalendarEvents(withInactive, ref, 4);
    expect(events.some((e) => e.attendeeEmails.includes('z@sk.com'))).toBe(false);
  });
});
