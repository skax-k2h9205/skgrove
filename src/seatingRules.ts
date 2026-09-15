/*
  회식 자리배치 — 옆자리·맞은편에 같은 값이 겹치지 않게 섞는다.

  줄(line) 하나는 테이블을 이어 붙인 긴 상이고, A면과 B면이 마주본다(A[i] ↔ B[i]).
  줄이 둘이면 사이에 통로가 있어 서로 이웃이 아니다 — 겹침 계산도 줄 안에서만 한다.
  테이블 경계는 두지 않는다. 실제 룸의 테이블 구성을 모를 때도 쓸 수 있어야 해서다.
*/

export type Seatable = {
  name: string;
  part: string;
  sex: string; // '남' | '여' | '' (미입력)
  age: string; // 세대 구간 이름 | '' (미입력)
};

export type Line = {
  cols: number;
  A: (Seatable | null)[];
  B: (Seatable | null)[];
};

export type LayoutKey = '1열' | '2열';

/** 값은 줄마다의 열 수. 한 열에 A면 1석 + B면 1석이 마주본다. */
export const LAYOUTS: Record<LayoutKey, { hint: string; lines: number[] }> = {
  '1열': { hint: '한 줄 · 16 ↔ 16', lines: [16] },
  '2열': { hint: '두 줄 · 각 8 ↔ 8', lines: [8, 8] },
};

/** 파트를 가장 세게 본다 — 회식에서 파트가 뭉치는 게 가장 눈에 띈다. */
export const AXES: { key: 'part' | 'sex' | 'age'; label: string; weight: number }[] = [
  { key: 'part', label: '파트', weight: 3 },
  { key: 'sex', label: '성별', weight: 2 },
  { key: 'age', label: '연령대', weight: 1 },
];

export function buildLines(key: LayoutKey): Line[] {
  return LAYOUTS[key].lines.map((cols) => ({
    cols,
    A: new Array(cols).fill(null),
    B: new Array(cols).fill(null),
  }));
}

export function totalSeats(lines: Line[]) {
  return lines.reduce((sum, line) => sum + line.cols * 2, 0);
}

/*
  줄별 정원. 앞줄부터 꽉 채우면 2열에서 16명 / 11명처럼 한쪽이 휑해진다.
  좌석 수에 비례해 나누고, 나머지 한 명씩은 여유 있는 줄에 돌아가며 얹는다.
*/
export function quotasFor(lines: Line[], people: number): number[] {
  const caps = lines.map((line) => line.cols * 2);
  const total = caps.reduce((a, b) => a + b, 0);
  if (people >= total) return caps;

  const quotas = caps.map((cap) => Math.floor((people * cap) / total));
  let left = people - quotas.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % quotas.length) {
    if (quotas[i] < caps[i]) {
      quotas[i] += 1;
      left -= 1;
    }
  }
  return quotas;
}

function neighborsOf(line: Line, row: 'A' | 'B', col: number) {
  const other = row === 'A' ? 'B' : 'A';
  return [line[row][col - 1], line[row][col + 1], line[other][col]].filter(Boolean) as Seatable[];
}

function costAt(line: Line, row: 'A' | 'B', col: number, person: Seatable) {
  return neighborsOf(line, row, col).reduce(
    (sum, near) =>
      sum +
      AXES.reduce((s, axis) => {
        const mine = person[axis.key];
        const theirs = near[axis.key];
        return s + (mine && theirs && mine === theirs ? axis.weight : 0);
      }, 0),
    0,
  );
}

function attempt(people: Seatable[], key: LayoutKey, shuffle: () => number) {
  const pool = people.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(shuffle() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const lines = buildLines(key);
  const quotas = quotasFor(lines, pool.length);
  let cost = 0;

  lines.forEach((line, li) => {
    let seated = 0;
    // 열 단위로 A→B 를 돌면 맞은편이 바로 다음에 놓여, 맞은편 겹침을 즉시 피할 수 있다.
    for (let col = 0; col < line.cols && pool.length && seated < quotas[li]; col += 1) {
      for (const row of ['A', 'B'] as const) {
        if (!pool.length || seated >= quotas[li]) break;
        let best = 0;
        let bestCost = Infinity;
        for (let k = 0; k < pool.length; k += 1) {
          const c = costAt(line, row, col, pool[k]);
          if (c < bestCost) {
            bestCost = c;
            best = k;
            if (c === 0) break;
          }
        }
        line[row][col] = pool.splice(best, 1)[0];
        cost += bestCost;
        seated += 1;
      }
    }
  });

  return { lines, cost };
}

/** 무작위 시작점을 여러 번 돌려 가장 겹침이 적은 배치를 고른다. */
export function arrange(people: Seatable[], key: LayoutKey, tries = 300, rng: () => number = Math.random): Line[] {
  let best = attempt(people, key, rng);
  for (let i = 1; i < tries && best.cost > 0; i += 1) {
    const got = attempt(people, key, rng);
    if (got.cost < best.cost) best = got;
  }
  return best.lines;
}

/** 축별 겹침 수 — 옆자리(같은 줄 인접 열) + 맞은편. 미입력 값은 세지 않는다. */
export function conflicts(lines: Line[]): Record<string, number> {
  const out: Record<string, number> = {};
  AXES.forEach((axis) => {
    out[axis.key] = 0;
  });

  lines.forEach((line) => {
    (['A', 'B'] as const).forEach((row) => {
      for (let col = 0; col < line.cols - 1; col += 1) {
        const x = line[row][col];
        const y = line[row][col + 1];
        if (x && y) AXES.forEach((a) => { if (x[a.key] && x[a.key] === y[a.key]) out[a.key] += 1; });
      }
    });
    for (let col = 0; col < line.cols; col += 1) {
      const a = line.A[col];
      const b = line.B[col];
      if (a && b) AXES.forEach((axis) => { if (a[axis.key] && a[axis.key] === b[axis.key]) out[axis.key] += 1; });
    }
  });
  return out;
}

/**
 * 한 값이 절반을 넘으면 그 값끼리 이웃이 되는 것을 피할 수 없다
 * (좌석마다 이웃이 최대 셋뿐이라 비둘기집). 0건을 목표로 경고하면 거짓말이 된다.
 */
export function unavoidable(people: Seatable[], key: 'part' | 'sex' | 'age') {
  const known = people.filter((p) => p[key]);
  if (!known.length) return false;
  const tally = new Map<string, number>();
  known.forEach((p) => tally.set(p[key], (tally.get(p[key]) ?? 0) + 1));
  return Math.max(...tally.values()) * 2 > known.length;
}
