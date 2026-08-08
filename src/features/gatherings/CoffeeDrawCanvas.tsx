/*
  커피뽑기 3D 무대를 화면에 붙이는 이음새. DrawCanvas(조뽑기)와 형제다.

  두 가지를 코드로 직접 챙긴다(WebGL 은 CSS 가 아니라 그림이라 미디어쿼리가 안 닿는다):
  1) prefers-reduced-motion — 움직임을 원치 않는 사용자.
  2) WebGL 실패 — 옛 기기·원격 데스크톱.
  둘 중 하나라도 걸리면 children(기존 CSS 텍스트 룰렛)으로 떨어지되, 결과 카드로
  넘어가도록 onLanded 는 그대로 울려 준다.

  단계는 여기서 몬다: spinning 이 켜지면 rolling(섞임) → 잠시 후 landing(감속) →
  onLanded(결과 전환). 당첨자는 이미 확정돼 넘어오므로 무대는 보여주기만 한다.
*/
import { useEffect, useRef, useState } from 'react';
import { mountDrawScene } from '../connect/drawScene';
import { buildCoffeeStage, type CoffeeMember, type CoffeeState } from './coffeeStage';

type CoffeeDrawCanvasProps = {
  members: CoffeeMember[];
  winner: string;
  spinning: boolean;
  onLanded: () => void;
  children: React.ReactNode;
};

const ROLL_S = 1.5; // 섞이는 시간
const LAND_S = 2.6; // 감속 시간(coffeeStage 와 맞춘다)
const FALLBACK_S = 1.7; // 폴백(텍스트 룰렛)에서 결과로 넘어가는 시간

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CoffeeDrawCanvas({ members, winner, spinning, onLanded, children }: CoffeeDrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [usable, setUsable] = useState(() => !prefersReducedMotion());

  const stateRef = useRef<CoffeeState>({ phase: 'idle', startedAt: 0, winner });
  const mountedAtRef = useRef(0);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;

  // 단계 진행: spinning 이 켜지면 rolling → landing → onLanded.
  useEffect(() => {
    if (!spinning) return undefined;
    if (!usable) {
      // 3D 를 못 쓰면 children(텍스트 룰렛)만 잠깐 보이고 결과로 넘어간다.
      const done = window.setTimeout(() => onLandedRef.current(), FALLBACK_S * 1000);
      return () => window.clearTimeout(done);
    }
    const now = () => performance.now() / 1000;
    stateRef.current = { phase: 'rolling', startedAt: now(), winner };
    const toLanding = window.setTimeout(() => {
      stateRef.current = { phase: 'landing', startedAt: now(), winner };
    }, ROLL_S * 1000);
    const done = window.setTimeout(() => onLandedRef.current(), (ROLL_S + LAND_S) * 1000);
    return () => {
      window.clearTimeout(toLanding);
      window.clearTimeout(done);
    };
  }, [spinning, usable, winner]);

  // 명단이 실제로 바뀔 때만 씬을 다시 만든다(리렌더마다 다시 만들면 GL 컨텍스트가 쌓인다).
  const roster = members.map((m) => `${m.name}:${m.color ?? ''}:${m.photoUrl ?? ''}`).join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !usable || members.length === 0) return undefined;

    // three 시계는 mount 시점이 0 이다. startedAt(벽시계)도 같은 기준으로 맞춘다.
    mountedAtRef.current = performance.now() / 1000;
    const readState = (): CoffeeState => ({
      ...stateRef.current,
      startedAt: Math.max(0, stateRef.current.startedAt - mountedAtRef.current),
    });

    const dispose = mountDrawScene({
      canvas,
      build: (ctx) => buildCoffeeStage(ctx, readState, members),
    });
    if (!dispose) {
      setUsable(false);
      return undefined;
    }
    return dispose;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, usable]);

  if (!usable || members.length === 0) return <>{children}</>;

  return <canvas className="coffee-draw-canvas" ref={canvasRef} aria-hidden="true" />;
}
