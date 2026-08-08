import { useState } from 'react';
import { AlertTriangle, FileCheck2, Plus, Send, Trash2 } from 'lucide-react';
import { PanelHeader } from '../../components/PanelHeader';
import { winningOptions } from '../../agendaRules';
import type { ActionItem, Agenda, ManagedAccount } from '../../types';

export type ActionDraft = Pick<ActionItem, 'title' | 'owner' | 'due'>;

type ActionCreateFormProps = {
  agenda: Agenda;
  accounts: ManagedAccount[];
  today: string;
  onCreate: (agenda: Agenda, drafts: ActionDraft[]) => void;
  onCancel: () => void;
};

const emptyDraft = (): ActionDraft => ({ title: '', owner: '미정', due: '' });

/**
 * 객관식에서 넘어왔으면 정해진 선택지를 첫 줄 제목에 미리 넣어준다.
 * 동점이면 무엇을 할지가 아직 정해지지 않은 것이므로 비워 둔다.
 */
const seedDrafts = (agenda: Agenda): ActionDraft[] => {
  if (agenda.voteType !== '객관식') return [emptyDraft()];
  const winners = winningOptions(agenda);
  if (winners.length !== 1) return [emptyDraft()];
  return [{ ...emptyDraft(), title: winners[0].label }];
};

export function ActionCreateForm({ agenda, accounts, today, onCreate, onCancel }: ActionCreateFormProps) {
  // 통과된 안건 하나에서 여러 액션이 나오는 경우가 흔해 처음부터 여러 줄을 다룬다.
  const [drafts, setDrafts] = useState<ActionDraft[]>(() => seedDrafts(agenda));
  const [error, setError] = useState('');

  const owners = accounts.filter((account) => account.status === '활성');

  const update = (index: number, patch: Partial<ActionDraft>) => {
    setDrafts(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  };

  const submit = () => {
    const filled = drafts.filter((draft) => draft.title.trim());

    if (filled.length === 0) {
      setError('액션아이템 제목을 최소 한 줄 입력해주세요.');
      return;
    }

    const pastDue = filled.find((draft) => draft.due && draft.due < today);
    if (pastDue) {
      setError(`목표일이 오늘보다 이전입니다: "${pastDue.title.trim()}"`);
      return;
    }

    setError('');
    onCreate(agenda, filled);
  };

  return (
    <section className="panel action-form-panel">
      <PanelHeader icon={FileCheck2} title="액션아이템 생성" />

      <p className="action-form-source">
        {agenda.status === '결정됨' ? '결정된 안건' : '통과 안건'} · {agenda.title} <span>({agenda.id})</span>
      </p>

      <div className="action-draft-list">
        {drafts.map((draft, index) => (
          <div className="action-draft-row" key={index}>
            <label>
              할 일
              <input
                value={draft.title}
                onChange={(event) => update(index, { title: event.target.value })}
                placeholder="예: 티미팅 아젠다 3개 제한안 작성"
              />
            </label>
            <label>
              담당자
              <select value={draft.owner} onChange={(event) => update(index, { owner: event.target.value })}>
                <option>미정</option>
                {owners.map((account) => (
                  <option key={account.id}>{account.name}</option>
                ))}
              </select>
            </label>
            <label>
              목표일
              <input
                type="date"
                value={draft.due}
                min={today}
                onChange={(event) => update(index, { due: event.target.value })}
              />
            </label>
            {drafts.length > 1 && (
              <button
                className="action-draft-remove"
                aria-label="이 줄 삭제"
                onClick={() => setDrafts(drafts.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="secondary-button" onClick={() => setDrafts([...drafts, emptyDraft()])}>
        <Plus size={17} />
        액션 추가
      </button>

      {error && (
        <div className="notice-line">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="form-actions">
        <button className="secondary-button" onClick={onCancel}>
          취소
        </button>
        <button className="primary-button" onClick={submit}>
          <Send size={18} />
          생성
        </button>
      </div>
    </section>
  );
}
