import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize, Minimize, Radio, TrendingUp } from 'lucide-react';
import {
  bidCount,
  currentPrice,
  deriveStatus,
  formatPrice,
  leadingBid,
  priceChange,
  priceHistory,
  publicTitle,
  recentBids,
  tickerIndex,
  tickerItems,
  timeLeft,
} from '../../marketRules';
import type { MarketBid, MarketItem } from '../../types';

/*
  행사 경매 시세판 — 주식창처럼 본다.

  라이브 무대의 큰 화면에 띄워 두는 용도다. 그래서 이 화면은 세 가지를 스스로 한다.
  1) 갱신: 앱은 장터 데이터를 로그인 때 한 번 읽는다. 여기서는 onRefresh 를 5초마다 불러
     다른 사람 폰에서 들어온 입찰이 무대에 바로 오르게 한다(탭이 보일 때만).
  2) 시계: 남은 시간은 1초마다 다시 센다. App 의 now 는 렌더 때만 바뀌어 무대에선 멈춰 보인다.
  3) 번쩍임: 값이 오른 줄을 1초쯤 붉게 깜빡인다 — 주식창이 체결을 알리는 방식. 이전 값은
     ref 에 들고 있다가 비교한다(상태에 두면 비교하는 순간 또 렌더가 돈다).

  색 문법은 한국 주식창을 따른다: 오른 것은 빨강. 경매는 내려가지 않으니 파랑은 없다.
  랜덤박스는 열기 전엔 publicTitle 이 '랜덤박스'를 주므로 여기서도 제목이 새지 않는다.
*/

const REFRESH_MS = 5000;
const CLOCK_MS = 1000;
const FLASH_MS = 1200;

/** 5초 폴링 — 탭이 보일 때만. 백그라운드로 가면 쉬었다가 돌아오면 바로 한 번 읽는다. */
function useLiveRefresh(onRefresh: (() => void) | undefined, enabled = true) {
  useEffect(() => {
    if (!onRefresh || !enabled) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') onRefresh();
    };
    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [onRefresh, enabled]);
}

/*
  값이 오른 물건 id 를 FLASH_MS 동안 돌려준다. 이전 값은 ref 에 들고 비교한다(상태에 두면
  비교하는 순간 또 렌더가 돈다). 첫 렌더는 기준만 잡고 번쩍이지 않는다.
*/
function useRiseFlash(rows: MarketItem[], bids: MarketBid[]) {
  const [flashing, setFlashing] = useState<Set<string>>(() => new Set());
  const prevPrices = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const prev = prevPrices.current;
    const risen: string[] = [];
    rows.forEach((item) => {
      const price = currentPrice(item, bids);
      const before = prev.get(item.id);
      if (before !== undefined && price > before) risen.push(item.id);
      prev.set(item.id, price);
    });
    if (risen.length === 0) return undefined;
    setFlashing((current) => new Set([...current, ...risen]));
    const timer = window.setTimeout(() => {
      setFlashing((current) => {
        const next = new Set(current);
        risen.forEach((id) => next.delete(id));
        return next;
      });
    }, FLASH_MS);
    return () => window.clearTimeout(timer);
    // bids 가 바뀔 때만 비교하면 된다. rows 는 bids 에서 파생된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bids]);
  return flashing;
}

type MarketTickerProps = {
  /** 이 행사(탭) 범위의 물건들. 나눔·취소는 규칙(tickerItems)이 거른다. */
  items: MarketItem[];
  bids: MarketBid[];
  title: string;
  /** 공개 전 남의 물건인가. 맞으면 제목·가격을 '???'로 가린다(격자와 같은 티저). */
  isLocked: (item: MarketItem) => boolean;
  /** 장터 물건·입찰을 다시 읽는다. 없으면 폴링하지 않는다(로컬 전용 모드 등). */
  onRefresh?: () => void;
  onOpenItem: (id: string) => void;
  onBack: () => void;
};

function stamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function clock(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 입찰 시각(ISO)을 'HH:MM' 로. 체결 내역용. */
function bidTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPct(pct: number) {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/*
  스파크라인. 가격 흐름을 계단으로 그린다 — 입찰은 순간에 일어나므로 사선이 아니라 계단이 맞다.
  점이 하나(시작가뿐)면 평평한 선. 세로는 시작가~현재가 사이를 꽉 쓴다(절대 축이 아니라 그 물건의 흐름).
*/
function Sparkline({ item, bids }: { item: MarketItem; bids: MarketBid[] }) {
  const points = priceHistory(item, bids);
  const width = 96;
  const height = 28;
  const pad = 2;
  const min = points[0].amount;
  const max = Math.max(...points.map((p) => p.amount));
  const span = max - min || 1;
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const y = (amount: number) => height - pad - ((amount - min) / span) * (height - pad * 2);

  let d = `M ${pad} ${y(points[0].amount).toFixed(1)}`;
  points.forEach((point, index) => {
    if (index === 0) return;
    const x = (pad + stepX * index).toFixed(1);
    // 계단: 먼저 가로로 가고, 그 자리에서 세로로 오른다.
    d += ` H ${x} V ${y(point.amount).toFixed(1)}`;
  });
  d += ` H ${width - pad}`;
  const last = points[points.length - 1];
  const risen = points.length > 1;

  return (
    <svg aria-hidden className={risen ? 'tk-spark up' : 'tk-spark'} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" strokeLinejoin="round" strokeWidth="2" />
      <circle cx={width - pad} cy={y(last.amount)} r="2.5" />
    </svg>
  );
}

/*
  탭 상단에 박히는 실시간 시세 요약. 누르지 않아도 보이는 것이 이 패널의 존재 이유다 —
  전체 시세판은 무대 화면용이고, 폰으로 장터를 들여다보는 사람은 여기서 "지금 뭐가 얼마까지
  올랐나"를 바로 본다. 같은 폴링(5초)과 같은 번쩍임을 쓴다.
*/
type MarketTickerPanelProps = {
  items: MarketItem[];
  bids: MarketBid[];
  isLocked: (item: MarketItem) => boolean;
  /** 행사 공개 전인가. 공개 전엔 입찰이 없어 숫자 대신 "언제부터 올라오는지"를 말한다. */
  preOpen: boolean;
  /** 공개 시각 안내문('11월 30일(월) 오후 12:00'). preOpen 일 때만 쓴다. */
  openLabel?: string;
  onRefresh?: () => void;
  onOpenBoard: () => void;
  onOpenItem: (id: string) => void;
};

const PANEL_ROWS = 5;

export function MarketTickerPanel({
  items,
  bids,
  isLocked,
  preOpen,
  openLabel,
  onRefresh,
  onOpenBoard,
  onOpenItem,
}: MarketTickerPanelProps) {
  const rows = tickerItems(items, bids);
  const index = tickerIndex(items, bids, stamp(new Date()));
  const flashing = useRiseFlash(rows, bids);
  // 공개 전엔 입찰이 들어올 수 없으니 폴링도 쉰다.
  useLiveRefresh(onRefresh, !preOpen);

  return (
    <section className="panel tkp" aria-label="실시간 시세">
      <header className="tkp-head">
        <h3 className="tkp-title">
          <TrendingUp size={18} />
          실시간 시세
        </h3>
        {!preOpen && (
          <span className="tk-live">
            <Radio size={12} />
            LIVE
            {onRefresh && <small>5초마다 갱신</small>}
          </span>
        )}
        <button className="tkp-open" onClick={onOpenBoard} type="button">
          전체 시세판
          <ArrowRight size={16} />
        </button>
      </header>

      {preOpen ? (
        <p className="tkp-note">
          {openLabel ? `${openLabel}에 공개되고 입찰이 시작되면` : '공개되고 입찰이 시작되면'} 여기에 경매가가 실시간으로
          올라와요. 전체 시세판은 무대 화면용이에요.
        </p>
      ) : rows.length === 0 ? (
        <p className="tkp-note">올라온 경매가 없어요. 경매 물건이 올라오면 여기 한 줄씩 생깁니다.</p>
      ) : (
        <>
          <div className="tkp-index">
            <span className="tk-label">호가 합계</span>
            <strong className={index.diff > 0 ? 'tk-num up' : 'tk-num'}>{formatPrice(index.current)}</strong>
            <span className={index.diff > 0 ? 'tk-change up' : 'tk-change'}>
              {index.diff > 0 ? '▲' : '—'} {formatPrice(index.diff)} ({formatPct(index.pct)})
            </span>
            <span className="tk-sub">
              진행중 {index.open} · 마감 {index.closed} · 입찰 {index.bidCount}건
            </span>
          </div>
          <ol className="tkp-rows">
            {rows.slice(0, PANEL_ROWS).map((item, rank) => {
              const locked = isLocked(item);
              const change = priceChange(item, bids);
              const cls = ['tkp-row', flashing.has(item.id) ? 'flash' : '', change.diff > 0 ? 'up' : ''].filter(Boolean).join(' ');
              return (
                <li key={item.id}>
                  <button className={cls} onClick={() => onOpenItem(item.id)} type="button">
                    <span className="tk-rank">{rank + 1}</span>
                    <span className="tkp-name">{locked ? '???' : publicTitle(item)}</span>
                    <span className="tkp-spark">{locked ? <span className="tk-spark-locked" /> : <Sparkline bids={bids} item={item} />}</span>
                    <span className="tkp-price tk-num">{locked ? '—' : formatPrice(currentPrice(item, bids))}</span>
                    <span className="tkp-change tk-num">{locked ? '' : change.diff > 0 ? `▲ ${formatPct(change.pct)}` : formatPct(0)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {rows.length > PANEL_ROWS && (
            <p className="tkp-more">
              외 {rows.length - PANEL_ROWS}개 — 전체 시세판에서 모두 볼 수 있어요.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function MarketTicker({ items, bids, title, isLocked, onRefresh, onOpenItem, onBack }: MarketTickerProps) {
  const [clockAt, setClockAt] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLElement>(null);

  const now = stamp(clockAt);
  const rows = tickerItems(items, bids);
  const index = tickerIndex(items, bids, now);
  const tape = recentBids(items, bids, 16);
  const itemById = new Map(items.map((item) => [item.id, item]));

  // 1초 시계 — 남은 시간과 상단 시각.
  useEffect(() => {
    const timer = window.setInterval(() => setClockAt(new Date()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useLiveRefresh(onRefresh);
  const flashing = useRiseFlash(rows, bids);

  // 전체 화면 — 무대 PC 용. 지원 안 하면 단추를 숨긴다. Esc 로 나가면 상태도 따라온다.
  const canFullscreen = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current?.requestFullscreen?.();
    }
  };

  const top = rows[0] && !isLocked(rows[0]) ? rows[0] : null;

  return (
    <section className="screen tk-stage" ref={stageRef}>
      <header className="tk-head">
        <button className="btn-ghost tk-back" onClick={onBack} type="button">
          <ArrowLeft size={16} />
          목록으로
        </button>
        <h2 className="tk-title">{title} 시세판</h2>
        <div className="tk-live">
          <Radio size={14} />
          <span>LIVE</span>
          <time>{clock(clockAt)}</time>
          {onRefresh && <small>5초마다 갱신</small>}
        </div>
        {canFullscreen && (
          <button
            aria-label={fullscreen ? '전체 화면 끝내기' : '전체 화면'}
            className="btn-ghost tk-full"
            onClick={toggleFullscreen}
            type="button"
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        )}
      </header>

      {/* 지수 — 올라온 경매 전체의 호가 합. 주식창의 코스피 자리. */}
      <div className="tk-index">
        <div className="tk-index-main">
          <span className="tk-label">호가 합계</span>
          <strong className={index.diff > 0 ? 'tk-num up' : 'tk-num'}>{formatPrice(index.current)}</strong>
          <span className={index.diff > 0 ? 'tk-change up' : 'tk-change'}>
            {index.diff > 0 ? '▲' : '—'} {formatPrice(index.diff)} ({formatPct(index.pct)})
          </span>
          <span className="tk-sub">시작가 합 {formatPrice(index.start)}</span>
        </div>
        <dl className="tk-index-side">
          <div>
            <dt>진행중</dt>
            <dd>{index.open}</dd>
          </div>
          <div>
            <dt>마감</dt>
            <dd>{index.closed}</dd>
          </div>
          <div>
            <dt>입찰</dt>
            <dd>{index.bidCount}건</dd>
          </div>
          <div>
            <dt>최고 상승</dt>
            <dd className="tk-top">{top ? `${publicTitle(top)} ${formatPct(priceChange(top, bids).pct)}` : '—'}</dd>
          </div>
        </dl>
      </div>

      {/* 체결 테이프 — 최근 입찰이 오른쪽에서 왼쪽으로 흐른다. 비면 안내 한 줄. */}
      <div className="tk-tape" aria-label="최근 체결">
        {tape.length === 0 ? (
          <span className="tk-tape-empty">아직 들어온 입찰이 없어요. 첫 입찰이 여기로 흐릅니다.</span>
        ) : (
          <div className="tk-tape-track">
            {[0, 1].map((copy) => (
              <ul aria-hidden={copy === 1} className="tk-tape-list" key={copy}>
                {tape.map((bid) => {
                  const item = itemById.get(bid.itemId);
                  if (!item) return null;
                  const locked = isLocked(item);
                  return (
                    <li key={bid.id}>
                      <span className="tk-tape-name">{locked ? '???' : publicTitle(item)}</span>
                      <strong className="up">{formatPrice(bid.amount)}</strong>
                      <span className="tk-tape-who">{bid.name}</span>
                      <time>{bidTime(bid.createdAt)}</time>
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        )}
      </div>

      <div className="tk-body">
        {/* 종목판 */}
        <div className="tk-board" role="table" aria-label="경매 시세">
          <div className="tk-row tk-row-head" role="row">
            <span>#</span>
            <span>물건</span>
            <span className="tk-col-spark">흐름</span>
            <span className="tk-col-price">현재가</span>
            <span className="tk-col-change">변동</span>
            <span className="tk-col-bids">입찰</span>
            <span className="tk-col-lead">선두</span>
            <span className="tk-col-time">마감</span>
          </div>
          {rows.length === 0 ? (
            <p className="tk-empty">올라온 경매가 없어요. 물건이 올라오면 여기 한 줄씩 생깁니다.</p>
          ) : (
            rows.map((item, rank) => {
              const locked = isLocked(item);
              const status = deriveStatus(item, bids, now);
              const change = priceChange(item, bids);
              const lead = leadingBid(item, bids);
              const open = status === '거래중';
              const cls = [
                'tk-row',
                flashing.has(item.id) ? 'flash' : '',
                change.diff > 0 ? 'up' : '',
                open ? '' : 'closed',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button className={cls} key={item.id} onClick={() => onOpenItem(item.id)} role="row" type="button">
                  <span className="tk-rank">{rank + 1}</span>
                  <span className="tk-name">
                    <strong>{locked ? '???' : publicTitle(item)}</strong>
                    <small>{item.seller}</small>
                  </span>
                  <span className="tk-col-spark">{locked ? <span className="tk-spark-locked" /> : <Sparkline bids={bids} item={item} />}</span>
                  <span className="tk-col-price tk-num">{locked ? '—' : formatPrice(currentPrice(item, bids))}</span>
                  <span className="tk-col-change">
                    {locked ? (
                      '—'
                    ) : (
                      <>
                        <b>{change.diff > 0 ? '▲' : '—'} {formatPrice(change.diff)}</b>
                        <small>{formatPct(change.pct)}</small>
                      </>
                    )}
                  </span>
                  <span className="tk-col-bids">{bidCount(item, bids)}</span>
                  <span className="tk-col-lead">{lead ? lead.name : '—'}</span>
                  <span className="tk-col-time">
                    <em className={open ? 'tk-chip' : 'tk-chip closed'}>{open ? timeLeft(item, now) : status === '거래완료' ? '낙찰' : status}</em>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* 체결 내역 — 테이프와 같은 데이터를 멈춰 세운 것. 테이프는 흘러가서 놓치기 쉽다. */}
        <aside className="tk-feed" aria-label="체결 내역">
          <h3>체결 내역</h3>
          {tape.length === 0 ? (
            <p className="tk-empty">아직 없음</p>
          ) : (
            <ol>
              {tape.map((bid) => {
                const item = itemById.get(bid.itemId);
                if (!item) return null;
                return (
                  <li key={bid.id}>
                    <time>{bidTime(bid.createdAt)}</time>
                    <span className="tk-feed-name">{isLocked(item) ? '???' : publicTitle(item)}</span>
                    <strong className="tk-num up">{formatPrice(bid.amount)}</strong>
                    <span className="tk-feed-who">{bid.name}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}
