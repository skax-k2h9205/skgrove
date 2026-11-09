// 이음장터 '행사 벼룩시장' 정의.
//
// 평소 이음장터는 상시 장터 하나다. 캔미팅 같은 특정 행사 때만 그날의 물건을
// 상시 물건과 섞이지 않게 따로 모으고 싶다 — 그래서 물건마다 'eventTag' 를 달고
// 여기 정의된 행사별로 가른다. (MarketItem.eventTag, market_items.event_tag)
//
// 운영 방법:
//  - 행사를 열 때: 아래 목록에 { tag, label, active: true } 한 줄을 추가한다.
//    그러면 등록 폼에 '어느 장터' 선택지와 보드 상단 탭에 그 행사가 뜬다.
//  - 행사가 끝나면: 그 줄의 active 를 false 로 바꾼다. 물건·낙찰 기록은 그대로 남고,
//    등록 선택지에서만 빠진다. 보드 탭은 그 행사에 물건이 있는 한 '지난 행사'로 계속 보인다.
//  - tag 는 한 번 정하면 바꾸지 않는다(물건에 저장된 값과 짝이라서). label 만 바꾸면 된다.
//    다음 행사는 겹치지 않는 새 tag 로 추가한다(예: 'canmeeting-2027').

export type MarketEvent = {
  /** 물건에 저장되는 식별자. 바꾸지 말 것. */
  tag: string;
  /** 탭·선택지에 보이는 이름. 자유롭게 바꿀 수 있다. */
  label: string;
  /** true 면 지금 등록 가능한 행사(폼 선택지+탭). 끝나면 false. */
  active: boolean;
  /** 수익을 팀에 기부하는 행사면 true — 그 탭 상단에 '모금 현황'(거래완료 낙찰가 합)을 띄운다.
   *  상시 장터는 판매금이 개인 것이라 모금이 아니므로 항상 false 취급. */
  fundraiser?: boolean;
  /** 마감을 이 시각으로 고정한다(사용자가 못 바꿈). 'YYYY-MM-DDTHH:mm' 로컬.
   *  당일 일괄 마감하는 행사용 — 폼에서 마감 선택 UI를 숨기고 이 값을 그대로 쓴다. */
  fixedCloseAt?: string;
  /** 공개(오픈) 시각 'YYYY-MM-DDTHH:mm'. 이 시각 전에는 '공개 전' — 남의 물건이
   *  사진·제목·가격·설명 없이 '???'로 가려지고(겉보기 티저), 홈 피드에도 안 뜬다.
   *  운영 중 바꿀 수 있다: app_config 오버라이드가 이 기본값을 이긴다([[configStore]]). */
  openAt?: string;
  /** true 면 이 행사 탭에 크리스마스 테마(스노우폴)를 입힌다. 그 탭 화면에만 적용되고
   *  상시 장터·다른 화면은 그대로다. 행사가 끝나면 이 줄만 지우면 된다. */
  xmas?: boolean;
};

export const MARKET_EVENTS: MarketEvent[] = [
  {
    tag: 'canmeeting-2026',
    label: '🎪 캔미팅 벼룩시장',
    active: true,
    fundraiser: true,
    fixedCloseAt: '2026-11-30T12:50',
    openAt: '2026-11-30T12:00',
    xmas: true,
  },
];

/** 공개 시각 오버라이드 맵(태그 → 'YYYY-MM-DDTHH:mm'). 팀 공용 설정에 저장한다. */
export type MarketOpenOverrides = Record<string, string>;

/** 이 행사의 실효 공개 시각. 운영 중 바꾼 오버라이드가 코드 기본값을 이긴다. 없으면 undefined(항상 공개). */
export function marketOpenAt(tag: string | undefined, overrides?: MarketOpenOverrides): string | undefined {
  if (!tag) return undefined;
  return overrides?.[tag] ?? marketEvent(tag)?.openAt;
}

/** 아직 공개 전인가 — 행사 물건이고, 공개 시각이 있고, 지금이 그 전. 상시 물건은 항상 false. */
export function isPreOpen(item: { eventTag?: string }, now: string, overrides?: MarketOpenOverrides): boolean {
  const openAt = marketOpenAt(item.eventTag, overrides);
  return Boolean(openAt && now < openAt);
}

/** 태그로 행사 정의를 찾는다. 상시(빈 태그)거나 모르는 태그면 undefined. */
export function marketEvent(tag?: string): MarketEvent | undefined {
  if (!tag) return undefined;
  return MARKET_EVENTS.find((event) => event.tag === tag);
}

/** 지금 등록 가능한(active) 행사들. 등록 폼의 '행사' 선택지에 쓴다. */
export function activeMarketEvents(): MarketEvent[] {
  return MARKET_EVENTS.filter((event) => event.active);
}
