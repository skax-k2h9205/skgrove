import { describe, expect, it } from 'vitest';
import {
  belowMinimum,
  canDrawCoffee,
  canJoinWaitlist,
  coffeeCandidates,
  deriveStatus,
  formatWhen,
  isFull,
  mySeat,
  sortGatherings,
  splitRoster,
  spotsLeft,
  timeUntil,
} from './gatheringRules';
import type { Gathering, GatheringSignup } from './types';

const NOW = '2026-08-05T12:00';

const meetup = (patch: Partial<Gathering> = {}): Gathering => ({
  id: 'GAT-1',
  kind: 'flash',
  title: '퇴근 후 볼링',
  startAt: '2026-08-05T19:00',
  place: '강남 볼링장',
  capacity: 3,
  closeAt: '2026-08-05T18:00',
  minPeople: null,
  desc: '',
  part: '전체',
  cost: 'n빵',
  host: '이선민',
  createdAt: '2026-08-05',
  canceled: false,
  ...patch,
});

// 신청 시각만 다르게 준다. 선착순은 오직 이 값으로 갈린다.
const signup = (name: string, minute: string, gatheringId = 'GAT-1'): GatheringSignup => ({
  id: `S-${name}`,
  gatheringId,
  name,
  createdAt: `2026-08-05T10:${minute}`,
});

const roster = [signup('가', '01'), signup('나', '02'), signup('다', '03'), signup('라', '04'), signup('마', '05')];

describe('선착순 확정과 대기', () => {
  it('정원만큼 앞에서 끊어 확정, 나머지는 대기가 된다', () => {
    const { confirmed, waiting } = splitRoster(meetup(), roster);
    expect(confirmed.map((s) => s.name)).toEqual(['가', '나', '다']);
    expect(waiting.map((s) => s.name)).toEqual(['라', '마']);
  });

  it('신청 순서가 뒤섞여 들어와도 시각 순으로 줄을 세운다', () => {
    const shuffled = [roster[3], roster[0], roster[4], roster[2], roster[1]];
    expect(splitRoster(meetup(), shuffled).confirmed.map((s) => s.name)).toEqual(['가', '나', '다']);
  });

  it('제한 없음이면 전원 확정이고 남은 자리는 null 이다', () => {
    const open = meetup({ capacity: null });
    expect(splitRoster(open, roster).waiting).toHaveLength(0);
    // 0 을 돌려주면 '자리 없음'과 구분되지 않는다
    expect(spotsLeft(open, roster)).toBeNull();
    expect(isFull(open, roster)).toBe(false);
  });

  it('다른 모임의 신청은 세지 않는다', () => {
    const mixed = [...roster, signup('바', '06', 'GAT-2')];
    expect(splitRoster(meetup(), mixed).confirmed).toHaveLength(3);
  });

  it('앞사람이 취소하면 대기 첫 번째가 저절로 확정된다', () => {
    // 승계를 위해 아무 값도 옮겨 쓰지 않는다. 레코드 하나가 빠지면 그만이다.
    const afterCancel = roster.filter((s) => s.name !== '나');
    expect(splitRoster(meetup(), afterCancel).confirmed.map((s) => s.name)).toEqual(['가', '다', '라']);
  });
});

describe('내 자리', () => {
  it('확정이면 확정으로 알려준다', () => {
    expect(mySeat(meetup(), roster, '가')).toBe('확정');
  });

  it('대기면 몇 번째인지 알려준다', () => {
    expect(mySeat(meetup(), roster, '마')).toEqual({ 대기: 2 });
  });

  it('신청하지 않았으면 null 이다', () => {
    expect(mySeat(meetup(), roster, '사')).toBeNull();
  });
});

describe('상태 파생', () => {
  it('자리가 남고 마감 전이면 모집중이다', () => {
    expect(deriveStatus(meetup(), roster.slice(0, 2), NOW)).toBe('모집중');
  });

  it('정원이 차면 마감이다', () => {
    expect(deriveStatus(meetup(), roster, NOW)).toBe('마감');
  });

  it('마감 시각이 지나면 자리가 남아도 마감이다', () => {
    // 상태를 저장했다면 아무도 접속하지 않는 사이 '모집중'으로 남았을 것이다
    expect(deriveStatus(meetup(), [], '2026-08-05T18:30')).toBe('마감');
  });

  it('시작 시각이 지나고 최소 인원을 채웠으면 진행함이다', () => {
    const withMin = meetup({ minPeople: 2 });
    expect(deriveStatus(withMin, roster.slice(0, 2), '2026-08-05T20:00')).toBe('진행함');
  });

  it('시작 시각이 지났는데 최소 인원에 못 미치면 종료다', () => {
    const withMin = meetup({ minPeople: 3 });
    expect(deriveStatus(withMin, roster.slice(0, 1), '2026-08-05T20:00')).toBe('종료');
  });

  it('취소는 시각과 무관하게 취소다', () => {
    expect(deriveStatus(meetup({ canceled: true }), [], NOW)).toBe('취소');
  });
});

describe('대기 줄에 세워도 되는가', () => {
  it('정원이 찼고 아직 마감 전이면 대기를 받는다', () => {
    expect(canJoinWaitlist(meetup(), roster, NOW)).toBe(true);
  });

  it('마감 시각이 지났으면 대기도 받지 않는다', () => {
    // 승계될 기회가 없는 줄에 세우는 것은 기만이다
    expect(canJoinWaitlist(meetup(), roster, '2026-08-05T18:30')).toBe(false);
  });

  it('취소된 모임에는 대기를 받지 않는다', () => {
    expect(canJoinWaitlist(meetup({ canceled: true }), roster, NOW)).toBe(false);
  });

  it('자리가 남아 있으면 대기가 아니라 그냥 신청이다', () => {
    expect(canJoinWaitlist(meetup(), roster.slice(0, 1), NOW)).toBe(false);
  });
});

describe('최소 인원', () => {
  it('미달이면 주최자에게 알린다', () => {
    expect(belowMinimum(meetup({ minPeople: 3 }), roster.slice(0, 2))).toBe(true);
  });

  it('최소 인원을 안 걸었으면 미달이 없다', () => {
    expect(belowMinimum(meetup({ minPeople: null }), [])).toBe(false);
  });
});

describe('정렬', () => {
  it('열린 모임이 위, 그 안에서는 임박한 순이다', () => {
    const soon = meetup({ id: 'A', startAt: '2026-08-05T19:00', closeAt: '2026-08-05T19:00' });
    const later = meetup({ id: 'B', startAt: '2026-08-07T19:00', closeAt: '2026-08-07T19:00' });
    const done = meetup({ id: 'C', startAt: '2026-08-01T19:00', closeAt: '2026-08-01T19:00' });
    expect(sortGatherings([done, later, soon], [], NOW).map((g) => g.id)).toEqual(['A', 'B', 'C']);
  });

  it('지난 모임은 최근에 끝난 것이 위에 온다', () => {
    const old = meetup({ id: 'OLD', startAt: '2026-07-01T19:00', closeAt: '2026-07-01T19:00' });
    const recent = meetup({ id: 'RECENT', startAt: '2026-08-01T19:00', closeAt: '2026-08-01T19:00' });
    expect(sortGatherings([old, recent], [], NOW).map((g) => g.id)).toEqual(['RECENT', 'OLD']);
  });
});

describe('사람이 읽는 시각', () => {
  it('요일과 오전오후를 붙여 읽히게 만든다', () => {
    expect(formatWhen('2026-08-05T19:00')).toBe('8월 5일(수) 오후 7:00');
  });

  it('정오는 오후 12시다', () => {
    expect(formatWhen('2026-08-05T12:00')).toBe('8월 5일(수) 오후 12:00');
  });

  it('자정은 오전 12시다', () => {
    expect(formatWhen('2026-08-05T00:30')).toBe('8월 5일(수) 오전 12:30');
  });

  it('망가진 값이 와도 앱을 깨뜨리지 않고 원문을 돌려준다', () => {
    expect(formatWhen('언젠가')).toBe('언젠가');
  });

  it('번개는 날짜보다 남은 시간이 잘 읽힌다', () => {
    expect(timeUntil('2026-08-05T19:00', NOW)).toBe('7시간 뒤');
    expect(timeUntil('2026-08-05T12:30', NOW)).toBe('30분 뒤');
    expect(timeUntil('2026-08-08T12:00', NOW)).toBe('3일 뒤');
    expect(timeUntil('2026-08-05T11:00', NOW)).toBe('지났어요');
  });
});

describe('coffeeCandidates / canDrawCoffee', () => {
  const signups = (names: string[], gatheringId = 'GAT-1'): GatheringSignup[] =>
    names.map((name, index) => ({
      id: `S-${index}`,
      gatheringId,
      name,
      createdAt: `2026-08-05T10:0${index}`,
    }));

  it('확정 로스터만 후보로 돌려준다 (대기 제외)', () => {
    const g = meetup({ capacity: 2 });
    const list = coffeeCandidates(g, signups(['가', '나', '다']));
    expect(list.map((s) => s.name)).toEqual(['가', '나']);
  });

  it('커피 뽑기를 켠 flash + 확정 2명 이상 + 아직 안 뽑음이면 뽑을 수 있다', () => {
    const g = meetup({ kind: 'flash', capacity: null, coffeeDraw: true });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(true);
  });

  it('커피 뽑기를 안 켠 번개는 확정 2명이어도 뽑을 수 없다', () => {
    const g = meetup({ kind: 'flash', capacity: null, coffeeDraw: false });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(false);
  });

  it('확정이 1명이면 뽑을 수 없다', () => {
    const g = meetup({ kind: 'flash', capacity: null, coffeeDraw: true });
    expect(canDrawCoffee(g, signups(['가']))).toBe(false);
  });

  it('callup(일정공모)에서는 뽑을 수 없다', () => {
    const g = meetup({ kind: 'callup', capacity: null });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(false);
  });

  it('이미 뽑았으면(잠김) 다시 뽑을 수 없다', () => {
    const g = meetup({ kind: 'flash', capacity: null, coffeeDraw: true, coffeePick: '가' });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(false);
  });

  it('취소된 모임에서는 뽑을 수 없다', () => {
    const g = meetup({ kind: 'flash', capacity: null, coffeeDraw: true, canceled: true });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(false);
  });
});
