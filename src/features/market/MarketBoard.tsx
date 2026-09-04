import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  Gavel,
  Gift,
  Hourglass,
  MapPin,
  Package,
  Pencil,
  Plus,
  Trash2,
  Trophy,
} from 'lucide-react';
import { CommentThread } from '../../components/CommentThread';
import { EmptyState } from '../../components/EmptyState';
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
};

type BoardView = 'feed' | 'create' | 'edit' | 'detail';
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
}: MarketBoardProps) {
  const [view, setView] = useState<BoardView>('feed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 상세를 '홈 피드'에서 열었는지 기록한다. 뒤로가기 목적지(홈 vs 목록)를 이걸로 정한다.
  const [openedFromFeed, setOpenedFromFeed] = useState(false);
  const [filter, setFilter] = useState<Filter>('거래중');
  const [amountInput, setAmountInput] = useState('');
  const [bidError, setBidError] = useState('');
  // 삭제는 되돌릴 수 없어 상세 안에서 펼치는 확인 UI로 받는다(유머와 같은 방식).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const visible = sortItems(
    items.filter((item) => {
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

  const openDetail = (id: string, fromFeed = false) => {
    setSelectedId(id);
    setAmountInput('');
    setBidError('');
    setConfirmingDelete(false);
    setView('detail');
    setOpenedFromFeed(fromFeed);
  };

  // 상세 '뒤로': 홈에서 들어왔으면 홈으로, 목록에서 들어왔으면 목록으로.
  const backFromDetail = () => {
    if (openedFromFeed && onExitToHome) onExitToHome();
    else setView('feed');
  };

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
        <MarketForm onCancel={() => setView('feed')} onSubmit={create} />
      </section>
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
            />
          </div>

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
    { key: 'seller', title: '판매왕', rows: rankSellers(items, bids, now), unit: '건' },
    { key: 'giver', title: '나눔왕', rows: rankGivers(items, bids, now), unit: '건' },
    { key: 'buyer', title: '구매왕', rows: rankBuyers(items, bids, now), unit: '건' },
    { key: 'spender', title: '큰손', rows: rankBigSpenders(items, bids, now), unit: '원' },
  ];
  const hasRanking = boards.some((board) => board.rows.length > 0);

  return (
    <section className="screen">
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
          <strong>이음장터 명예의 전당</strong>
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
            const status = deriveStatus(item, bids, now);
            const badge = gridBadge(item, status);
            const open = isOpen(item, bids, now);
            const count = bidCount(item, bids);
            const left = timeLeft(item, now);
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
                    {item.kind === 'auction' ? `입찰 ${count}` : '바로 나눔'}
                    {open && left ? ` · ${left}` : ''}
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
