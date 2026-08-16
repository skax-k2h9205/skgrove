/*
  사다리타기 2D 연출.

  커피뽑기(3D, coffeeStage.ts)의 형제지만 사다리는 본질이 2D 다 — three 없이
  canvas.getContext('2d') 로 세로줄+가로줄을 그리고, 패자 열에서 커피칸(슬롯0)까지
  실제로 밟는 경로를 마커가 requestAnimationFrame 으로 훑어 내려간다.
  당첨자(패자)는 이미 확정돼 있다(winner) — 무대는 결정하지 않고 보여주기만 한다.
*/
import { easeOutCubic } from '../connect/drawScene';
import { generateLadder, type Ladder } from './games/ladder';
import type { CoffeeMember } from './coffeeStage';

const LAND_S = 2.5; // 총 연출 시간(브리프 기준)

// 아바타 색 이름 → hex. coffeeStage/avatarTexture 와 같은 계열로 맞춘다.
const COLOR_HEX: Record<string, string> = {
  green: '#3f6b52',
  blue: '#2f6fd0',
  red: '#c2553f',
  yellow: '#c08a2e',
};
const hexOf = (color?: string) => COLOR_HEX[color ?? ''] ?? '#2f6fd0';

export type LadderHandle = {
  /** 사다리를 훑어 내려가는 애니메이션을 시작한다. 끝나면 onDone 을 부른다. */
  start(onDone: () => void): void;
  dispose(): void;
};

type Step = { col: number; row: number };

/**
 * 가로줄이 실제로 놓인 마지막 행 다음 한 칸.
 * games/ladder.ts 의 내부 ROWS 를 밖에서 알 수 없으니, 실제로 그려야 할 최소 행 수를
 * 데이터(rungs)에서 되짚는다 — 이 이상 그려도 경로도, 시각적 밀도도 달라지지 않는다.
 */
function rowCountOf(ladder: Ladder): number {
  return Math.max(1, ladder.rungs.reduce((max, r) => Math.max(max, r.row + 1), 0));
}

/** startCol 에서 실제로 밟는 (열,행) 경로. traceColumn 과 같은 규칙을 좌표째로 기록한다. */
function tracePath(ladder: Ladder, startCol: number, rows: number): Step[] {
  const path: Step[] = [{ col: startCol, row: 0 }];
  let col = startCol;
  for (let row = 0; row < rows; row++) {
    const right = ladder.rungs.some((r) => r.row === row && r.left === col);
    const left = ladder.rungs.some((r) => r.row === row && r.left === col - 1);
    if (right) col += 1;
    else if (left) col -= 1;
    path.push({ col, row: row + 1 });
  }
  return path;
}

/**
 * 캔버스에 사다리를 그린다. 돌려주는 handle 의 start 를 부르면 마커가 패자 열에서
 * 커피칸까지 훑어 내려가고, dispose 는 애니메이션과 리사이즈 관찰을 정리한다.
 * winner 를 members 에서 못 찾으면(indexOf === -1) null 을 돌려준다 — 호출부는 기존
 * CSS 연출(children)로 떨어진다.
 */
export function mountLadder(
  canvas: HTMLCanvasElement,
  { members, winner }: { members: CoffeeMember[]; winner: string },
): LadderHandle | null {
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx || members.length === 0) return null;
  // 명시적으로 non-null 타입을 준 새 바인딩. narrowing 은 아래에 정의될 함수 선언까지
  // 이어지지 않으므로(TS 는 미리 걸리는 호출 가능성을 보수적으로 본다), 여기서 확정한다.
  const ctx: CanvasRenderingContext2D = canvasCtx;

  const loserIndex = members.findIndex((m) => m.name === winner);
  if (loserIndex === -1) return null;

  const names = members.map((m) => m.name);
  const ladder = generateLadder(names, loserIndex);
  const rows = rowCountOf(ladder);
  const startCol = ladder.columns.indexOf(winner);
  const path = tracePath(ladder, startCol, rows);
  const colorByName = new Map(members.map((m) => [m.name, m.color]));

  const PAD_X = 26;
  const PAD_TOP = 40;
  const PAD_BOTTOM = 30;

  let lastDrawn = 0;

  function layout() {
    const { clientWidth: w, clientHeight: h } = canvas;
    const colCount = ladder.columns.length;
    const colGap = colCount > 1 ? (w - PAD_X * 2) / (colCount - 1) : 0;
    const rowGap = (h - PAD_TOP - PAD_BOTTOM) / rows;
    return {
      w,
      h,
      colX: (col: number) => PAD_X + col * colGap,
      rowY: (row: number) => PAD_TOP + row * rowGap,
    };
  }

  function draw(progress: number) {
    lastDrawn = progress;
    const { w, h, colX, rowY } = layout();
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    // 세로줄 + 이름표
    ladder.columns.forEach((name, col) => {
      ctx.strokeStyle = hexOf(colorByName.get(name));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(colX(col), rowY(0));
      ctx.lineTo(colX(col), rowY(rows));
      ctx.stroke();

      ctx.fillStyle = 'rgba(240,240,245,0.92)';
      ctx.font = '600 12px Pretendard, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, colX(col), rowY(0) - 14);
    });

    // 가로줄
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ladder.rungs.forEach((r) => {
      ctx.beginPath();
      ctx.moveTo(colX(r.left), rowY(r.row));
      ctx.lineTo(colX(r.left + 1), rowY(r.row));
      ctx.stroke();
    });

    // 커피칸(도착지) 표시
    ctx.fillStyle = '#c08a2e';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('☕', colX(ladder.coffeeSlot), rowY(rows) + 22);

    // 마커: 진행도(0~1, 이미 easeOutCubic 이 적용된 값)를 경로 위 위치로 보간한다.
    const steps = path.length - 1;
    const at = progress * steps;
    const i = Math.min(Math.floor(at), Math.max(steps - 1, 0));
    const frac = steps > 0 ? at - i : 1;
    const a = path[i];
    const b = path[Math.min(i + 1, path.length - 1)];
    const mx = colX(a.col) + (colX(b.col) - colX(a.col)) * frac;
    const my = rowY(a.row) + (rowY(b.row) - rowY(a.row)) * frac;

    ctx.beginPath();
    ctx.fillStyle = hexOf(members[loserIndex].color);
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(lastDrawn);
  }
  resize();
  // 창 크기가 아니라 캔버스 자신의 크기를 본다(drawScene.ts 의 mountDrawScene 과 같은 이유).
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let frame = 0;
  let disposed = false;

  return {
    start(onDone) {
      if (disposed) return;
      // 재진입 방지: 같은 핸들에 start 가 다시 불리면(예: 같은 명단·당첨자로 재추첨),
      // 앞서 예약된 프레임을 먼저 끊는다 — 안 그러면 두 루프가 같은 캔버스에 겹쳐 그리고
      // onDone 도 두 번 울린다.
      cancelAnimationFrame(frame);
      const startedAt = performance.now();
      const tick = () => {
        const elapsed = (performance.now() - startedAt) / 1000;
        const t = Math.min(elapsed / LAND_S, 1);
        draw(easeOutCubic(t));
        if (t >= 1) {
          onDone();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}
