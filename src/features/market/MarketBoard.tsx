import type { DetailNav } from '../../detailNav';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  Gavel,
  Gift,
  Hourglass,
  Lock,
  MapPin,
  Package,
  Pencil,
  Plus,
  QrCode,
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
  currentPrice,
  isOpen,
  deriveStatus,
  effectiveCloseAt,
  formatPrice,
  fundraiseSummary,
  isSettled,
  leadingBid,
  minNextBid,
  myBid,
  rankBigSpenders,
  rankBuyers,
  rankGivers,
  rankSellers,
  sortItems,
  timeLeft,
  winner,
} from '../../marketRules';
import type { CurrentUser, MarketBid, MarketComment, MarketItem, MarketStatus } from '../../types';
import { ItemPoster } from './ItemPoster';
import { MarketForm, type MarketDraft } from './MarketForm';
import { QrSheet } from './QrSheet';
import {
  MARKET_EVENTS,
  isPreOpen,
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
  onCancelItem: (item: MarketItem) => void;
  onMarkDone: (item: MarketItem) => void;
  /** 팀리더 권한. 남의 물건도 삭제할 수 있다. */
  canModerate: boolean;
  /** 완전 삭제(물건 + 입찰 기록). 판매자 또는 팀리더만 호출한다. */
  onDelete: (item: MarketItem) => void;
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

type BoardView = 'feed' | 'create' | 'edit' | 'detail' | 'qrsheet';
type Filter = '거래중' | '나눔' | '내가 올린 것' | '전체';

const FILTERS: Filter[] = ['거래중', '나눔', '내가 올린 것', '전체'];

/*
  격자 배지는 '유형'만 말한다 — 경매인지 나눔인지. 가격·남은시간·입찰 현황은
  전부 상세로 미룬다(팀 문법: 목록은 "무엇이 있나"를 보는 곳).

  끝난 것만 예외로 배지를 바꾼다. 모임이 마감 배지를 남긴 근거와 같다 —
  없으면 이미 팔린 물건을 눌러야만 알게 되어 헛걸음이 생긴다.
*/
function gridBadge(item: MarketItem, status: MarketStatus): { text: string; tone: 'moss' | 'clay' | 'muted' } {
  if (status === '거래완료') return { text: '거래완료', tone: 'muted' };
  if (status === '유찰') return { text: '유찰', tone: 'muted' };
  if (status === '취소') return { text: '취소됨', tone: 'muted' };
  return item.kind === 'giveaway' ? { text: '나눔', tone: 'clay' } : { text: '경매', tone: 'moss' };
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
  now,
  imagePendingIds,
  openOverrides,
  onSetEventOpenAt,
  onCreate,
  onUpdate,
  onBid,
  onCancelItem,
  onMarkDone,
  canModerate,
  onDelete,
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
  const [filter, setFilter] = useState<Filter>('거래중');
  // 상시('') 또는 행사 태그. 상단 탭이 이걸 바꾼다 — 상시와 행사 물건을 완전히 가른다.
  const [scope, setScope] = useState<string>('');

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

  // 현재 탭(상시/행사)에 속한 물건만. 명예의 전당·격자 모두 이 범위 안에서 센다.
  const scopedItems = items.filter((item) => (item.eventTag ?? '') === scope);

  // 이 탭의 공개 시각과 '공개 전' 여부. 공개 전엔 남의 물건이 '???'로 가려진다.
  const scopeOpenAt = marketOpenAt(scope, openOverrides);
  const preOpen = scopeOpenAt ? now < scopeOpenAt : false;
  // 특정 물건이 지금 이 사용자에게 가려지는가 — 공개 전 + 남의 물건.
  const isLocked = (item: MarketItem) =>
    isPreOpen(item, now, openOverrides) && item.seller !== currentUser.name;

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
  useEffect(() => {
    if (focusId) {
      openDetail(focusId, true);
      onFocusHandled?.();
    }
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

  // 공개 전 남의 물건은 상세로 들어와도 가린다(격자·홈피드에서 막지만 방어적으로 한 번 더).
  if (view === 'detail' && selected && isLocked(selected)) {
    return (
      <section className="screen">
        <button className="btn-ghost back-link" onClick={backFromDetail} type="button">
          <ArrowLeft size={16} />
          {openedFromFeed ? '홈으로' : '목록으로'}
        </button>
        <div className="market-locked-detail">
          <Lock size={28} />
          <h2>아직 공개 전이에요</h2>
          <p>
            {scopeOpenAt ? `${formatStamp(scopeOpenAt)}에 공개돼요.` : '곧 공개돼요.'} 그때 사진과 내용이 함께
            열립니다.
          </p>
        </div>
      </section>
    );
  }

  if (view === 'detail' && selected) {
    const status = deriveStatus(selected, bids, now);
    const itemBids = bidsFor(selected.id, bids);
    const top = leadingBid(selected, bids);
    const won = winner(selected, bids, now);
    const itemComments = comments
      .filter((comment) => comment.itemId === selected.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const isSeller = selected.seller === currentUser.name;
    const isWinner = won?.name === currentUser.name;
    const blocked = bidBlockedReason(selected, bids, now, currentUser.name);
    const nextMin = minNextBid(selected, bids);
    const mine = myBid(selected, bids, currentUser.name);

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
              onPhotoClick={selected.imageUrl ? () => setZoomed(true) : undefined}
            />
          </div>

          {zoomed && selected.imageUrl && (
            <PhotoViewer alt={selected.title} onClose={() => setZoomed(false)} src={selected.imageUrl} />
          )}

          <div className="gathering-detail-body">
            <h2>{selected.title}</h2>
            <p className="gathering-host">{selected.seller}님이 내놓았어요</p>

            {/* 지금 얼마인지가 이 화면의 첫 질문이다. 사실 목록보다 먼저 답한다. */}
            <div className="market-price-head">
              <span className="market-price-label">
                {selected.kind === 'giveaway' ? '나눔' : status === '거래중' ? '현재가' : '낙찰가'}
              </span>
              <strong className="market-price-amount">
                {selected.kind === 'giveaway' ? '선착순' : formatPrice(currentPrice(selected, bids))}
                {selected.kind === 'auction' && selected.startPrice > 0 && (
                  <small> 시작가 {formatPrice(selected.startPrice)}</small>
                )}
              </strong>
              <span className={status === '거래중' ? 'market-time-chip' : 'market-time-chip closed'}>
                {status === '거래중' ? timeLeft(selected, now) : status}
              </span>
            </div>

            <dl className="gathering-facts">
              <div>
                <dt>
                  {selected.kind === 'giveaway' ? <Gift size={16} /> : <Gavel size={16} />}
                  방식
                </dt>
                <dd>
                  {selected.kind === 'giveaway' ? '나눔' : '경매'}
                  <em> · {selected.kind === 'giveaway' ? '먼저 누른 분이 가져감' : '최고가 낙찰'}</em>
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

            {selected.desc && <p className="gathering-desc">{selected.desc}</p>}

            <div className="gathering-actions">
              {blocked ? (
                <span className="seat-badge closed">{blocked}</span>
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
                {won && <span> · 가져간 분 {won.name}</span>}
              </p>
              {itemBids.length === 0 ? (
                <p className="field-note">
                  {selected.kind === 'giveaway'
                    ? '아직 아무도 신청하지 않았어요. 먼저 누르면 가져갑니다.'
                    : '아직 아무도 부르지 않았어요. 시작가부터 부를 수 있습니다.'}
                </p>
              ) : (
                <ul className="roster-list">
                  {(selected.kind === 'giveaway'
                    ? itemBids
                    : [...itemBids].sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt))
                  ).map((entry, index) => (
                    <li className={entry.id === top?.id ? '' : 'waiting'} key={entry.id}>
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

  return (
    <section className={xmas ? 'screen market-xmas' : 'screen'}>
      {xmas && (
        <div aria-hidden="true" className="xmas-snow">
          {Array.from({ length: 14 }).map((_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 7 + 4) % 97}%`,
                animationDuration: `${6 + ((i * 1.3) % 5)}s`,
                animationDelay: `${(i * 0.7) % 4}s`,
              }}
            >
              ❄
            </i>
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

      {/* 크리스마스 꼬마전구 띠(이 탭 한정). */}
      {xmas && (
        <div aria-hidden="true" className="xmas-lights">
          {Array.from({ length: 11 }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      )}

      {/* 공개 전 안내 — 지금은 물건을 미리 모으는 기간. 남의 물건은 공개 시각까지 '???'로 가려진다. */}
      {preOpen && (
        <section className="panel market-preopen">
          <div className="preopen-head">
            <Lock size={16} />
            {scopeLabel} 공개 전
          </div>
          <p className="preopen-text">
            지금은 물건을 미리 모으는 기간이에요. {scopeOpenAt && <strong>{formatStamp(scopeOpenAt)}</strong>}에
            모두 공개되고 입찰이 시작돼요. 그때까지 다른 사람 물건은 사진·내용이 <strong>???</strong>로 가려집니다.
            (내가 올린 물건은 나에게만 보여요.)
          </p>
          <p className="preopen-count">지금까지 {scopedItems.length}개 모임</p>
        </section>
      )}

      {/* 공개 시각 조정 — 리더 전용. 라이브 중 공개가 늦춰지거나 당겨질 때 바꾼다. */}
      {onSetEventOpenAt && scopeEvent && scopeOpenAt && (
        <section className="panel market-openedit">
          <label className="field-label" htmlFor="market-open-at">
            공개 시각 조정 <em>리더</em>
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
        {hasRanking ? (
          <div className="market-rank-grid">
            {boards.map((board) => (
              <div className="market-rank" key={board.key}>
                <h3>{board.title}</h3>
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
        <EmptyState
          action={{ label: '물건 내놓기', onClick: () => setView('create') }}
          description="안 쓰는 물건이 누군가에게는 필요할 수 있어요. 나눔도 환영입니다."
          icon={Package}
          title={filter === '거래중' ? '지금 올라온 물건이 없어요' : '해당하는 물건이 없어요'}
        />
      ) : (
        /*
          인스타 쇼핑 격자. 사진 위 가격 태그가 인스타 쇼핑의 상품 태그와
          같은 자리다 — 이 화면에서 가장 먼저 알고 싶은 것이 값이라
          상세까지 미루지 않는다. 남은 시간은 스토리처럼 "사라지는 것"이라
          같이 얹고, 마감된 것은 가라앉힌다.
        */
        <div className="poster-grid ig-shop">
          {visible.map((item) => {
            // 공개 전 남의 물건 — 사진·제목·유형을 '???'로 가린다(겉보기 티저, 클릭 불가).
            if (isLocked(item)) {
              return (
                <figure className="ig-shop-cell locked" key={item.id}>
                  <div className="poster-cell poster-locked" aria-label="공개 전 물건">
                    <Gift size={30} strokeWidth={1.5} />
                    <span>???</span>
                  </div>
                  <figcaption className="ig-shop-meta">
                    <strong>???</strong>
                    <span>🎁 공개 전</span>
                  </figcaption>
                </figure>
              );
            }
            const status = deriveStatus(item, bids, now);
            const badge = gridBadge(item, status);
            const open = isOpen(item, bids, now);
            const count = bidCount(item, bids);
            const left = timeLeft(item, now);
            const minePreOpen = preOpen && item.seller === currentUser.name;
            return (
              <figure className={open ? 'ig-shop-cell' : 'ig-shop-cell closed'} key={item.id}>
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
                  <strong>{item.title}</strong>
                  <span>
                    {minePreOpen
                      ? '🔒 나만 보임 · 공개 전'
                      : `${item.kind === 'auction' ? `입찰 ${count}` : '바로 나눔'}${open && left ? ` · ${left}` : ''}`}
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
