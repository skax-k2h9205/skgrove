// 세션 카드에 붙는 '구글 캘린더에서 확인됨' 줄.
//
// 보기 전용이다. 여기서 세션을 만들거나 고치지 않는다.
// 대조 결과를 저장하지도 않는다 — 그릴 때마다 계산한다. 저장하면 캘린더가 바뀐 뒤에도
// 낡은 연결이 남는다.
import { CalendarCheck, CalendarSearch } from 'lucide-react';
import { formatEventWhen, matchSessionToEvents, type MatchableSession } from '../../calendarMatch';
import type { CalendarMetricEvent } from '../../types';

type CalendarLinkProps = {
  session: MatchableSession;
  events: CalendarMetricEvent[];
};

export function CalendarLink({ session, events }: CalendarLinkProps) {
  // 캘린더를 아직 연동하지 않았으면 아무 말도 하지 않는다.
  // 연동한 적 없는 사람에게 '연결 안 됨'은 결함처럼 읽힌다.
  if (events.length === 0) return null;

  const match = matchSessionToEvents(session, events);

  if (match.kind === 'matched') {
    const when = formatEventWhen(match.event);
    return (
      <p className="calendar-link matched">
        <CalendarCheck size={14} aria-hidden />
        <span>
          캘린더에서 확인됨
          {when && ` · ${when}`}
          {` · ${match.event.attendees}명`}
        </span>
      </p>
    );
  }

  if (match.kind === 'ambiguous') {
    // 아무거나 고르면 조용히 틀린 정보가 된다. 후보가 여럿이라는 사실을 그대로 보여준다.
    return (
      <p className="calendar-link ambiguous">
        <CalendarSearch size={14} aria-hidden />
        <span>같은 날 비슷한 일정이 {match.candidates.length}건이라 하나로 정하지 못했어요</span>
      </p>
    );
  }

  return null;
}
