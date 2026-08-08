/*
  3D 뽑기 무대를 화면에 붙이는 이음새.

  WebGL 은 CSS 가 아니라 그림이라, 이 앱이 지켜 온 두 가지를 코드로 직접 챙겨야 한다.
  1) prefers-reduced-motion — 캔버스 안의 움직임에는 미디어쿼리가 닿지 않는다.
  2) 실패해도 화면은 남아야 한다 — 옛 기기·원격 데스크톱에는 WebGL 이 없다.
  둘 중 하나라도 걸리면 children(기존 CSS 연출)을 그대로 보여준다.
*/
import { useEffect, useRef, useState } from 'react';
import { mountDrawScene } from './drawScene';
import { buildTeamStage, type DrawState, type Member } from './drawStages';

type DrawCanvasProps = {
  members: Member[];
  isDrawing: boolean;
  teamOf?: Record<string, number>;
  teamCount?: number;
  children: React.ReactNode;
};

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DrawCanvas({ members, isDrawing, teamOf, teamCount, children }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [usable, setUsable] = useState(() => !prefersReducedMotion());

  /*
    무대는 매 프레임 이 ref 를 읽는다. 상태를 의존성에 넣어 다시 mount 하면
    렌더링 컨텍스트가 쌓이다 브라우저 한도에 걸려 화면이 통째로 사라진다.
    바뀌는 값은 ref 로 흘려보내고, 씬은 참여자가 바뀔 때만 다시 만든다.
  */
  const stateRef = useRef<DrawState>({ phase: 'idle', startedAt: 0 });
  const phase: DrawState['phase'] = isDrawing ? 'rolling' : teamOf ? 'done' : 'idle';

  // 단계가 바뀐 순간을 기록해 둔다. 감속 곡선이 이 시각을 기준으로 흐른다.
  const prevPhase = useRef(phase);
  if (prevPhase.current !== phase) {
    prevPhase.current = phase;
    stateRef.current.startedAt = performance.now() / 1000;
  }
  stateRef.current.phase = phase;
  stateRef.current.teamOf = teamOf;
  stateRef.current.teamCount = teamCount;

  // 참여자 명단이 실제로 바뀔 때만 씬을 다시 만든다.
  const roster = members.map((m) => `${m.name}:${m.color}`).join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !usable || members.length === 0) return undefined;

    // three 가 쓰는 시계는 mount 시점이 0 이다. startedAt 도 같은 기준으로 맞춘다.
    const mountedAt = performance.now() / 1000;
    const readState = (): DrawState => ({
      ...stateRef.current,
      startedAt: Math.max(0, stateRef.current.startedAt - mountedAt),
    });

    const dispose = mountDrawScene({
      canvas,
      build: (ctx) => buildTeamStage(ctx, readState, members),
    });

    // WebGL 을 못 만들면 조용히 기존 연출로 돌아간다.
    if (!dispose) {
      setUsable(false);
      return undefined;
    }
    return dispose;
    // roster 로 명단 변화를 감지한다. members 배열은 매 렌더 새로 만들어져 그대로 쓰면 무한히 다시 만든다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, usable]);

  if (!usable || members.length === 0) return <>{children}</>;

  return <canvas className="draw-canvas" ref={canvasRef} aria-hidden="true" />;
}
