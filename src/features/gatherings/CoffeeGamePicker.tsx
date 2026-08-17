/*
  커피내기 게임 선택 칩. Phase A 는 운 게임(룰렛·사다리)만 노출한다 —
  기본값은 전체 목록이지만, GatheringBoard 가 kind === 'luck' 만 걸러서 넘긴다.
  Phase B 에서 실력 게임을 붙일 때 games prop 을 생략하면(=COFFEE_GAMES 전체) 그대로 확장된다.
*/
import type { CoffeeGame } from '../../types';
import { COFFEE_GAMES, type CoffeeGameMeta } from './games/coffeeGames';

type Props = {
  value: CoffeeGame;
  onChange: (g: CoffeeGame) => void;
  disabled?: boolean;
  games?: CoffeeGameMeta[];
};

export function CoffeeGamePicker({ value, onChange, disabled, games = COFFEE_GAMES }: Props) {
  return (
    <div className="coffee-game-picker" role="radiogroup" aria-label="커피내기 게임 선택">
      {games.map((g) => (
        <button
          key={g.id}
          type="button"
          role="radio"
          aria-checked={value === g.id}
          className={value === g.id ? 'coffee-game-chip on' : 'coffee-game-chip'}
          disabled={disabled}
          onClick={() => onChange(g.id)}
        >
          <strong>{g.name}</strong>
          <span>{g.blurb}</span>
        </button>
      ))}
    </div>
  );
}
