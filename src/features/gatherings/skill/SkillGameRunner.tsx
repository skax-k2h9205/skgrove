import { useState } from 'react';
import type { JSX } from 'react';
import type { CoffeeScore } from '../../../types';

export type SkillGameComponent = (props: { onScore: (score: number) => void }) => JSX.Element;

type Props = {
  members: string[];
  Play: SkillGameComponent;
  onComplete: (scores: CoffeeScore[]) => void;
  onCancel: () => void;
};

export function SkillGameRunner({ members, Play, onComplete, onCancel }: Props) {
  const [scores, setScores] = useState<CoffeeScore[]>([]);
  const [phase, setPhase] = useState<'handoff' | 'playing'>('handoff');
  const i = scores.length;
  const current = members[i];

  const record = (score: number) => {
    const next = [...scores, { name: current, score }];
    setScores(next);
    if (next.length >= members.length) onComplete(next);
    else setPhase('handoff');
  };

  if (phase === 'handoff') {
    return (
      <div className="coffee-skill-handoff">
        <p className="coffee-skill-turn">{current}님 차례 ({i + 1}/{members.length})</p>
        <button type="button" className="primary-button coffee" onClick={() => setPhase('playing')}>시작</button>
        <button type="button" className="coffee-skill-cancel" onClick={onCancel}>그만두기</button>
      </div>
    );
  }
  return <Play key={i} onScore={record} />;
}
