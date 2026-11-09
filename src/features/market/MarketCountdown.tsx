import { useEffect, useState } from 'react';

/*
  행사 공개/마감 카운트다운(슬림 한 줄). 배너를 늘리지 않으려 작은 pill 로 둔다.
  - 공개 전: "공개까지 N일 HH:MM:SS"
  - 공개~마감: "마감까지 HH:MM:SS" (마감 10분 전부터는 긴급 색)
  - 마감 후: "마감되었어요"
  openAt/closeAt 은 'YYYY-MM-DDTHH:mm' 로컬 — 초 단위로 직접 틱한다(App 의 now 는 초단위가 아니라서).
*/
function parse(stamp?: string): number {
  return stamp ? new Date(stamp).getTime() : Number.NaN;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}일 ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function MarketCountdown({ openAt, closeAt }: { openAt?: string; closeAt?: string }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const open = parse(openAt);
  const close = parse(closeAt);

  // 공개 전 → 공개까지. 공개~마감 → 마감까지. 그 뒤 → 마감됨.
  if (!Number.isNaN(open) && nowMs < open) {
    return (
      <div className="market-countdown">
        <span className="cd-ico" aria-hidden="true">🎁</span>
        <span className="cd-label">공개까지</span>
        <span className="cd-time">{fmt(open - nowMs)}</span>
      </div>
    );
  }
  if (!Number.isNaN(close) && nowMs < close) {
    const urgent = close - nowMs < 10 * 60 * 1000;
    return (
      <div className={urgent ? 'market-countdown urgent' : 'market-countdown'}>
        <span className="cd-ico" aria-hidden="true">⏰</span>
        <span className="cd-label">마감까지</span>
        <span className="cd-time">{fmt(close - nowMs)}</span>
      </div>
    );
  }
  if (!Number.isNaN(close)) {
    return (
      <div className="market-countdown closed">
        <span className="cd-ico" aria-hidden="true">🏁</span>
        마감되었어요
      </div>
    );
  }
  return null;
}
