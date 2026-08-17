import { useEffect, useRef, useState } from 'react';

const MIN_WAIT = 1500;
const MAX_WAIT = 4000;
const FALSE_START = 9999; // 부정출발 페널티(사실상 패)

export function ReactionGame({ onScore }: { onScore: (ms: number) => void }) {
  const [green, setGreen] = useState(false);
  const greenAtRef = useRef(0);

  useEffect(() => {
    const wait = MIN_WAIT + Math.random() * (MAX_WAIT - MIN_WAIT);
    const t = window.setTimeout(() => {
      greenAtRef.current = performance.now();
      setGreen(true);
    }, wait);
    return () => window.clearTimeout(t);
  }, []);

  const tap = () => {
    if (!green) {
      onScore(FALSE_START); // 초록 전에 눌렀다 — 부정출발
      return;
    }
    onScore(Math.round(performance.now() - greenAtRef.current));
  };

  return (
    <button
      type="button"
      className={green ? 'coffee-reaction green' : 'coffee-reaction red'}
      onClick={tap}
      aria-label={green ? '지금 탭!' : '초록불을 기다리세요'}
    >
      {green ? '탭!' : '기다려…'}
    </button>
  );
}
