// 리더용 암호화 UI — 키 설정(최초 1회) + 암호화 접수 복호화 열람.
// 개인키는 리더 기기에서만 다뤄지고(세션 메모리 캐시), 서버엔 감싼 암호문만 저장된다.
import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Lock, Copy, Check } from 'lucide-react';
import {
  generateRecipientKeypair,
  wrapPrivateKey,
  unwrapPrivateKey,
  generateRecoveryCode,
  decryptAsRecipient,
  ISSUE_ENC_ALG,
  type EncryptedIssue,
} from '../../crypto/issueCrypto';
import {
  loadLeaderKeyRecord,
  saveLeaderKeyRecord,
  cachePrivateKey,
  getCachedPrivateKey,
  type LeaderKeyRecord,
} from '../../crypto/leaderKeyStore';
import type { Issue } from '../../types';

const MIN_PASSPHRASE = 8;

// ── 키 설정 모달 ──
export function LeaderKeySetup({ accountId, onDone, intro, title }: { accountId: string; onDone: () => void; intro?: string; title?: string }) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const create = async () => {
    if (pass.length < MIN_PASSPHRASE) { setError(`패스프레이즈는 ${MIN_PASSPHRASE}자 이상이어야 해요.`); return; }
    if (pass !== pass2) { setError('두 패스프레이즈가 서로 달라요.'); return; }
    setBusy(true);
    setError('');
    try {
      const { publicJwk, privateJwk } = await generateRecipientKeypair();
      const code = generateRecoveryCode();
      const rec: LeaderKeyRecord = {
        accountId,
        publicJwk,
        encPrivPassphrase: await wrapPrivateKey(privateJwk, pass),
        encPrivRecovery: await wrapPrivateKey(privateJwk, code),
        alg: ISSUE_ENC_ALG,
      };
      const ok = await saveLeaderKeyRecord(rec);
      if (!ok) { setError('키 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'); return; }
      cachePrivateKey(accountId, privateJwk); // 바로 열람 가능
      setRecoveryCode(code);
    } finally {
      setBusy(false);
    }
  };

  if (recoveryCode) {
    return (
      <div className="anon-key-setup">
        <div className="role-note">
          <strong><KeyRound size={15} /> 복구코드를 안전한 곳에 보관하세요</strong>
          <span>비밀번호를 잊었을 때, 이 코드로 접수를 다시 열 수 있는 유일한 예비 열쇠예요. 지금 한 번만 보여드려요 — 메모장이나 비밀번호 관리앱에 저장해 주세요. (서버·관리자도 모르는 값입니다)</span>
        </div>
        <div className="anonymous-receipt">
          <strong>복구코드</strong>
          <span style={{ letterSpacing: '0.05em' }}>{recoveryCode}</span>
          <button
            type="button"
            className="login-link"
            onClick={() => { void navigator.clipboard?.writeText(recoveryCode); setCopied(true); }}
          >
            {copied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 복사</>}
          </button>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          복구코드를 안전한 곳에 저장했어요.
        </label>
        <button className="primary-button" disabled={!confirmed} onClick={onDone}>
          <ShieldCheck size={16} /> 완료
        </button>
      </div>
    );
  }

  return (
    <div className="anon-key-setup">
      <div className="role-note">
        <strong><Lock size={15} /> {title ?? '암호화 열람 키 설정'}</strong>
        <span>{intro ?? '익명 접수를 열어보려면 암호화 키가 필요해요.'} 패스프레이즈는 이 기기에서만 쓰이고 서버로 전송되지 않습니다.</span>
      </div>
      <label>
        패스프레이즈
        <input type="password" value={pass} autoComplete="new-password"
          onChange={(e) => setPass(e.target.value)} placeholder={`${MIN_PASSPHRASE}자 이상`} />
      </label>
      <label>
        패스프레이즈 확인
        <input type="password" value={pass2} autoComplete="new-password"
          onChange={(e) => setPass2(e.target.value)} placeholder="한 번 더" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button" disabled={busy} onClick={create}>
        <KeyRound size={16} /> {busy ? '키 생성 중…' : '키 만들기'}
      </button>
    </div>
  );
}

// ── 암호화 접수 본문 열람 ──
type DecState =
  | { phase: 'loading' }
  | { phase: 'noKey' }          // 이 리더가 아직 키 미설정
  | { phase: 'setup' }          // 키 설정 진행
  | { phase: 'notRecipient' }   // 이 글은 내 키로 암호화되지 않음
  | { phase: 'locked' }         // 키 있음, 패스프레이즈 필요
  | { phase: 'unlocked'; body: string; expectedChange: string }
  | { phase: 'error'; message: string };

export function EncryptedIssueBody({ issue, accountId }: { issue: Issue; accountId: string }) {
  const [state, setState] = useState<DecState>({ phase: 'loading' });
  const [record, setRecord] = useState<LeaderKeyRecord | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  // 비밀번호를 잊었을 때 복구코드로 여는 경로. 같은 개인키를 복구코드로도 감싸 뒀다(encPrivRecovery).
  const [useRecovery, setUseRecovery] = useState(false);
  const [recovery, setRecovery] = useState('');

  const encIssue: EncryptedIssue = {
    alg: issue.encAlg ?? ISSUE_ENC_ALG,
    payload: issue.encPayload ?? '',
    keys: issue.encKeys ?? [],
  };
  const iAmRecipient = encIssue.keys.some((k) => k.accountId === accountId);

  // 캐시된 개인키가 있으면 즉시 복호화. 없으면 키 레코드 로드해 상태 결정.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!accountId) { if (alive) setState({ phase: 'noKey' }); return; }
      if (!iAmRecipient) { if (alive) setState({ phase: 'notRecipient' }); return; }
      const cached = getCachedPrivateKey(accountId);
      if (cached) {
        try {
          const text = await decryptAsRecipient(encIssue, accountId, cached);
          const parsed = JSON.parse(text) as { body: string; expectedChange: string };
          if (alive) setState({ phase: 'unlocked', body: parsed.body, expectedChange: parsed.expectedChange });
        } catch {
          if (alive) setState({ phase: 'error', message: '복호화에 실패했어요.' });
        }
        return;
      }
      const rec = await loadLeaderKeyRecord(accountId);
      if (!alive) return;
      if (!rec) { setState({ phase: 'noKey' }); return; }
      setRecord(rec);
      setState({ phase: 'locked' });
    })();
    return () => { alive = false; };
    // issue.id 변경 시 재실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id, accountId]);

  const unlock = async () => {
    if (!record) return;
    setBusy(true);
    try {
      let priv;
      try {
        priv = useRecovery
          ? await unwrapPrivateKey(record.encPrivRecovery, recovery.trim())
          : await unwrapPrivateKey(record.encPrivPassphrase, pass);
      } catch {
        setState({ phase: 'error', message: useRecovery ? '복구코드가 올바르지 않아요.' : '비밀번호가 올바르지 않아요.' });
        return;
      }
      cachePrivateKey(accountId, priv);
      const text = await decryptAsRecipient(encIssue, accountId, priv);
      const parsed = JSON.parse(text) as { body: string; expectedChange: string };
      setState({ phase: 'unlocked', body: parsed.body, expectedChange: parsed.expectedChange });
      setPass('');
      setRecovery('');
    } finally {
      setBusy(false);
    }
  };

  if (state.phase === 'loading') return <div className="issue-body-box"><p>불러오는 중…</p></div>;

  if (state.phase === 'notRecipient') {
    return (
      <div className="issue-body-box">
        <strong><Lock size={14} /> 암호화 접수</strong>
        <p>이 글은 회원님 키로 암호화되지 않아 열람할 수 없어요(다른 대상 리더에게 전달된 글입니다).</p>
      </div>
    );
  }

  if (state.phase === 'noKey' || state.phase === 'setup') {
    return state.phase === 'setup'
      ? <LeaderKeySetup accountId={accountId} onDone={() => setState({ phase: 'locked' })} />
      : (
        <div className="issue-body-box">
          <strong><Lock size={14} /> 암호화 접수</strong>
          <p>이 익명 접수는 암호화되어 있어요. 열람하려면 암호화 키를 먼저 설정하세요.</p>
          <button className="primary-button" onClick={() => setState({ phase: 'setup' })}>
            <KeyRound size={16} /> 암호화 키 설정
          </button>
        </div>
      );
  }

  if (state.phase === 'unlocked') {
    return (
      <div className="issue-body-box">
        <strong><ShieldCheck size={14} /> 접수 내용 (복호화됨)</strong>
        <p>{state.body || '작성된 내용이 없습니다.'}</p>
        {state.expectedChange && (<><strong>기대 변화</strong><p>{state.expectedChange}</p></>)}
      </div>
    );
  }

  // locked | error
  return (
    <div className="issue-body-box">
      <strong><Lock size={14} /> 암호화 접수 — {useRecovery ? '복구코드' : '비밀번호'} 입력</strong>
      <p>대상 리더인 회원님만 열람할 수 있어요. {useRecovery ? '설정 때 저장한 복구코드를 입력하세요.' : '비밀번호로 잠금을 해제하세요.'}</p>
      {useRecovery ? (
        <input value={recovery} autoComplete="off"
          onChange={(e) => setRecovery(e.target.value)} placeholder="복구코드" />
      ) : (
        <input type="password" value={pass} autoComplete="off"
          onChange={(e) => setPass(e.target.value)} placeholder="비밀번호" />
      )}
      {state.phase === 'error' && <p className="form-error">{state.message}</p>}
      <button className="primary-button" disabled={busy || (useRecovery ? !recovery.trim() : !pass)} onClick={unlock}>
        <KeyRound size={16} /> {busy ? '여는 중…' : '열람'}
      </button>
      <button
        type="button"
        className="login-link"
        onClick={() => { setUseRecovery((v) => !v); setState({ phase: 'locked' }); }}
      >
        {useRecovery ? '← 비밀번호로 열기' : '비밀번호를 잊으셨나요? 복구코드로 열기'}
      </button>
    </div>
  );
}
