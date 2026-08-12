// 구글 캘린더 프록시 공용 코드. 파일명이 _ 로 시작하면 Vercel 이 라우트로 만들지 않는다.
//
// 이 파일을 가져다 쓸 때는 './_shared.js' 처럼 확장자를 붙여야 한다. 배포된 함수는
// Node ESM 으로 도는데, ESM 은 상대 경로에 확장자를 요구한다. 확장자를 빼면
// 로컬 타입검사·빌드는 통과하고 배포 후 첫 호출에서 MODULE_NOT_FOUND 로 죽는다.
//
// 서버 환경변수(비밀은 서버에만):
//   GOOGLE_CLIENT_ID        : OAuth 클라이언트 ID
//   GOOGLE_CLIENT_SECRET    : OAuth 클라이언트 시크릿
//   GOOGLE_REDIRECT_URI     : 구글 콘솔에 등록한 리디렉션 URI (…/api/calendar/callback)
//   CALENDAR_ALLOWED_ORIGIN : 토큰을 넘겨줄 앱 오리진 (예: http://127.0.0.1:5173)
//
// 하나라도 없으면 휴면한다. reason 은 반드시 'disabled' 여야 한다 —
// 프론트는 이 문자열로만 '기능 없음(조용히 통과)'과 '호출 실패(경고)'를 가른다.

// 읽기 전용 스코프만 요청한다. 캘린더에 쓰지 않는다.
export const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/*
  읽을 캘린더. 'primary' 는 접속한 계정 본인의 캘린더라, 전용 계정이 팀 캘린더에
  초대만 받은 경우 엉뚱하게 빈 캘린더를 읽는다(실제로 그 상황이었다).
  GOOGLE_CALENDAR_ID 를 주면 그 캘린더를, 없으면 예전처럼 primary 를 읽는다.
*/
export function eventsUrl(calendarId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

export type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  recurringEventId?: string;
  /** default | focusTime | outOfOffice | workingLocation | birthday | fromGmail */
  eventType?: string;
  /** opaque(바쁨) | transparent(한가함) */
  transparency?: string;
  organizer?: { email?: string };
  /** self: true 인 항목이 이 캘린더 주인이다. */
  attendees?: { email?: string; self?: boolean; responseStatus?: string }[];
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

export function config() {
  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  const redirectUri = env('GOOGLE_REDIRECT_URI');
  const appOrigin = env('CALENDAR_ALLOWED_ORIGIN');
  if (!clientId || !clientSecret || !redirectUri || !appOrigin) return null;
  // 캘린더 ID 는 선택이다. 없으면 접속 계정의 기본 캘린더를 읽는다.
  const calendarId = env('GOOGLE_CALENDAR_ID') || 'primary';
  return { clientId, clientSecret, redirectUri, appOrigin, calendarId };
}

// 토큰이 오가는 경로다. '*' 로 열지 않고 설정된 오리진만 허용한다.
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/** 구글 일정 → 프론트가 먹는 원시 형태. 필요한 것만 남긴다. */
export function normalizeEvents(items: GoogleEvent[]): unknown[] {
  return items
    // 취소된 일정은 열리지 않은 회의다. 회의 시간에 넣으면 안 된다.
    .filter((item) => item.status !== 'cancelled')
    .filter((item) => Boolean(item.id))
    .map((item) => ({
      id: String(item.id),
      title: item.summary?.trim() || '(제목 없음)',
      startsAt: item.start?.dateTime ?? item.start?.date ?? '',
      endsAt: item.end?.dateTime ?? item.end?.date ?? '',
      // dateTime 이 없고 date 만 있으면 종일 일정이다.
      isAllDay: !item.start?.dateTime,
      isRecurring: Boolean(item.recurringEventId),
      attendeeEmails: (item.attendees ?? [])
        .map((attendee) => attendee.email)
        .filter((email): email is string => Boolean(email)),
      organizerEmail: item.organizer?.email,
      location: item.location,
      description: item.description,
      // 회의인지 아닌지를 가르는 값들. 프론트가 이걸로 집중 시간·부재중·거절한 초대를 걸러낸다.
      eventType: item.eventType,
      selfResponse: (item.attendees ?? []).find((attendee) => attendee.self)?.responseStatus,
      showsAsBusy: item.transparency !== 'transparent',
    }))
    .filter((event) => event.startsAt && event.endsAt);
}

/** 토큰을 opener 로 넘기고 닫히는 콜백 페이지. postMessage 대상 오리진을 명시한다. */
export function callbackPage(appOrigin: string, payload: Record<string, string | number>): string {
  const json = JSON.stringify({ type: 'skgrove:calendar', ...payload });
  return `<!doctype html><meta charset="utf-8"><title>SKonnection</title>
<body style="font:14px/1.6 system-ui;padding:24px;color:#1d2522">
<p>연결을 마쳤습니다. 이 창은 곧 닫힙니다.</p>
<script>
  // 대상 오리진을 '*' 로 두면 아무 창이나 토큰을 받아갈 수 있다.
  try { window.opener && window.opener.postMessage(${json}, ${JSON.stringify(appOrigin)}); } catch (e) {}
  window.close();
</script></body>`;
}
