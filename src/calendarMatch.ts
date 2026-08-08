// 앱 안의 회의 세션(캔미팅·티미팅)과 구글 캘린더에서 읽어온 일정을 대조한다.
//
// 여기서 하는 일은 '보여주기'뿐이다. 세션을 만들지도, 고치지도 않는다.
// 결과를 저장하지도 않는다 — 저장하면 캘린더가 바뀐 뒤에도 낡은 연결이 남는다.
//
// 모르면 연결하지 않는다. googleCalendar.ts 의 partOf 가 파트를 못 정하면 null 을
// 돌려주는 것과 같은 태도다. 잘못 붙인 일정은 조용히 틀린 정보가 되지만,
// 안 붙은 일정은 화면에 '연결 안 됨'으로 남아 사용자가 이유를 찾을 수 있다.
import type { CalendarMeetingType, CalendarMetricEvent } from './types';

/** 대조에 필요한 최소한의 세션 정보. CanSession·TeaSession 을 여기에 맞춰 넣는다. */
export type MatchableSession = {
  /** 'YYYY-MM-DD'. 비어 있으면 후보가 없어 자연히 미연결이 된다. */
  heldAt: string;
  title: string;
  type: CalendarMeetingType;
};

export type CalendarMatch =
  | { kind: 'matched'; event: CalendarMetricEvent }
  | { kind: 'ambiguous'; candidates: CalendarMetricEvent[] }
  | { kind: 'none' };

/**
 * 후보 전부가 갖고 있는 단어는 순위를 가르지 못한다.
 * meetingTypeOf 가 제목에서 이 단어를 보고 타입을 정했으므로, 같은 타입 후보끼리는
 * 이 단어가 항상 겹친다. 세면 모든 후보 점수가 똑같이 1씩 올라 동률만 만든다.
 */
const CLASSIFIER_WORDS = new Set(['캔미팅', '티미팅']);

export function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !CLASSIFIER_WORDS.has(token));
}

// 저장된 지 오래된 세션에는 heldAt 이 아예 없을 수 있다(컬럼이 나중에 생겼다).
// 타입만 믿고 slice 를 부르면 그런 행 하나가 화면 전체를 무너뜨린다.
function dayOf(isoOrDate: string | undefined | null): string {
  return typeof isoOrDate === 'string' ? isoOrDate.slice(0, 10) : '';
}

function overlapCount(sessionTokens: string[], event: CalendarMetricEvent): number {
  const eventTokens = new Set(titleTokens(event.title));
  return sessionTokens.filter((token) => eventTokens.has(token)).length;
}

/**
 * 세션에 붙일 캘린더 일정을 고른다.
 *
 * 1) 같은 날짜·같은 타입인 일정만 후보로 둔다.
 * 2) 후보가 하나면 그것이다. 제목이 안 겹쳐도 연결한다 — 날짜와 타입이 이미 맞았고,
 *    제목은 후보가 여럿일 때 순위를 가르는 용도다.
 * 3) 여럿이면 제목 토큰 겹침이 가장 많은 것을 고른다. 최고점이 둘 이상이면 ambiguous.
 */
export function matchSessionToEvents(
  session: MatchableSession,
  events: CalendarMetricEvent[],
): CalendarMatch {
  const day = dayOf(session.heldAt);
  if (!day) return { kind: 'none' };

  const candidates = events.filter(
    (event) => event.type === session.type && dayOf(event.startsAt) === day,
  );
  if (candidates.length === 0) return { kind: 'none' };
  if (candidates.length === 1) return { kind: 'matched', event: candidates[0] };

  const sessionTokens = titleTokens(session.title);
  let best = -1;
  let bestEvents: CalendarMetricEvent[] = [];
  for (const candidate of candidates) {
    const score = overlapCount(sessionTokens, candidate);
    if (score > best) {
      best = score;
      bestEvents = [candidate];
    } else if (score === best) {
      bestEvents.push(candidate);
    }
  }

  if (bestEvents.length === 1) return { kind: 'matched', event: bestEvents[0] };
  return { kind: 'ambiguous', candidates: bestEvents };
}

/**
 * '14:00–15:30' 처럼 시각 구간을 만든다.
 *
 * startsAt 의 시각 부분을 그대로 읽는다. Date 로 파싱해 되찍으면 브라우저 시간대에 따라
 * 구글 캘린더가 보여주는 시각과 어긋난다 — 일정은 그 일정이 열린 곳의 시각으로 읽어야 한다.
 * 자정을 넘기는 회의는 끝 시각이 앞으로 돌아간다(24시간으로 나눈 나머지).
 */
export function formatEventWhen(event: CalendarMetricEvent): string {
  const start = event.startsAt.slice(11, 16);
  if (!/^\d{2}:\d{2}$/.test(start)) return '';

  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMinutes = (startMinutes + event.durationMinutes) % 1440;
  const pad = (value: number) => String(value).padStart(2, '0');
  const end = `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`;
  return `${start}–${end}`;
}
