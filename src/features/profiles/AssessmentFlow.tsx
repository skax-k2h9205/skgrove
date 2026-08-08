/*
  성향 진단 플로우 — 인트로 → MBTI 16문항 → DISC 12문항 → 결과 + 협업 가이드.
  채점·문항은 assessment.ts(순수)에서 온다. 이 컴포넌트는 흐름·표시만 맡는다.
  완료 시 onComplete 로 Profile 패치(진단값 + 색 + 자동 요약 + 협업 가이드)를 넘긴다.
*/
import { useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, ClipboardCopy, Sparkles } from 'lucide-react';
import type { DiscKey, Profile } from '../../types';
import { Markdownish } from '../chat/Markdownish';
import {
  DISC_GUIDE,
  DISC_LABEL,
  DISC_QUESTIONS,
  MBTI_QUESTIONS,
  scoreDisc,
  scoreMbti,
  summaryFrom,
  DISC_COLOR,
} from './assessment';

type AssessmentProps = {
  profile: Profile;
  onComplete: (patch: Partial<Profile>) => void;
  onCancel: () => void;
};

type Phase = 'intro' | 'mbti' | 'disc' | 'result';

const COLLAB_PROMPT =
  '내 업무 스타일을 바탕으로, 나와 협업할 동료가 참고할 "나와 일하는 법" 가이드를 써줘. ' +
  '항목: 소통 선호 / 피드백 받는 법 / 의사결정 방식 / 집중 시간대 / 피해야 할 것 / 강점 활용법. ' +
  '존댓말, 불릿, 간결하게. 나에 대해 아는 정보를 바탕으로 구체적으로.';

const AXIS_NAME: Record<string, string> = {
  EI: '에너지', SN: '정보', TF: '결정', JP: '생활',
};

export function Assessment({ profile, onComplete, onCancel }: AssessmentProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [mIdx, setMIdx] = useState(0);
  const [dIdx, setDIdx] = useState(0);
  const [mbti, setMbti] = useState<Record<string, 'a' | 'b'>>({});
  const [disc, setDisc] = useState<Record<string, DiscKey>>({});
  const [collab, setCollab] = useState(profile.collabGuide ?? '');
  const [copied, setCopied] = useState(false);

  const total = MBTI_QUESTIONS.length + DISC_QUESTIONS.length;
  const done = Object.keys(mbti).length + Object.keys(disc).length;

  const result = useMemo(() => {
    const m = scoreMbti(mbti);
    const d = scoreDisc(disc);
    return { m, d };
  }, [mbti, disc]);

  const answerMbti = (choice: 'a' | 'b') => {
    const q = MBTI_QUESTIONS[mIdx];
    setMbti((prev) => ({ ...prev, [q.id]: choice }));
    if (mIdx + 1 < MBTI_QUESTIONS.length) setMIdx(mIdx + 1);
    else setPhase('disc');
  };

  const answerDisc = (key: DiscKey) => {
    const q = DISC_QUESTIONS[dIdx];
    setDisc((prev) => ({ ...prev, [q.id]: key }));
    if (dIdx + 1 < DISC_QUESTIONS.length) setDIdx(dIdx + 1);
    else setPhase('result');
  };

  const back = () => {
    if (phase === 'mbti') {
      if (mIdx > 0) setMIdx(mIdx - 1);
      else setPhase('intro');
    } else if (phase === 'disc') {
      if (dIdx > 0) setDIdx(dIdx - 1);
      else setPhase('mbti');
    } else if (phase === 'result') {
      setPhase('disc');
      setDIdx(DISC_QUESTIONS.length - 1);
    }
  };

  const save = () => {
    const { m, d } = result;
    onComplete({
      mbtiType: m.type,
      mbtiScores: m.scores,
      discType: d.type,
      discSecondary: d.secondary,
      discScores: d.scores,
      color: DISC_COLOR[d.type],
      collabGuide: collab.trim() || undefined,
      ...summaryFrom(m.type, d.type),
    });
  };

  const copyPrompt = () => {
    void navigator.clipboard?.writeText(COLLAB_PROMPT).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <section className="panel assessment">
      <div className="assess-top">
        {phase !== 'intro' && (
          <button type="button" className="btn-ghost" onClick={back} aria-label="이전">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="assess-progress" aria-hidden="true">
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <button type="button" className="btn-ghost" onClick={onCancel}>닫기</button>
      </div>

      {phase === 'intro' && (
        <div className="assess-intro">
          <Sparkles size={28} />
          <h2>성향 진단</h2>
          <p>
            평소 성향(MBTI 16문항)과 업무 성향(DISC 12문항)을 진단해요. 정답은 없어요 —
            더 가까운 쪽을 고르면 됩니다. 약 4~5분.
          </p>
          <p className="assess-intro-sub">결과는 내 카드에 담기고, AI 상담이 나를 이해하는 근거가 됩니다.</p>
          <button type="button" className="primary-button" onClick={() => setPhase('mbti')}>시작하기</button>
        </div>
      )}

      {phase === 'mbti' && (
        <div className="assess-q">
          <span className="assess-q-tag">평소 성향 · {AXIS_NAME[MBTI_QUESTIONS[mIdx].axis]} · {mIdx + 1}/{MBTI_QUESTIONS.length}</span>
          <h3>더 가까운 쪽은?</h3>
          <div className="assess-choices two">
            <button type="button" onClick={() => answerMbti('a')}>{MBTI_QUESTIONS[mIdx].a}</button>
            <button type="button" onClick={() => answerMbti('b')}>{MBTI_QUESTIONS[mIdx].b}</button>
          </div>
        </div>
      )}

      {phase === 'disc' && (
        <div className="assess-q">
          <span className="assess-q-tag">업무 성향 · {dIdx + 1}/{DISC_QUESTIONS.length}</span>
          <h3>{DISC_QUESTIONS[dIdx].prompt}</h3>
          <div className="assess-choices">
            {DISC_QUESTIONS[dIdx].options.map((opt) => (
              <button type="button" key={opt.key} onClick={() => answerDisc(opt.key)}>{opt.text}</button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="assess-result">
          <h2>진단 결과</h2>
          <div className="assess-result-row">
            <div className={`assess-badge ${DISC_COLOR[result.d.type]}`}>
              <strong>{result.m.type}</strong>
              <span>평소 성향 (MBTI)</span>
            </div>
            <div className={`assess-badge ${DISC_COLOR[result.d.type]}`}>
              <strong>{DISC_LABEL[result.d.type]}</strong>
              <span>업무 성향 (DISC · {result.d.type})</span>
            </div>
          </div>

          <div className="assess-leans">
            {(['EI', 'SN', 'TF', 'JP'] as const).map((axis) => {
              const lean = result.m.scores[axis];
              const [first, second] = axis.split('');
              return (
                <div className="assess-lean" key={axis}>
                  <span>{first} {lean}%</span>
                  <div className="assess-lean-bar"><span style={{ width: `${lean}%` }} /></div>
                  <span>{100 - lean}% {second}</span>
                </div>
              );
            })}
          </div>

          <p className="assess-disc-guide">{DISC_GUIDE[result.d.type]}</p>

          <div className="assess-collab">
            <div className="assess-collab-head">
              <strong>나와 일하는 법 (선택)</strong>
              <button type="button" className="btn-ghost" onClick={copyPrompt}>
                <ClipboardCopy size={15} /> {copied ? '복사됨' : 'AI 프롬프트 복사'}
              </button>
            </div>
            <p className="assess-collab-help">
              위 프롬프트를 내가 쓰는 AI(Codex·ChatGPT·Claude)에 붙여 실행하고, 나온 가이드를 여기에 붙여넣으세요.
            </p>
            <textarea
              value={collab}
              onChange={(e) => setCollab(e.target.value)}
              placeholder="예) - 소통: 결론부터 간결하게 주세요 …"
              rows={5}
            />
            {collab.trim() && (
              <div className="assess-collab-preview"><Markdownish text={collab} /></div>
            )}
          </div>

          <div className="profile-form-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>취소</button>
            <button type="button" className="primary-button" onClick={save}>
              <BadgeCheck size={18} /> 결과 저장
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
