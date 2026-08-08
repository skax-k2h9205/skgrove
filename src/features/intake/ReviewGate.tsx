import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, PenLine, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { groupFindings, reviewIntake, type ReviewField, type ReviewFinding } from '../../intakeReview';

// 검토 입력을 객체로 받지 않는다. 매 렌더마다 새 객체가 되어 재검토가 무한히 돈다.
//
// 수정안 '바로 적용' 버튼을 둔다. 예전엔 모델이 항목 전체를 다시 써서 대상·사안이
// 사라지는 문제로 뺐지만, 이제 프롬프트가 "대상·행동·요구 보존, 새 주제 금지"를
// 강제하는 건설적 재구성이라 안전하다. 적용은 항목 단위로 하고(rewritten = 그 항목의
// 완성 대체문), 적용하면 값이 바뀌어 자동으로 다시 검토된다. 최종 판단은 여전히 작성자다.
type ReviewGateProps = {
  title: string;
  body: string;
  expectedChange: string;
  onEditManually: () => void;
  onReadyChange: (ready: boolean) => void;
  onApply: (fields: ReviewField[], rewritten: string) => void;
};

type GateState =
  | { phase: 'checking' }
  | { phase: 'clear' }
  | { phase: 'blocked'; findings: ReviewFinding[] }
  | { phase: 'unavailable' };

const FIELD_LABEL: Record<ReviewField, string> = {
  title: '제목',
  body: '내용',
  expectedChange: '기대 변화',
};


export function ReviewGate({
  title,
  body,
  expectedChange,
  onEditManually,
  onReadyChange,
  onApply,
}: ReviewGateProps) {
  const [state, setState] = useState<GateState>({ phase: 'checking' });

  // 의존성은 원시값 셋이다. 값이 실제로 바뀔 때만 다시 검토한다.
  const runReview = useCallback(async () => {
    setState({ phase: 'checking' });
    const result = await reviewIntake({ title, body, expectedChange });

    // 엔드포인트 미설정은 "기능 없음"이지 "검사 실패"가 아니다. 조용히 통과시킨다.
    if (!result.ok) {
      setState({ phase: result.reason === 'disabled' ? 'clear' : 'unavailable' });
      return;
    }

    const findings = result.findings ?? [];
    setState(findings.length > 0 ? { phase: 'blocked', findings } : { phase: 'clear' });
  }, [title, body, expectedChange]);

  useEffect(() => {
    void runReview();
  }, [runReview]);

  // 제출 가능 여부를 부모에게 알린다. 지적이 남아 있는 동안에만 잠근다.
  useEffect(() => {
    onReadyChange(state.phase === 'clear' || state.phase === 'unavailable');
  }, [state.phase, onReadyChange]);

  if (state.phase === 'checking') {
    return (
      <div className="review-gate checking">
        <Sparkles size={18} />
        <p>내용을 검토하고 있어요. 잠시만 기다려주세요.</p>
      </div>
    );
  }

  if (state.phase === 'unavailable') {
    return (
      <div className="review-gate unavailable">
        <AlertTriangle size={18} />
        <div>
          <strong>AI 검토를 받지 못한 상태로 접수됩니다</strong>
          <span>특정인을 향한 표현이 없는지 직접 확인해주세요.</span>
        </div>
        <button className="secondary-button" onClick={() => void runReview()}>
          <RefreshCw size={16} />
          다시 검토
        </button>
      </div>
    );
  }

  if (state.phase === 'clear') {
    return (
      <div className="review-gate clear">
        <ShieldCheck size={18} />
        <p>검토를 마쳤어요. 이대로 접수할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="review-gate blocked">
      <div className="review-gate-head">
        <AlertTriangle size={18} />
        <strong>다듬어야 접수할 수 있어요</strong>
      </div>

      {groupFindings(state.findings).map((group, index) => (
        <article className="review-finding" key={`${group.kind}-${index}`}>
          <span className={`review-kind ${group.kind}`}>
            {group.kind === 'profanity' ? '욕설' : '인신공격'} ·{' '}
            {group.fields.map((field) => FIELD_LABEL[field]).join(', ')}
          </span>
          {group.reason && <p className="review-reason">{group.reason}</p>}
          <p className="review-suggestion-label">이렇게 바꿔볼 수 있어요</p>
          <p className="review-rewritten">{group.rewritten}</p>
          <button
            type="button"
            className="secondary-button review-apply"
            onClick={() => onApply(group.fields, group.rewritten)}
          >
            <Check size={15} />
            이 문장으로 적용
          </button>
        </article>
      ))}

      <div className="review-gate-foot">
        <button className="primary-button" onClick={onEditManually}>
          <PenLine size={16} />
          내용 고치러 가기
        </button>
        {/* 앱이 받지 못하는 말도 사람은 받을 수 있어야 한다. 막다른 길을 만들지 않는다. */}
        <p className="field-note">
          이 내용이 꼭 그대로 전달되어야 하는 사안이라면, 리더에게 1on1을 요청해주세요. 접수 화면 대신 직접 이야기하는
          편이 나은 일도 있습니다.
        </p>
      </div>
    </div>
  );
}
