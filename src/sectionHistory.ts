/*
  뒤로가기 — 화면 전환을 브라우저 히스토리에 쌓는다.

  이 앱은 라우터 없이 App 의 active 상태 하나로 화면을 바꾼다. 그래서 화면을 옮겨도
  히스토리에 아무것도 남지 않고, 뒤로가기를 누르면 '이전 화면'이 아니라 앱 밖(들어오기
  전 페이지)으로 나가 버렸다. 모바일에선 뒤로가기·스와이프가 사실상 유일한 '돌아가기'
  동작이라, 메뉴 하나 잘못 누르면 앱이 통째로 닫히는 것처럼 보인다.

  주소(해시)를 쓰지 않고 history.state 에만 화면 id 를 담는 이유:
  해시는 이미 슬랙 딥링크가 '한 번 읽고 지우는' 용도로 쓰고 있다(App.tsx 의 applyHash).
  뒤로가기까지 해시로 굴리면 지우는 쪽과 쌓는 쪽이 서로를 덮어써 엉킨다. state 만 쓰면
  주소창은 건드리지 않고 히스토리 항목만 쌓을 수 있다.
*/
import type { Section } from './types';

// history.state 는 다른 스크립트(Supabase 리다이렉트 등)와 공유하는 자리다.
// 남의 값과 섞이지 않도록 앱 이름을 붙인 키 하나만 쓴다.
const SECTION_KEY = 'skgroveSection';
// 어느 로그인에서 쌓은 항목인가. 로그아웃해도 브라우저 히스토리는 지울 수 없어서,
// 앞사람이 쌓아둔 항목이 뒤에 그대로 남는다. 표식이 다르면 우리 것이 아니라고 보고 무시한다.
const LOGIN_KEY = 'skgroveLogin';
/*
  화면 안에서 연 상세(예: 캔미팅 세션 하나). 섹션만 쌓으면 캔미팅 상세에서 뒤로가기를 눌렀을 때
  세션 목록이 아니라 직전 화면(대개 홈)으로 나가버린다. 상세를 열 때 한 칸 더 쌓아 두면
  첫 뒤로가기는 목록으로, 그다음이 이전 화면으로 간다.
*/
const DETAIL_KEY = 'skgroveDetail';

/*
  Record<Section, true> 라서 Section 에 화면을 추가하면 여기도 채우지 않는 한 tsc 가 막는다.
  목록을 따로 들고 있으면서도 원본과 어긋나지 않게 하는 장치다.
*/
const KNOWN_SECTIONS: Record<Section, true> = {
  dashboard: true,
  mypage: true,
  guide: true,
  intake: true,
  leader: true,
  agenda: true,
  actions: true,
  meetings: true,
  gatherings: true,
  profiles: true,
  connect: true,
  seating: true,
  memory: true,
  metrics: true,
  growth: true,
  accounts: true,
  system: true,
  platform: true,
  notifications: true,
  humor: true,
  market: true,
};

export function isSection(value: unknown): value is Section {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(KNOWN_SECTIONS, value);
}

/** 로그인 1회를 가리키는 표식. 로그인할 때마다 새로 만든다. */
export function newLoginKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** pushState/replaceState 에 넣을 상태 객체. detail 은 화면 안에서 연 상세의 id. */
export function sectionHistoryState(
  section: Section,
  loginKey: string,
  detail: string | null = null,
): Record<string, unknown> {
  return { [SECTION_KEY]: section, [LOGIN_KEY]: loginKey, [DETAIL_KEY]: detail };
}

/**
 * popstate 로 돌아온 항목에서 화면 id 를 읽는다.
 * 우리가(이번 로그인에서) 쌓지 않은 항목이면 null — 앱 진입 전 페이지, 남이 넣은 state,
 * 앞사람 로그인이 남긴 항목이 여기 해당한다. 이때는 화면을 건드리지 않는다.
 */
export function sectionFromHistoryState(state: unknown, loginKey: string): Section | null {
  if (!state || typeof state !== 'object') return null;
  const bag = state as Record<string, unknown>;
  if (bag[LOGIN_KEY] !== loginKey) return null;
  const value = bag[SECTION_KEY];
  return isSection(value) ? value : null;
}

/**
 * 히스토리에 새 항목을 쌓을지. 같은 메뉴를 여러 번 누르면 항목만 불어나고
 * 뒤로가기를 그 횟수만큼 눌러야 겨우 이전 화면이 나온다 — 같은 화면이면 쌓지 않는다.
 */
export function shouldPushSection(current: Section, next: Section): boolean {
  return current !== next;
}

/**
 * 돌아온 항목이 열고 있던 상세의 id. 우리가 쌓은 항목이 아니거나 상세가 없으면 null.
 */
export function detailFromHistoryState(state: unknown, loginKey: string): string | null {
  if (!state || typeof state !== 'object') return null;
  const bag = state as Record<string, unknown>;
  if (bag[LOGIN_KEY] !== loginKey) return null;
  const value = bag[DETAIL_KEY];
  return typeof value === 'string' && value ? value : null;
}
