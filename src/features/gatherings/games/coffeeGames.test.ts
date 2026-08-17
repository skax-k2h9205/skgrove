import { describe, expect, it } from 'vitest';
import { COFFEE_GAMES, gameMeta, resolveSkillLoser } from './coffeeGames';

describe('coffeeGames 레지스트리', () => {
  it('5종이 있고 각각 id·kind 가 정의된다', () => {
    expect(COFFEE_GAMES.map((g) => g.id)).toEqual(['roulette', 'ladder', 'reaction', 'timing', 'tap']);
    expect(gameMeta('roulette').kind).toBe('luck');
    expect(gameMeta('ladder').kind).toBe('luck');
    expect(gameMeta('reaction').kind).toBe('skill');
  });
});

describe('resolveSkillLoser', () => {
  it('반응속도: ms 가 가장 큰(느린) 사람이 진다', () => {
    const scores = [{ name: '민수', score: 210 }, { name: '지연', score: 340 }, { name: '현우', score: 180 }];
    expect(resolveSkillLoser('reaction', scores)).toBe('지연');
  });
  it('광클: 탭이 가장 적은 사람이 진다(높을수록 좋음)', () => {
    const scores = [{ name: '민수', score: 55 }, { name: '지연', score: 41 }, { name: '현우', score: 60 }];
    expect(resolveSkillLoser('tap', scores)).toBe('지연');
  });
  it('타이밍: 중앙에서 가장 먼(오차 큰) 사람이 진다', () => {
    const scores = [{ name: '민수', score: 0.12 }, { name: '지연', score: 0.03 }, { name: '현우', score: 0.28 }];
    expect(resolveSkillLoser('timing', scores)).toBe('현우');
  });
  it('동점이면 배열 순서상 먼저인 사람으로 결정적으로 정한다', () => {
    const scores = [{ name: '민수', score: 300 }, { name: '지연', score: 300 }];
    expect(resolveSkillLoser('reaction', scores)).toBe('민수');
  });
});
