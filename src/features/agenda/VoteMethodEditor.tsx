import { ListChecks, Plus, Scale, X } from 'lucide-react';
import type { VoteType } from '../../types';

// 선택지가 많아지면 스토리 투표 카드에서 막대가 읽히지 않고, 표도 잘게 흩어져 정족수를 못 채운다.
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

const voteTypeIcon: Record<VoteType, typeof Scale> = {
  찬반: Scale,
  객관식: ListChecks,
};

/**
 * 객관식 선택지를 검증한다. 새 안건 등록과 리더 안건 후보 두 경로가 공유한다.
 *
 * 빈 칸은 지우고 검사한다. 세 칸을 열어두고 둘만 채운 것은 실수가 아니다.
 * 통과하면 정제된 라벨 배열을 함께 돌려줘 저장하는 쪽이 그대로 쓰게 한다.
 */
export function validateVoteOptions(
  voteType: VoteType,
  optionLabels: string[],
): { error: string; labels: string[] } {
  const labels = optionLabels.map((label) => label.trim()).filter(Boolean);

  if (voteType !== '객관식') return { error: '', labels: [] };

  if (labels.length < MIN_OPTIONS) {
    return { error: `선택지를 ${MIN_OPTIONS}개 이상 입력해주세요. 하나뿐이면 고를 것이 없습니다.`, labels };
  }

  if (new Set(labels).size !== labels.length) {
    return { error: '같은 선택지가 두 번 들어 있습니다. 어느 쪽에 투표한 것인지 알 수 없게 됩니다.', labels };
  }

  return { error: '', labels };
}

type VoteMethodEditorProps = {
  voteType: VoteType;
  optionLabels: string[];
  multiSelect: boolean;
  onVoteTypeChange: (voteType: VoteType) => void;
  onOptionLabelsChange: (labels: string[]) => void;
  onMultiSelectChange: (value: boolean) => void;
};

/**
 * 투표 방식(찬반/객관식) 선택과 객관식 선택지 편집을 담는 표현 컴포넌트.
 * 상태는 부모가 소유하고, 값과 setter만 받는다.
 */
export function VoteMethodEditor({
  voteType,
  optionLabels,
  multiSelect,
  onVoteTypeChange,
  onOptionLabelsChange,
  onMultiSelectChange,
}: VoteMethodEditorProps) {
  const updateOption = (index: number, value: string) =>
    onOptionLabelsChange(optionLabels.map((label, at) => (at === index ? value : label)));

  const addOption = () => {
    if (optionLabels.length < MAX_OPTIONS) onOptionLabelsChange([...optionLabels, '']);
  };

  const removeOption = (index: number) => {
    if (optionLabels.length > MIN_OPTIONS) onOptionLabelsChange(optionLabels.filter((_, at) => at !== index));
  };

  return (
    <>
      <p className="form-section-label">투표 방식</p>
      <div className="intake-choice-grid">
        {(Object.keys(voteTypeIcon) as VoteType[]).map((item) => {
          const Icon = voteTypeIcon[item];
          return (
            <button
              className={voteType === item ? 'choice-card selected' : 'choice-card'}
              key={item}
              onClick={() => onVoteTypeChange(item)}
              type="button"
            >
              <Icon size={22} />
              <strong>{item}</strong>
            </button>
          );
        })}
      </div>

      {voteType === '객관식' && (
        <div className="agenda-options-editor">
          <p className="form-section-label">선택지</p>
          {optionLabels.map((label, index) => (
            <div className="agenda-option-row" key={index}>
              <input
                value={label}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`선택지 ${index + 1}`}
                aria-label={`선택지 ${index + 1}`}
              />
              <button
                className="agenda-option-remove"
                onClick={() => removeOption(index)}
                disabled={optionLabels.length <= MIN_OPTIONS}
                aria-label={`선택지 ${index + 1} 삭제`}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <button
            className="secondary-button"
            onClick={addOption}
            disabled={optionLabels.length >= MAX_OPTIONS}
            type="button"
          >
            <Plus size={16} />
            {optionLabels.length >= MAX_OPTIONS ? `선택지는 ${MAX_OPTIONS}개까지` : '선택지 추가'}
          </button>

          <label className="agenda-multi-toggle">
            <input
              type="checkbox"
              checked={multiSelect}
              onChange={(event) => onMultiSelectChange(event.target.checked)}
            />
            <span>
              <strong>여러 개 고르기 허용</strong>
              마음에 드는 것을 모두 고를 수 있습니다. 선택지 비율의 합이 100%를 넘을 수 있어요.
            </span>
          </label>
        </div>
      )}
    </>
  );
}
