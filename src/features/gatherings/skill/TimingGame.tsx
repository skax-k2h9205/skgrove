import { useEffect, useRef, useState } from 'react';

const PERIOD = 1400; // 한 번 왕복(ms)

export function TimingGame({ onScore }: { onScore: (distance: number) => void }) {
  const [pos, setPos] = useState(0.5); // 0..1
  const startRef = useRef(performance.now());
  const frameRef = useRef(0);

  useEffect(() => {
    const loop = () => {
      const t = ((performance.now() - startRef.current) % PERIOD) / PERIOD; // 0..1
      setPos(t < 0.5 ? t * 2 : (1 - t) * 2); // 삼각파: 0→1→0
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const stop = () => {
    cancelAnimationFrame(frameRef.current);
    onScore(Math.abs(pos - 0.5)); // 중앙에서 벗어난 정도
  };

  return (
    <div className="coffee-timing">
      <div className="coffee-timing-track">
        <span className="coffee-timing-center" />
        <span className="coffee-timing-marker" style={{ left: `${pos * 100}%` }} />
      </div>
      <button type="button" className="primary-button coffee" onClick={stop}>멈춰!</button>
    </div>
  );
}
