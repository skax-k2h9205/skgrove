import { useEffect, useRef, useState } from 'react';

const DURATION = 5000;

export function TapGame({ onScore }: { onScore: (count: number) => void }) {
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const countRef = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const remain = DURATION - (performance.now() - start);
      if (remain <= 0) {
        window.clearInterval(id);
        setLeft(0);
        onScore(countRef.current);
      } else {
        setLeft(remain);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const tap = () => {
    if (left <= 0) return;
    countRef.current += 1;
    setCount(countRef.current);
  };

  return (
    <div className="coffee-tap">
      <p className="coffee-tap-count">{count}</p>
      <p className="coffee-tap-left">{(left / 1000).toFixed(1)}s</p>
      <button type="button" className="coffee-tap-pad" onClick={tap} aria-label="빠르게 탭">탭!</button>
    </div>
  );
}
