import type { MarketBid, MarketItem, MarketStatus } from './types';

/*
  이음장터의 규칙. 화면과 저장소 어디에도 이 계산을 복사하지 않는다.

  설계의 핵심 둘 — 모임·번개에서 배운 것을 그대로 가져왔다.

  1. **낙찰자를 저장하지 않는다.** 입찰 레코드에 '낙찰' 플래그를 박아두면 마감 시각에
     그 플래그를 써줄 사람이 필요한데, 아무도 접속하지 않는 시간이 반드시 있다.
     대신 입찰 목록에서 최고가를 '본다'. 마감이 지나면 저절로 낙찰이 된다.

  2. **나눔과 경매가 같은 표를 쓴다.** 나눔은 금액 0 짜리 입찰 하나다. 그래서
     "가장 앞선 사람" 하나만 고르면 선착순이 되고, 경매는 "가장 높은 사람"이 된다.
     정렬 기준만 다르고 나머지 규칙(마감·취소·완료)은 한 벌로 유지된다.
*/

/** 마감 임박 판정 기준(분). 이 안에 들어온 입찰은 마감을 밀어낸다. */
export const SNIPE_GUARD_MINUTES = 3;

/** 입찰 정렬의 유일한 근거. 시각이 같으면 id 로 갈라 항상 같은 답이 나오게 한다. */
export function sortBids(bids: MarketBid[]) {
  return [...bids].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function bidsFor(itemId: string, all: MarketBid[]) {
  return sortBids(all.filter((bid) => bid.itemId === itemId));
}

/*
  이 물건을 가져갈 사람. 경매는 최고가, 나눔은 선착순.
  동액이면 **먼저 부른 사람**이 이긴다 — 나중 사람이 같은 값으로 가로채면
  먼저 부른 사람 입장에서는 규칙이 없는 것과 같다.
*/
export function leadingBid(item: MarketItem, bids: MarketBid[]): MarketBid | null {
  const ordered = bidsFor(item.id, bids);
  if (ordered.length === 0) return null;
  if (item.kind === 'giveaway') return ordered[0];
  return ordered.reduce((top, bid) => (bid.amount > top.amount ? bid : top), ordered[0]);
}

/** 지금 가격. 아무도 안 불렀으면 시작가 그대로. */
export function currentPrice(item: MarketItem, bids: MarketBid[]) {
  if (item.kind === 'giveaway') return 0;
  const top = leadingBid(item, bids);
  return top ? top.amount : item.startPrice;
}

/** 다음에 부를 수 있는 최소 금액. 첫 입찰은 시작가부터 가능하다. */
export function minNextBid(item: MarketItem, bids: MarketBid[]) {
  if (item.kind === 'giveaway') return 0;
  const top = leadingBid(item, bids);
  return top ? top.amount + item.minStep : item.startPrice;
}

export function bidCount(item: MarketItem, bids: MarketBid[]) {
  return bidsFor(item.id, bids).length;
}

export function myBid(item: MarketItem, bids: MarketBid[], name: string) {
  return bidsFor(item.id, bids).find((bid) => bid.name === name) ?? null;
}

/** 실제 마감 시각. 막판 입찰로 밀렸으면 밀린 쪽이 기준이다. */
export function effectiveCloseAt(item: MarketItem) {
  if (!item.extendedTo) return item.closeAt;
  return item.extendedTo > item.closeAt ? item.extendedTo : item.closeAt;
}

/*
  마감 직전에 들어온 입찰인가. 맞으면 마감을 SNIPE_GUARD_MINUTES 만큼 민다.
  이걸 안 하면 마지막 1초에 부르고 끝내는 사람이 항상 이기고, 그 뒤로는
  아무도 미리 부르지 않게 된다(먼저 부르면 손해라는 학습).
*/
export function extendedCloseFor(item: MarketItem, now: string): string | null {
  const close = Date.parse(effectiveCloseAt(item));
  const at = Date.parse(now);
  if (Number.isNaN(close) || Number.isNaN(at)) return null;
  const leftMinutes = (close - at) / 60000;
  if (leftMinutes < 0 || leftMinutes > SNIPE_GUARD_MINUTES) return null;

  const pushed = new Date(at + SNIPE_GUARD_MINUTES * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pushed.getFullYear()}-${pad(pushed.getMonth() + 1)}-${pad(pushed.getDate())}` +
    `T${pad(pushed.getHours())}:${pad(pushed.getMinutes())}`
  );
}

/*
  상태는 저장하지 않고 파생시킨다. 취소만은 판매자의 의사라 시각으로 알 수 없어
  플래그로 남긴다. 마감 뒤에는 가져갈 사람이 있었는지가 결과를 가른다 —
  아무도 안 불렀으면 '거래완료'가 아니라 '유찰'이어야 판매자가 다시 올릴지 판단한다.
*/
export function deriveStatus(item: MarketItem, bids: MarketBid[], now: string): MarketStatus {
  if (item.canceled) return '취소';
  // 나눔은 선착순이라 먼저 받은 사람이 나오는 순간 끝난다. 마감은 아무도 안 받았을 때
  // 유찰로 넘기는 데만 쓴다 — 경매처럼 마감까지 기다리게 하면 이미 임자가 정해졌는데도
  // '거래중'으로 남는다.
  if (item.kind === 'giveaway' && leadingBid(item, bids)) return '거래완료';
  if (now < effectiveCloseAt(item)) return '거래중';
  return leadingBid(item, bids) ? '거래완료' : '유찰';
}

export function isOpen(item: MarketItem, bids: MarketBid[], now: string) {
  return deriveStatus(item, bids, now) === '거래중';
}

/*
  물건을 수정할 수 있는가. 본인 물건이고, 아직 거래중이며, 아무도 입찰하지 않았을 때만.
  입찰이 붙으면 그 사람은 가격·마감·물건을 믿고 건 것이라, 몰래 바꾸면 '입찰 취소 불가'
  원칙과 어긋난다(대칭). 그 뒤엔 취소(→입찰자 알림)로만 조건을 바꾼다.
  수정 버튼 노출과 저장 가드가 같은 규칙을 봐야 해서 한곳에 둔다.
*/
export function canEditMarketItem(item: MarketItem, bids: MarketBid[], now: string, userName: string) {
  if (item.seller !== userName) return false;
  if (deriveStatus(item, bids, now) !== '거래중') return false;
  return bidCount(item, bids) === 0;
}

/*
  이 사람이 지금 입찰할 수 있는가. 막는 이유를 문자열로 돌려준다 —
  버튼을 흐리게만 두면 사용자는 고장으로 읽는다(팀 카피 원칙).
  null 이면 입찰 가능.
*/
export function bidBlockedReason(
  item: MarketItem,
  bids: MarketBid[],
  now: string,
  name: string,
): string | null {
  const status = deriveStatus(item, bids, now);
  if (status === '취소') return '판매자가 거래를 취소했어요.';
  if (item.seller === name) return '내가 올린 물건이에요.';

  // 나눔은 누군가 받으면 끝난다. 받은 사람이 나인지 남인지 구분해서 알린다.
  // (예전엔 '남이 가져감' 검사가 내 신청까지 잡아, 정작 내가 받았는데도 "다른 분이
  //  가져갔어요"가 떴다. 본인 검사가 그 뒤라 영영 닿지 않았다.)
  if (item.kind === 'giveaway') {
    if (myBid(item, bids, name)) return '이미 받으셨어요.';
    if (leadingBid(item, bids)) return '이미 다른 분이 가져갔어요.';
  }

  if (status !== '거래중') return '마감된 거래예요.';
  return null;
}

/** 낙찰자. 마감 전에는 아직 아무도 아니다 — 진행 중 최고가를 낙찰로 부르면 오해가 생긴다. */
export function winner(item: MarketItem, bids: MarketBid[], now: string) {
  if (deriveStatus(item, bids, now) !== '거래완료') return null;
  return leadingBid(item, bids);
}

/** 양쪽이 다 눌러야 거래가 끝난 것으로 본다. 한쪽 말만으로 정하지 않는다. */
export function isSettled(item: MarketItem) {
  return item.sellerDone && item.buyerDone;
}

/*
  목록 정렬: 거래중이 위, 그 안에서는 곧 마감되는 순. 끝난 것은 최근 순으로 아래에 쌓인다.
  포스터가 쌓여 보이려면 지난 것도 사라지지 않고 남아야 한다(모임과 같은 판단).
*/
export function sortItems(items: MarketItem[], bids: MarketBid[], now: string) {
  return [...items].sort((a, b) => {
    const aOpen = isOpen(a, bids, now);
    const bOpen = isOpen(b, bids, now);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    const aClose = effectiveCloseAt(a);
    const bClose = effectiveCloseAt(b);
    return aOpen ? aClose.localeCompare(bClose) : bClose.localeCompare(aClose);
  });
}

/** 마감까지 남은 시간을 사람 말로. '2026-08-06T18:00' 은 읽고 계산해야 한다. */
export function timeLeft(item: MarketItem, now: string) {
  const diff = Date.parse(effectiveCloseAt(item)) - Date.parse(now);
  if (Number.isNaN(diff)) return '';
  if (diff <= 0) return '마감됨';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes}분 남음`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 남음`;
  return `${Math.round(hours / 24)}일 남음`;
}

/** 금액 표기. 3자리 구분과 '원'을 한 곳에서만 붙인다. */
export function formatPrice(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/* ===== 랭킹 — 시작부터 지금까지 누적 =====
   유~머게시판은 달마다 끊지만 여기는 끊지 않는다. 거래는 글보다 훨씬 드물게
   일어나서, 달로 끊으면 매달 1일마다 순위표가 비어 아무 말도 하지 못한다. */

export type MarketRanker = { name: string; count: number };

function rank(counts: Map<string, number>): MarketRanker[] {
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);
}

/** 거래가 성사된 건만 센다. 올려두기만 한 것이나 유찰은 실적이 아니다. */
function closedDeals(items: MarketItem[], bids: MarketBid[], now: string) {
  return items.filter((item) => deriveStatus(item, bids, now) === '거래완료');
}

export function rankSellers(items: MarketItem[], bids: MarketBid[], now: string) {
  const counts = new Map<string, number>();
  closedDeals(items, bids, now)
    .filter((item) => item.kind === 'auction')
    .forEach((item) => counts.set(item.seller, (counts.get(item.seller) ?? 0) + 1));
  return rank(counts);
}

export function rankGivers(items: MarketItem[], bids: MarketBid[], now: string) {
  const counts = new Map<string, number>();
  closedDeals(items, bids, now)
    .filter((item) => item.kind === 'giveaway')
    .forEach((item) => counts.set(item.seller, (counts.get(item.seller) ?? 0) + 1));
  return rank(counts);
}

export function rankBuyers(items: MarketItem[], bids: MarketBid[], now: string) {
  const counts = new Map<string, number>();
  closedDeals(items, bids, now).forEach((item) => {
    const won = leadingBid(item, bids);
    if (won) counts.set(won.name, (counts.get(won.name) ?? 0) + 1);
  });
  return rank(counts);
}

/** 큰손 — 지금까지 가장 많이 쓴 사람. 건수가 아니라 금액이라 별도로 센다. */
export function rankBigSpenders(items: MarketItem[], bids: MarketBid[], now: string) {
  const totals = new Map<string, number>();
  closedDeals(items, bids, now)
    .filter((item) => item.kind === 'auction')
    .forEach((item) => {
      const won = leadingBid(item, bids);
      if (won) totals.set(won.name, (totals.get(won.name) ?? 0) + won.amount);
    });
  return rank(totals);
}
