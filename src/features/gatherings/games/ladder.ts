export type Rung = { row: number; left: number }; // left 열과 left+1 열을 잇는 가로줄
export interface Ladder {
  columns: string[]; // 각 세로줄 위에 선 사람 이름 (열 index 순)
  rungs: Rung[];
  coffeeSlot: number; // 커피 당첨 바닥 칸 (항상 0)
}

const ROWS = 8; // 가로줄이 놓일 수 있는 층 수. 시각적 밀도.

/** 한 열에서 시작해 사다리를 타고 내려간 도착 슬롯. 각 행에서 좌/우 가로줄이 있으면 옆으로 이동. */
export function traceColumn(ladder: Ladder, startCol: number): number {
  let col = startCol;
  for (let row = 0; row < ROWS; row++) {
    const right = ladder.rungs.some((r) => r.row === row && r.left === col);
    const left = ladder.rungs.some((r) => r.row === row && r.left === col - 1);
    if (right) col += 1;
    else if (left) col -= 1;
  }
  return col;
}

/**
 * 가로줄을 무작위로 뿌린다. 같은 행에서 인접 가로줄이 겹치면(한 칸이 좌우 동시)
 * 경로가 꼬이므로, 각 행에서 왼쪽부터 훑으며 바로 옆에 이미 놓였으면 건너뛴다.
 */
function randomRungs(colCount: number, rng: () => number): Rung[] {
  const rungs: Rung[] = [];
  for (let row = 0; row < ROWS; row++) {
    let left = 0;
    while (left < colCount - 1) {
      if (rng() < 0.5) {
        rungs.push({ row, left });
        left += 2; // 방금 놓은 가로줄의 오른쪽 열은 이 행에서 또 잇지 않는다
      } else {
        left += 1;
      }
    }
  }
  return rungs;
}

/**
 * 패자로 지정된 사람이 커피칸(0)에 도달하는 사다리를 만든다.
 * 방식: 가로줄을 자유롭게 뿌린 뒤, 슬롯0 에 도달하는 '열'을 찾아 그 열에 패자를 놓고
 * 나머지 이름을 남은 열에 순서대로 채운다. 사다리(가로줄)는 진짜, 이름 배치만 맞춘다.
 */
export function generateLadder(names: string[], loserIndex: number, rng: () => number = Math.random): Ladder {
  const n = names.length;
  const rungs = randomRungs(n, rng);
  // 각 열이 도달하는 슬롯. 전단사(순열)임은 traceColumn 구조상 보장된다.
  const landing = names.map((_, col) => traceColumn({ columns: names, rungs, coffeeSlot: 0 }, col));
  const coffeeColumn = landing.indexOf(0); // 슬롯0(커피)에 도달하는 열
  const loserName = names[loserIndex];
  const others = names.filter((_, i) => i !== loserIndex);
  const columns: string[] = [];
  let o = 0;
  for (let col = 0; col < n; col++) {
    columns[col] = col === coffeeColumn ? loserName : others[o++];
  }
  return { columns, rungs, coffeeSlot: 0 };
}
