import type { DetailNav } from '../../detailNav';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  Dices,
  Gavel,
  Gift,
  Heart,
  Hourglass,
  MapPin,
  Package,
  PackageOpen,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { CommentThread } from '../../components/CommentThread';
import { EmptyState } from '../../components/EmptyState';
import { PhotoViewer } from '../../components/PhotoViewer';
import {
  bidBlockedReason,
  bidCount,
  bidsFor,
  canEditMarketItem,
  canRevealMystery,
  currentPrice,
  isOpen,
  deriveStatus,
  effectiveCloseAt,
  formatPrice,
  fundraiseSummary,
  isMysteryHidden,
  isSettled,
  leadingBid,
  minNextBid,
  myBid,
  publicTitle,
  raffleEntrants,
  rankBigSpenders,
  rankBuyers,
  rankGivers,
  rankSellers,
  sortItems,
  timeLeft,
  winner,
} from '../../marketRules';
import type { CurrentUser, MarketBid, MarketComment, MarketFavorite, MarketItem, MarketStatus } from '../../types';
import { ItemPoster } from './ItemPoster';
import { MarketForm, type MarketDraft } from './MarketForm';
import { MarketTicker, MarketTickerPanel } from './MarketTicker';
import { MarketCountdown } from './MarketCountdown';
import { MarketXmasScene } from './MarketXmasScene';
import { QrSheet } from './QrSheet';
import { RandomBoxReveal } from './RandomBoxReveal';
import { GiveawayRaffleReveal } from './GiveawayRaffleReveal';
import {
  MARKET_EVENTS,
  isRaffleGiveaway,
  marketEvent,
  marketOpenAt,
  type MarketOpenOverrides,
} from './marketEvents';

/** 'YYYY-MM-DDTHH:mm' 를 '11월 30일(월) 오후 12:00' 로. 공개 시각 안내용. */
function formatStamp(stamp: string) {
  const [datePart, timePart] = stamp.split('T');
  const [, month, day] = datePart.split('-');
  const [hh, mm] = timePart.split(':');
  const hour = Number(hh);
  const ampm = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(stamp).getDay()] ?? '';
  return `${Number(month)}월 ${Number(day)}일(${dow}) ${ampm} ${hour12}:${mm}`;
}

type MarketBoardProps = {
  items: MarketItem[];
  bids: MarketBid[];
  comments: MarketComment[];
  onAddComment: (itemId: string, body: string, parentId?: string) => void;
  onEditComment: (id: string, body: string) => void;
  onDeleteComment: (id: string) => void;
  onToggleCommentLike: (id: string) => void;
  currentUser: CurrentUser;
  /** 관심(찜) 전체 — (물건, 사람) 한 줄씩. 모두가 함께 보는 공유 데이터라 "N명 관심"을 센다. */
  favorites: MarketFavorite[];
  /** 관심(하트) 토글. 물건 id 로 (이 물건, 나) 한 줄을 넣고 뺀다. */
  onToggleFavorite: (itemId: string) => void;
  /** 'YYYY-MM-DDTHH:mm' 로컬 시각. 상태 파생의 기준이라 App 이 한 곳에서 만든다. */
  now: string;
  /** 등록 직후 배경에서 썸네일을 그리는 중인 물건. 격자에 '그리는 중' 을 띄운다(모임과 동일). */
  imagePendingIds: string[];
  /** 행사 공개 시각 오버라이드(태그→'YYYY-MM-DDTHH:mm'). 공개 전엔 남의 물건을 '???'로 가린다. */
  openOverrides: MarketOpenOverrides;
  /** 리더면 공개 시각을 바꿀 수 있다(라이브 중 조정). 권한 없으면 undefined. */
  onSetEventOpenAt?: (tag: string, openAt: string) => void;
  onCreate: (draft: MarketDraft) => void;
  onUpdate: (item: MarketItem, draft: MarketDraft) => void;
  onBid: (item: MarketItem, amount: number) => void;
  /** 추첨 나눔 신청 취소(마감 전, 본인 신청). 선착순 나눔·경매에는 쓰지 않는다. */
  onWithdrawBid: (item: MarketItem) => void;
  onCancelItem: (item: MarketItem) => void;
  onMarkDone: (item: MarketItem) => void;
  /** 팀리더 권한. 남의 물건도 삭제할 수 있다. */
  canModerate: boolean;
  /** 완전 삭제(물건 + 입찰 기록). 판매자 또는 팀리더만 호출한다. */
  onDelete: (item: MarketItem) => void;
  /** 랜덤박스를 열 수 있는 사람인가(리더·커넥셔너). 낙찰 확정 여부는 규칙(canRevealMystery)이 본다. */
  canReveal: boolean;
  /** 랜덤박스 열기 — revealedAt 을 찍어 모두에게 내용물을 보이게 한다. 연출은 보드가 띄운다. */
  onReveal: (item: MarketItem) => void;
  /** 장터 물건·입찰 다시 읽기. 시세판이 5초마다 부른다. 없으면 시세판은 폴링 없이 뜬다. */
  onRefresh?: () => void;
  /** 홈 피드에서 이 물건을 눌러 들어온 경우 그 id. 바로 상세를 열고 한 번만 소비한다. */
  focusId?: string | null;
  onFocusHandled?: () => void;
  /** 홈 피드에서 진입한 상세에서 '뒤로'를 누르면 목록이 아니라 홈으로 돌아간다. */
  onExitToHome?: () => void;
  /* 목록 → 상세를 브라우저 히스토리에 한 칸으로 남긴다(detailNav.ts).
     쌓고 되감는 건 App 이, 실제로 열고 닫는 건 여기가 한다. */
  detailNav: DetailNav;
  onDetailOpen: (id: string) => void;
  /** 쌓아둔 칸을 되감았으면 true — 그때는 popstate 가 닫아 주므로 여기서 닫지 않는다. */
  onDetailExit: () => boolean;
};

type BoardView = 'feed' | 'create' | 'edit' | 'detail' | 'qrsheet' | 'ticker';
type Filter = '거래중' | '나눔' | '관심' | '내가 올린 것' | '전체';

const FILTERS: Filter[] = ['거래중', '나눔', '관심', '내가 올린 것', '전체'];

/*
  격자 배지는 '유형'만 말한다 — 경매인지 나눔인지. 가격·남은시간·입찰 현황은
  전부 상세로 미룬다(팀 문법: 목록은 "무엇이 있나"를 보는 곳).

  끝난 것만 예외로 배지를 바꾼다. 모임이 마감 배지를 남긴 근거와 같다 —
  없으면 이미 팔린 물건을 눌러야만 알게 되어 헛걸음이 생긴다.
*/
function gridBadge(item: MarketItem, status: MarketStatus): { text: string; tone: 'moss' | 'clay' | 'muted' } {
  // 낙찰됐지만 아직 안 연 랜덤박스 — '거래완료'보다 '열기 전'이 지금 이 물건의 상태다.
  if (status === '거래완료' && isMysteryHidden(item)) return { text: '열기 전', tone: 'clay' };
  if (status === '거래완료') return { text: '거래완료', tone: 'muted' };
  if (status === '유찰') return { text: '유찰', tone: 'muted' };
  if (status === '취소') return { text: '취소됨', tone: 'muted' };
  if (item.kind === 'giveaway') return { text: isRaffleGiveaway(item) ? '추첨 나눔' : '나눔', tone: 'clay' };
  return { text: '경매', tone: 'moss' };
}

export function MarketBoard({
  items,
  bids,
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onToggleCommentLike,
  currentUser,
  favorites,
  onToggleFavorite,
  now,
  imagePendingIds,
  openOverrides,
  onSetEventOpenAt,
  onCreate,
  onUpdate,
  onBid,
  onWithdrawBid,
  onCancelItem,
  onMarkDone,
  canModerate,
  onDelete,
  canReveal,
  onReveal,
  onRefresh,
  focusId,
  onFocusHandled,
  onExitToHome,
  detailNav,
  onDetailOpen,
  onDetailExit,
}: MarketBoardProps) {
  const [view, setView] = useState<BoardView>('feed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 상세를 '홈 피드'에서 열었는지 기록한다. 뒤로가기 목적지(홈 vs 목록)를 이걸로 정한다.
  const [openedFromFeed, setOpenedFromFeed] = useState(false);
  // 진행 중인 행사가 있으면 그 탭을 기본으로 연다(없으면 상시 장터).
  const initialScope = MARKET_EVENTS.find((event) => event.active)?.tag ?? '';
  const [filter, setFilter] = useState<Filter>(initialScope === '' ? '거래중' : '전체');
  // 상시('') 또는 행사 태그. 상단 탭이 이걸 바꾼다 — 상시와 행사 물건을 완전히 가른다.
  const [scope, setScope] = useState<string>(initialScope);

  // 탭을 바꿀 때 하위 필터 기본값도 맞춘다: 상시는 '거래중', 행사는 '전체'(올라온 걸 한눈에 보도록).
  const selectScope = (next: string) => {
    setScope(next);
    setFilter(next === '' ? '거래중' : '전체');
  };
  const [amountInput, setAmountInput] = useState('');
  const [bidError, setBidError] = useState('');
  // 삭제는 되돌릴 수 없어 상세 안에서 펼치는 확인 UI로 받는다(유머와 같은 방식).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // 상세에서 사진을 눌러 크게 보는 중인가.
  const [zoomed, setZoomed] = useState(false);
  // 랜덤박스 열기 연출을 띄우는 중인가. 처음 열 때와 '다시 보기' 둘 다 이걸 켠다.
  const [revealing, setRevealing] = useState(false);
  // 추첨 나눔 결과 연출(두구두구→당첨자)을 띄우는 중인가. 당첨자는 규칙이 이미 정해 놓았다.
  const [raffling, setRaffling] = useState(false);
  // '추첨 결과 보기'로 공개를 마친 물건들(뷰어 기준). 규칙상 당첨자는 마감 즉시 계산되지만,
  // 버튼으로 두구두구를 보기 전엔 로스터에 당첨자를 드러내지 않는다 — 안 그러면 연출이 김샌다.
  // 뷰어별 로컬 상태라 localStorage 에 남겨 새로고침 뒤에도 '이미 본' 것으로 유지한다.
  const [revealedRaffles, setRevealedRaffles] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('skon.raffleRevealed');
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });
  const markRaffleRevealed = (id: string) => {
    setRevealedRaffles((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('skon.raffleRevealed', JSON.stringify([...next]));
      } catch {
        /* 로컬 저장 실패해도 연출/공개엔 지장 없다 */
      }
      return next;
    });
  };

  // 현재 탭(상시/행사)에 속한 물건만. 명예의 전당·격자 모두 이 범위 안에서 센다.
  const scopedItems = items.filter((item) => (item.eventTag ?? '') === scope);

  // 관심(찜) — 물건별 관심 수와 '내가 눌렀는지'. 격자·상세·관심 탭이 같은 답을 본다.
  const favCount = (id: string) => favorites.reduce((n, fav) => (fav.itemId === id ? n + 1 : n), 0);
  const iFavorited = (id: string) => favorites.some((fav) => fav.itemId === id && fav.name === currentUser.name);

  // 이 탭의 오픈 시각과 '오픈 전' 여부. 오픈 전에도 물건은 등록 즉시 다 보인다 —
  // 가리지 않고, 입찰·신청(액션)만 오픈 시각부터 연다(bidBlockedReason).
  const scopeOpenAt = marketOpenAt(scope, openOverrides);
  const preOpen = scopeOpenAt ? now < scopeOpenAt : false;
  // 더 이상 물건을 가리지 않는다. 시세판(티커)이 받는 prop 만 유지하려 항상 false 를 넘긴다.
  const isLocked = (_item: MarketItem) => false;

  // 물건별 딥링크 — 스캔하면 (로그인 후) 이 물건 상세로 바로 온다. App 의 '#market=<id>' 해시가 받는다.
  const marketLink = (item: MarketItem) =>
    `${window.location.origin}${window.location.pathname}#market=${item.id}`;

  // 상단 탭: 상시 + (등록 가능하거나 물건이 하나라도 있는) 행사들. 행사가 없으면 탭 자체를 숨긴다.
  const eventTabs = MARKET_EVENTS.filter(
    (event) => event.active || items.some((item) => item.eventTag === event.tag),
  );

  const visible = sortItems(
    scopedItems.filter((item) => {
      const status = deriveStatus(item, bids, now);
      if (filter === '거래중') return status === '거래중';
      if (filter === '나눔') return item.kind === 'giveaway';
      if (filter === '관심') return iFavorited(item.id);
      if (filter === '내가 올린 것') return item.seller === currentUser.name;
      return true;
    }),
    bids,
    now,
  );

  // 목록 필터에서 빠져도 열어둔 상세는 유지되어야 하므로 전체에서 찾는다.
  const selected = items.find((item) => item.id === selectedId) ?? null;

  // 화면만 상세로 바꾼다. 히스토리는 건드리지 않는다 — 뒤로가기로 복원할 때 쓴다.
  const showDetail = (id: string, fromFeed = false) => {
    setSelectedId(id);
    setAmountInput('');
    setBidError('');
    setConfirmingDelete(false);
    setView('detail');
    setOpenedFromFeed(fromFeed);
  };

  const openDetail = (id: string, fromFeed = false) => {
    setZoomed(false); // 앞 물건의 확대가 남아 있으면 안 된다
    setRevealing(false);
    setRaffling(false);
    showDetail(id, fromFeed);
    /* 홈 피드에서 바로 연 상세는 쌓지 않는다. 그 경우 '뒤로'의 목적지가 홈인데,
       홈은 이미 한 칸 아래에 있어서 더 쌓으면 뒤로가기를 두 번 눌러야 한다. */
    if (!fromFeed) onDetailOpen(id);
  };

  // 상세 '뒤로': 홈에서 들어왔으면 홈으로, 목록에서 들어왔으면 목록으로.
  const backFromDetail = () => {
    setZoomed(false);
    if (openedFromFeed && onExitToHome) {
      onExitToHome();
      return;
    }
    // 쌓아둔 칸을 되감으면 popstate 가 목록으로 돌려놓는다. 없을 때만 직접 닫는다.
    if (!onDetailExit()) setView('feed');
  };

  /*
    뒤로가기가 이 화면에 닿았다. 돌아간 칸에 상세가 담겨 있으면 그 상세를, 없으면 목록을 연다.
    tick 이 0 이면 아직 뒤로가기가 없었다는 뜻이라 첫 렌더에서는 아무것도 하지 않는다.
  */
  useEffect(() => {
    if (!detailNav.tick) return;
    if (detailNav.id) showDetail(detailNav.id); // 되돌아온 것이므로 다시 쌓지 않는다
    else setView('feed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailNav.tick]);

  // 홈 피드에서 이 물건을 눌러 들어오면 바로 그 상세를 연다(한 번만 소비).
  // '#market=ticker' 는 물건이 아니라 시세판 딥링크 — 무대 PC 가 주소만 열면 바로 시세판이 뜬다.
  useEffect(() => {
    if (!focusId) return;
    if (focusId === 'ticker') {
      const event = eventTabs[0];
      if (event) {
        selectScope(event.tag);
        setView('ticker');
      }
      onFocusHandled?.();
      return;
    }
    openDetail(focusId, true);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const create = (draft: MarketDraft) => {
    onCreate(draft);
    setView('feed');
  };

  if (view === 'create') {
    return (
      <section className="screen">
        <MarketForm defaultEventTag={scope} onCancel={() => setView('feed')} onSubmit={create} />
      </section>
    );
  }

  // 시세판 — 행사 경매를 주식창처럼. 줄을 누르면 그 물건 상세로 들어간다(목록에서 연 것과 같은 길).
  if (view === 'ticker') {
    return (
      <MarketTicker
        bids={bids}
        isLocked={isLocked}
        items={scopedItems}
        onBack={() => setView('feed')}
        onOpenItem={(id) => openDetail(id)}
        onRefresh={onRefresh}
        title={marketEvent(scope)?.label ?? '이음장터'}
      />
    );
  }

  // QR 시트 — 운영자가 접수된 물건들의 QR을 한 장으로 뽑아 진열대에 붙인다(현재 탭 범위).
  if (view === 'qrsheet') {
    return (
      <QrSheet
        items={scopedItems}
        linkFor={marketLink}
        onBack={() => setView('feed')}
        title={marketEvent(scope)?.label ?? '이음장터'}
      />
    );
  }

  // 수정은 입찰 0건일 때만 상세에서 열린다. 저장 후 상세로 돌아간다.
  if (view === 'edit' && selected) {
    const target = selected;
    return (
      <section className="screen">
        <MarketForm
          initial={target}
          onCancel={() => setView('detail')}
          onSubmit={(draft) => {
            onUpdate(target, draft);
            setView('detail');
          }}
        />
      </section>
    );
  }

  if (view === 'detail' && selected) {
    const status = deriveStatus(selected, bids, now);
    const itemBids = bidsFor(selected.id, bids);
    const top = leadingBid(selected, bids);
    const won = winner(selected, bids, now);
    // 추첨 나눔 — 선착순이 아니라 마감 후 무작위 1명. 당첨자(won)는 마감 즉시 계산되지만,
    // 뷰어가 '추첨 결과 보기'로 두구두구를 보기 전까진 로스터·정산에 당첨자를 드러내지 않는다.
    const isRaffle = isRaffleGiveaway(selected);
    const entrants = isRaffle ? raffleEntrants(selected, bids) : [];
    const raffleRevealed = !isRaffle || revealedRaffles.has(selected.id);
    const shownWon = raffleRevealed ? won : null;
    const itemComments = comments
      .filter((comment) => comment.itemId === selected.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const isSeller = selected.seller === currentUser.name;
    const isWinner = shownWon?.name === currentUser.name;
    const blocked = bidBlockedReason(selected, bids, now, currentUser.name, openOverrides);
    const nextMin = minNextBid(selected, bids);
    const mine = myBid(selected, bids, currentUser.name);
    // 랜덤박스: 열기 전엔 제목·설명·사진을 숨긴다. 연 뒤엔 일반 물건과 같되 '다시 보기'가 남는다.
    const hidden = isMysteryHidden(selected);
    const revealable = canRevealMystery(selected, bids, now, canReveal);
    const reveal = () => {
      onReveal(selected);
      setRevealing(true);
    };

    // 신청/추첨 로스터에서 '뽑힌 사람'을 강조할 id. 추첨은 공개 전엔 아무도 강조하지 않는다(shownWon=null).
    const rosterTopId = isRaffle ? shownWon?.id : top?.id;

    const placeBid = () => {
      if (selected.kind === 'giveaway') {
        onBid(selected, 0);
        return;
      }
      const amount = Number(amountInput.replace(/[^\d]/g, '')) || 0;
      if (amount < nextMin) {
        setBidError(`${formatPrice(nextMin)} 이상 불러주세요.`);
        return;
      }
      setBidError('');
      setAmountInput('');
      onBid(selected, amount);
    };

    return (
      <section className="screen">
        <button className="btn-ghost back-link" onClick={backFromDetail} type="button">
          <ArrowLeft size={16} />
          {openedFromFeed ? '홈으로' : '목록으로'}
        </button>

        <div className="gathering-detail">
          <div className="gathering-detail-poster">
            <ItemPoster
              badge={gridBadge(selected, status).text}
              badgeTone={gridBadge(selected, status).tone}
              item={selected}
              onPhotoClick={selected.imageUrl && !hidden ? () => setZoomed(true) : undefined}
            />
          </div>

          {zoomed && selected.imageUrl && !hidden && (
            <PhotoViewer alt={selected.title} onClose={() => setZoomed(false)} src={selected.imageUrl} />
          )}

          {revealing && (
            <RandomBoxReveal item={selected} onClose={() => setRevealing(false)} winner={won?.name} />
          )}

          {raffling && (
            <GiveawayRaffleReveal
              entrants={entrants.map((entry) => entry.name)}
              item={selected}
              onClose={() => {
                setRaffling(false);
                markRaffleRevealed(selected.id);
              }}
              winner={won?.name}
            />
          )}

          <div className="gathering-detail-body">
            <div className="market-detail-head">
              <h2>{hidden ? `🎁 ${publicTitle(selected)}` : selected.title}</h2>
              {/* 관심(하트) — 상세에서도 바로 찜/해제. 옆에 'N명 관심' 수를 함께 보여준다. */}
              <button
                aria-label={iFavorited(selected.id) ? '관심 해제' : '관심'}
                aria-pressed={iFavorited(selected.id)}
                className={`market-fav detail${iFavorited(selected.id) ? ' on' : ''}${favCount(selected.id) > 0 ? ' has-count' : ''}`}
                onClick={() => onToggleFavorite(selected.id)}
                type="button"
              >
                <Heart size={20} />
                {favCount(selected.id) > 0 && <span className="market-fav-count">{favCount(selected.id)}</span>}
              </button>
            </div>
            <p className="gathering-host">{selected.seller}님이 내놓았어요</p>

            {/* 랜덤박스 안내 — 열기 전: 언제 누가 여는지. 판매자 본인에게만 내용물을 덧붙인다(확인용). */}
            {hidden && (
              <div className="market-mystery-note">
                <PackageOpen size={16} />
                <p>
                  안에 뭐가 들었는지는 비밀이에요. 낙찰이 확정되면 리더가 무대에서 열어봅니다.
                  {isSeller && (
                    <>
                      <br />
                      <em>내가 넣은 것(나만 보임): {selected.title}</em>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* 열어보기 — 리더·커넥셔너, 낙찰 확정 뒤에만 버튼이 나온다. 누르면 기록하고 연출을 띄운다. */}
            {revealable && (
              <button className="primary-button market-reveal-button" onClick={reveal} type="button">
                <PackageOpen size={18} />
                열어보기
              </button>
            )}
            {hidden && !revealable && status === '거래완료' && (
              <p className="field-note">낙찰이 확정됐어요. 리더가 열어보면 내용물이 공개됩니다.</p>
            )}
            {selected.mystery && selected.revealedAt && (
              <button className="btn-ghost market-replay-button" onClick={() => setRevealing(true)} type="button">
                <RotateCcw size={16} />
                열리는 장면 다시 보기
              </button>
            )}

            {/* 지금 얼마인지가 이 화면의 첫 질문이다. 사실 목록보다 먼저 답한다. */}
            <div className="market-price-head">
              <span className="market-price-label">
                {selected.kind === 'giveaway' ? '나눔' : status === '거래중' ? '현재가' : '낙찰가'}
              </span>
              <strong className="market-price-amount">
                {selected.kind === 'giveaway'
                  ? isRaffle
                    ? '🎲 추첨'
                    : '선착순'
                  : formatPrice(currentPrice(selected, bids))}
                {selected.kind === 'auction' && selected.startPrice > 0 && (
                  <small> 시작가 {formatPrice(selected.startPrice)}</small>
                )}
              </strong>
              <span className={status === '거래중' ? 'market-time-chip' : 'market-time-chip closed'}>
                {status === '거래중' ? timeLeft(selected, now) : status}
              </span>
            </div>

            {/* 추첨 나눔 현황/결과 — 마감 전엔 신청 인원, 마감 뒤엔 '두구두구' 결과 보기. */}
            {isRaffle && status === '거래중' && (
              <p className="field-note market-raffle-note">
                <Dices size={14} /> {entrants.length}명이 신청했어요 · 마감 후 무작위로 한 분을 추첨해요.
              </p>
            )}
            {isRaffle && status === '거래완료' && (
              <button
                className="primary-button market-reveal-button"
                onClick={() => setRaffling(true)}
                type="button"
              >
                <Dices size={18} />
                {raffleRevealed ? '추첨 결과 다시 보기' : '추첨 결과 보기'}
              </button>
            )}
            {isRaffle && status === '유찰' && (
              <p className="field-note">아무도 신청하지 않아 유찰됐어요.</p>
            )}

            <dl className="gathering-facts">
              <div>
                <dt>
                  {selected.kind === 'giveaway' ? <Gift size={16} /> : <Gavel size={16} />}
                  방식
                </dt>
                <dd>
                  {selected.kind === 'giveaway' ? (isRaffle ? '나눔(추첨)' : '나눔') : selected.mystery ? '랜덤박스 경매' : '경매'}
                  <em>
                    {' · '}
                    {selected.kind === 'giveaway'
                      ? isRaffle
                        ? '마감 후 무작위 1명 추첨'
                        : '먼저 누른 분이 가져감'
                      : selected.mystery
                        ? '최고가 낙찰 · 내용물은 낙찰 뒤 공개'
                        : '최고가 낙찰'}
                  </em>
                </dd>
              </div>
              <div>
                <dt>
                  <Package size={16} />
                  마감
                </dt>
                <dd>{effectiveCloseAt(selected).replace('T', ' ')}</dd>
              </div>
              {selected.kind === 'auction' && (
                <div>
                  <dt>
                    <Gavel size={16} />
                    최소 인상폭
                  </dt>
                  <dd>{formatPrice(selected.minStep)}</dd>
                </div>
              )}
              <div>
                <dt>
                  <MapPin size={16} />
                  거래 장소
                </dt>
                <dd>{selected.place}</dd>
              </div>
            </dl>

            {selected.desc && !hidden && <p className="gathering-desc">{selected.desc}</p>}

            <div className="gathering-actions">
              {blocked ? (
                <span className="seat-badge closed">{blocked}</span>
              ) : selected.kind === 'giveaway' && isRaffle ? (
                // 추첨 나눔: 마감 전엔 신청/취소가 자유롭다. 이미 신청했으면 '취소'로 바꾼다.
                mine ? (
                  <button className="btn-ghost" onClick={() => onWithdrawBid(selected)} type="button">
                    <Check size={16} />
                    신청됨 · 취소
                  </button>
                ) : (
                  <button className="primary-button" onClick={placeBid} type="button">
                    <Gift size={16} />
                    나눔 신청하기
                  </button>
                )
              ) : selected.kind === 'giveaway' ? (
                <button className="primary-button" onClick={placeBid} type="button">
                  <Gift size={16} />
                  받기
                </button>
              ) : (
                <div className="market-bid-form">
                  <input
                    aria-label="입찰 금액"
                    inputMode="numeric"
                    onChange={(event) => setAmountInput(event.target.value)}
                    placeholder={`${nextMin.toLocaleString('ko-KR')} 이상`}
                    value={amountInput}
                  />
                  <button className="primary-button" onClick={placeBid} type="button">
                    입찰하기
                  </button>
                </div>
              )}

              {/*
                수정은 아직 아무도 입찰하지 않았을 때만 연다. 입찰이 붙으면 그 사람은
                이 조건(가격·마감·물건)을 믿고 건 것이라, 몰래 바꾸면 입찰 취소 불가
                원칙과 어긋난다. 바꿔야 하면 '거래 내리기'(입찰자에게 알림)로 무른다.
              */}
              {canEditMarketItem(selected, bids, now, currentUser.name) && (
                <button className="btn-ghost" onClick={() => setView('edit')} type="button">
                  <Pencil size={16} />
                  수정
                </button>
              )}

              {isSeller && !selected.canceled && status === '거래중' && (
                <button className="btn-ghost danger" onClick={() => onCancelItem(selected)} type="button">
                  <Ban size={16} />
                  거래 내리기
                </button>
              )}

              {canModerate && !confirmingDelete && (
                <button className="btn-ghost danger" onClick={() => setConfirmingDelete(true)} type="button">
                  <Trash2 size={16} />
                  삭제
                </button>
              )}
            </div>

            {confirmingDelete && (
              <div className="agenda-close-box">
                <AlertTriangle size={18} />
                <p>이 물건을 삭제하면 되돌릴 수 없어요. 입찰 기록도 함께 사라집니다.</p>
                <div className="vote-confirm-actions">
                  <button className="secondary-button" onClick={() => setConfirmingDelete(false)} type="button">
                    취소
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      onDelete(selected);
                      setConfirmingDelete(false);
                      setView('feed');
                    }}
                  >
                    <Trash2 size={16} />
                    삭제 확정
                  </button>
                </div>
              </div>
            )}

            {bidError && <p className="form-error">{bidError}</p>}
            {!blocked && selected.kind === 'auction' && (
              <p className="field-note">
                입찰은 취소할 수 없어요. 마감 3분 안에 부르면 3분 미뤄집니다.
              </p>
            )}
            {mine && selected.kind === 'auction' && (
              <p className="field-note">내가 부른 금액 {formatPrice(mine.amount)} · 더 높이 부를 수 있어요.</p>
            )}

            {/* 거래가 끝난 뒤에는 양쪽이 각각 완료를 누른다. 앱이 판정하지 않는다. */}
            {status === '거래완료' && (isSeller || isWinner) && (
              <div className="market-settle">
                {isSettled(selected) ? (
                  <span className="seat-badge confirmed">
                    <Check size={16} />
                    거래 완료 확인됨
                  </span>
                ) : (
                  <>
                    <p className="field-note">
                      {isSeller ? selected.sellerDone : selected.buyerDone
                        ? '상대방 확인을 기다리는 중이에요.'
                        : '물건을 주고받았다면 눌러주세요. 양쪽이 눌러야 완료로 기록됩니다.'}
                    </p>
                    {!(isSeller ? selected.sellerDone : selected.buyerDone) && (
                      <button className="btn-secondary" onClick={() => onMarkDone(selected)} type="button">
                        <Check size={16} />
                        거래 완료
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="roster">
              <p className="roster-title">
                {selected.kind === 'giveaway' ? '신청' : '입찰'} {bidCount(selected, bids)}건
                {shownWon && <span> · {isRaffle ? '당첨' : '가져간 분'} {shownWon.name}</span>}
              </p>
              {itemBids.length === 0 ? (
                <p className="field-note">
                  {selected.kind === 'giveaway'
                    ? isRaffle
                      ? '아직 아무도 신청하지 않았어요. 신청하면 마감 후 추첨 대상이 됩니다.'
                      : '아직 아무도 신청하지 않았어요. 먼저 누르면 가져갑니다.'
                    : '아직 아무도 부르지 않았어요. 시작가부터 부를 수 있습니다.'}
                </p>
              ) : (
                <ul className="roster-list">
                  {(selected.kind === 'giveaway'
                    ? itemBids
                    : [...itemBids].sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt))
                  ).map((entry, index) => (
                    <li className={entry.id === rosterTopId ? '' : 'waiting'} key={entry.id}>
                      <span className="roster-no">{index + 1}</span>
                      {entry.name}
                      {selected.kind === 'auction' && <em className="market-bid-amount">{formatPrice(entry.amount)}</em>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <CommentThread
              comments={itemComments}
              currentUser={currentUser}
              canModerate={canModerate}
              onAdd={(parentId, body) => onAddComment(selected.id, body, parentId ?? undefined)}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
              onToggleLike={onToggleCommentLike}
            />
          </div>
        </div>
      </section>
    );
  }

  const boards = [
    { key: 'seller', title: '판매왕', rows: rankSellers(scopedItems, bids, now), unit: '건' },
    { key: 'giver', title: '나눔왕', rows: rankGivers(scopedItems, bids, now), unit: '건' },
    { key: 'buyer', title: '구매왕', rows: rankBuyers(scopedItems, bids, now), unit: '건' },
    { key: 'spender', title: '큰손', rows: rankBigSpenders(scopedItems, bids, now), unit: '원' },
  ];
  const hasRanking = boards.some((board) => board.rows.length > 0);
  const scopeEvent = marketEvent(scope);
  const scopeLabel = scopeEvent?.label;
  // 모금 현황은 기부 행사 탭에서만. 공개 전엔 거래가 없어 0원이라 숨긴다.
  const fund = scopeEvent?.fundraiser && !preOpen ? fundraiseSummary(scopedItems, bids, now) : null;
  // 크리스마스 테마는 이 탭에만. 상시 장터·다른 화면은 그대로다.
  const xmas = Boolean(scopeEvent?.xmas);
  // 나눔왕 시상 행사 — 안내 패널을 띄우고 명예의 전당 나눔왕에 시상 표시.
  const giverAward = Boolean(scopeEvent?.giverAward);

  return (
    <section className={xmas ? 'screen market-xmas' : 'screen'}>
      {/* 페이지 전체에 내리는 눈(이 탭 한정). 배너 밖 화면에도 소복소복. */}
      {xmas && (
        <div aria-hidden="true" className="xmas-pagesnow">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 5 + 2) % 98}%`,
                fontSize: `${[10, 13, 16][i % 3]}px`,
                animationDuration: `${7 + ((i * 1.7) % 7)}s`,
                animationDelay: `${(i * 0.6) % 7}s`,
              }}
            >
              ❄
            </span>
          ))}
        </div>
      )}
      {/* 상시/행사 탭. 행사 벼룩시장이 열려 있을 때만 보이고, 평소엔 숨어 화면이 그대로다. */}
      {eventTabs.length > 0 && (
        <div className="segmented market-scope-tabs" role="tablist" aria-label="장터 전환">
          <button
            className={scope === '' ? 'selected' : ''}
            onClick={() => selectScope('')}
            role="tab"
            aria-selected={scope === ''}
            type="button"
          >
            상시 장터
          </button>
          {eventTabs.map((event) => (
            <button
              className={scope === event.tag ? 'selected' : ''}
              key={event.tag}
              onClick={() => selectScope(event.tag)}
              role="tab"
              aria-selected={scope === event.tag}
              type="button"
            >
              {event.label}
            </button>
          ))}
        </div>
      )}

      {/* 크리스마스 히어로 장면(이 탭 한정) — 산타·루돌프·트리. */}
      {xmas && <MarketXmasScene />}

      {/* 공개/마감 카운트다운(행사 탭, 슬림 한 줄). */}
      {(scopeOpenAt || scopeEvent?.fixedCloseAt) && (
        <MarketCountdown closeAt={scopeEvent?.fixedCloseAt} openAt={scopeOpenAt} />
      )}

{/* 공개 시각 조정 — 커넥셔너(전권)·관리자 전용. 라이브 중 공개가 늦춰지거나 당겨질 때 바꾼다. */}
      {onSetEventOpenAt && scopeEvent && scopeOpenAt && (
        <section className="panel market-openedit">
          <label className="field-label" htmlFor="market-open-at">
            공개 시각 조정 <em>커넥셔너</em>
          </label>
          <input
            id="market-open-at"
            type="datetime-local"
            value={scopeOpenAt}
            onChange={(event) => event.target.value && onSetEventOpenAt(scope, event.target.value)}
          />
          <p className="field-note">바꾸면 모든 참여자 화면의 공개 시각이 함께 움직여요(새로고침·재방문 시 반영).</p>
        </section>
      )}

      {/* 실시간 시세 — 행사 탭 상단에 누르지 않아도 보인다. 전체 시세판(무대용)은 여기서 연다. */}
      {scopeEvent && (
        <MarketTickerPanel
          bids={bids}
          isLocked={isLocked}
          items={scopedItems}
          onOpenBoard={() => setView('ticker')}
          onOpenItem={(id) => openDetail(id)}
          onRefresh={onRefresh}
          openLabel={scopeOpenAt ? formatStamp(scopeOpenAt) : undefined}
          preOpen={preOpen}
        />
      )}

      {/* 모금 현황 — 기부 행사 탭 상단. 거래완료(낙찰 확정)된 경매 금액의 합. */}
      {fund && (
        <section className="panel fund-panel">
          <div className="fund-head">
            <Sparkles size={16} />
            {scopeLabel} 모금 현황
          </div>
          <div className="fund-total">{formatPrice(fund.total)}</div>
          <div className="fund-sub">
            거래완료 {fund.soldCount}건 · 진행중 {fund.ongoingCount}건 · 나눔 {fund.giveawayCount}건
          </div>
          <p className="fund-note">낙찰 확정(거래완료)된 경매 금액의 합이에요. 전액 팀을 위해 쓰입니다.</p>
        </section>
      )}

      {/*
        실적을 맨 위에 둔다. 유~머게시판의 명예의 전당과 같은 자리다 —
        아래에 두면 포스터 격자를 다 지나야 나와 아무도 보지 않는다.
        다만 순위표는 한 줄 띠로 유지한다. 유~머처럼 시상대를 세우면
        물건을 보러 온 사람이 매번 그만큼을 지나쳐야 한다.
        판은 항상 띄운다 — 통째로 숨기면 기능이 사라진 것처럼 보인다.
        성사된 거래가 하나도 없으면 4칸 '아직 없음' 대신 안내 한 줄로 대신한다.
      */}
      <section className="panel market-hall">
        <div className="market-hall-head">
          <Trophy size={18} />
          <strong>{scopeLabel ? `${scopeLabel} 명예의 전당` : '이음장터 명예의 전당'}</strong>
        </div>
        {giverAward && (
          <p className="market-hall-note">
            🏆 성사된 나눔이 가장 많은 분을 <strong>나눔왕</strong>으로 시상해요 · 경매 판매금은 판매자 본인이 가져가요.
          </p>
        )}
        {hasRanking ? (
          <div className="market-rank-grid">
            {boards.map((board) => (
              <div className="market-rank" key={board.key}>
                <h3>
                  {giverAward && board.key === 'giver' && <span className="rank-award">🏆 시상</span>}
                  {board.title}
                </h3>
                {board.rows.length === 0 ? (
                  <p className="field-note">아직 없음</p>
                ) : (
                  <ol>
                    {board.rows.map((row, index) => (
                      <li key={row.name}>
                        <span className="market-rank-no">{index + 1}</span>
                        {row.name}
                        <em>
                          {board.unit === '원' ? formatPrice(row.count) : `${row.count}${board.unit}`}
                        </em>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="market-hall-empty">
            아직 성사된 거래가 없어요. 첫 거래의 주인공이 되어보세요 — 판매왕 · 나눔왕 · 구매왕 · 큰손이 여기 오릅니다.
          </p>
        )}
      </section>

      <div className="gathering-toolbar">
        <div className="toolbar">
          {FILTERS.map((item) => (
            <button
              className={filter === item ? 'filter active' : 'filter'}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        {canModerate && scopedItems.length > 0 && (
          <button className="btn-ghost" onClick={() => setView('qrsheet')} type="button">
            <QrCode size={18} />
            QR 출력
          </button>
        )}
        <button className="primary-button" onClick={() => setView('create')} type="button">
          <Plus size={18} />
          물건 내놓기
        </button>
      </div>

      {visible.length === 0 ? (
        filter === '관심' ? (
          <EmptyState
            description="마음에 드는 물건의 하트를 누르면 여기에 모여요. 찜한 물건은 나만 볼 수 있어요."
            icon={Heart}
            title="아직 찜한 물건이 없어요"
          />
        ) : (
          <EmptyState
            action={{ label: '물건 내놓기', onClick: () => setView('create') }}
            description="안 쓰는 물건이 누군가에게는 필요할 수 있어요. 나눔도 환영입니다."
            icon={Package}
            title={filter === '거래중' ? '지금 올라온 물건이 없어요' : '해당하는 물건이 없어요'}
          />
        )
      ) : (
        /*
          인스타 쇼핑 격자. 사진 위 가격 태그가 인스타 쇼핑의 상품 태그와
          같은 자리다 — 이 화면에서 가장 먼저 알고 싶은 것이 값이라
          상세까지 미루지 않는다. 남은 시간은 스토리처럼 "사라지는 것"이라
          같이 얹고, 마감된 것은 가라앉힌다.
        */
        <div className="poster-grid ig-shop">
          {visible.map((item) => {
            const status = deriveStatus(item, bids, now);
            const badge = gridBadge(item, status);
            const open = isOpen(item, bids, now);
            const count = bidCount(item, bids);
            const left = timeLeft(item, now);
            const isFav = iFavorited(item.id);
            const favs = favCount(item.id);
            return (
              <figure className={open ? 'ig-shop-cell' : 'ig-shop-cell closed'} key={item.id}>
                {/* 관심(하트) — 격자에서 바로 찜한다. 셀 버튼 안에 중첩하면 안 되므로(button in button)
                    figure 를 기준으로 겹쳐 올린 별도 버튼이다. 눌러도 상세로 들어가지 않는다.
                    관심이 있으면 옆에 'N명 관심' 수를 함께 보여준다(수요 신호·재미 요소). */}
                <button
                  aria-label={isFav ? '관심 해제' : '관심'}
                  aria-pressed={isFav}
                  className={`market-fav${isFav ? ' on' : ''}${favs > 0 ? ' has-count' : ''}`}
                  onClick={() => onToggleFavorite(item.id)}
                  type="button"
                >
                  <Heart size={18} />
                  {favs > 0 && <span className="market-fav-count">{favs}</span>}
                </button>
                <button className="poster-cell" onClick={() => openDetail(item.id)} type="button">
                  <ItemPoster badge={badge.text} badgeTone={badge.tone} item={item} />
                  {/*
                    가격은 목록에 띄우지 않는다 — 얼마인지는 상세에서 본다(팀 문법: 목록은
                    "무엇이 있나"). 격자에는 유형 배지(경매/나눔)만 남긴다.
                    사진 없이 올리면 등록 직후 배경에서 크레파스 썸네일을 그리는데(모임과 동일),
                    그동안만 '그림 그리는 중' 을 띄운다. 다 그려지면 이 자리가 사진으로 바뀐다.
                  */}
                  {imagePendingIds.includes(item.id) && (
                    <span className="ig-drawing">
                      <Hourglass size={14} />
                      그림 그리는 중
                    </span>
                  )}
                </button>
                <figcaption className="ig-shop-meta">
                  <strong>{publicTitle(item)}</strong>
                  <span>
                    {`${
                      item.kind === 'auction'
                        ? `입찰 ${count}`
                        : isRaffleGiveaway(item)
                          ? `추첨 대기 ${count}명`
                          : '바로 나눔'
                    }${open && left ? ` · ${left}` : ''}`}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
