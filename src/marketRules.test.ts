import { describe, expect, it } from 'vitest';
import {
  bidBlockedReason,
  canEditMarketItem,
  canRevealMystery,
  currentPrice,
  deriveStatus,
  effectiveCloseAt,
  extendedCloseFor,
  formatPrice,
  isMysteryHidden,
  leadingBid,
  minNextBid,
  priceChange,
  priceHistory,
  publicTitle,
  recentBids,
  rankBigSpenders,
  rankBuyers,
  rankGivers,
  rankSellers,
  sortItems,
  tickerIndex,
  tickerItems,
  timeLeft,
  winner,
} from './marketRules';
import type { MarketBid, MarketItem } from './types';

const NOW = '2026-08-05T12:00';

const auction = (patch: Partial<MarketItem> = {}): MarketItem => ({
  id: 'MKT-1',
  kind: 'auction',
  title: '허먼밀러 세이코체어',
  desc: '',
  startPrice: 120000,
  minStep: 5000,
  closeAt: '2026-08-06T18:00',
  place: '9층 라운지',
  seller: '김수정',
  createdAt: '2026-08-05',
  canceled: false,
  sellerDone: false,
  buyerDone: false,
  ...patch,
});

const giveaway = (patch: Partial<MarketItem> = {}): MarketItem =>
  auction({ id: 'MKT-G', kind: 'giveaway', startPrice: 0, minStep: 0, ...patch });

const bid = (patch: Partial<MarketBid> = {}): MarketBid => ({
  id: 'BID-1',
  itemId: 'MKT-1',
  name: '이관국',
  amount: 130000,
  createdAt: '2026-08-05T10:00:00.000Z',
  ...patch,
});

describe('canEditMarketItem — 입찰 0건일 때만 수정 가능', () => {
  it('본인 물건 · 입찰 0 · 거래중이면 수정 가능', () => {
    expect(canEditMarketItem(auction(), [], NOW, '김수정')).toBe(true);
  });

  it('입찰이 하나라도 있으면 수정 불가 (취소 불가 원칙의 대칭)', () => {
    const bids = [bid({ id: 'B1', name: '이관국', amount: 130000 })];
    expect(canEditMarketItem(auction(), bids, NOW, '김수정')).toBe(false);
  });

  it('나눔은 먼저 받은 사람(=입찰 1건)이 있으면 수정 불가', () => {
    const g = giveaway();
    const bids = [bid({ id: 'B1', itemId: 'MKT-G', name: '이수현', amount: 0 })];
    expect(canEditMarketItem(g, bids, NOW, '김수정')).toBe(false);
  });

  it('남의 물건은 수정 불가', () => {
    expect(canEditMarketItem(auction(), [], NOW, '이관국')).toBe(false);
  });

  it('마감이 지나 거래중이 아니면 수정 불가', () => {
    const closed = auction({ closeAt: '2026-08-04T18:00' });
    expect(canEditMarketItem(closed, [], NOW, '김수정')).toBe(false);
  });

  it('취소된 물건은 수정 불가', () => {
    expect(canEditMarketItem(auction({ canceled: true }), [], NOW, '김수정')).toBe(false);
  });
});

describe('leadingBid', () => {
  it('경매는 최고가가 앞선다', () => {
    const item = auction();
    const bids = [
      bid({ id: 'B1', name: '이관국', amount: 130000 }),
      bid({ id: 'B2', name: '박동진', amount: 175000 }),
      bid({ id: 'B3', name: '최철원', amount: 168000 }),
    ];
    expect(leadingBid(item, bids)?.name).toBe('박동진');
  });

  // 나중 사람이 같은 값으로 가로챌 수 있으면 먼저 부른 사람에겐 규칙이 없는 것과 같다.
  it('같은 금액이면 먼저 부른 사람이 이긴다', () => {
    const item = auction();
    const bids = [
      bid({ id: 'B1', name: '먼저', amount: 150000, createdAt: '2026-08-05T10:00:00.000Z' }),
      bid({ id: 'B2', name: '나중', amount: 150000, createdAt: '2026-08-05T11:00:00.000Z' }),
    ];
    expect(leadingBid(item, bids)?.name).toBe('먼저');
  });

  it('나눔은 금액과 무관하게 선착순이다', () => {
    const item = giveaway();
    const bids = [
      bid({ id: 'B1', itemId: 'MKT-G', name: '늦게', amount: 0, createdAt: '2026-08-05T11:00:00.000Z' }),
      bid({ id: 'B2', itemId: 'MKT-G', name: '먼저', amount: 0, createdAt: '2026-08-05T09:00:00.000Z' }),
    ];
    expect(leadingBid(item, bids)?.name).toBe('먼저');
  });

  it('다른 물건의 입찰은 섞이지 않는다', () => {
    const item = auction();
    expect(leadingBid(item, [bid({ itemId: 'MKT-OTHER', amount: 999999 })])).toBeNull();
  });
});

describe('가격', () => {
  it('입찰이 없으면 시작가가 현재가다', () => {
    expect(currentPrice(auction(), [])).toBe(120000);
  });

  it('첫 입찰은 시작가부터 부를 수 있다', () => {
    expect(minNextBid(auction(), [])).toBe(120000);
  });

  it('이후 입찰은 최고가 + 최소 인상폭이다', () => {
    expect(minNextBid(auction(), [bid({ amount: 130000 })])).toBe(135000);
  });

  it('나눔은 금액 개념이 없다', () => {
    expect(currentPrice(giveaway(), [])).toBe(0);
    expect(minNextBid(giveaway(), [])).toBe(0);
  });

  it('금액은 3자리로 끊어 표기한다', () => {
    expect(formatPrice(182000)).toBe('182,000원');
  });
});

describe('deriveStatus', () => {
  it('마감 전이면 거래중', () => {
    expect(deriveStatus(auction(), [], NOW)).toBe('거래중');
  });

  it('마감 뒤 입찰이 있으면 거래완료', () => {
    const item = auction({ closeAt: '2026-08-05T11:00' });
    expect(deriveStatus(item, [bid()], NOW)).toBe('거래완료');
  });

  // 아무도 안 불렀는데 '거래완료'라고 하면 판매자가 다시 올릴지 판단할 수 없다.
  it('마감 뒤 입찰이 없으면 유찰', () => {
    const item = auction({ closeAt: '2026-08-05T11:00' });
    expect(deriveStatus(item, [], NOW)).toBe('유찰');
  });

  it('취소는 시각과 무관하게 취소다', () => {
    expect(deriveStatus(auction({ canceled: true }), [bid()], NOW)).toBe('취소');
  });

  it('나눔은 받는 즉시 거래완료 — 마감 전이라도 (선착순)', () => {
    const g = giveaway(); // closeAt 은 미래
    const taken = [bid({ itemId: 'MKT-G', name: '이수현', amount: 0 })];
    expect(deriveStatus(g, taken, NOW)).toBe('거래완료');
  });

  it('나눔도 아무도 안 받고 마감되면 유찰', () => {
    const g = giveaway({ closeAt: '2026-08-05T11:00' });
    expect(deriveStatus(g, [], NOW)).toBe('유찰');
  });

  it('낙찰자는 마감 뒤에만 정해진다', () => {
    const open = auction();
    expect(winner(open, [bid()], NOW)).toBeNull();
    const closed = auction({ closeAt: '2026-08-05T11:00' });
    expect(winner(closed, [bid()], NOW)?.name).toBe('이관국');
  });
});

describe('막판 입찰 연장', () => {
  it('마감 3분 안에 부르면 마감이 밀린다', () => {
    const item = auction({ closeAt: '2026-08-05T12:02' });
    const pushed = extendedCloseFor(item, NOW);
    expect(pushed).toBe('2026-08-05T12:03');
  });

  it('여유가 있으면 밀지 않는다', () => {
    expect(extendedCloseFor(auction({ closeAt: '2026-08-05T18:00' }), NOW)).toBeNull();
  });

  it('이미 마감된 뒤에는 밀지 않는다', () => {
    expect(extendedCloseFor(auction({ closeAt: '2026-08-05T11:00' }), NOW)).toBeNull();
  });

  it('밀린 마감이 실제 마감이 된다', () => {
    const item = auction({ closeAt: '2026-08-05T12:02', extendedTo: '2026-08-05T12:05' });
    expect(effectiveCloseAt(item)).toBe('2026-08-05T12:05');
    expect(deriveStatus(item, [], NOW)).toBe('거래중');
  });

  // 원래 마감보다 이른 값이 들어와도 거래가 앞당겨지면 안 된다.
  it('원래 마감보다 이른 연장값은 무시한다', () => {
    const item = auction({ closeAt: '2026-08-06T18:00', extendedTo: '2026-08-05T09:00' });
    expect(effectiveCloseAt(item)).toBe('2026-08-06T18:00');
  });
});

describe('bidBlockedReason', () => {
  it('열려 있고 남의 물건이면 입찰할 수 있다', () => {
    expect(bidBlockedReason(auction(), [], NOW, '이관국')).toBeNull();
  });

  it('내가 올린 물건에는 입찰할 수 없다', () => {
    expect(bidBlockedReason(auction(), [], NOW, '김수정')).toBe('내가 올린 물건이에요.');
  });

  it('마감된 거래에는 입찰할 수 없다', () => {
    const item = auction({ closeAt: '2026-08-05T11:00' });
    expect(bidBlockedReason(item, [], NOW, '이관국')).toBe('마감된 거래예요.');
  });

  it('취소된 거래는 취소라고 말한다', () => {
    expect(bidBlockedReason(auction({ canceled: true }), [], NOW, '이관국')).toBe(
      '판매자가 거래를 취소했어요.',
    );
  });

  it('나눔은 남이 가져가면 "이미 다른 분이 가져갔어요"', () => {
    const item = giveaway();
    const taken = [bid({ itemId: 'MKT-G', name: '심상준', amount: 0 })];
    expect(bidBlockedReason(item, taken, NOW, '이관국')).toBe('이미 다른 분이 가져갔어요.');
  });

  it('내가 받았으면 "이미 받으셨어요" (남이 가져간 것으로 오해하지 않는다)', () => {
    const item = giveaway();
    const mine = [bid({ itemId: 'MKT-G', name: '이관국', amount: 0 })];
    expect(bidBlockedReason(item, mine, NOW, '이관국')).toBe('이미 받으셨어요.');
  });
});

describe('sortItems', () => {
  it('거래중이 위에 오고 곧 마감되는 순으로 선다', () => {
    const soon = auction({ id: 'SOON', closeAt: '2026-08-05T13:00' });
    const later = auction({ id: 'LATER', closeAt: '2026-08-09T13:00' });
    const done = auction({ id: 'DONE', closeAt: '2026-08-04T13:00' });
    const sorted = sortItems([done, later, soon], [], NOW);
    expect(sorted.map((item) => item.id)).toEqual(['SOON', 'LATER', 'DONE']);
  });
});

describe('timeLeft', () => {
  it('한 시간 안이면 분으로 말한다', () => {
    expect(timeLeft(auction({ closeAt: '2026-08-05T12:30' }), NOW)).toBe('30분 남음');
  });

  it('하루 안이면 시간으로 말한다', () => {
    expect(timeLeft(auction({ closeAt: '2026-08-05T18:00' }), NOW)).toBe('6시간 남음');
  });

  it('마감이 지나면 마감됨', () => {
    expect(timeLeft(auction({ closeAt: '2026-08-05T11:00' }), NOW)).toBe('마감됨');
  });
});

describe('랭킹', () => {
  const later = '2026-08-31T23:59'; // 아래 물건이 전부 마감된 뒤 시점

  const sold = (id: string, seller: string, buyer: string, amount: number): MarketItem =>
    auction({ id, seller, closeAt: '2026-08-10T18:00' });

  const items = [
    sold('A', '김수정', '이관국', 100000),
    sold('B', '김수정', '이관국', 50000),
    sold('C', '박완배', '박동진', 30000),
    giveaway({ id: 'G1', seller: '심상준', closeAt: '2026-08-10T18:00' }),
    giveaway({ id: 'G2', seller: '심상준', closeAt: '2026-08-10T18:00' }),
  ];

  const bids: MarketBid[] = [
    bid({ id: 'b1', itemId: 'A', name: '이관국', amount: 100000 }),
    bid({ id: 'b2', itemId: 'B', name: '이관국', amount: 50000 }),
    bid({ id: 'b3', itemId: 'C', name: '박동진', amount: 30000 }),
    bid({ id: 'b4', itemId: 'G1', name: '노현희', amount: 0 }),
    bid({ id: 'b5', itemId: 'G2', name: '이수현', amount: 0 }),
  ];

  it('판매왕은 성사된 경매만 센다', () => {
    expect(rankSellers(items, bids, later)[0]).toEqual({ name: '김수정', count: 2 });
  });

  it('나눔왕은 나눔만 센다', () => {
    const top = rankGivers(items, bids, later);
    expect(top[0]).toEqual({ name: '심상준', count: 2 });
    expect(top.some((item) => item.name === '김수정')).toBe(false);
  });

  it('구매왕은 낙찰받은 사람을 센다', () => {
    expect(rankBuyers(items, bids, later)[0]).toEqual({ name: '이관국', count: 2 });
  });

  it('큰손은 건수가 아니라 금액을 센다', () => {
    expect(rankBigSpenders(items, bids, later)[0]).toEqual({ name: '이관국', count: 150000 });
  });

  // 올려두기만 하고 아무도 안 가져간 것은 실적이 아니다.
  it('유찰은 어느 랭킹에도 들어가지 않는다', () => {
    const unsold = [auction({ id: 'U', seller: '최근화', closeAt: '2026-08-10T18:00' })];
    expect(rankSellers(unsold, [], later)).toEqual([]);
    expect(rankBuyers(unsold, [], later)).toEqual([]);
  });

  // 달로 끊으면 매달 1일마다 순위표가 비어 아무 말도 못 한다. 누적으로 센다.
  it('지난 달에 끝난 거래도 계속 센다', () => {
    const old = [auction({ id: 'OLD', seller: '윤희성', closeAt: '2026-03-02T18:00' })];
    const oldBids = [bid({ id: 'oldb', itemId: 'OLD', name: '김금', amount: 20000 })];
    expect(rankSellers(old, oldBids, later)[0]).toEqual({ name: '윤희성', count: 1 });
  });

  it('아직 진행 중인 거래는 세지 않는다', () => {
    const open = [auction({ id: 'O', seller: '최근화', closeAt: '2026-08-20T18:00' })];
    const openBids = [bid({ id: 'ob', itemId: 'O', name: '이관국', amount: 10000 })];
    expect(rankSellers(open, openBids, NOW)).toEqual([]);
  });
});

/*
  랜덤박스 — 내용물은 저장돼 있지만 열기 전엔 어디서도 제목이 새면 안 되고,
  여는 것은 낙찰 확정 뒤 권한 있는 사람만이다.
*/
describe('랜덤박스', () => {
  const box = (patch: Partial<MarketItem> = {}) =>
    auction({ id: 'BOX', title: '스타벅스 기프티콘 3만원', mystery: true, eventTag: 'canmeeting-2026', ...patch });
  const AFTER = '2026-08-07T09:00'; // 마감(08-06 18:00) 뒤

  it('열기 전엔 제목이 "랜덤박스"로 가려지고, 연 뒤엔 진짜 제목이 나온다', () => {
    expect(isMysteryHidden(box())).toBe(true);
    expect(publicTitle(box())).toBe('랜덤박스');
    expect(publicTitle(box({ revealedAt: '2026-08-07T09:10' }))).toBe('스타벅스 기프티콘 3만원');
    expect(isMysteryHidden(box({ revealedAt: '2026-08-07T09:10' }))).toBe(false);
  });

  it('일반 물건은 랜덤박스 규칙에 걸리지 않는다', () => {
    expect(isMysteryHidden(auction())).toBe(false);
    expect(publicTitle(auction())).toBe('허먼밀러 세이코체어');
  });

  it('낙찰이 확정(거래완료)돼야 열 수 있다 — 입찰 중이나 유찰이면 못 연다', () => {
    const bids = [bid({ id: 'b1', itemId: 'BOX', name: '이관국', amount: 130000 })];
    expect(canRevealMystery(box(), bids, NOW, true)).toBe(false); // 아직 거래중
    expect(canRevealMystery(box(), bids, AFTER, true)).toBe(true); // 마감 뒤 낙찰 확정
    expect(canRevealMystery(box(), [], AFTER, true)).toBe(false); // 아무도 안 불러 유찰
  });

  it('권한이 없으면 낙찰 뒤에도 못 열고, 이미 연 박스는 다시 못 연다', () => {
    const bids = [bid({ id: 'b1', itemId: 'BOX', name: '이관국', amount: 130000 })];
    expect(canRevealMystery(box(), bids, AFTER, false)).toBe(false);
    expect(canRevealMystery(box({ revealedAt: '2026-08-07T09:10' }), bids, AFTER, true)).toBe(false);
    expect(canRevealMystery(auction(), bids, AFTER, true)).toBe(false); // 랜덤박스가 아니다
  });
});

/* 시세판 — 가격은 오르기만 하므로 변동은 항상 시작가 대비 상승분이다. */
describe('시세판', () => {
  const chair = auction(); // 시작가 120,000
  const lamp = auction({ id: 'MKT-2', title: '스탠드 조명', startPrice: 10000, minStep: 1000 });
  const gift = auction({ id: 'MKT-3', kind: 'giveaway', title: '머그컵', startPrice: 0, minStep: 0 });
  const gone = auction({ id: 'MKT-4', title: '취소된 것', canceled: true });
  const bids = [
    bid({ id: 'a', itemId: 'MKT-1', name: '이관국', amount: 125000, createdAt: '2026-08-05T10:00:00.000Z' }),
    bid({ id: 'b', itemId: 'MKT-2', name: '김승현', amount: 12000, createdAt: '2026-08-05T10:05:00.000Z' }),
    bid({ id: 'c', itemId: 'MKT-2', name: '이두민', amount: 15000, createdAt: '2026-08-05T10:10:00.000Z' }),
    bid({ id: 'd', itemId: 'MKT-1', name: '김수정', amount: 130000, createdAt: '2026-08-05T10:20:00.000Z' }),
  ];

  it('가격 흐름은 시작가에서 출발해 최고가가 갱신될 때만 점을 찍는다', () => {
    expect(priceHistory(lamp, bids).map((p) => p.amount)).toEqual([10000, 12000, 15000]);
    // 더 낮은 금액이 뒤에 와도 계단은 내려가지 않는다.
    const lower = [...bids, bid({ id: 'e', itemId: 'MKT-2', name: '박서연', amount: 11000, createdAt: '2026-08-05T10:30:00.000Z' })];
    expect(priceHistory(lamp, lower).map((p) => p.amount)).toEqual([10000, 12000, 15000]);
    expect(priceHistory(auction({ id: 'MKT-9' }), bids)).toEqual([{ at: '2026-08-05', amount: 120000 }]);
  });

  it('변동은 시작가 대비 금액과 비율로 센다', () => {
    expect(priceChange(lamp, bids)).toEqual({ diff: 5000, pct: 50 });
    expect(priceChange(chair, bids).diff).toBe(10000);
    expect(priceChange(chair, bids).pct).toBeCloseTo(8.333, 2);
    expect(priceChange(gift, bids)).toEqual({ diff: 0, pct: 0 }); // 0으로 나누지 않는다
  });

  it('시세판에는 경매만 오르고(나눔·취소 제외), 많이 오른 순으로 선다', () => {
    const rows = tickerItems([chair, lamp, gift, gone], bids);
    expect(rows.map((item) => item.id)).toEqual(['MKT-2', 'MKT-1']);
  });

  it('최근 체결은 시세판 물건의 입찰만 최신순으로 자른다', () => {
    const stray = bid({ id: 'z', itemId: 'MKT-3', name: '아무개', amount: 0, createdAt: '2026-08-05T11:00:00.000Z' });
    expect(recentBids([chair, lamp, gift], [...bids, stray], 2).map((b) => b.id)).toEqual(['d', 'c']);
  });

  it('지수는 현재가 합·시작가 합·진행/마감 수를 한 번에 준다', () => {
    const index = tickerIndex([chair, lamp, gift, gone], bids, NOW);
    expect(index.current).toBe(145000);
    expect(index.start).toBe(130000);
    expect(index.diff).toBe(15000);
    expect(index.pct).toBeCloseTo(11.54, 1);
    expect(index.open).toBe(2);
    expect(index.closed).toBe(0);
    expect(index.bidCount).toBe(4);
  });
});
