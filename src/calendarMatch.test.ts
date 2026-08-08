import { describe, expect, it } from 'vitest';
import { formatEventWhen, matchSessionToEvents, titleTokens } from './calendarMatch';
import type { CalendarMetricEvent } from './types';

const event = (patch: Partial<CalendarMetricEvent>): CalendarMetricEvent => ({
  id: 'EV-1',
  title: '8월 캔미팅',
  part: 'TEST혁신파트',
  type: '캔미팅',
  startsAt: '2026-08-12T14:00:00+09:00',
  durationMinutes: 90,
  attendees: 8,
  isRecurring: false,
  ...patch,
});

describe('titleTokens', () => {
  it('공백으로 자르고 소문자로 맞춘다', () => {
    expect(titleTokens('8월 Sync 회의')).toEqual(['8월', 'sync', '회의']);
  });

  it('분류어(캔미팅·티미팅)는 변별력이 없어 뺀다', () => {
    // 후보 전부가 이 단어를 갖고 있으므로 세어봐야 순위가 안 갈린다.
    expect(titleTokens('8월 캔미팅 협업방식')).toEqual(['8월', '협업방식']);
    expect(titleTokens('티미팅 기술세미나')).toEqual(['기술세미나']);
  });

  it('빈 문자열은 토큰이 없다', () => {
    expect(titleTokens('   ')).toEqual([]);
  });
});

describe('formatEventWhen', () => {
  it('시작 시각과 길이로 구간을 만든다', () => {
    expect(formatEventWhen(event({ startsAt: '2026-08-12T14:00:00+09:00', durationMinutes: 90 }))).toBe(
      '14:00–15:30',
    );
  });

  it('브라우저 시간대와 무관하게 일정에 적힌 시각을 쓴다', () => {
    // Date 로 파싱해 되찍으면 여기서 실행 환경에 따라 값이 달라진다.
    expect(formatEventWhen(event({ startsAt: '2026-08-12T09:05:00-05:00', durationMinutes: 25 }))).toBe(
      '09:05–09:30',
    );
  });

  it('자정을 넘기면 끝 시각이 돌아간다', () => {
    expect(formatEventWhen(event({ startsAt: '2026-08-12T23:30:00+09:00', durationMinutes: 60 }))).toBe(
      '23:30–00:30',
    );
  });

  it('시각을 못 읽으면 빈 문자열 — 종일 일정이 흘러들어온 경우', () => {
    expect(formatEventWhen(event({ startsAt: '2026-08-12' }))).toBe('');
  });
});

describe('matchSessionToEvents', () => {
  it('같은 날짜·타입 일정이 하나면 그것으로 연결한다', () => {
    const result = matchSessionToEvents(
      { heldAt: '2026-08-12', title: '협업 방식', type: '캔미팅' },
      [event({ id: 'EV-1' })],
    );
    expect(result).toEqual({ kind: 'matched', event: expect.objectContaining({ id: 'EV-1' }) });
  });

  it('날짜가 다르면 연결하지 않는다', () => {
    const result = matchSessionToEvents(
      { heldAt: '2026-08-13', title: '협업 방식', type: '캔미팅' },
      [event({})],
    );
    expect(result.kind).toBe('none');
  });

  it('타입이 다르면 연결하지 않는다', () => {
    const result = matchSessionToEvents(
      { heldAt: '2026-08-12', title: '협업 방식', type: '티미팅' },
      [event({ type: '캔미팅' })],
    );
    expect(result.kind).toBe('none');
  });

  it('heldAt 이 비어 있으면 후보가 없다 — 날짜 없는 기존 티미팅 데이터', () => {
    const result = matchSessionToEvents({ heldAt: '', title: '기술세미나', type: '티미팅' }, [
      event({ type: '티미팅' }),
    ]);
    expect(result.kind).toBe('none');
  });

  it('같은 날 후보가 둘이면 제목이 겹치는 쪽을 고른다', () => {
    const result = matchSessionToEvents(
      { heldAt: '2026-08-12', title: '협업 방식 개선', type: '캔미팅' },
      [
        event({ id: 'EV-A', title: '8월 캔미팅 회고' }),
        event({ id: 'EV-B', title: '캔미팅 협업 방식' }),
      ],
    );
    expect(result).toEqual({ kind: 'matched', event: expect.objectContaining({ id: 'EV-B' }) });
  });

  it('겹침이 동률이면 억지로 고르지 않고 후보를 그대로 남긴다', () => {
    const result = matchSessionToEvents(
      { heldAt: '2026-08-12', title: '협업 방식', type: '캔미팅' },
      [event({ id: 'EV-A', title: '캔미팅 협업' }), event({ id: 'EV-B', title: '캔미팅 방식' })],
    );
    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.candidates.map((candidate) => candidate.id)).toEqual(['EV-A', 'EV-B']);
  });

  it('겹치는 단어가 전혀 없어도 후보가 하나면 연결한다', () => {
    // 날짜와 타입이 이미 맞았다. 제목은 순위를 가르는 용도일 뿐 관문이 아니다.
    const result = matchSessionToEvents(
      { heldAt: '2026-08-12', title: '협업 방식', type: '캔미팅' },
      [event({ id: 'EV-A', title: '월간 정기 모임' })],
    );
    expect(result).toEqual({ kind: 'matched', event: expect.objectContaining({ id: 'EV-A' }) });
  });

  it('heldAt 이 아예 없는 예전 세션도 터지지 않는다', () => {
    // 컬럼이 생기기 전에 저장된 행에는 이 값이 없다. 타입만 믿으면 slice 에서 죽는다.
    const legacy = { title: '기술세미나', type: '티미팅' } as never;
    expect(matchSessionToEvents(legacy, [event({ type: '티미팅' })]).kind).toBe('none');
  });

  it('일정이 하나도 없으면 연결하지 않는다', () => {
    const result = matchSessionToEvents({ heldAt: '2026-08-12', title: '협업', type: '캔미팅' }, []);
    expect(result.kind).toBe('none');
  });

  it('시각대가 붙어 있어도 날짜 부분만 본다', () => {
    const result = matchSessionToEvents(
      { heldAt: '2026-08-12', title: '협업', type: '캔미팅' },
      [event({ startsAt: '2026-08-12T23:30:00+09:00' })],
    );
    expect(result.kind).toBe('matched');
  });
});
