import type { MarketBid, MarketItem, MarketStatus } from './types';
import { isPreOpen, isRaffleGiveaway, marketOpenAt, type MarketOpenOverrides } from './features/market/marketEvents';

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

/* ===== 추첨 나눔 =====
   캔미팅 같은 행사의 나눔은 '선착순'이 아니라 마감 후 '무작위 1명 추첨'이다(marketEvents.giveawayRaffle).

   선착순과 같은 설계 원칙을 지킨다 — **당첨자를 저장하지 않는다.** 서버에 "당첨" 플래그를
   박아 두면 마감 시각에 그걸 뽑아 줄 사람이 필요한데, 아무도 접속 안 하는 시간이 반드시 있다.
   대신 신청 목록에서 **결정적으로(seeded)** 계산한다 — 모든 클라이언트가 같은 신청 목록을 보면
   같은 당첨자를 얻는다. 추첨기(Math.random)는 쓸 수 없다(기기마다 달라진다).

   1인 1표. 같은 사람이 여러 번 눌러도(중복 레코드가 있어도) 한 표로 묶는다. */

/** 외부 의존성 없는 결정적 해시(djb2). 같은 문자열이면 어떤 기기에서도 같은 부호 없는 32비트 정수. */
function djb2(input: string): number {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    // hash * 33 + charCode. '| 0' 로 32비트 정수에 가둬 기기·엔진 차이를 없앤다.
    hash = (((hash << 5) + hash) + input.charCodeAt(index)) | 0;
  }
  return hash >>> 0; // 부호 없는 32비트
}

/** 이 물건의 신청자(1인 1표). 같은 이름의 중복 신청은 가장 이른 것 하나로 묶는다. */
export function raffleEntrants(item: MarketItem, bids: MarketBid[]): MarketBid[] {
  const seen = new Set<string>();
  const entrants: MarketBid[] = [];
  for (const bid of bidsFor(item.id, bids)) {
    if (seen.has(bid.name)) continue;
    seen.add(bid.name);
    entrants.push(bid);
  }
  return entrants;
}

/*
  당첨자를 결정적으로 고른다(시각과 무관한 순수 계산). seed 는 물건 id 와 신청자 이름들을
  이어 붙인 값의 해시라, 신청자 구성이 그대로면 몇 번을 돌려도 같은 사람이 나온다.
  신청자가 한 명 더 들어오면 seed 가 바뀌어 당첨자도 바뀔 수 있는데, 이는 마감 전까지의
  일이고 마감 뒤 목록은 고정되므로 결과도 고정된다.
*/
function rafflePick(item: MarketItem, bids: MarketBid[]): MarketBid | null {
  const entrants = raffleEntrants(item, bids);
  if (entrants.length === 0) return null;
  // 구분자(\u0000)로 이어 붙여 '이관'+'국' 과 '이'+'관국' 이 같은 seed 가 되는 충돌을 막는다.
  const seed = djb2(`${item.id}\u0000${entrants.map((bid) => bid.name).join('\u0000')}`);
  return entrants[seed % entrants.length];
}

/*
  추첨 당첨자(공개용). 마감 전에는 아직 아무도 아니다 — 돌려보기 전에 당첨자를 보이면
  추첨의 뜻이 없다. 마감 뒤 신청자 0명이면 유찰(null), 1명 이상이면 결정적으로 뽑힌 한 명.
*/
export function raffleWinner(item: MarketItem, bids: MarketBid[], now: string): MarketBid | null {
  if (now < effectiveCloseAt(item)) return null;
  return rafflePick(item, bids);
}

/*
  이 물건을 가져갈 사람. 경매는 최고가, 나눔은 선착순 — 단 '추첨 나눔'이면 결정적으로 뽑힌 한 명.
  동액이면 **먼저 부른 사람**이 이긴다 — 나중 사람이 같은 값으로 가로채면
  먼저 부른 사람 입장에서는 규칙이 없는 것과 같다.

  추첨 나눔의 '뽑힌 사람'은 시각과 무관한 결정적 값이다(rafflePick). 마감 전에 당첨자를
  내보이지 않는 시각 제어는 deriveStatus·winner 가 하고, 여기서는 "누가 뽑히는가"만 본다.
*/
export function leadingBid(item: MarketItem, bids: MarketBid[]): MarketBid | null {
  const ordered = bidsFor(item.id, bids);
  if (ordered.length === 0) return null;
  if (item.kind === 'giveaway') return isRaffleGiveaway(item) ? rafflePick(item, bids) : ordered[0];
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
  // 선착순 나눔은 먼저 받은 사람이 나오는 순간 끝난다. 마감은 아무도 안 받았을 때 유찰로
  // 넘기는 데만 쓴다 — 경매처럼 마감까지 기다리게 하면 이미 임자가 정해졌는데도 '거래중'으로 남는다.
  // 단 '추첨 나눔'은 반대다: 신청이 들어와도 마감 전까지는 당첨자가 없으므로(경매처럼) 마감을
  // 기다려야 한다. 그래서 선착순일 때만 이 이른-완료 분기를 탄다.
  if (item.kind === 'giveaway' && !isRaffleGiveaway(item) && leadingBid(item, bids)) return '거래완료';
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
  openOverrides?: MarketOpenOverrides,
): string | null {
  const status = deriveStatus(item, bids, now);
  if (status === '취소') return '판매자가 거래를 취소했어요.';
  if (item.seller === name) return '내가 올린 물건이에요.';

  // 오픈 전 — 물건은 등록 즉시 보이지만 입찰·신청은 오픈 시각부터 연다.
  // (예전엔 오픈 전 남의 물건을 통째로 가렸다. 지금은 '보이되 액션만 잠근다'.)
  if (isPreOpen(item, now, openOverrides)) {
    const openAt = marketOpenAt(item.eventTag, openOverrides);
    const when = openAt ? `${openAt.slice(5, 10).replace('-', '/')} ${openAt.slice(11, 16)}` : '오픈';
    return item.kind === 'giveaway'
      ? `아직 오픈 전이에요 · ${when}부터 신청할 수 있어요.`
      : `아직 오픈 전이에요 · ${when}부터 입찰할 수 있어요.`;
  }

  // 추첨 나눔: 선착순과 달리 "먼저 받은 사람"이 없다. 마감 전이면 누구나 신청할 수 있고
  // (이미 신청했으면 화면이 버튼을 '취소'로 바꾼다 — 그건 막는 게 아니다), 마감 뒤에는
  // 신청을 닫는다. '이미 다른 분이 가져갔어요'로 막지 않는다.
  if (item.kind === 'giveaway' && isRaffleGiveaway(item)) {
    if (status !== '거래중') return '추첨 신청이 마감됐어요.';
    return null;
  }

  // 선착순 나눔은 누군가 받으면 끝난다. 받은 사람이 나인지 남인지 구분해서 알린다.
  // (예전엔 '남이 가져감' 검사가 내 신청까지 잡아, 정작 내가 받았는데도 "다른 분이
  //  가져갔어요"가 떴다. 본인 검사가 그 뒤라 영영 닿지 않았다.)
  if (item.kind === 'giveaway') {
    if (myBid(item, bids, name)) return '이미 받으셨어요.';
    if (leadingBid(item, bids)) return '이미 다른 분이 가져갔어요.';
  }

  if (status !== '거래중') return '마감된 거래예요.';
  return null;
}

/* ===== 랜덤박스 =====
   안에 뭐가 들었는지 모른 채 부르는 경매. 내용물(제목·사진·설명)은 처음부터 저장돼 있고,
   '열었는가'만 revealedAt 으로 남긴다. 열기 전엔 격자·상세·알림·홈 피드 어디서도 제목이
   새면 안 되므로, 보여줄 이름은 반드시 publicTitle 을 거친다. */

export const MYSTERY_TITLE = '랜덤박스';

/** 아직 안 연 랜덤박스인가. 일반 물건과 이미 연 박스는 false. */
export function isMysteryHidden(item: Pick<MarketItem, 'mystery' | 'revealedAt'>) {
  return Boolean(item.mystery) && !item.revealedAt;
}

/** 화면·알림에 쓸 제목. 안 연 랜덤박스는 진짜 제목 대신 '랜덤박스'. */
export function publicTitle(item: Pick<MarketItem, 'title' | 'mystery' | 'revealedAt'>) {
  return isMysteryHidden(item) ? MYSTERY_TITLE : item.title;
}

/*
  지금 이 박스를 열 수 있는가. 낙찰이 확정(거래완료)된 뒤에만 — 입찰 중에 열리면
  랜덤박스가 아니다. 누가 여는지는 호출부가 권한(리더·커넥셔너)으로 정해 privileged 로 넘긴다.
  규칙 모듈은 사용자 역할 체계를 모르는 채로 둔다.
*/
export function canRevealMystery(item: MarketItem, bids: MarketBid[], now: string, privileged: boolean) {
  if (!privileged) return false;
  if (!isMysteryHidden(item)) return false;
  return deriveStatus(item, bids, now) === '거래완료';
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

/**
 * 모금 집계(행사 벼룩시장). 낙찰 확정(거래완료)된 경매 낙찰가의 합을 모금액으로 본다.
 * 나눔은 0원이라 금액엔 안 잡히고 건수로만 센다. 진행중 경매는 아직 확정 전이라 금액 제외.
 */
export function fundraiseSummary(items: MarketItem[], bids: MarketBid[], now: string) {
  let total = 0;
  let soldCount = 0;
  let ongoingCount = 0;
  let giveawayCount = 0;
  for (const item of items) {
    const status = deriveStatus(item, bids, now);
    if (item.kind === 'auction') {
      if (status === '거래완료') {
        total += currentPrice(item, bids);
        soldCount += 1;
      } else if (status === '거래중') {
        ongoingCount += 1;
      }
    } else if (status === '거래완료') {
      giveawayCount += 1;
    }
  }
  return { total, soldCount, ongoingCount, giveawayCount };
}

/* ===== 시세판 — 주식창처럼 보는 행사 경매 =====
   가격은 입찰에서만 오르고 내려가지 않는다. 그래서 '변동'은 언제나 시작가 대비 상승분이고,
   스파크라인은 계단형으로 올라가기만 한다. 아래 함수들은 그 그림의 근거 숫자만 만든다. */

export type PricePoint = { at: string; amount: number };

/** 가격 흐름. 등록(시작가)에서 출발해 입찰이 들어온 순서대로 최고가가 갱신된 자취. */
export function priceHistory(item: MarketItem, bids: MarketBid[]): PricePoint[] {
  const points: PricePoint[] = [{ at: item.createdAt, amount: item.startPrice }];
  let top = item.startPrice;
  for (const bid of bidsFor(item.id, bids)) {
    if (bid.amount > top) {
      top = bid.amount;
      points.push({ at: bid.createdAt, amount: top });
    }
  }
  return points;
}

/** 시작가 대비 얼마나 올랐나. 시작가 0(나눔)이면 비율은 0으로 둔다 — 0으로 나눌 수 없다. */
export function priceChange(item: MarketItem, bids: MarketBid[]) {
  const diff = currentPrice(item, bids) - item.startPrice;
  const pct = item.startPrice > 0 ? (diff / item.startPrice) * 100 : 0;
  return { diff, pct };
}

/*
  시세판에 올릴 물건: 경매만, 취소 제외. 많이 오른 순 → 같은 비율이면 비싼 순 → 제목순.
  나눔은 값이 없어 시세판에 둘 자리가 없고, 취소는 더 움직이지 않으니 뺀다.
  마감된 경매는 남긴다 — 낙찰가가 확정된 '종가'로 읽히는 게 주식창의 문법이다.
*/
export function tickerItems(items: MarketItem[], bids: MarketBid[]) {
  return items
    .filter((item) => item.kind === 'auction' && !item.canceled)
    .sort((a, b) => {
      const ca = priceChange(a, bids);
      const cb = priceChange(b, bids);
      return cb.pct - ca.pct || currentPrice(b, bids) - currentPrice(a, bids) || a.title.localeCompare(b.title);
    });
}

/** 최근 체결(입찰) — 시세판 물건에 붙은 입찰을 최신순으로. 테이프·체결 내역에 쓴다. */
export function recentBids(items: MarketItem[], bids: MarketBid[], limit = 12) {
  const ids = new Set(tickerItems(items, bids).map((item) => item.id));
  return sortBids(bids.filter((bid) => ids.has(bid.itemId)))
    .reverse()
    .slice(0, limit);
}

/**
 * 시세판 지수 — 올라온 경매 전체의 현재가 합과 시작가 합. 둘의 차가 "오늘 얼마나 올랐나".
 * 모금 현황(fundraiseSummary)은 확정된 낙찰가만 세지만, 지수는 진행 중인 호가까지 더한다 —
 * 라이브 무대에서 보고 싶은 건 확정액이 아니라 지금 이 순간의 열기다.
 */
export function tickerIndex(items: MarketItem[], bids: MarketBid[], now: string) {
  let current = 0;
  let start = 0;
  let open = 0;
  let closed = 0;
  let bidCountTotal = 0;
  for (const item of tickerItems(items, bids)) {
    current += currentPrice(item, bids);
    start += item.startPrice;
    bidCountTotal += bidCount(item, bids);
    if (isOpen(item, bids, now)) open += 1;
    else closed += 1;
  }
  return { current, start, diff: current - start, pct: start > 0 ? ((current - start) / start) * 100 : 0, open, closed, bidCount: bidCountTotal };
}
