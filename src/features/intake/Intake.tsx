import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  Megaphone,
  MessageSquarePlus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { PanelHeader } from '../../components/PanelHeader';
import type { CurrentUser, Identity, Issue, IssueVisibility, Urgency } from '../../types';
import { ReviewGate } from './ReviewGate';
import { EncryptedIssueBody, LeaderKeySetup } from '../leader/AnonCrypto';
import { loadLeaderKeyRecord } from '../../crypto/leaderKeyStore';

type IntakeProps = {
  identity: Identity;
  currentUser: CurrentUser;
  // 로그인 계정의 id. 실명 '리더만 보기' 암호화 글의 작성자 키 설정·본문 복호화에 쓴다.
  myAccountId: string;
  issues: Issue[];
  // 특정 파트리더에게 바로 보낼 수 있게 활성 파트리더 목록을 받는다.
  partLeaders: { name: string; part: string }[];
  onIdentityChange: (identity: Identity) => void;
  onIssueUpdate: (issue: Issue) => void;
  // 익명 접수는 App에서 대상 리더 공개키로 암호화하므로 비동기다.
  onSubmitIssue: (issue: Omit<Issue, 'id' | 'status' | 'createdAt'>) => Promise<Issue>;
};

type IntakeStep = 'scope' | 'content' | 'review' | 'complete';
// 대상은 '팀리더' · '리더 전체' 이거나, 특정 파트리더의 이름 문자열.
type Target = string;
type MyIssueFilter = '전체' | '답변 대기' | '1on1' | '완료';

const categories = ['회의문화', '협업', '업무방식', '갈등', '성장/피드백', '복지/분위기', '기타'];
const steps: Array<{ id: IntakeStep; label: string }> = [
  { id: 'scope', label: '방식 선택' },
  { id: 'content', label: '내용 작성' },
  { id: 'review', label: '제출 확인' },
  { id: 'complete', label: '접수 완료' },
];

export function Intake({ identity, currentUser, myAccountId, issues, partLeaders, onIdentityChange, onIssueUpdate, onSubmitIssue }: IntakeProps) {
  const [step, setStep] = useState<IntakeStep>('scope');
  const [target, setTarget] = useState<Target>('팀리더');
  const [visibility, setVisibility] = useState<IssueVisibility>('리더만 보기');
  const [category, setCategory] = useState(categories[0]);
  const [urgency, setUrgency] = useState<Urgency>('보통');
  // 예시 문장을 기본값으로 넣으면 그대로 제출되어 남의 문장이 내 의견으로 접수된다.
  // 예시는 placeholder로만 보여준다.
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [expectedChange, setExpectedChange] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [receiptAccessCode, setReceiptAccessCode] = useState('');
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [myIssueFilter, setMyIssueFilter] = useState<MyIssueFilter>('전체');
  const [expandedIssueIds, setExpandedIssueIds] = useState<Record<string, boolean>>({});
  /* 익명 접수 조회는 '쓰는' 흐름이 아니라 '접수번호를 받은 사람이 나중에
     확인하러 오는' 경로다. 상시 펼쳐두면 말하러 온 화면에 관계없는 폼이
     하나 더 놓인다. 필요할 때만 연다. */
  const [lookupOpen, setLookupOpen] = useState(false);
  const [anonymousReceiptId, setAnonymousReceiptId] = useState('');
  const [anonymousAccessCode, setAnonymousAccessCode] = useState('');
  const [anonymousLookupError, setAnonymousLookupError] = useState('');
  // 접수 저장 실패(암호화 불가로 fail-closed 차단 등)를 제출 버튼 근처에 표시.
  const [submitError, setSubmitError] = useState('');
  const [anonymousIssueId, setAnonymousIssueId] = useState('');
  // 검토를 통과하기 전에는 제출할 수 없다. 검토 중에도 잠근다.
  const [reviewReady, setReviewReady] = useState(false);
  // 방금 접수가 암호화되어 저장됐는지(완료 화면 안내용).
  const [receiptEncrypted, setReceiptEncrypted] = useState(false);
  // 실명 '리더만 보기' 제출 시 작성자 본인 키가 없으면 키 설정 모달을 띄운다(암호화 수신자에 본인 포함).
  const [needKeySetup, setNeedKeySetup] = useState(false);
  // 실명 '리더만 보기'는 본문을 [대상 리더 + 작성자]로 암호화한다 — 익명글처럼 서버로 평문이 안 간다.
  const encryptedNamed = identity === '실명' && visibility === '리더만 보기';
  // 암호화 글(익명 전체 / 실명 '리더만 보기')은 본문이 서버로 안 가므로 외부 AI 검토를 생략한다.
  const skipReview = identity === '익명' || encryptedNamed;

  const currentStepIndex = steps.findIndex((item) => item.id === step);
  const myIssues = issues.filter(
    (issue) => issue.author === '실명' && issue.submitterEmail?.toLowerCase() === currentUser.email.toLowerCase(),
  );
  const visibleMyIssues = myIssues.filter((issue) => {
    if (myIssueFilter === '답변 대기') {
      return issue.status !== '회수' && !issue.leaderReply && !issue.oneOnOneNote && !issue.actionItem;
    }
    if (myIssueFilter === '1on1') return Boolean(issue.oneOnOneNote);
    if (myIssueFilter === '완료') return issue.status === '회수' || issue.status === '종료' || issue.status === '답변완료' || issue.status === '액션아이템';
    return true;
  });

  const submit = async () => {
    // 버튼이 잠겨 있어도 다른 경로로 호출될 수 있으니 여기서 한 번 더 막는다.
    // 익명은 외부 AI 검토를 건너뛰므로 reviewReady 게이트를 적용하지 않는다.
    if ((!skipReview && !reviewReady) || !title.trim() || !body.trim()) return;
    // 실명 '리더만 보기'는 작성자도 복호화해야 하므로 본인 키가 필요하다.
    // 없으면 키 설정 모달을 띄우고 멈춘다(설정 완료 후 재제출).
    if (encryptedNamed && myAccountId) {
      const myKey = await loadLeaderKeyRecord(myAccountId);
      if (!myKey) {
        setNeedKeySetup(true);
        return;
      }
    }
    setSubmitError('');
    const nextAnonymousCode = identity === '익명' ? makeAnonymousAccessCode() : undefined;
    let createdIssue;
    try {
      createdIssue = await onSubmitIssue({
        title: title.trim(),
        category,
        author: identity,
        anonymousAccessCode: nextAnonymousCode,
        submitterName: identity === '실명' ? currentUser.name : undefined,
        submitterEmail: identity === '실명' ? currentUser.email : undefined,
        submitterPart: identity === '실명' ? currentUser.part : undefined,
        target,
        urgency,
        body: body.trim(),
        expectedChange: expectedChange.trim(),
        visibility,
      });
    } catch (error) {
      // 암호화 불가(수신자 키 없음 등)로 접수가 막힌 경우 — 평문으로 저장되지 않았음을 알린다.
      setSubmitError(error instanceof Error ? error.message : '접수를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setReceiptEncrypted(createdIssue.encrypted === true);
    setReceiptId(createdIssue.id);
    setReceiptAccessCode(nextAnonymousCode ?? '');
    if (nextAnonymousCode) {
      setAnonymousReceiptId(createdIssue.id);
      setAnonymousAccessCode(nextAnonymousCode);
      setAnonymousIssueId(createdIssue.id);
    }
    setStep('complete');
  };

  const updateResponseDraft = (issueId: string, value: string) => {
    setResponseDrafts((drafts) => ({ ...drafts, [issueId]: value }));
  };

  // 후속 응답은 덮어쓰지 않고 이어 붙인다. 예전엔 새 응답이 이전 응답을 지워
  // 주고받은 맥락이 사라졌다. 빈 줄로 구분해 쌓는다.
  const appendResponse = (existing: string | undefined, addition: string) =>
    existing ? `${existing}\n\n${addition}` : addition;

  const saveSubmitterResponse = (issue: Issue) => {
    const response = responseDrafts[issue.id]?.trim();
    if (!response) return;
    onIssueUpdate({ ...issue, submitterResponse: appendResponse(issue.submitterResponse, response) });
    setResponseDrafts((drafts) => ({ ...drafts, [issue.id]: '' }));
  };

  const respondToOneOnOne = (issue: Issue, oneOnOneResponse: Issue['oneOnOneResponse']) => {
    const response = responseDrafts[issue.id]?.trim();
    onIssueUpdate({
      ...issue,
      oneOnOneResponse,
      submitterResponse: response ? appendResponse(issue.submitterResponse, response) : issue.submitterResponse,
    });
    if (response) {
      setResponseDrafts((drafts) => ({ ...drafts, [issue.id]: '' }));
    }
  };

  const toggleIssue = (issueId: string) => {
    setExpandedIssueIds((ids) => ({ ...ids, [issueId]: !ids[issueId] }));
  };

  const canWithdraw = (issue: Issue) => {
    return (
      (issue.status === '접수' || issue.status === '검토중') &&
      !issue.leaderReply &&
      !issue.oneOnOneNote &&
      !issue.actionItem &&
      !issue.leaderMemo
    );
  };

  const withdrawIssue = (issue: Issue) => {
    onIssueUpdate({
      ...issue,
      status: '회수',
      submitterResponse: '작성자가 접수 의견을 회수했습니다.',
    });
  };

  const lookupAnonymousIssue = () => {
    const receipt = anonymousReceiptId.trim().toUpperCase();
    const code = anonymousAccessCode.trim().toUpperCase();
    const issue = issues.find(
      (item) => item.author === '익명' && item.id.toUpperCase() === receipt && item.anonymousAccessCode === code,
    );

    if (!issue) {
      setAnonymousIssueId('');
      setAnonymousLookupError('접수번호와 확인 코드가 일치하는 익명 접수 건을 찾을 수 없어요.');
      return;
    }

    setAnonymousIssueId(issue.id);
    setAnonymousLookupError('');
  };

  /*
    이 화면은 목적이 둘이다 — '말하기'(4단계 위저드)와 '내가 낸 것 확인하기'.
    예전에는 세로로 쌓여 있어, 말하러 온 사람이 자기 이력을 지나쳐야 했고
    확인하러 온 사람은 위저드를 지나쳐야 했다. 마이페이지를 새로 만들면
    메뉴가 14개가 되므로, 화면 안에서 탭으로 가른다.
  */
  const [view, setView] = useState<'write' | 'mine'>('write');

  const anonymousIssue = issues.find((issue) => issue.id === anonymousIssueId);

  return (
    <section className="screen intake-screen">
      {/* 실명 '리더만 보기' 제출 시 작성자 본인 키가 없으면 여기서 만들고 재제출한다.
          이 키가 있어야 작성자도 자기 암호화 본문을 '내 접수'에서 다시 볼 수 있다. */}
      {needKeySetup && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <LeaderKeySetup
              accountId={myAccountId}
              intro="이 글은 대상 리더와 나만 볼 수 있게 암호화됩니다. 열람용 키를 먼저 만들어 주세요."
              onDone={() => {
                setNeedKeySetup(false);
                void submit();
              }}
            />
          </div>
        </div>
      )}
      <div className="intake-main">
        {/* 익명성 보장은 이 화면의 존재 이유인데 안내가 본문에 묻혀 있었다.
            문구 자체는 제품 약속이라 그대로 두고 위계만 올린다. */}
        {step === 'scope' && (
          <div className="intake-intro">
            <h1 className="culture-display">
              여기서 한 말은 <span className="culture-mark">이름 없이</span> 전해집니다
            </h1>
            <p className="culture-lede">
              익명으로 접수하면 작성자 정보가 본문과 분리되어 저장됩니다. 리더 화면에도 누가 썼는지
              보이지 않아요.
            </p>
          </div>
        )}

        <div className="segmented intake-view-tabs" role="tablist" aria-label="접수 화면 전환">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'write'}
            className={view === 'write' ? 'selected' : ''}
            onClick={() => setView('write')}
          >
            <MessageSquarePlus size={16} />
            말하기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'mine'}
            className={view === 'mine' ? 'selected' : ''}
            onClick={() => setView('mine')}
          >
            <Megaphone size={16} />
            내 접수 {myIssues.length > 0 ? `(${myIssues.length})` : ''}
          </button>
        </div>

        {view === 'write' && (
        <>
        <div className="intake-stepper">
          {steps.map((item, index) => (
            <button
              className={index <= currentStepIndex ? 'active' : ''}
              // 앞 단계로 되돌아가는 것은 늘 열어두고, 건너뛰기만 막는다.
              // 내용이 비어 있는데 '제출 확인'으로 점프하면 빈 의견이 접수된다.
              disabled={index > currentStepIndex || item.id === 'complete'}
              key={item.id}
              onClick={() => setStep(item.id)}
            >
              <span>{index + 1}</span>
              {item.label}
            </button>
          ))}
        </div>

        {step === 'scope' && (
          <section className="panel intake-panel">
            <PanelHeader icon={MessageSquarePlus} title="어떤 방식으로 말할까요?" />
            <div className="intake-choice-grid">
              {(['익명', '실명'] as const).map((item) => (
                <button className={identity === item ? 'choice-card selected' : 'choice-card'} onClick={() => onIdentityChange(item)} key={item}>
                  {item === '익명' ? <EyeOff size={22} /> : <ShieldCheck size={22} />}
                  <strong>{item}</strong>
                </button>
              ))}
            </div>

            <div className="form-grid">
              <label>
                전달 대상
                <select value={target} onChange={(event) => setTarget(event.target.value)}>
                  <option value="팀리더">팀리더</option>
                  {partLeaders.length > 0 && (
                    <optgroup label="파트리더에게 직접">
                      {partLeaders.map((leader) => (
                        <option key={leader.name} value={leader.name}>
                          {leader.name} · {leader.part}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="리더 전체">리더 전체</option>
                </select>
              </label>
              <label>
                공개 범위
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as IssueVisibility)}>
                  <option value="리더만 보기">리더만 보기 · 원문 비공개</option>
                  <option value="안건 후보로 공개 가능">안건 후보로 공개 가능 · 원문 인용 가능</option>
                </select>
              </label>
            </div>

            {/* 라벨만으로는 '리더만 보기'가 절대 공개되지 않는다고 읽힌다.
                실제로는 리더가 새로 쓴 익명 안건이 올라갈 수 있으므로 여기서 미리 밝힌다. */}
            <p className="field-note">
              {visibility === '리더만 보기'
                ? '내가 쓴 원문과 작성자 정보는 팀원에게 공개되지 않습니다. 다만 리더가 이 주제를 다뤄야 한다고 판단하면, 원문 대신 리더가 새로 쓴 익명 안건이 안건함에 올라갈 수 있어요.'
                : '리더가 원문을 인용하거나 다듬어 안건으로 올릴 수 있습니다. 익명으로 접수했다면 작성자 정보는 계속 공개되지 않습니다.'}
            </p>

            <button className="primary-button wide" onClick={() => setStep('content')}>
              <FileText size={18} />
              내용 작성하기
            </button>
          </section>
        )}

        {step === 'content' && (
          /*
            인스타 '새 게시물' 만들기 모달의 2단 구조. 왼쪽이 미디어 자리,
            오른쪽이 캡션과 설정이다. 이 앱에서 미디어에 해당하는 것은 본문이라
            왼쪽을 본문 하나로 크게 비웠다. 나머지(제목 · 분류 · 긴급도 ·
            기대 변화)는 전부 오른쪽 레일로 옮겼다.

            필드도 검증도 제출 흐름도 그대로다. 바뀐 것은 배치뿐이다 —
            익명 접수는 이 앱의 전제라 흐름에 손대지 않는다.
          */
          <section className="panel ig-create">
            <div className="ig-create-main">
              <span className="ig-create-label">
                내용
                <span className="field-required">필수</span>
              </span>
              <textarea
                required
                aria-required="true"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="예: 논의할 주제가 명확하지 않은 회의는 시간을 줄이고, 필요한 경우 안건함에서 먼저 투표하면 좋겠습니다."
              />
            </div>

            <div className="ig-create-side">
              <header className="ig-create-head">
                <span className="ig-ava">{identity === '익명' ? '익' : currentUser.name.slice(0, 1)}</span>
                <span className="ig-post-who">
                  <b>{identity === '익명' ? '익명으로 접수' : currentUser.name}</b>
                  <span>
                    {target} · {visibility}
                  </span>
                </span>
              </header>

              <label>
                <span className="field-label">
                  제목
                  <span className="field-required">필수</span>
                </span>
                <input
                  required
                  aria-required="true"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 팀 티미팅 시간을 줄이고 싶어요"
                />
              </label>

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
                  긴급도
                  <select value={urgency} onChange={(event) => setUrgency(event.target.value as Urgency)}>
                    <option>낮음</option>
                    <option>보통</option>
                    <option>높음</option>
                  </select>
                </label>
              </div>

              <label>
                기대 변화
                <textarea
                  value={expectedChange}
                  onChange={(event) => setExpectedChange(event.target.value)}
                  placeholder="예: 회의 전 안건을 먼저 모으고, 꼭 필요한 주제만 짧게 논의하면 좋겠습니다."
                />
              </label>

              {/*
                버튼을 흐리게만 두면 사용자는 고장으로 읽는다. 사이드바 잠금에서
                이미 세운 원칙인데 폼에는 빠져 있었다. 무엇이 모자란지 적는다.
              */}
              {(!title.trim() || !body.trim()) && (
                <p className="field-note gate-note">
                  {!title.trim() && !body.trim()
                    ? '제목과 내용을 채우면 다음으로 넘어갈 수 있어요.'
                    : !title.trim()
                      ? '제목을 채우면 다음으로 넘어갈 수 있어요.'
                      : '내용을 채우면 다음으로 넘어갈 수 있어요.'}
                </p>
              )}

              <div className="form-actions">
                <button className="secondary-button" onClick={() => setStep('scope')}>
                  이전
                </button>
                <button
                  className="primary-button"
                  disabled={!title.trim() || !body.trim()}
                  onClick={() => {
                    // 내용이 바뀌었으니 이전 검토 결과를 물려받지 않는다.
                    setReviewReady(false);
                    setStep('review');
                  }}
                >
                  제출 전 확인
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 'review' && (
          <section className="panel intake-panel">
            <PanelHeader icon={ShieldCheck} title="제출 전 확인" />
            {/* 제출 전에 꼭 다시 확인해야 하는 값은 익명/실명과 공개 범위 둘뿐이다.
                카테고리·긴급도와 같은 회색 라벨로 묻어두면 눈에 걸리지 않으므로 맨 위로 올린다. */}
            <div className="review-box">
              <div className="review-flags">
                <span className={identity === '익명' ? 'review-flag anon' : 'review-flag named'}>
                  {identity === '익명' ? <EyeOff size={14} /> : <ShieldCheck size={14} />}
                  {identity === '익명' ? '익명으로 접수' : '실명으로 접수'}
                </span>
                <span className={visibility === '리더만 보기' ? 'review-flag closed' : 'review-flag open'}>
                  {visibility === '리더만 보기' ? <Lock size={14} /> : <Eye size={14} />}
                  {visibility}
                </span>
              </div>

              <div className="review-section">
                <p className="review-section-label">작성한 내용</p>
                <h2>{title}</h2>
                <p>{body}</p>
                {/* 기대 변화는 선택 항목이다. 비어 있는데 라벨만 남으면 빈 줄로 읽힌다. */}
                {expectedChange.trim() && (
                  <div className="review-expected">
                    <strong>기대 변화</strong>
                    <p>{expectedChange}</p>
                  </div>
                )}
              </div>

              <div className="review-section">
                <p className="review-section-label">전달 설정</p>
                <dl>
                  {identity === '실명' && (
                    <div><dt>작성자</dt><dd>{currentUser.name} · {currentUser.part} · {currentUser.email}</dd></div>
                  )}
                  <div><dt>전달 대상</dt><dd>{target}</dd></div>
                  <div><dt>카테고리</dt><dd>{category}</dd></div>
                  <div><dt>긴급도</dt><dd>{urgency}</dd></div>
                </dl>
              </div>
            </div>

            {skipReview ? (
              // 암호화 접수(익명 전체 / 실명 리더만보기): 본문을 수신자 공개키로 암호화하므로 외부 AI로 보내지 않는다(검토 생략).
              <div className="submit-notes">
                <ShieldCheck size={16} />
                <div>
                  {identity === '익명' ? (
                    <p>익명 접수는 대상 리더만 열어볼 수 있도록 <strong>암호화되어 저장</strong>됩니다. 운영자도 내용을 볼 수 없어요.</p>
                  ) : (
                    <p>이 글은 대상 리더와 나만 열어볼 수 있도록 <strong>암호화되어 저장</strong>됩니다. 운영자도 내용을 볼 수 없어요.</p>
                  )}
                  <p>암호화 글은 외부 AI 다듬기 검토를 하지 않습니다. 제목엔 민감 정보를 넣지 말아주세요.</p>
                </div>
              </div>
            ) : (
              <>
                <ReviewGate
                  title={title}
                  body={body}
                  expectedChange={expectedChange}
                  onEditManually={() => setStep('content')}
                  onReadyChange={setReviewReady}
                  onApply={(fields, rewritten) => {
                    // 수정안을 해당 항목에 반영한다. 값이 바뀌면 ReviewGate 가 자동으로 다시 검토한다.
                    fields.forEach((field) => {
                      if (field === 'title') setTitle(rewritten);
                      else if (field === 'body') setBody(rewritten);
                      else setExpectedChange(rewritten);
                    });
                  }}
                />

                {/* 경고를 세 개 쌓으면 서로를 무력화한다. 막는 역할은 위의 ReviewGate 하나만 맡고,
                    항상 보여야 하는 안내 두 줄은 조용한 톤으로 묶는다. 외부 전송 고지는 검토 결과와 무관하게 항상 보인다. */}
                <div className="submit-notes">
                  <ShieldCheck size={16} />
                  <div>
                    <p>개인정보, 실명 비방, 민감 정보가 포함되어 있지 않은지 한 번 더 확인해주세요.</p>
                    <p>다듬기 검토를 위해 작성 내용이 외부 AI로 전송됩니다. 이름·메일·소속은 보내지 않습니다.</p>
                  </div>
                </div>
              </>
            )}
            {submitError && <p className="form-error">{submitError}</p>}
            <div className="form-actions">
              <button className="secondary-button" onClick={() => setStep('content')}>
                수정하기
              </button>
              <button className="primary-button" disabled={!skipReview && !reviewReady} onClick={submit}>
                <Send size={18} />
                접수하기
              </button>
            </div>
          </section>
        )}

        {step === 'complete' && (
          <section className="panel intake-panel complete-panel">
            <CheckCircle2 size={42} />
            <p className="eyebrow">접수 완료</p>
            <h2>{receiptId}</h2>
            {(receiptAccessCode || receiptEncrypted) && (
              <p className="intake-enc-badge">
                <ShieldCheck size={15} />
                {receiptEncrypted
                  ? receiptAccessCode
                    ? '본문이 대상 리더 공개키로 암호화되어 저장됐어요. 운영자도 내용을 볼 수 없습니다.'
                    : '본문이 대상 리더와 나만 볼 수 있게 암호화되어 저장됐어요. 운영자도 내용을 볼 수 없습니다.'
                  : '대상 리더가 아직 암호화 키를 설정하지 않아 이번 글은 암호화되지 않았어요.'}
              </p>
            )}
            {receiptAccessCode && (
              <div className="anonymous-receipt">
                <strong>익명 확인 코드</strong>
                <span>{receiptAccessCode}</span>
                <small>이 코드는 다시 보여주지 않는 값으로 가정하고 꼭 따로 보관해주세요.</small>
              </div>
            )}
            <p>
              {receiptAccessCode
                ? '의견이 리더 관리함으로 전달되었습니다. 접수번호와 확인 코드로 익명 접수 조회에서 후속 조치를 확인할 수 있어요.'
                : '의견이 리더 관리함으로 전달되었습니다. 접수 상태는 아래 목록에서 계속 확인할 수 있어요.'}
            </p>
            <button
              className="primary-button"
              onClick={() => {
                // 직전 접수 내용이 남아 있으면 다음 의견에 그대로 딸려 들어간다.
                setTitle('');
                setBody('');
                setExpectedChange('');
                setStep('scope');
              }}
            >
              새 의견 접수
            </button>
          </section>
        )}
        </>
        )}

        {view === 'mine' && (
        <>
        <section className="panel intake-panel my-issues-panel">
          <div className="my-issues-header">
            <PanelHeader icon={Megaphone} title="내 접수 현황" />
            <div className="toolbar my-issues-toolbar">
              {(['전체', '답변 대기', '1on1', '완료'] as const).map((item) => (
                <button
                  className={myIssueFilter === item ? 'filter active' : 'filter'}
                  key={item}
                  onClick={() => setMyIssueFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* 예전에는 이 설명이 옆 열에 같은 제목의 별도 패널로 있었다.
              같은 이름이 목록과 설명 둘을 가리켜 라벨이 충돌했다.
              헤더는 제목과 필터를 한 줄에 놓는 가로 배치라 그 밖에 둔다. */}
          {/*
            여기 있던 안내문("사내메일 기준으로 실명 접수 건만 보입니다…")을 지웠다.
            '사내메일 기준'은 구현 세부사항이라 사용자에게 필요 없고, '실명만 보인다'는
            익명으로 냈는데 안 보일 때만 필요한 조건부 정보이며, '아래에서 조회하세요'는
            바로 아래 화면에 보이는 섹션을 가리키는 말이었다.
            그 상황이 오면 빈 상태가 '아직 실명으로 접수한 의견이 없어요'라고 말하고
            익명 조회 섹션이 바로 아래 있다. 답이 이미 있는 자리에 설명을 미리 얹으면,
            소수의 첫 혼란을 위해 모든 방문에 세금을 매기는 셈이 된다.
          */}
          <div className="submission-list">
            {visibleMyIssues.length > 0 ? (
              visibleMyIssues.map((issue) => {
                const isExpanded = expandedIssueIds[issue.id] ?? visibleMyIssues.length === 1;
                return (
                  <article className="submission-card" key={issue.id}>
                    <button className="submission-summary" onClick={() => toggleIssue(issue.id)}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <div>
                        <strong>{issue.title}</strong>
                        <span>{issue.id} · {issue.category} · {issue.target}</span>
                      </div>
                      <span className="status-pill">{issue.status}</span>
                    </button>

                    {isExpanded && (
                      <div className="submission-detail">
                        {/* 내가 쓴 본문·기대 변화를 먼저 보여준다. 예전에는 리더 답변만 렌더돼
                            정작 작성자가 자기가 뭘 냈는지 다시 볼 수 없었다.
                            암호화 글(실명 리더만보기)은 작성자 본인 키로 복호화해서 보여준다. */}
                        {issue.encrypted ? (
                          <div className="submission-own">
                            <EncryptedIssueBody issue={issue} accountId={myAccountId} />
                          </div>
                        ) : (
                          <>
                            {issue.body && (
                              <div className="submission-own">
                                <p className="submission-own-label">작성한 내용</p>
                                <p className="submission-own-body">{issue.body}</p>
                              </div>
                            )}
                            {issue.expectedChange && (
                              <div className="submission-own">
                                <p className="submission-own-label">기대 변화</p>
                                <p className="submission-own-body">{issue.expectedChange}</p>
                              </div>
                            )}
                          </>
                        )}
                        {/* 보류·종료는 결과만 통보하면 무시당한 것으로 읽힌다. 리더가 남긴 사유를 함께 보여준다. */}
                        {issue.statusReason && (
                          <p className="submission-reason">
                            {issue.status} 사유: {issue.statusReason}
                          </p>
                        )}
                        {issue.leaderReply && <p>답변: {issue.leaderReply}</p>}
                        {issue.oneOnOneNote && <p>1on1: {issue.oneOnOneNote}</p>}
                        {issue.actionItem && <p>액션아이템: {issue.actionItem}</p>}
                        {issue.submitterResponse && <p>내 응답: {issue.submitterResponse}</p>}
                        {issue.oneOnOneResponse && <p>1on1 응답: {issue.oneOnOneResponse}</p>}
                        {(issue.leaderReply || issue.oneOnOneNote || issue.actionItem) && (
                          <div className="submission-followup">
                            {issue.oneOnOneNote && (
                              <div className="submission-followup-actions">
                                <button className="secondary-button" onClick={() => respondToOneOnOne(issue, '수락')}>
                                  1on1 수락
                                </button>
                                <button className="secondary-button" onClick={() => respondToOneOnOne(issue, '일정 조율 요청')}>
                                  일정 조율 요청
                                </button>
                              </div>
                            )}
                            <textarea
                              value={responseDrafts[issue.id] ?? ''}
                              onChange={(event) => updateResponseDraft(issue.id, event.target.value)}
                              placeholder="리더 답변에 대한 확인, 추가 의견, 가능한 일정 등을 남겨주세요."
                            />
                            <button className="primary-button wide" onClick={() => saveSubmitterResponse(issue)}>
                              후속 응답 남기기
                            </button>
                          </div>
                        )}
                        {canWithdraw(issue) && (
                          <div className="submission-withdraw">
                            <span>리더가 아직 답변이나 후속 조치를 남기기 전이라 회수할 수 있습니다.</span>
                            <button className="secondary-button" onClick={() => withdrawIssue(issue)}>
                              접수 회수
                            </button>
                          </div>
                        )}
                        {issue.status === '회수' && <p>이 접수 의견은 작성자가 회수했습니다.</p>}
                        {issue.status !== '회수' &&
                          !issue.statusReason &&
                          !issue.leaderReply &&
                          !issue.oneOnOneNote &&
                          !issue.actionItem && <p>아직 리더가 남긴 답변이나 후속 액션이 없습니다.</p>}
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <EmptyState
                icon={Megaphone}
                title="아직 실명으로 접수한 의견이 없어요"
                description="리더 답변이나 1on1 제안이 오면 여기에서 바로 응답할 수 있습니다."
                action={{ label: '의견 보내기', onClick: () => { setView('write'); setStep('scope'); } }}
              />
            )}
          </div>
        </section>

        <section className="panel">
          <button className="btn-ghost lookup-toggle" onClick={() => setLookupOpen((prev) => !prev)} type="button">
            <KeyRound size={18} />
            익명으로 접수한 건 조회하기
            <ChevronDown size={16} className={lookupOpen ? 'is-open' : ''} />
          </button>
          {lookupOpen && (
          <div className="anonymous-lookup">
            <label>
              접수번호
              <input
                value={anonymousReceiptId}
                onChange={(event) => setAnonymousReceiptId(event.target.value.toUpperCase())}
                placeholder="SOOP-..."
              />
            </label>
            <label>
              확인 코드
              <input
                value={anonymousAccessCode}
                onChange={(event) => setAnonymousAccessCode(event.target.value.toUpperCase())}
                placeholder="AB12CD"
              />
            </label>
            <button className="primary-button wide" onClick={lookupAnonymousIssue}>
              조회하기
            </button>
            {anonymousLookupError && <p className="form-error">{anonymousLookupError}</p>}
            {anonymousIssue && (
              <div className="anonymous-result">
                <div className="submission-summary static">
                  <KeyRound size={18} />
                  <div>
                    <strong>{anonymousIssue.title}</strong>
                    <span>{anonymousIssue.id} · {anonymousIssue.category} · {anonymousIssue.target}</span>
                  </div>
                  <span className="status-pill">{anonymousIssue.status}</span>
                </div>
                <div className="submission-detail">
                  {anonymousIssue.body && (
                    <div className="submission-own">
                      <p className="submission-own-label">작성한 내용</p>
                      <p className="submission-own-body">{anonymousIssue.body}</p>
                    </div>
                  )}
                  {anonymousIssue.expectedChange && (
                    <div className="submission-own">
                      <p className="submission-own-label">기대 변화</p>
                      <p className="submission-own-body">{anonymousIssue.expectedChange}</p>
                    </div>
                  )}
                  {anonymousIssue.statusReason && (
                    <p className="submission-reason">
                      {anonymousIssue.status} 사유: {anonymousIssue.statusReason}
                    </p>
                  )}
                  {anonymousIssue.leaderReply && <p>답변: {anonymousIssue.leaderReply}</p>}
                  {anonymousIssue.oneOnOneNote && <p>익명 추가 대화 제안: {anonymousIssue.oneOnOneNote}</p>}
                  {anonymousIssue.actionItem && <p>액션아이템: {anonymousIssue.actionItem}</p>}
                  {anonymousIssue.submitterResponse && <p>내 익명 응답: {anonymousIssue.submitterResponse}</p>}
                  {(anonymousIssue.leaderReply || anonymousIssue.oneOnOneNote || anonymousIssue.actionItem) && (
                    <div className="submission-followup">
                      <textarea
                        value={responseDrafts[anonymousIssue.id] ?? ''}
                        onChange={(event) => updateResponseDraft(anonymousIssue.id, event.target.value)}
                        placeholder="익명 상태로 추가 의견을 남겨주세요."
                      />
                      <button className="primary-button wide" onClick={() => saveSubmitterResponse(anonymousIssue)}>
                        익명 후속 응답 남기기
                      </button>
                    </div>
                  )}
                  {!anonymousIssue.leaderReply && !anonymousIssue.oneOnOneNote && !anonymousIssue.actionItem && (
                    <p>아직 리더가 남긴 답변이나 후속 액션이 없습니다.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </section>
        </>
        )}
      </div>
    </section>
  );
}

function makeAnonymousAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}
