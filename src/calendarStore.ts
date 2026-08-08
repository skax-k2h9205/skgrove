// 구글 캘린더에서 읽어온 일정의 보관소 — localStorage 한 곳.
//
// 원래 Metrics.tsx 안에만 있었다. 회의 화면이 같은 일정을 읽어야 해서 꺼냈다.
// 저장 키는 그대로 둔다 — 키를 바꾸면 이미 연동해둔 사람의 일정이 사라진다.
//
// 여기에 담기는 것은 CalendarMetricEvent 다. 참석자 메일은 이미 떨어져 나가고
// 인원 수만 남은 형태라, 브라우저에 남아도 누가 참석했는지는 알 수 없다.
import { DEFAULT_CALENDAR_WINDOW_DAYS } from './meetingRules';
import type { CalendarConnection, CalendarMetricEvent } from './types';

const EVENTS_KEY = 'skgrove:metrics-calendar-events';
const STATUS_KEY = 'skgrove:metrics-calendar-status';
// 몇 일치를 모은 값인지 함께 남긴다. 이게 없으면 저장된 합계를 주당으로 되돌릴 수 없다.
const WINDOW_KEY = 'skgrove:metrics-calendar-window-days';

export function readCalendarEvents(): CalendarMetricEvent[] {
  try {
    const saved = window.localStorage.getItem(EVENTS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as CalendarMetricEvent[];
    // 손으로 고쳐졌거나 예전 형태일 수 있다. 배열이 아니면 없는 것으로 본다.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readCalendarStatus(): CalendarConnection {
  const saved = window.localStorage.getItem(STATUS_KEY);
  if (saved === 'connected' || saved === 'synced') return saved;
  return 'disconnected';
}

export function readCalendarWindowDays(): number {
  const saved = Number(window.localStorage.getItem(WINDOW_KEY));
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_CALENDAR_WINDOW_DAYS;
}

export function saveCalendarState(
  status: CalendarConnection,
  events: CalendarMetricEvent[],
  windowDays: number,
) {
  window.localStorage.setItem(STATUS_KEY, status);
  window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  window.localStorage.setItem(WINDOW_KEY, String(windowDays));
}
