import type { Gathering, GatheringSignup, GatheringStatus } from './types';

/*
  번개 모임 / 일정공모의 규칙. 화면과 저장소 어디에도 이 계산을 복사하지 않는다.

  설계의 핵심 하나: **확정과 대기를 저장하지 않는다.**
  신청 레코드에 '확정'/'대기' 플래그를 박아두면, 앞사람이 취소할 때마다 뒷사람의
  플래그를 옮겨 써야 한다. 그 쓰기가 한 번이라도 실패하면 정원이 비어 있는데
  대기자가 남아 있는 상태가 되고, 선착순의 신뢰가 깨진다.
  대신 신청 시각으로 정렬해 앞에서 capacity 명까지를 확정으로 '본다'. 취소는
  레코드 삭제 하나면 되고, 승계는 다음 렌더에서 저절로 일어난다.
*/

/** 신청 순서 = 선착순. 시각이 같으면 id 로 갈라 항상 같은 답이 나오게 한다. */
export function sortSignups(signups: GatheringSignup[]) {
  return [...signups].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function signupsFor(gatheringId: string, all: GatheringSignup[]) {
  return sortSignups(all.filter((signup) => signup.gatheringId === gatheringId));
}

/** 확정 / 대기 두 줄로 가른다. capacity 가 null 이면 전원 확정. */
export function splitRoster(gathering: Gathering, signups: GatheringSignup[]) {
  const ordered = signupsFor(gathering.id, signups);
  if (gathering.capacity === null) return { confirmed: ordered, waiting: [] as GatheringSignup[] };
  return { confirmed: ordered.slice(0, gathering.capacity), waiting: ordered.slice(gathering.capacity) };
}

/** 커피뽑기 후보 = 확정 로스터. 대기자는 아직 오는 사람이 아니라 제외한다. */
export function coffeeCandidates(gathering: Gathering, signups: GatheringSignup[]) {
  return splitRoster(gathering, signups).confirmed;
}

/**
 * 커피 담당을 뽑을 수 있는가.
 * 번개(flash) · 취소 아님 · 아직 안 뽑음 · 확정 2명 이상.
 * (주최자 여부는 UI 관심사라 여기서 보지 않는다 — currentUser 를 규칙에 들이지 않는다.)
 */
export function canDrawCoffee(gathering: Gathering, signups: GatheringSignup[]) {
  if (gathering.kind !== 'flash') return false;
  if (!gathering.coffeeDraw) return false; // 주최자가 만들 때 커피 뽑기를 켠 번개에서만
  if (gathering.canceled) return false;
  if (gathering.coffeePick) return false;
  return coffeeCandidates(gathering, signups).length >= 2;
}

export function confirmedCount(gathering: Gathering, signups: GatheringSignup[]) {
  return splitRoster(gathering, signups).confirmed.length;
}

/** 남은 자리. 제한 없음이면 null — 0 을 돌려주면 '자리 없음'과 구분되지 않는다. */
export function spotsLeft(gathering: Gathering, signups: GatheringSignup[]) {
  if (gathering.capacity === null) return null;
  return Math.max(0, gathering.capacity - confirmedCount(gathering, signups));
}

export function isFull(gathering: Gathering, signups: GatheringSignup[]) {
  return spotsLeft(gathering, signups) === 0;
}

/** 이 사람이 신청했는가. 실명 기준이라 한 사람이 두 번 신청할 수 없다. */
export function mySignup(gathering: Gathering, signups: GatheringSignup[], name: string) {
  return signupsFor(gathering.id, signups).find((signup) => signup.name === name) ?? null;
}

/** 신청했다면 확정인지 대기인지. 안 했으면 null. */
export function mySeat(gathering: Gathering, signups: GatheringSignup[], name: string) {
  const { confirmed, waiting } = splitRoster(gathering, signups);
  if (confirmed.some((signup) => signup.name === name)) return '확정' as const;
  const index = waiting.findIndex((signup) => signup.name === name);
  if (index >= 0) return { 대기: index + 1 } as const;
  return null;
}

/*
  상태는 저장하지 않고 파생시킨다. 저장하면 "마감 시각이 지났는데 모집중으로 남은"
  어긋남이 반드시 생긴다 — 상태를 바꿔줄 사람이 아무도 접속하지 않는 시간이 있기 때문이다.
  취소만은 주최자의 의사라 시각으로 알 수 없어 플래그로 남긴다.
*/
export function deriveStatus(gathering: Gathering, signups: GatheringSignup[], now: string): GatheringStatus {
  if (gathering.canceled) return '취소';
  if (now >= gathering.startAt) {
    // 시작 시각이 지난 뒤에는 사람이 모였는지가 결과를 가른다.
    const enough = gathering.minPeople === null || confirmedCount(gathering, signups) >= gathering.minPeople;
    return enough ? '진행함' : '종료';
  }
  if (now >= gathering.closeAt) return '마감';
  if (isFull(gathering, signups)) return '마감';
  return '모집중';
}

export function isOpen(gathering: Gathering, signups: GatheringSignup[], now: string) {
  return deriveStatus(gathering, signups, now) === '모집중';
}

/*
  정원이 찼어도 대기는 받는다. 다만 마감 시각이 지났거나 취소·종료된 건에는
  대기도 받지 않는다 — 승계될 기회가 없는 줄에 세우는 것은 기만이다.
*/
export function canJoinWaitlist(gathering: Gathering, signups: GatheringSignup[], now: string) {
  const status = deriveStatus(gathering, signups, now);
  return status === '마감' && now < gathering.closeAt && !gathering.canceled;
}

/** 최소 인원에 못 미치는가. 주최자에게 "접을지" 판단 근거를 준다. */
export function belowMinimum(gathering: Gathering, signups: GatheringSignup[]) {
  if (gathering.minPeople === null) return false;
  return confirmedCount(gathering, signups) < gathering.minPeople;
}

/*
  목록 정렬: 아직 열린 것이 위, 그 안에서는 임박한 순.
  끝난 것은 최근에 끝난 순으로 아래에 쌓인다 — 포스터가 쌓여 보이려면
  지난 것도 사라지지 않고 남아야 한다.
*/
export function sortGatherings(items: Gathering[], signups: GatheringSignup[], now: string) {
  return [...items].sort((a, b) => {
    const aOver = deriveStatus(a, signups, now) === '진행함' || deriveStatus(a, signups, now) === '종료';
    const bOver = deriveStatus(b, signups, now) === '진행함' || deriveStatus(b, signups, now) === '종료';
    if (aOver !== bOver) return aOver ? 1 : -1;
    // 지난 모임은 최신이 위, 앞으로 올 모임은 임박한 것이 위.
    return aOver ? b.startAt.localeCompare(a.startAt) : a.startAt.localeCompare(b.startAt);
  });
}

/** 'YYYY-MM-DDTHH:mm' → '8월 5일(수) 오후 7:00'. 원본 문자열은 사람이 읽기 어렵다. */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatWhen(startAt: string) {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return startAt;
  const hour = date.getHours();
  const meridiem = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${WEEKDAYS[date.getDay()]}) ${meridiem} ${hour12}:${minute}`;
}

/** 시작까지 남은 시간을 사람 말로. 번개는 "3시간 뒤"가 날짜보다 훨씬 잘 읽힌다. */
export function timeUntil(startAt: string, now: string) {
  const diff = Date.parse(startAt) - Date.parse(now);
  if (Number.isNaN(diff)) return '';
  if (diff <= 0) return '지났어요';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes}분 뒤`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 뒤`;
  return `${Math.round(hours / 24)}일 뒤`;
}
