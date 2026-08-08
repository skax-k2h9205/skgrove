import { describe, expect, it } from 'vitest';
import {
  MAX_PART_MEETING_ATTENDEES,
  buildPartByEmail,
  buildPartByName,
  countWorkdays,
  meetingLoadByPerson,
  isAttendanceEvent,
  parseTitleTag,
  partFromTitle,
  durationMinutes,
  isMeeting,
  isPartAttributable,
  meetingTypeOf,
  partOf,
  toMetricEvents,
} from './googleCalendar';
import type { ManagedAccount, RawCalendarEvent } from './types';

const account = (patch: Partial<ManagedAccount>): ManagedAccount => ({
  id: 'USR-X',
  name: '아무개',
  email: 'a@sk.com',
  role: '팀원',
  part: 'TEST혁신파트',
  status: '활성',
  joinedAt: '2026-07-24',
  ...patch,
});

const event = (patch: Partial<RawCalendarEvent>): RawCalendarEvent => ({
  id: 'EV-1',
  title: '주간 싱크',
  startsAt: '2026-08-03T10:00:00+09:00',
  endsAt: '2026-08-03T11:00:00+09:00',
  isAllDay: false,
  isRecurring: false,
  attendeeEmails: ['a@sk.com', 'b@sk.com', 'c@sk.com'],
  ...patch,
});

const accounts = [
  account({ email: 'a@sk.com', part: 'TEST혁신파트' }),
  account({ email: 'b@sk.com', part: 'TEST혁신파트' }),
  account({ email: 'c@sk.com', part: 'ITS혁신파트' }),
];

describe('durationMinutes', () => {
  it('시작과 끝의 차이를 분으로 돌려준다', () => {
    expect(durationMinutes(event({}))).toBe(60);
  });

  it('90분도 정확히 센다', () => {
    expect(durationMinutes(event({ endsAt: '2026-08-03T11:30:00+09:00' }))).toBe(90);
  });

  it('날짜를 못 읽으면 0이다', () => {
    expect(durationMinutes(event({ endsAt: '언젠가' }))).toBe(0);
  });

  it('끝이 시작보다 앞서도 음수를 내지 않는다', () => {
    expect(durationMinutes(event({ endsAt: '2026-08-03T09:00:00+09:00' }))).toBe(0);
  });
});

describe('meetingTypeOf', () => {
  it('제목의 캔미팅·티미팅을 먼저 본다', () => {
    expect(meetingTypeOf(event({ title: '3분기 캔미팅' }))).toBe('캔미팅');
    expect(meetingTypeOf(event({ title: '8월 티미팅' }))).toBe('티미팅');
  });

  it('제목 규칙은 인원 규칙보다 우선한다', () => {
    // 2명이지만 캔미팅이라고 적혀 있으면 원온원이 아니다.
    expect(meetingTypeOf(event({ title: '캔미팅 사전 조율', attendeeEmails: ['a@sk.com', 'b@sk.com'] }))).toBe('캔미팅');
  });

  it('2명이면 원온원이다', () => {
    expect(meetingTypeOf(event({ attendeeEmails: ['a@sk.com', 'b@sk.com'] }))).toBe('원온원');
  });

  it('그 밖에는 파트회의다', () => {
    expect(meetingTypeOf(event({}))).toBe('파트회의');
  });
});

describe('isMeeting', () => {
  it('시간이 잡힌 보통 일정은 회의다', () => {
    expect(isMeeting(event({}))).toBe(true);
  });

  it('종일 일정은 회의가 아니라 행사다', () => {
    expect(isMeeting(event({ isAllDay: true }))).toBe(false);
  });

  it('집중 시간·부재중·근무 위치는 회의가 아니다', () => {
    expect(isMeeting(event({ eventType: 'focusTime' }))).toBe(false);
    expect(isMeeting(event({ eventType: 'outOfOffice' }))).toBe(false);
    expect(isMeeting(event({ eventType: 'workingLocation' }))).toBe(false);
    expect(isMeeting(event({ eventType: 'birthday' }))).toBe(false);
  });

  it('eventType 이 default 면 회의다', () => {
    expect(isMeeting(event({ eventType: 'default' }))).toBe(true);
  });

  it('내가 거절한 초대는 회의 시간에 넣지 않는다', () => {
    expect(isMeeting(event({ selfResponse: 'declined' }))).toBe(false);
  });

  it('수락·미정·미응답은 회의로 센다', () => {
    expect(isMeeting(event({ selfResponse: 'accepted' }))).toBe(true);
    expect(isMeeting(event({ selfResponse: 'tentative' }))).toBe(true);
    expect(isMeeting(event({ selfResponse: 'needsAction' }))).toBe(true);
  });

  it("'한가함'으로 표시한 일정은 회의가 아니다", () => {
    expect(isMeeting(event({ showsAsBusy: false }))).toBe(false);
  });

  it('값이 없으면 회의 쪽으로 본다 — 예전에 저장된 데이터 호환', () => {
    expect(isMeeting(event({ eventType: undefined, selfResponse: undefined, showsAsBusy: undefined }))).toBe(true);
  });
});

describe('isPartAttributable', () => {
  const withAttendees = (count: number) =>
    event({ attendeeEmails: Array.from({ length: count }, (_, i) => `p${i}@sk.com`) });

  it('보통 규모 회의는 파트에 단다', () => {
    expect(isPartAttributable(withAttendees(8))).toBe(true);
  });

  it('임계값까지는 단다', () => {
    expect(isPartAttributable(withAttendees(MAX_PART_MEETING_ATTENDEES))).toBe(true);
  });

  it('전사 규모는 어느 파트의 회의량도 아니다', () => {
    expect(isPartAttributable(withAttendees(MAX_PART_MEETING_ATTENDEES + 1))).toBe(false);
  });
});

describe('buildPartByEmail', () => {
  it('메일을 소문자로 맞춰 담는다', () => {
    const map = buildPartByEmail([account({ email: 'A@SK.COM', part: 'ITS혁신파트' })]);
    expect(map.get('a@sk.com')).toBe('ITS혁신파트');
  });

  it('비활성 계정은 현재 조직이 아니므로 뺀다', () => {
    const map = buildPartByEmail([account({ email: 'a@sk.com', status: '비활성' })]);
    expect(map.size).toBe(0);
  });
});

describe('partOf', () => {
  const partByEmail = buildPartByEmail(accounts);

  it('참석자가 가장 많은 파트로 정한다', () => {
    expect(partOf(event({}), partByEmail)).toBe('TEST혁신파트');
  });

  it('메일 대소문자가 달라도 맞춘다', () => {
    expect(partOf(event({ attendeeEmails: ['A@SK.com'] }), partByEmail)).toBe('TEST혁신파트');
  });

  it('사내 계정이 하나도 없으면 null 이다', () => {
    expect(partOf(event({ attendeeEmails: ['x@other.com'] }), partByEmail)).toBeNull();
  });

  it('참석자가 없으면 null 이다', () => {
    expect(partOf(event({ attendeeEmails: [] }), partByEmail)).toBeNull();
  });
});

describe('toMetricEvents', () => {
  it('시간 일정을 회의로 옮긴다', () => {
    const [first] = toMetricEvents([event({})], accounts);
    expect(first).toEqual({
      id: 'EV-1',
      title: '주간 싱크',
      part: 'TEST혁신파트',
      type: '파트회의',
      startsAt: '2026-08-03T10:00:00+09:00',
      durationMinutes: 60,
      attendees: 3,
      isRecurring: false,
    });
  });

  it('종일 일정은 회의가 아니므로 뺀다', () => {
    const all = toMetricEvents([event({ isAllDay: true, startsAt: '2026-08-07', endsAt: '2026-08-08' })], accounts);
    expect(all).toEqual([]);
  });

  it('파트를 못 정한 일정은 뺀다', () => {
    // 잘못 붙이면 그 파트 지수를 조용히 망가뜨린다.
    expect(toMetricEvents([event({ attendeeEmails: ['x@other.com'] })], accounts)).toEqual([]);
  });

  it('길이를 못 읽은 일정은 뺀다', () => {
    expect(toMetricEvents([event({ endsAt: '언젠가' })], accounts)).toEqual([]);
  });

  it('집중 시간과 거절한 초대는 회의 시간에 들어가지 않는다', () => {
    const events = toMetricEvents(
      [
        event({ id: 'A' }),
        event({ id: 'B', eventType: 'focusTime' }),
        event({ id: 'C', selfResponse: 'declined' }),
        event({ id: 'D', showsAsBusy: false }),
      ],
      accounts,
    );
    expect(events.map((e) => e.id)).toEqual(['A']);
  });

  it('전사 규모 회의는 파트 집계에서 뺀다', () => {
    const many = Array.from({ length: MAX_PART_MEETING_ATTENDEES + 5 }, (_, i) => `p${i}@sk.com`);
    // 사내 계정도 섞여 있어 파트는 정해지지만, 규모 때문에 제외되어야 한다.
    const events = toMetricEvents([event({ attendeeEmails: [...many, 'a@sk.com'] })], accounts);
    expect(events).toEqual([]);
  });

  it('60분 이상 여부를 그대로 셀 수 있게 길이를 남긴다', () => {
    const events = toMetricEvents(
      [event({ id: 'A', endsAt: '2026-08-03T11:10:00+09:00' }), event({ id: 'B', endsAt: '2026-08-03T10:30:00+09:00' })],
      accounts,
    );
    expect(events.filter((e) => e.durationMinutes >= 60)).toHaveLength(1);
  });
});

/*
  아래 제목들은 실제 팀 캘린더(AI ITS 혁신팀)에서 그대로 가져왔다.
  꾸며낸 예시로 테스트하면 규칙이 현실과 어긋나도 초록불이 켜진다.
*/
describe('제목 규칙 — 실제 캘린더 제목으로', () => {
  const staff = [
    account({ name: '심상준', part: 'ITS혁신파트' }),
    account({ name: '박완배', part: 'ITS혁신파트' }),
    account({ name: '이승주', part: 'PM혁신파트' }),
    account({ name: '김수정', part: 'TEST혁신파트' }),
  ];
  const byName = buildPartByName(staff);

  it('대괄호를 뜯어 태그와 본문을 나눈다', () => {
    expect(parseTitleTag('[회의/심상준,박완배]조달청 사전미팅')).toEqual({
      tag: '회의/심상준,박완배',
      rest: '조달청 사전미팅',
    });
    expect(parseTitleTag('제목만 있는 일정')).toEqual({ tag: null, rest: '제목만 있는 일정' });
  });

  it('[회의/참여자] — 앞으로의 약속 형식', () => {
    // 두 명이 ITS혁신, 한 명이 PM혁신이면 다수인 ITS혁신파트로 본다.
    expect(partFromTitle('[회의/심상준,박완배,이승주]', byName)).toBe('ITS혁신파트');
  });

  it('참여자 자리에 파트명을 적어도 된다', () => {
    expect(partFromTitle('[회의/ITS혁신]주간 점검', byName)).toBe('ITS혁신파트');
  });

  it('[파트명]… — 이미 쌓인 회의도 살린다', () => {
    expect(partFromTitle('[ITS혁신]파트 위클리', byName)).toBe('ITS혁신파트');
    expect(partFromTitle('[TEST혁신]파트 위클리', byName)).toBe('TEST혁신파트');
    expect(partFromTitle('[PM혁신] 파트위클리', byName)).toBe('PM혁신파트');
    expect(partFromTitle('[팀전체]AI 집중학습시간', byName)).toBe('전체');
  });

  it('[이름]… — 그 사람의 파트로 본다', () => {
    expect(partFromTitle('[심상준]CAIO팀장Weekly', byName)).toBe('ITS혁신파트');
  });

  it('모르는 태그는 null — 잘못 붙이느니 세지 않는다', () => {
    // 잘못 붙인 파트는 그 파트 지수를 조용히 망가뜨린다.
    expect(partFromTitle('[DAVIS CODE] Daily', byName)).toBeNull();
    expect(partFromTitle('[블루하츠]점심식사', byName)).toBeNull();
    expect(partFromTitle('[CEO타운홀]', byName)).toBeNull();
    expect(partFromTitle('[팀장/파트장]위클리', byName)).toBeNull();
  });

  it('퇴사·비활성 계정 이름으로는 파트를 정하지 않는다', () => {
    const gone = buildPartByName([account({ name: '퇴사자', part: 'ITS혁신파트', status: '비활성' })]);
    expect(partFromTitle('[퇴사자]주간', gone)).toBeNull();
  });
});

describe('근태 일정 판정', () => {
  it('휴가·출장·건강검진·반차를 근태로 본다', () => {
    for (const title of [
      '[휴가/심인수]',
      '[출장]박완배-하이닉스이천',
      '[출장/박소연] 한국투자증권 PiMS 패치',
      '[건강검진/심상준]',
      '[오전반차/이수현]',
    ]) {
      expect(isAttendanceEvent(event({ title }))).toBe(true);
    }
  });

  it('회의는 근태가 아니다', () => {
    expect(isAttendanceEvent(event({ title: '[ITS혁신]파트 위클리' }))).toBe(false);
  });

});

describe('회의 부담 — 사람별 하루 회의시간', () => {
  const staff = [
    account({ name: '심상준', part: 'ITS혁신파트' }),
    account({ name: '박완배', part: 'ITS혁신파트' }),
    account({ name: '이선민', part: 'PM혁신파트' }),
  ];
  // 2026-08-03(월) ~ 08-07(금) = 평일 5일
  const at = (date: string, from: string, to: string, title: string) =>
    event({ id: `${date}-${title}`, title, startsAt: `${date}T${from}:00+09:00`, endsAt: `${date}T${to}:00+09:00` });

  it('평일만 분모에 넣는다 — 주말을 넣으면 하루 평균이 실제보다 작아진다', () => {
    expect(countWorkdays('2026-08-03', '2026-08-07')).toBe(5);
    expect(countWorkdays('2026-08-03', '2026-08-09')).toBe(5); // 토·일 제외
  });

  it('파트 회의는 그 파트 전원에게 붙는다', () => {
    // 이게 없으면 파트 위클리에만 들어가는 사람이 0 이 되어 "회의 적다"로 읽힌다.
    const { loads } = meetingLoadByPerson([at('2026-08-03', '10:00', '11:00', '[ITS혁신]파트 위클리')], staff);
    expect(loads.map((l) => l.name).sort()).toEqual(['박완배', '심상준']);
  });

  it('이름이 적혀 있으면 그 사람에게만 붙는다', () => {
    const { loads } = meetingLoadByPerson([at('2026-08-03', '10:00', '11:00', '[회의/심상준] 협의')], staff);
    expect(loads).toHaveLength(1);
    expect(loads[0].name).toBe('심상준');
    expect(loads[0].totalMinutes).toBe(60);
  });

  it('가장 많았던 하루를 따로 남긴다 — 평균보다 이 값이 설득한다', () => {
    const events = [
      at('2026-08-03', '09:00', '13:00', '[회의/심상준] 종일 워크샵'),
      at('2026-08-04', '10:00', '10:30', '[회의/심상준] 짧은 협의'),
    ];
    const { loads } = meetingLoadByPerson(events, staff);
    expect(loads[0].busiestDay).toEqual({ date: '2026-08-03', minutes: 240 });
  });

  it('누구 것인지 모르는 회의는 세지 않고, 그 사실을 돌려준다', () => {
    // 화면이 "이 값은 실제보다 작다"를 밝히려면 몇 건이 빠졌는지 알아야 한다.
    const events = [
      at('2026-08-03', '10:00', '11:00', '[회의/심상준] 협의'),
      at('2026-08-03', '14:00', '15:00', '[PiMS2.0] Weekly'),
    ];
    const { attributed, total } = meetingLoadByPerson(events, staff);
    expect(total).toBe(2);
    expect(attributed).toBe(1);
  });

  it('근태는 시간이 잡혀 있어도 회의가 아니다', () => {
    const { loads, total } = meetingLoadByPerson([at('2026-08-03', '09:00', '18:00', '[출장/심상준] 하이닉스')], staff);
    expect(total).toBe(0);
    expect(loads).toEqual([]);
  });
});
