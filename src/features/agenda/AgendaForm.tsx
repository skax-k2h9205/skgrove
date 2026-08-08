import { useState } from 'react';
import { AlertTriangle, EyeOff, FilePlus2, Send, ShieldCheck } from 'lucide-react';
import { PanelHeader } from '../../components/PanelHeader';
import { MIN_OPTIONS, VoteMethodEditor, validateVoteOptions } from './VoteMethodEditor';
import { teamParts } from '../../auth';
import type { Agenda, Identity, TeamPart, VoteType } from '../../types';

export type AgendaDraft = Pick<
  Agenda,
  'title' | 'description' | 'category' | 'part' | 'author' | 'deadline' | 'voteType' | 'multiSelect'
> & {
  // 라벨만 넘긴다. 선택지 id 발급과 집계 초기화는 안건을 만드는 쪽 책임이다.
  optionLabels: string[];
};

type AgendaFormProps = {
  onSubmit: (draft: AgendaDraft) => void;
  onCancel: () => void;
};

const categories = ['회의문화', '협업', '업무방식', '갈등', '성장/피드백', '복지/분위기', '기타'];
// auth.teamParts에는 '전체'가 없다. 안건은 팀 전체 대상이 기본이라 앞에 붙여 쓴다.
const agendaParts: TeamPart[] = ['전체', ...teamParts];

const DEFAULT_VOTING_DAYS = 7;
const addDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export function AgendaForm({ onSubmit, onCancel }: AgendaFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [part, setPart] = useState<TeamPart>('전체');
  const [author, setAuthor] = useState<Identity>('익명');
  const [deadline, setDeadline] = useState(addDays(DEFAULT_VOTING_DAYS));
  const [voteType, setVoteType] = useState<VoteType>('찬반');
  const [optionLabels, setOptionLabels] = useState<string[]>(Array(MIN_OPTIONS).fill(''));
  const [multiSelect, setMultiSelect] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length < 5) {
      setError('제목은 5자 이상 입력해주세요. 투표하는 사람이 제목만 보고 판단할 수 있어야 합니다.');
      return;
    }

    if (!trimmedDescription) {
      setError('배경 설명을 입력해주세요. 맥락 없는 안건은 찬반이 갈리기 어렵습니다.');
      return;
    }

    if (deadline && deadline <= addDays(0)) {
      setError('마감일은 내일 이후로 정해주세요. 오늘 마감이면 투표할 시간이 없습니다.');
      return;
    }

    const { error: optionError, labels } = validateVoteOptions(voteType, optionLabels);
    if (optionError) {
      setError(optionError);
      return;
    }

    setError('');
    onSubmit({
      title: trimmedTitle,
      description: trimmedDescription,
      category,
      part,
      author,
      deadline,
      voteType,
      // 찬반이면 선택지를 저장하지 않는다. 방식을 바꿔가며 쓴 흔적이 남을 이유가 없다.
      optionLabels: voteType === '객관식' ? labels : [],
      multiSelect: voteType === '객관식' && multiSelect,
    });
  };

  return (
    <section className="panel agenda-form-panel">
      <PanelHeader icon={FilePlus2} title="새 안건 등록" />

      <div className="intake-choice-grid">
        {(['익명', '실명'] as const).map((item) => (
          <button
            className={author === item ? 'choice-card selected' : 'choice-card'}
            key={item}
            onClick={() => setAuthor(item)}
          >
            {item === '익명' ? <EyeOff size={22} /> : <ShieldCheck size={22} />}
            <strong>{item}</strong>
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label>
          카테고리
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          투표 대상 파트
          <select value={part} onChange={(event) => setPart(event.target.value as TeamPart)}>
            {agendaParts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        투표 마감일
        <input type="date" value={deadline} min={addDays(1)} onChange={(event) => setDeadline(event.target.value)} />
      </label>

      <VoteMethodEditor
        voteType={voteType}
        optionLabels={optionLabels}
        multiSelect={multiSelect}
        onVoteTypeChange={setVoteType}
        onOptionLabelsChange={setOptionLabels}
        onMultiSelectChange={setMultiSelect}
      />

      <label>
        안건 제목
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 팀 티미팅을 30분으로 줄이기"
        />
      </label>
      <label>
        배경 설명
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="왜 이 안건이 필요한지, 어떤 변화를 기대하는지 적어주세요."
        />
      </label>

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
          안건 등록
        </button>
      </div>
    </section>
  );
}
