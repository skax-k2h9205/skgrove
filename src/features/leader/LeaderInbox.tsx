import {
  AlarmClock,
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  FileCheck2,
  MessageSquareText,
  PenLine,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  Vote,
} from 'lucide-react';
import { useState } from 'react';
import { MIN_OPTIONS, VoteMethodEditor, validateVoteOptions } from '../agenda/VoteMethodEditor';
import { useTenantParts } from '../../tenantParts';
import {
  RESPONSE_DUE_DAYS,
  daysSinceCreated,
  isAwaitingResponse,
  isResponseOverdue,
  oldestWaitingDays,
  statusNeedsReason,
} from '../../issueRules';
import { leadersFor } from '../../notificationRules';
import { EncryptedIssueBody } from './AnonCrypto';
import type { Agenda, CurrentUser, Identity, Issue, IssueStatus, ManagedAccount, TeamPart, VoteType } from '../../types';

type AgendaDraft = Pick<
  Agenda,
  'title' | 'description' | 'category' | 'part' | 'author' | 'deadline' | 'voteType' | 'multiSelect'
> & {
  // 라벨만 넘긴다. 선택지 id 발급과 집계 초기화는 안건을 만드는 쪽(App) 책임이다.
  optionLabels: string[];
};

type LeaderInboxProps = {
  issues: Issue[];
  accounts: ManagedAccount[];
  currentUser: CurrentUser;
  today: string;
  onIssueUpdate: (issue: Issue) => void;
  onPromoteToAgenda: (issue: Issue, draft: AgendaDraft) => void;
  canDelete?: boolean;
  onDeleteIssue?: (id: string) => void;
};
// 안건 탭에서 답변·1on1·안건화·메모를 처리한다. '액션'은 별도 액션보드로 옮겨 여기선 뺐다.
type LeaderAction = 'reply' | 'oneOnOne' | 'agenda' | 'memo';

/*
  상태 10개를 전부 칩으로 늘어놓으면 두 줄(94px)을 먹는다. 목록에 걸린 건이
  세 건일 때도 필터가 목록보다 자리를 더 차지했다. 리더가 매일 오가는 네 개만
  칩으로 두고, 결과 상태와 보관 상태는 드롭다운으로 내린다.
  ('전체'는 회수·종료를 제외한다 — 그 둘은 이미 보관 성격이다.)
*/
const primaryFilters: Array<'전체' | IssueStatus> = ['전체', '접수', '검토중', '답변완료'];
const secondaryFilters: IssueStatus[] = ['1on1 제안', '액션아이템', '안건화', '보류', '회수', '종료'];
// 건별 상태 변경 select 는 거르기와 달리 모든 상태를 다 보여줘야 한다.
const issueStatuses: IssueStatus[] = [
  '접수',
  '검토중',
  '답변완료',
  ...secondaryFilters,
];
const DEFAULT_VOTING_DAYS = 7;
const addDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export function LeaderInbox({ issues, accounts, currentUser, today, onIssueUpdate, onPromoteToAgenda, canDelete, onDeleteIssue }: LeaderInboxProps) {
  // 안건 전환 시 파트 선택: '전체' + 현재 팀 파트.
  const agendaParts: TeamPart[] = ['전체', ...useTenantParts()];
  const handleDelete = (issue: Issue) => {
    if (!onDeleteIssue) return;
    if (window.confirm(`'${issue.title}' 접수를 삭제할까요? 되돌릴 수 없습니다.`)) onDeleteIssue(issue.id);
  };
  const [filter, setFilter] = useState<'전체' | IssueStatus>('전체');
  /*
    목록과 상세를 화면 단위로 나눈다. 예전에는 좌우 분할이었는데, 작업판이
    584px 폭에 갇힌 채 '안건' 탭 1179px 짜리 내용을 752px 상자에 밀어넣어
    페이지 스크롤 안에 또 스크롤이 생겼다. 리더는 한 건을 읽고 답변·1on1·
    액션·안건화를 끝낸 뒤 다음 건으로 간다 — 목록을 곁에 두고 빠르게
    오가는 작업이 아니다. 안건함과 같은 전환 방식으로 맞춘다.
  */
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [activeAction, setActiveAction] = useState<LeaderAction>('reply');
  const [draft, setDraft] = useState('');
  const [agendaDrafts, setAgendaDrafts] = useState<Record<string, AgendaDraft>>({});
  const [agendaError, setAgendaError] = useState('');
  // 보류·종료로 바꾸려는 중인 건. 사유를 받기 전에는 상태를 바꾸지 않는다.
  const [pendingStatus, setPendingStatus] = useState<{ issueId: string; status: IssueStatus } | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

  // 리더 관리함은 '나에게 접수된 건'만 본다. 전달 대상(target)이 나를 가리키는 건만
  // (leadersFor 가 팀리더·리더전체·특정 파트리더 이름을 모두 해석). 남의 파트로 간
  // 접수까지 다 보이면 대나무숲의 대상 지정이 무의미해진다.
  const myIssues = issues.filter((issue) =>
    leadersFor(accounts, issue.target).some((leader) => leader.email.toLowerCase() === currentUser.email.toLowerCase()),
  );
  const visibleIssues =
    filter === '전체'
      ? myIssues.filter((issue) => issue.status !== '회수' && issue.status !== '종료')
      : myIssues.filter((issue) => issue.status === filter);
  const selectedIssue = visibleIssues.find((issue) => issue.id === selectedIssueId) ?? null;
  // 암호화 접수 복호화에 필요한 내 계정 id(CurrentUser엔 id가 없어 accounts에서 이메일로 찾는다).
  const myAccountId = accounts.find(
    (account) => account.email.toLowerCase() === currentUser.email.toLowerCase(),
  )?.id ?? '';
  const agendaDraft = selectedIssue ? agendaDrafts[selectedIssue.id] ?? makeAgendaDraft(selectedIssue) : null;
  const waitingCount = myIssues.filter((issue) => issue.status === '접수' || issue.status === '검토중').length;
  const answeredCount = myIssues.filter((issue) => issue.leaderReply).length;
  const followUpCount = myIssues.filter((issue) => issue.oneOnOneNote || issue.actionItem).length;
  // 개수만으로는 방치가 보이지 않는다. 3건이 3일째인지 30일째인지가 다르다.
  const oldestWaiting = oldestWaitingDays(myIssues, today);
  const overdueCount = myIssues.filter((issue) => isResponseOverdue(issue, today)).length;

  const chooseIssue = (issue: Issue) => {
    setSelectedIssueId(issue.id);
    setDraft('');
    setAgendaDrafts((current) => ({ ...current, [issue.id]: current[issue.id] ?? makeAgendaDraft(issue) }));
  };

  const changeStatus = (issue: Issue, status: IssueStatus) => {
    if (status === issue.status) return;
    // 보류·종료는 접수자에게 "안 하기로 했다"는 통보다. 근거 없이 보내지 않는다.
    if (statusNeedsReason(status)) {
      setSelectedIssueId(issue.id);
      setPendingStatus({ issueId: issue.id, status });
      setReasonDraft(issue.statusReason ?? '');
      return;
    }
    onIssueUpdate({ ...issue, status });
  };

  const commitStatusChange = (issue: Issue) => {
    const reason = reasonDraft.trim();
    if (!pendingStatus || !reason) return;
    onIssueUpdate({ ...issue, status: pendingStatus.status, statusReason: reason });
    setPendingStatus(null);
    setReasonDraft('');
  };

  const cancelStatusChange = () => {
    setPendingStatus(null);
    setReasonDraft('');
  };

  const updateAgendaDraft = (patch: Partial<AgendaDraft>) => {
    if (!selectedIssue || !agendaDraft) return;

    setAgendaDrafts((current) => ({
      ...current,
      [selectedIssue.id]: { ...agendaDraft, ...patch },
    }));
  };

  const saveAction = () => {
    if (!selectedIssue || !draft.trim()) return;
    const entry = draft.trim();

    // 처리기록은 덮어쓰지 않고 이어 붙인다. 한 건에 답변·메모를 여러 번 남길 수 있고,
    // 예전엔 마지막 것만 남아 이전 처리가 사라졌다. 빈 줄로 구분해 쌓는다.
    if (activeAction === 'reply') {
      onIssueUpdate({ ...selectedIssue, leaderReply: appendEntry(selectedIssue.leaderReply, entry), status: '답변완료' });
    }

    if (activeAction === 'oneOnOne') {
      onIssueUpdate({ ...selectedIssue, oneOnOneNote: appendEntry(selectedIssue.oneOnOneNote, entry), status: '1on1 제안' });
    }

    if (activeAction === 'memo') {
      onIssueUpdate({ ...selectedIssue, leaderMemo: appendEntry(selectedIssue.leaderMemo, entry), status: '검토중' });
    }

    setDraft('');
  };

  const submitAgendaDraft = () => {
    if (!selectedIssue || !agendaDraft) return;

    const { error: optionError, labels } = validateVoteOptions(agendaDraft.voteType, agendaDraft.optionLabels);
    if (optionError) {
      setAgendaError(optionError);
      return;
    }

    const nextDraft: AgendaDraft = {
      ...agendaDraft,
      title: agendaDraft.title.trim(),
      description: agendaDraft.description.trim(),
      category: agendaDraft.category.trim() || selectedIssue.category,
      author: selectedIssue.visibility === '리더만 보기' ? '익명' : agendaDraft.author,
      deadline: agendaDraft.deadline || addDays(DEFAULT_VOTING_DAYS),
      // 찬반이면 선택지를 저장하지 않는다. 방식을 바꿔가며 쓴 흔적이 남을 이유가 없다.
      optionLabels: agendaDraft.voteType === '객관식' ? labels : [],
      multiSelect: agendaDraft.voteType === '객관식' && agendaDraft.multiSelect,
    };

    if (!nextDraft.title || !nextDraft.description) return;

    setAgendaError('');
    onPromoteToAgenda(selectedIssue, nextDraft);
    setAgendaDrafts((current) => {
      const next = { ...current };
      delete next[selectedIssue.id];
      return next;
    });
    setActiveAction('reply');
  };

  return (
    <section className="screen leader-screen">
      <div className="leader-summary">
        <div>
          <MessageSquareText size={22} />
          <span>처리 대기</span>
          <strong>{waitingCount}</strong>
        </div>
        <div>
          <Send size={22} />
          <span>답변 완료</span>
          <strong>{answeredCount}</strong>
        </div>
        <div>
          <FileCheck2 size={22} />
          <span>후속 액션</span>
          <strong>{followUpCount}</strong>
        </div>
        <div className={overdueCount > 0 ? 'leader-overdue' : ''}>
          <AlarmClock size={22} />
          <span>가장 오래 기다린 건</span>
          <strong>{oldestWaiting === null ? '없음' : `${oldestWaiting}일`}</strong>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="notice-line action-overdue-notice">
          <AlarmClock size={18} />
          {RESPONSE_DUE_DAYS}일이 넘도록 응답이 없는 접수가 {overdueCount}건 있습니다. 대나무숲은 첫 몇 건의 응답 속도가
          이후 참여를 결정합니다.
        </div>
      )}

      {/*
        목록과 작업면을 번갈아 보여주던 것을 좌우 2단으로 바꿨다. 처리하는
        내내 다음 건이 몇 개 남았는지 보이고, 한 건을 끝낼 때마다 목록으로
        돌아갔다가 다시 들어오지 않아도 된다.

        다만 대화 어휘(아바타 · 말풍선)는 쓰지 않는다. 익명 접수를 '대화'로
        그리면 리더가 상대를 사람으로 특정하려는 유인이 생긴다. 이 화면은
        사람 대 사람이 아니라 건별 처리다 — 접수 카드를 그대로 둔다.

        좁은 폭에서는 예전처럼 한 번에 하나만 보여준다(아래 CSS).
      */}
      <div className={selectedIssue ? 'leader-layout has-selection' : 'leader-layout'}>
        <section className="leader-inbox-list">
          <div className="toolbar leader-toolbar">
            {primaryFilters.map((item) => (
              <button className={filter === item ? 'filter active' : 'filter'} key={item} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
            <select
              aria-label="그 밖의 상태로 거르기"
              value={secondaryFilters.includes(filter as IssueStatus) ? filter : ''}
              onChange={(event) => {
                if (event.target.value) setFilter(event.target.value as IssueStatus);
              }}
            >
              <option value="">그 밖의 상태</option>
              {secondaryFilters.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="issue-list">
            {visibleIssues.map((issue) => (
              <article className={selectedIssue?.id === issue.id ? 'issue-card selected' : 'issue-card'} key={issue.id}>
                <button className="issue-select" onClick={() => chooseIssue(issue)}>
                  <span className={`priority ${issue.urgency}`}>{issue.urgency}</span>
                  <h2>{issue.title}</h2>
                  <p>
                    {issue.id} · {issue.category} · {getAuthorLabel(issue)} · {issue.target}
                  </p>
                  {(() => {
                    // 접수일이 없는 과거 데이터는 경과일을 표시하지 않는다.
                    const waited = daysSinceCreated(issue, today);
                    if (waited === null || !isAwaitingResponse(issue)) return null;
                    return (
                      <span className={isResponseOverdue(issue, today) ? 'waiting-badge overdue' : 'waiting-badge'}>
                        <AlarmClock size={13} />
                        {waited === 0 ? '오늘 접수' : `${waited}일째 응답 대기`}
                      </span>
                    );
                  })()}
                  {issue.author === '실명' && issue.submitterName && (
                    <div className="author-card">
                      <strong>{issue.submitterName}</strong>
                      <span>
                        {issue.submitterPart} · {issue.submitterEmail}
                      </span>
                    </div>
                  )}
                  <div className="issue-flags">
                    {issue.leaderReply && <span>답변 있음</span>}
                    {issue.oneOnOneNote && <span>1on1 제안</span>}
                    {issue.actionItem && <span>액션아이템</span>}
                  </div>
                </button>
                <div className="issue-actions">
                  {/* 바로 옆 select 가 이미 현재 상태를 값으로 보여준다.
                      같은 낱말을 배지로 한 번 더 찍어 "접수 접수"로 읽혔다. */}
                  <select
                    aria-label={`${issue.title} 상태`}
                    value={issue.status}
                    onChange={(event) => changeStatus(issue, event.target.value as IssueStatus)}
                  >
                    {issueStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <button
                    className="secondary-button"
                    disabled={issue.status === '회수'}
                    onClick={() => {
                      chooseIssue(issue);
                      setActiveAction('agenda');
                    }}
                    title={
                      issue.visibility === '리더만 보기'
                        ? '원문과 작성자 정보는 공개하지 않고 정제한 익명 안건을 만듭니다.'
                        : '접수 의견을 정제해 안건 후보로 전환합니다.'
                    }
                  >
                    {issue.visibility === '리더만 보기' ? <ShieldCheck size={17} /> : <Vote size={17} />}
                    {issue.visibility === '리더만 보기' ? '정제 후 안건화' : '안건화'}
                  </button>
                  {canDelete && onDeleteIssue && (
                    <button
                      className="secondary-button"
                      onClick={() => handleDelete(issue)}
                      style={{ color: '#dc2626', borderColor: '#f0999599' }}
                      title="이 접수를 삭제합니다(admin 전용)"
                    >
                      <Trash2 size={17} /> 삭제
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel leader-workbench">
          {selectedIssue ? (
            <>
              {/* 2단에서는 숨긴다(CSS). 좁은 폭에서만 쓰이며, 선택을 지워야
                  목록이 다시 보인다 — 레이아웃이 selectedIssue 로 정해지기 때문이다. */}
              <button className="btn-ghost leader-back" onClick={() => setSelectedIssueId('')} type="button">
                <ArrowLeft size={16} />
                접수 목록으로
              </button>
              <div className="leader-workbench-head">
                <span className="status-pill">{selectedIssue.status}</span>
                <h2>{selectedIssue.title}</h2>
                <p>
                  {selectedIssue.id} · {selectedIssue.category} · {getAuthorLabel(selectedIssue)} · {selectedIssue.target} ·{' '}
                  {selectedIssue.visibility}
                </p>
                {selectedIssue.author === '실명' && selectedIssue.submitterName && (
                  <div className="author-card prominent">
                    <strong>{selectedIssue.submitterName}</strong>
                    <span>
                      {selectedIssue.submitterPart} · {selectedIssue.submitterEmail}
                    </span>
                  </div>
                )}
              </div>

              {selectedIssue.visibility === '리더만 보기' && (
                <div className="privacy-promotion-note">
                  <ShieldCheck size={18} />
                  <span>이 접수 건은 원문 작성자 정보를 공개하지 않고, 리더가 정제한 익명 안건으로만 전환됩니다.</span>
                </div>
              )}

              {/* 리더가 답변하려면 접수자가 무엇을 썼는지 읽을 수 있어야 한다.
                  암호화 접수는 대상 리더만 자기 기기에서 복호화한다(운영자 불가독). */}
              {selectedIssue.encrypted ? (
                <EncryptedIssueBody issue={selectedIssue} accountId={myAccountId} />
              ) : (
                <div className="issue-body-box">
                  <strong>접수 내용</strong>
                  <p>{selectedIssue.body || '작성된 내용이 없습니다.'}</p>
                  {selectedIssue.expectedChange && (
                    <>
                      <strong>기대 변화</strong>
                      <p>{selectedIssue.expectedChange}</p>
                    </>
                  )}
                </div>
              )}

              <div className="leader-action-tabs">
                <button className={activeAction === 'reply' ? 'selected' : ''} onClick={() => setActiveAction('reply')}>
                  <MessageSquareText size={17} />
                  답변
                </button>
                <button className={activeAction === 'oneOnOne' ? 'selected' : ''} onClick={() => setActiveAction('oneOnOne')}>
                  <CalendarPlus size={17} />
                  1on1
                </button>
                <button className={activeAction === 'agenda' ? 'selected' : ''} onClick={() => setActiveAction('agenda')}>
                  <Vote size={17} />
                  안건
                </button>
                <button className={activeAction === 'memo' ? 'selected' : ''} onClick={() => setActiveAction('memo')}>
                  <PenLine size={17} />
                  메모
                </button>
              </div>

              {activeAction === 'agenda' && agendaDraft ? (
                <div className="agenda-refine-form">
                  <label>
                    안건 제목
                    <input
                      value={agendaDraft.title}
                      onChange={(event) => updateAgendaDraft({ title: event.target.value })}
                      placeholder="팀원이 투표할 수 있는 안건 제목으로 정리해주세요."
                    />
                  </label>

                  <label>
                    안건 설명
                    <textarea
                      value={agendaDraft.description}
                      onChange={(event) => updateAgendaDraft({ description: event.target.value })}
                      placeholder="원문을 그대로 옮기지 말고, 투표 가능한 배경과 기대 변화를 정제해주세요."
                    />
                  </label>

                  {/* 원문 옮기기는 리더가 의도적으로 눌러야만 일어난다.
                      '리더만 보기'로 접수된 건은 이 경로 자체를 열지 않는다. */}
                  {selectedIssue.visibility !== '리더만 보기' && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        updateAgendaDraft({
                          title: agendaDraft.title || selectedIssue.title,
                          description: issueSourceText(selectedIssue),
                        })
                      }
                    >
                      <PenLine size={17} />
                      접수 원문 불러와서 다듬기
                    </button>
                  )}

                  <div className="agenda-refine-grid">
                    <label>
                      카테고리
                      <input value={agendaDraft.category} onChange={(event) => updateAgendaDraft({ category: event.target.value })} />
                    </label>
                    <label>
                      투표 대상
                      <select value={agendaDraft.part} onChange={(event) => updateAgendaDraft({ part: event.target.value as TeamPart })}>
                        {agendaParts.map((part) => (
                          <option key={part}>{part}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="agenda-refine-grid">
                    <label>
                      공개 방식
                      <select
                        value={selectedIssue.visibility === '리더만 보기' ? '익명' : agendaDraft.author}
                        disabled={selectedIssue.visibility === '리더만 보기'}
                        onChange={(event) => updateAgendaDraft({ author: event.target.value as Identity })}
                      >
                        <option>익명</option>
                        <option>실명</option>
                      </select>
                    </label>
                    <label>
                      투표 마감일
                      <input
                        type="date"
                        min={addDays(1)}
                        value={agendaDraft.deadline}
                        onChange={(event) => updateAgendaDraft({ deadline: event.target.value })}
                      />
                    </label>
                  </div>

                  <VoteMethodEditor
                    voteType={agendaDraft.voteType}
                    optionLabels={agendaDraft.optionLabels}
                    multiSelect={agendaDraft.multiSelect}
                    onVoteTypeChange={(voteType) => updateAgendaDraft({ voteType })}
                    onOptionLabelsChange={(optionLabels) => updateAgendaDraft({ optionLabels })}
                    onMultiSelectChange={(multiSelect) => updateAgendaDraft({ multiSelect })}
                  />

                  {selectedIssue.visibility === '리더만 보기' && (
                    <div className="privacy-promotion-note">
                      <ShieldCheck size={18} />
                      <span>원문과 작성자 정보는 공개되지 않습니다. 리더가 정제한 별도 안건만 안건함에 올라갑니다.</span>
                    </div>
                  )}

                  {/* 무엇이 팀 전체에 공개되는지 확정 직전에 보여준다.
                      원문이 섞여 들어갔는지 리더가 눈으로 확인할 수 있는 마지막 지점이다. */}
                  <div className="agenda-publish-preview">
                    <strong>팀원에게 공개될 내용</strong>
                    <p className="agenda-publish-preview-title">{agendaDraft.title.trim() || '(제목을 입력해주세요)'}</p>
                    <p className="agenda-publish-preview-body">
                      {agendaDraft.description.trim() || '(설명을 입력해주세요)'}
                    </p>
                    <small>
                      작성자 표기: {selectedIssue.visibility === '리더만 보기' ? '익명' : agendaDraft.author} · 투표 대상:{' '}
                      {agendaDraft.part} · 투표 방식: {agendaDraft.voteType}
                    </small>
                  </div>

                  {agendaError && (
                    <div className="notice-line">
                      <AlertTriangle size={18} />
                      {agendaError}
                    </div>
                  )}

                  <button
                    className="primary-button wide"
                    disabled={!agendaDraft.title.trim() || !agendaDraft.description.trim()}
                    onClick={submitAgendaDraft}
                  >
                    <ShieldCheck size={18} />
                    {selectedIssue.visibility === '리더만 보기' ? '익명화해 안건 후보로 만들기' : '정제한 안건 후보로 만들기'}
                  </button>
                </div>
              ) : (
                <>
                  <label>
                    {getActionLabel(activeAction)}
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={getActionPlaceholder(activeAction)} />
                  </label>

                  <button className="primary-button wide" onClick={saveAction}>
                    <UserRoundCheck size={18} />
                    처리 기록 남기기
                  </button>
                </>
              )}

              {/* 보류·종료로 바꾸려는 중이면 사유부터 받는다. 이 화면을 통과해야 상태가 바뀐다. */}
              {pendingStatus?.issueId === selectedIssue.id ? (
                <div className="status-reason-editor">
                  <label>
                    {pendingStatus.status} 사유
                    <textarea
                      value={reasonDraft}
                      onChange={(event) => setReasonDraft(event.target.value)}
                      placeholder={
                        pendingStatus.status === '보류'
                          ? '왜 지금은 진행하지 않는지, 언제 다시 볼지 적어주세요. 접수자에게 그대로 보입니다.'
                          : '어떤 판단으로 마무리하는지 적어주세요. 접수자에게 그대로 보입니다.'
                      }
                    />
                  </label>
                  <p className="field-note">
                    이유 없이 상태만 바뀌면 접수자는 무시당했다고 읽습니다. 이 문장이 접수자가 보는 유일한 설명입니다.
                  </p>
                  <div className="form-actions">
                    <button className="secondary-button" onClick={cancelStatusChange}>
                      취소
                    </button>
                    <button
                      className="primary-button"
                      disabled={!reasonDraft.trim()}
                      onClick={() => commitStatusChange(selectedIssue)}
                    >
                      {pendingStatus.status}(으)로 변경
                    </button>
                  </div>
                </div>
              ) : (
                selectedIssue.status !== '종료' &&
                selectedIssue.status !== '회수' && (
                  <button className="secondary-button wide" onClick={() => changeStatus(selectedIssue, '종료')}>
                    종료 처리
                  </button>
                )
              )}

              <div className="leader-history">
                <strong>처리 기록</strong>
                {selectedIssue.statusReason && (
                  <p>
                    {selectedIssue.status} 사유: {selectedIssue.statusReason}
                  </p>
                )}
                {selectedIssue.leaderReply && (
                  <div className="leader-followup-thread">
                    <strong>답변</strong>
                    {selectedIssue.leaderReply.split('\n\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                )}
                {selectedIssue.oneOnOneNote && (
                  <div className="leader-followup-thread">
                    <strong>1on1 제안</strong>
                    {selectedIssue.oneOnOneNote.split('\n\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                )}
                {selectedIssue.actionItem && <p>액션아이템: {selectedIssue.actionItem}</p>}
                {selectedIssue.leaderMemo && (
                  <div className="leader-followup-thread">
                    <strong>리더 메모</strong>
                    {selectedIssue.leaderMemo.split('\n\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                )}
                {selectedIssue.oneOnOneResponse && <p>팀원 1on1 응답: {selectedIssue.oneOnOneResponse}</p>}
                {selectedIssue.submitterResponse && (
                  <div className="leader-followup-thread">
                    <strong>팀원 후속 응답</strong>
                    {/* 후속 응답은 빈 줄로 누적된다. 각 응답을 한 줄씩 보여준다. */}
                    {selectedIssue.submitterResponse.split('\n\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                )}
                {!selectedIssue.statusReason &&
                  !selectedIssue.leaderReply &&
                  !selectedIssue.oneOnOneNote &&
                  !selectedIssue.actionItem &&
                  !selectedIssue.leaderMemo &&
                  !selectedIssue.oneOnOneResponse &&
                  !selectedIssue.submitterResponse && (
                  <p>아직 남긴 처리 기록이 없습니다.</p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-panel">
              <strong>왼쪽에서 접수 건을 고르세요.</strong>
              <span>고른 건의 답변 · 안건화 · 1on1 제안을 여기에서 처리합니다.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

// 안건 초안은 비워둔 채로 시작한다.
// 접수 원문을 기본값으로 깔면 리더가 아무것도 하지 않아도 원문이 그대로 공개된다.
// 소규모 팀에서는 문체와 사례만으로 작성자가 특정되므로, 원문을 옮기는 것은
// 반드시 리더의 명시적인 행동(원문 불러오기)이어야 한다.
function makeAgendaDraft(issue: Issue): AgendaDraft {
  return {
    title: '',
    description: '',
    category: issue.category,
    part: '전체',
    author: issue.visibility === '리더만 보기' ? '익명' : issue.author,
    deadline: addDays(DEFAULT_VOTING_DAYS),
    // 대나무숲 접수는 대개 "이 제안을 받아들일까"라 찬반이 기본이다.
    // 답이 둘이 아닌 건은 리더가 객관식으로 바꿔 선택지를 직접 채운다.
    voteType: '찬반',
    multiSelect: false,
    // 객관식으로 바꿨을 때 바로 두 칸이 보이도록 미리 열어둔다(새 안건 등록과 같다).
    optionLabels: Array(MIN_OPTIONS).fill(''),
  };
}

// 처리기록을 덮어쓰지 않고 이어 붙인다. 빈 줄로 구분해 쌓아 이력이 남게 한다.
function appendEntry(existing: string | undefined, addition: string) {
  return existing ? `${existing}\n\n${addition}` : addition;
}

// '원문 불러오기'를 눌렀을 때만 쓰이는 값. 공개 가능으로 접수된 건에서만 노출한다.
function issueSourceText(issue: Issue) {
  return [issue.body, issue.expectedChange ? `기대 변화\n${issue.expectedChange}` : '']
    .filter(Boolean)
    .join('\n\n');
}

function getActionLabel(action: LeaderAction) {
  if (action === 'reply') return '작성자에게 남길 답변';
  if (action === 'oneOnOne') return '1on1 제안 내용';
  return '리더 내부 메모';
}

function getActionPlaceholder(action: LeaderAction) {
  if (action === 'reply') return '검토 결과와 다음 조치를 작성해주세요.';
  if (action === 'oneOnOne') return '대화 목적, 제안 일정, 참여 대상을 적어주세요.';
  return '리더끼리 공유할 판단 근거를 남겨주세요.';
}

function getAuthorLabel(issue: Issue) {
  if (issue.author === '익명') return '익명';
  return issue.submitterName ? `실명 ${issue.submitterName}` : '실명';
}
