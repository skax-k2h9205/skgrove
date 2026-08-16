/*
  사다리타기 2D 무대를 화면에 붙이는 이음새. CoffeeDrawCanvas(커피뽑기)와 형제다.
  GatheringBoard 가 게임 종류에 따라 둘을 같은 props 로 바꿔 끼울 수 있도록 계약을 맞춘다.

  두 가지를 코드로 직접 챙긴다:
  1) prefers-reduced-motion — 움직임을 원치 않는 사용자.
  2) canvas 2d 컨텍스트 실패, 또는 winner 를 members 에서 못 찾는 경우.
  둘 중 하나라도 걸리면 children(기존 CSS 텍스트 룰렛)으로 떨어지되, 결과 카드로
  넘어가도록 onLanded 는 그대로 울려 준다.

  마운트는 명단·당첨자가 바뀔 때만 다시 한다(ladderStage.ts 가 패자의 경로를 그때 고정
  한다). spinning 이 켜지면 이미 마운트된 사다리의 start 를 불러 애니메이션을 튼다.
*/
import { useEffect, useRef, useState } from 'react';
import type { CoffeeMember } from './coffeeStage';
import { mountLadder, type LadderHandle } from './ladderStage';

type LadderDrawCanvasProps = {
  members: CoffeeMember[];
  winner: string;
  spinning: boolean;
  onLanded: () => void;
  children: React.ReactNode;
};

const FALLBACK_S = 1.7; // 폴백(텍스트 룰렛)에서 결과로 넘어가는 시간(CoffeeDrawCanvas 와 맞춘다)

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function LadderDrawCanvas({ members, winner, spinning, onLanded, children }: LadderDrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [usable, setUsable] = useState(() => !prefersReducedMotion());

  const handleRef = useRef<LadderHandle | null>(null);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;

  // 명단·당첨자가 실제로 바뀔 때만 사다리를 새로 만든다(리렌더마다 다시 만들면 rAF 가 쌓인다).
  const roster = members.map((m) => `${m.name}:${m.color ?? ''}`).join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !usable || members.length === 0) return undefined;

    const handle = mountLadder(canvas, { members, winner });
    if (!handle) {
      // canvas 실패 또는 winner 를 members 에서 못 찾음 — children 폴백으로 떨어진다.
      setUsable(false);
      return undefined;
    }
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, winner, usable]);

  // spinning 이 켜지면 이미 마운트된 사다리를 훑어 내려가는 애니메이션을 시작한다.
  useEffect(() => {
    if (!spinning) return undefined;
    if (!usable || !handleRef.current) {
      // 사다리를 못 쓰면 children(텍스트 룰렛)만 잠깐 보이고 결과로 넘어간다.
      const done = window.setTimeout(() => onLandedRef.current(), FALLBACK_S * 1000);
      return () => window.clearTimeout(done);
    }
    handleRef.current.start(() => onLandedRef.current());
    return undefined;
  }, [spinning, usable]);

  if (!usable || members.length === 0) return <>{children}</>;

  return <canvas className="ladder-draw-canvas" ref={canvasRef} aria-hidden="true" />;
}
