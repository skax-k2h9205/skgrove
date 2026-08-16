import type { CoffeeGame, CoffeeScore } from '../../../types';

export type GameKind = 'luck' | 'skill';

export interface CoffeeGameMeta {
  id: CoffeeGame;
  name: string;
  blurb: string;
  kind: GameKind;
  /** 실력 게임에서만: 점수가 높을수록 잘한 것인가. tap=true, reaction/timing=false(작을수록 좋음). */
  higherIsBetter?: boolean;
}

export const COFFEE_GAMES: CoffeeGameMeta[] = [
  { id: 'roulette', name: '룰렛', blurb: '프로필이 돌다 한 명에 걸려요', kind: 'luck' },
  { id: 'ladder', name: '사다리', blurb: '줄을 타고 내려가 커피칸에 걸린 사람', kind: 'luck' },
  { id: 'reaction', name: '반응속도', blurb: '초록불에 가장 늦게 반응한 사람', kind: 'skill', higherIsBetter: false },
  { id: 'timing', name: '타이밍', blurb: '정중앙에서 가장 벗어난 사람', kind: 'skill', higherIsBetter: false },
  { id: 'tap', name: '광클', blurb: '5초 동안 가장 적게 누른 사람', kind: 'skill', higherIsBetter: true },
];

const BY_ID = new Map(COFFEE_GAMES.map((g) => [g.id, g]));

export function gameMeta(id: CoffeeGame): CoffeeGameMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`unknown coffee game: ${id}`);
  return meta;
}

/**
 * 실력 게임의 패자 = 최악 점수. higherIsBetter 면 최소값이, 아니면 최대값이 패자.
 * 동점은 배열 순서상 먼저 오는 사람으로 정한다 — 재현 가능한 결과를 위해 결정적으로.
 */
export function resolveSkillLoser(id: CoffeeGame, scores: CoffeeScore[]): string {
  if (scores.length === 0) throw new Error('resolveSkillLoser: 빈 점수');
  const higherIsBetter = gameMeta(id).higherIsBetter ?? false;
  return scores.reduce((worst, cur) => {
    const curWorse = higherIsBetter ? cur.score < worst.score : cur.score > worst.score;
    return curWorse ? cur : worst;
  }).name;
}
