import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Gavel,
  ListPlus,
  ThumbsDown,
  ThumbsUp,
  Timer,
} from 'lucide-react';
import {
  daysLeft,
  isOpen,
  optionRate,
  participationRate,
  remainingVoters,
  voteTotal,
  votesShortOfQuorum,
  winningOptions,
} from '../../agendaRules';
import type { Agenda, VoteChoice, VoteSelection } from '../../types';
import { approveRate } from './agendaSort';

type AgendaDetailProps = {
  agenda: Agenda;
  alreadyVoted: boolean;
  canClose: boolean;
  today: string;
  actionCount: number;
  onVote: (id: string, selection: VoteSelection) => void;
  onClose: (id: string) => void;
  onCreateActions: (agenda: Agenda) => void;
  onBack: () => void;
};

export function AgendaDetail({
  agenda,
  alreadyVoted,
  canClose,
  today,
  actionCount,
  onVote,
  onClose,
  onCreateActions,
  onBack,
}: AgendaDetailProps) {
  // 확정 전 임시 선택. 확정 버튼을 눌러야만 onVote가 호출된다.
  const [pendingChoice, setPendingChoice] = useState<VoteChoice | null>(null);
  const [pendingOptionIds, setPendingOptionIds] = useState<string[]>([]);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const multipleChoice = agenda.voteType === '객관식';
  const total = voteTotal(agenda);
  const rate = approveRate(agenda);
  const remaining = daysLeft(agenda, today);
  const open = isOpen(agenda);
  const shortOfQuorum = votesShortOfQuorum(agenda);
  const notVotedYet = remainingVoters(agenda);
  const winners = winningOptions(agenda);
  const decidedOption = winners.length === 1 ? winners[0] : null;
  const canCreateActions = agenda.status === '통과' || agenda.status === '결정됨';

  const toggleOption = (optionId: string) =>
    setPendingOptionIds((picked) => {
      if (!agenda.multiSelect) return picked.includes(optionId) ? [] : [optionId];
      return picked.includes(optionId) ? picked.filter((id) => id !== optionId) : [...picked, optionId];
    });

  const clearPending = () => {
    setPendingChoice(null);
    setPendingOptionIds([]);
  };

  const hasPending = multipleChoice ? pendingOptionIds.length > 0 : pendingChoice !== null;

  const confirmVote = () => {
    if (multipleChoice) onVote(agenda.id, { kind: '객관식', optionIds: pendingOptionIds });
    else if (pendingChoice) onVote(agenda.id, { kind: '찬반', choice: pendingChoice });
    clearPending();
  };

  // 확정 직전에 "무엇에 투표하는지"를 사용자가 쓴 말 그대로 되짚어준다.
  const pendingLabel = multipleChoice
    ? agenda.options
        .filter((option) => pendingOptionIds.includes(option.id))
        .map((option) => option.label)
        .join(', ')
    : pendingChoice === 'approve'
      ? '찬성'
      : '반대';

  // 마감을 되돌릴 수 없으므로, 무엇으로 확정되는지 숫자로 보여준 뒤 묻는다.
  const closingTally = multipleChoice
    ? total === 0
      ? '아직 아무도 투표하지 않았습니다'
      : `현재 1위 ${winners.map((option) => option.label).join(' · ')} ${winners[0].count}표`
    : `찬성 ${agenda.approve} · 반대 ${agenda.reject}`;

  return (
    <section className="panel agenda-detail-panel">
      <button className="can-back" onClick={onBack}>
        <ArrowLeft size={16} />
        안건 목록
      </button>

      <div className="agenda-detail-head">
        <span className={`status-dot ${agenda.status}`}>{agenda.status}</span>
        <h2>{agenda.title}</h2>
        <p className="agenda-detail-meta">
          {agenda.id} · {agenda.category} · {agenda.part} · {agenda.source} · {agenda.createdAt}
        </p>
        <p className="agenda-detail-author">
          {agenda.author === '익명' ? (
            <>
              <EyeOff size={15} />
              익명 등록
            </>
          ) : (
            <>작성자 {agenda.authorName || '이름 없음'}</>
          )}
        </p>
      </div>

      <p className="agenda-detail-body">{agenda.description || '등록된 배경 설명이 없습니다.'}</p>

      {agenda.deadline && (
        <p className="agenda-deadline">
          <Timer size={15} />
          {open
            ? remaining !== null && remaining <= 0
              ? '오늘 마감'
              : `마감 ${agenda.deadline} · ${remaining}일 남음`
            : `${agenda.closedAt || agenda.deadline} 마감됨`}
        </p>
      )}

      <div className="agenda-detail-vote">
        {multipleChoice ? (
          /* 선택지가 몇 개든 같은 막대로 늘어선다. 찬반의 2칸짜리 막대와 같은 문법이다. */
          <div className="ig-poll">
            {agenda.options.map((option) => {
              const share = optionRate(agenda, option);
              const leading = total > 0 && winners.some((winner) => winner.id === option.id);
              return (
                <div className={leading ? 'ig-opt win' : 'ig-opt'} key={option.id}>
                  <span className="ig-opt-bar" style={{ width: `${share}%` }} />
                  <b>{option.label}</b>
                  <em>
                    {option.count}표 · {share}%
                  </em>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="vote-bar">
              <span style={{ width: `${rate}%` }} />
            </div>
            <div className="vote-counts">
              <span>찬성 {agenda.approve}</span>
              <span>반대 {agenda.reject}</span>
            </div>
          </>
        )}

        <p className="agenda-detail-summary">
          {total === 0
            ? '아직 투표가 없습니다.'
            : multipleChoice
              ? `${total}명 참여${agenda.multiSelect ? ' · 여러 개 고르기 안건이라 비율의 합이 100%를 넘을 수 있어요' : ''}`
              : `총 ${total}표 · 찬성률 ${rate}%`}
          {agenda.eligibleCount > 0 &&
            ` · 대상 ${agenda.eligibleCount}명 중 ${total}명 참여(${participationRate(agenda)}%)`}
        </p>
        {open && (
          <p className="agenda-detail-summary">
            {shortOfQuorum > 0
              ? `성립까지 ${shortOfQuorum}표 더 필요 · 아직 ${notVotedYet}명이 투표하지 않았습니다.`
              : `정족수를 채웠습니다. 남은 ${notVotedYet}명의 표로 결과가 바뀔 수 있습니다.`}
          </p>
        )}
      </div>

      {!open ? (
        <>
          <div className="passed-box">
            <FileCheck2 size={18} />
            {agenda.status === '결정됨'
              ? decidedOption
                ? `「${decidedOption.label}」(으)로 정해졌습니다.`
                : '1위가 동점이라 하나로 정해지지 않았습니다. 후속 논의가 필요해요.'
              : agenda.status === '통과'
                ? actionCount > 0
                  ? `통과된 안건입니다. 액션아이템 ${actionCount}건이 만들어졌어요.`
                  : '통과된 안건입니다. 액션아이템 생성 대상이에요.'
                : multipleChoice
                  ? '정족수를 채우지 못해 성립하지 않았습니다.'
                  : '부결된 안건입니다.'}
          </div>
          {canCreateActions && (
            <button className="primary-button" onClick={() => onCreateActions(agenda)}>
              <ListPlus size={18} />
              {actionCount > 0 ? '액션아이템 추가 생성' : '액션아이템 생성'}
            </button>
          )}
        </>
      ) : alreadyVoted ? (
        <div className="voted-box">
          <CheckCircle2 size={18} />
          이 안건에 이미 투표했습니다. 어떤 쪽을 골랐는지는 기록되지 않아 다시 확인할 수 없어요.
        </div>
      ) : (
        <>
          {multipleChoice ? (
            <>
              <div className="agenda-choice-list">
                {agenda.options.map((option) => {
                  const picked = pendingOptionIds.includes(option.id);
                  return (
                    <button
                      aria-pressed={picked}
                      className={picked ? 'agenda-choice selected' : 'agenda-choice'}
                      key={option.id}
                      onClick={() => toggleOption(option.id)}
                      type="button"
                    >
                      <span className="agenda-choice-mark">{picked && <Check size={14} />}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="agenda-detail-summary">
                {agenda.multiSelect ? '마음에 드는 것을 모두 고를 수 있습니다.' : '하나만 고를 수 있습니다.'}
              </p>
            </>
          ) : (
            <div className="vote-actions">
              <button className={pendingChoice === 'approve' ? 'selected' : ''} onClick={() => setPendingChoice('approve')}>
                <ThumbsUp size={17} />
                찬성
              </button>
              <button className={pendingChoice === 'reject' ? 'selected' : ''} onClick={() => setPendingChoice('reject')}>
                <ThumbsDown size={17} />
                반대
              </button>
            </div>
          )}

          {/* 확정 경고는 확정 '전에' 보여야 한다.
              투표한 뒤에 "변경할 수 없다"고 알리는 건 안내가 아니라 통보다. */}
          {hasPending && (
            <div className="vote-confirm">
              <AlertTriangle size={18} />
              <p>
                <strong>{pendingLabel}</strong>
                {multipleChoice ? '에 투표합니다.' : '으로 투표합니다.'} 확정하면 변경하거나 취소할 수 없고, 어떤 쪽을
                골랐는지는 기록되지 않아 나중에 다시 확인할 수도 없어요.
              </p>
              <div className="vote-confirm-actions">
                <button className="secondary-button" onClick={clearPending}>
                  다시 고르기
                </button>
                <button className="primary-button" onClick={confirmVote}>
                  <CheckCircle2 size={17} />
                  투표 확정
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {open && canClose && (
        <div className="agenda-close-box">
          {closeConfirmOpen ? (
            <>
              <AlertTriangle size={18} />
              <p>
                지금 마감하면 남은 {notVotedYet}명은 투표할 수 없고, {closingTally}로 결과가 확정됩니다. 되돌릴 수 없습니다.
              </p>
              <div className="vote-confirm-actions">
                <button className="secondary-button" onClick={() => setCloseConfirmOpen(false)}>
                  취소
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    onClose(agenda.id);
                    setCloseConfirmOpen(false);
                  }}
                >
                  <Gavel size={17} />
                  마감 확정
                </button>
              </div>
            </>
          ) : (
            <button className="secondary-button" onClick={() => setCloseConfirmOpen(true)}>
              <Gavel size={17} />
              지금 마감하기
            </button>
          )}
        </div>
      )}
    </section>
  );
}
