/*
  캘린더 연동 전, 회의량 대시보드를 미리 보기 위한 목업 회의 생성기.

  하드코딩이 아니라 **라이브 accounts(dev에 등록된 실제 회원)** 로 만든다 — 그래야
  meetingLoadByPerson 의 제목 파싱 귀속이 실제 이름·파트와 맞아 사람별 집계가 채워진다.
  생성물은 googleCalendar.ts 의 RawCalendarEvent 라, 파트 지표(toMetricEvents)와
  사람별 지표(meetingLoadByPerson) 양쪽을 동일하게 채운다.

  제목 규칙(귀속용): '[ITS혁신]파트 위클리'(파트 전원), '[회의/리더,멤버] 원온원'(두 사람),
  '[전체] 캔미팅'(전원). 근태 단어(휴가·출장 등)는 회의에서 빠지므로 제목에 쓰지 않는다.
*/
import type { ManagedAccount, RawCalendarEvent } from './types';

const PART_SHORT: Record<string, string> = {
  'ITS혁신파트': 'ITS혁신',
  'TEST혁신파트': 'TEST혁신',
  'PM혁신파트': 'PM혁신',
};

const pad = (n: number) => String(n).padStart(2, '0');

// 로컬 표기(YYYY-MM-DDTHH:MM:00) — 기존 샘플과 같은 형식. Date.parse 가 로컬로 읽는다.
function stamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function addDays(d: Date, days: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + days);
  return c;
}

/** 그 주의 월요일. 감속 없이 요일만 맞춘다. */
function mondayOf(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = c.getDay(); // 0=일 .. 6=토
  return addDays(c, day === 0 ? -6 : 1 - day);
}

type Slot = { day: Date; hour: number; minute: number };

function meeting(
  id: string,
  title: string,
  slot: Slot,
  durationMin: number,
  emails: string[],
  isRecurring: boolean,
): RawCalendarEvent {
  const start = new Date(slot.day.getFullYear(), slot.day.getMonth(), slot.day.getDate(), slot.hour, slot.minute);
  const end = new Date(start.getTime() + durationMin * 60000);
  return {
    id,
    title,
    startsAt: stamp(start),
    endsAt: stamp(end),
    isAllDay: false,
    isRecurring,
    attendeeEmails: emails,
    eventType: 'default',
    showsAsBusy: true,
  };
}

/**
 * 최근 `weeks` 주의 회의를 생성한다. referenceDate 기준 이번 주 월요일부터 과거로.
 * 순수 함수 — 같은 입력이면 같은 출력(무작위 없음).
 */
export function mockCalendarEvents(
  accounts: ManagedAccount[],
  referenceDate: Date,
  weeks = 4,
): RawCalendarEvent[] {
  const active = accounts.filter((account) => account.status === '활성' && account.name && account.email);
  const parts = [...new Set(active.map((account) => account.part))].filter((part) => part && part !== '전체');
  const events: RawCalendarEvent[] = [];
  const baseMonday = mondayOf(referenceDate);
  let seq = 0;
  const nextId = () => `MOCK-${pad(++seq)}`;

  for (let w = 0; w < weeks; w += 1) {
    // 오래된 주 → 최근 주 순.
    const monday = addDays(baseMonday, -7 * (weeks - 1 - w));

    parts.forEach((part, pi) => {
      const members = active.filter((account) => account.part === part);
      if (members.length === 0) return;
      const short = PART_SHORT[part] ?? part;

      // 파트 위클리 — 월/화 10:00, 60분, 파트 전원.
      events.push(
        meeting(nextId(), `[${short}]파트 위클리`, { day: addDays(monday, pi % 2), hour: 10, minute: 0 }, 60, members.map((m) => m.email), true),
      );

      // 원온원 — 리더(첫 멤버)와 각 멤버, 화~금 분산, 30분.
      const leader = members[0];
      members.slice(1).forEach((member, mi) => {
        const weekday = 1 + (mi % 4); // 화(1)~금(4)
        const hour = 13 + (mi % 4); // 13~16시
        events.push(
          meeting(nextId(), `[회의/${leader.name},${member.name}] 원온원`, { day: addDays(monday, weekday), hour, minute: 0 }, 30, [leader.email, member.email], true),
        );
      });
    });

    // 크로스파트 실무 회의 — 목 15:00, 45분, 서로 다른 파트 멤버 2명.
    if (parts.length >= 2) {
      const a = active.find((account) => account.part === parts[0]);
      const b = active.find((account) => account.part === parts[1] && account.name !== a?.name);
      if (a && b) {
        events.push(
          meeting(nextId(), `[회의/${a.name},${b.name}] 협업 논의`, { day: addDays(monday, 3), hour: 15, minute: 0 }, 45, [a.email, b.email], false),
        );
      }
    }
  }

  // 캔미팅 — 2주 전 수요일 14:00, 90분, 전원.
  if (active.length > 0) {
    events.push(
      meeting(nextId(), '[전체] 캔미팅', { day: addDays(baseMonday, -7 + 2), hour: 14, minute: 0 }, 90, active.map((m) => m.email), false),
    );
  }

  return events;
}
