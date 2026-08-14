import { FormEvent, useState } from 'react';
import { HeartHandshake, LogIn, UserPlus, KeyRound, ShieldCheck, Slack } from 'lucide-react';
import { teamParts, isCompanyEmail } from '../../auth';
import { login as serverLogin, changePassword, requestReset, confirmReset } from '../../authApi';
import type { CurrentUser, ManagedAccount, TeamPart } from '../../types';

// 새 비밀번호의 최소 길이. 너무 짧으면 해시를 걸어도 금방 뚫린다.
const MIN_PASSWORD_LENGTH = 6;

// Slack 로그인은 Slack이 정한 최소 브라우저 버전 이상에서만 뜬다. 미달이면 Slack이
// "미지원 브라우저"로 막아 로그인 페이지가 아예 안 나온다(특히 구버전 Safari를 쓰는
// 회사 VDI/OA 환경). 그래서 지원 버전을 화면에 상시 안내한다.
// ※ Slack은 이 요건을 매년 5월·11월 갱신한다 — 그때 이 숫자만 고치면 된다.
const SUPPORTED_BROWSERS = 'Chrome 137+ · Edge 136+ · Firefox 139+ · Safari 26+';

type LoginScreenProps = {
  accounts: ManagedAccount[];
  onLogin: (user: CurrentUser) => void;
  onRegister: (account: Omit<ManagedAccount, 'id' | 'joinedAt' | 'status'>) => void;
  // 비밀번호 변경 폴백(서버 미설정 시). 서버가 켜지면 쓰이지 않는다.
  onSetPassword: (email: string, passwordHash: string) => void;
  // Slack(OIDC) 로그인 시작. Supabase 미설정이면 undefined → 버튼을 숨긴다.
  onSlackLogin?: () => void;
  // Slack 로그인 실패/차단 사유(비활성 등). 리다이렉트 복귀 후 App 이 채운다.
  slackError?: string;
};

// auth: 로그인/가입 · change: 첫 로그인 강제 변경 · reset: 인증번호 초기화
type AuthMode = 'login' | 'signup';
type Phase = 'auth' | 'change' | 'reset-request' | 'reset-confirm';

export function LoginScreen({ accounts, onLogin, onRegister, onSetPassword, onSlackLogin, slackError }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [phase, setPhase] = useState<Phase>('auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [part, setPart] = useState<TeamPart>('TEST혁신파트');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // 강제 변경·초기화 단계에서 쓰는 값들.
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [code, setCode] = useState('');
  // 강제 변경에는 방금 로그인에 쓴 비번(현재 비번)이 필요하다.
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
  const [pendingCurrentPw, setPendingCurrentPw] = useState('');

  // Slack 로그인이 유일한 로그인 수단이다. 이메일+비번 폼은 백도어가 아니라,
  // Slack 자체가 설정 안 된 환경(로컬 개발 등)에서만 뜨는 폴백이다 — 정상 배포에선 절대 안 보인다.
  // (히든 제스처·데모 빠른 로그인 같은 우회 경로는 전부 제거했다.)
  const showEmailLogin = !onSlackLogin;

  const resetFields = () => {
    setError('');
    setNotice('');
    setNewPw('');
    setNewPw2('');
    setCode('');
  };

  const backToAuth = () => {
    setPhase('auth');
    resetFields();
    setPassword('');
    setPendingUser(null);
    setPendingCurrentPw('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // ── 첫 로그인 강제 변경 ──
    if (phase === 'change') {
      if (newPw.length < MIN_PASSWORD_LENGTH) {
        setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`);
        return;
      }
      if (newPw !== newPw2) {
        setError('두 비밀번호가 서로 달라요.');
        return;
      }
      setBusy(true);
      try {
        const r = await changePassword(trimmedEmail, pendingCurrentPw, newPw, onSetPassword);
        if (!r.ok) {
          setError(r.error ?? '비밀번호를 바꾸지 못했어요.');
          return;
        }
        // 변경 성공 → 그대로 입장.
        if (pendingUser) onLogin(pendingUser);
      } finally {
        setBusy(false);
      }
      return;
    }

    // ── 초기화: 인증번호 요청 ──
    if (phase === 'reset-request') {
      if (!isCompanyEmail(trimmedEmail)) {
        setError('사내메일은 @sk.com 계정만 사용할 수 있어요.');
        return;
      }
      setBusy(true);
      try {
        const r = await requestReset(trimmedEmail);
        if (!r.ok) {
          setError(r.error ?? '요청에 실패했어요.');
          return;
        }
        setError('');
        setNotice('가입된 계정이라면 슬랙 DM으로 인증번호를 보냈어요. 5분 안에 입력해 주세요.');
        setPhase('reset-confirm');
      } finally {
        setBusy(false);
      }
      return;
    }

    // ── 초기화: 인증번호 + 새 비번 ──
    if (phase === 'reset-confirm') {
      if (!code.trim()) {
        setError('인증번호를 입력해 주세요.');
        return;
      }
      if (newPw.length < MIN_PASSWORD_LENGTH) {
        setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`);
        return;
      }
      if (newPw !== newPw2) {
        setError('두 비밀번호가 서로 달라요.');
        return;
      }
      setBusy(true);
      try {
        const r = await confirmReset(trimmedEmail, code.trim(), newPw);
        if (!r.ok) {
          setError(r.error ?? '초기화에 실패했어요.');
          return;
        }
        backToAuth();
        setNotice('비밀번호가 바뀌었어요. 새 비밀번호로 로그인해 주세요.');
      } finally {
        setBusy(false);
      }
      return;
    }

    // 로그인은 이메일+비밀번호만으로 한다(모바일과 동일). 이름은 가입 때만 받는다.
    if (mode === 'signup' && !trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (!isCompanyEmail(trimmedEmail)) {
      setError('사내메일은 @sk.com 계정만 사용할 수 있어요.');
      return;
    }

    if (mode === 'login') {
      // 상태 안내는 클라이언트가 읽을 수 있는 accounts 로 먼저 거른다(서버 왕복 전에).
      const account = accounts.find((item) => item.email.toLowerCase() === trimmedEmail);
      if (account?.status === '승인 대기') {
        setError('아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요.');
        return;
      }
      if (account?.status === '비활성') {
        setError('비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요.');
        return;
      }
      if (!password) {
        setError('비밀번호를 입력해주세요.');
        return;
      }

      setBusy(true);
      try {
        // 서버 인증(폴백: 클라이언트 검증). 성공하면 mustChange 여부까지 받는다.
        const r = await serverLogin(trimmedEmail, password, account);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setError('');
        setNotice('');
        if (r.mustChange) {
          // 초기 비번(123123) 등 → 입장 전에 새 비번을 강제로 정한다.
          setPendingUser(r.user);
          setPendingCurrentPw(password);
          setPhase('change');
          return;
        }
        onLogin(r.user);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (accounts.some((account) => account.email.toLowerCase() === trimmedEmail)) {
      setError('이미 가입된 사내메일이에요. 로그인으로 진행해주세요.');
      return;
    }

    setError('');
    setNotice('가입 요청이 접수됐어요. 팀리더가 계정 관리에서 활성 처리하면 로그인할 수 있어요.');
    // 권한은 항상 '팀원'으로 고정한다. 클라이언트가 보낸 값을 신뢰하지 않는다.
    onRegister({ name: trimmedName, email: trimmedEmail, role: '팀원', part });
    setMode('login');
  };

  return (
    <main className="login-page">
      {/*
        제목("사내 계정으로 로그인")을 없앴다. 바로 아래 탭이 로그인/가입 중
        무엇을 하는지 이미 말하고, 그 위 로고가 어디인지 말한다. 셋을 다 두면
        입력칸에 닿기 전에 안내를 세 번 읽는다.

        눈에 보이는 제목이 사라졌으므로 폼의 이름은 aria-label 로 남긴다 —
        스크린리더에서 이 폼이 무엇인지 알 수 없게 두면 안 된다.
      */}
      <form
        aria-label={mode === 'login' ? '사내 계정으로 로그인' : '새 계정 가입 요청'}
        className="login-panel"
        onSubmit={submit}
      >
        {/*
          로고를 왼쪽 소개면에서 이 카드 안으로 옮겼다. 인스타 로그인도
          워드마크가 카드 안에 있다 — 이름과 입력칸이 한 덩어리로 읽혀야
          "여기서 시작한다"가 분명해진다. 왼쪽에 두면 헤드라인과 로고가
          같은 위계로 경쟁했다.

          로고 클릭 = 커넥셔너용 빠른 로그인(데모) 히든 토글. 일반 유저는 알기 어렵다.
        */}
        <div className="brand login-brand">
          <div className="brand-mark" title="SKonnection">
            <HeartHandshake size={24} />
          </div>
          <div>
            <strong>SKonnection</strong>
            <span>팀을 잇는 곳</span>
          </div>
        </div>

        {/* ── 첫 로그인 강제 변경 ── */}
        {phase === 'change' && (
          <>
            <div className="role-note">
              <strong><ShieldCheck size={15} /> 새 비밀번호를 정해 주세요</strong>
              <span>보안을 위해 초기 비밀번호는 처음 로그인할 때 반드시 바꿔야 해요.</span>
            </div>
            <label>
              새 비밀번호
              <input type="password" value={newPw} autoComplete="new-password"
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={`${MIN_PASSWORD_LENGTH}자 이상`} />
            </label>
            <label>
              새 비밀번호 확인
              <input type="password" value={newPw2} autoComplete="new-password"
                onChange={(e) => setNewPw2(e.target.value)} placeholder="한 번 더" />
            </label>
          </>
        )}

        {/* ── 초기화: 이메일로 인증번호 요청 ── */}
        {phase === 'reset-request' && (
          <>
            <div className="role-note">
              <strong><KeyRound size={15} /> 비밀번호 초기화</strong>
              <span>사내메일로 인증번호를 슬랙 DM으로 보내드려요.</span>
            </div>
            <label>
              사내메일
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@sk.com" />
            </label>
          </>
        )}

        {/* ── 초기화: 인증번호 + 새 비번 ── */}
        {phase === 'reset-confirm' && (
          <>
            <label>
              인증번호
              <input value={code} inputMode="numeric" autoComplete="one-time-code"
                onChange={(e) => setCode(e.target.value)} placeholder="슬랙 DM으로 받은 6자리" />
            </label>
            <label>
              새 비밀번호
              <input type="password" value={newPw} autoComplete="new-password"
                onChange={(e) => setNewPw(e.target.value)} placeholder={`${MIN_PASSWORD_LENGTH}자 이상`} />
            </label>
            <label>
              새 비밀번호 확인
              <input type="password" value={newPw2} autoComplete="new-password"
                onChange={(e) => setNewPw2(e.target.value)} placeholder="한 번 더" />
            </label>
          </>
        )}

        {/* ── 로그인 / 가입 ── */}
        {phase === 'auth' && (
          <>
            {/*
              Slack 로그인이 기본 진입로. 비밀번호를 만들거나 외울 필요 없이 "이미 회사
              슬랙에 로그인한 사람"만 확실히 들어온다. 아래 이메일+비번은 슬랙을 못 쓰는
              상황용 백업으로 남겨둔다(전환기).
            */}
            {onSlackLogin && (
              <>
                <button type="button" className="primary-button slack-login-button" onClick={onSlackLogin}>
                  <Slack size={18} /> Slack으로 로그인
                </button>
                {slackError && <p className="form-error">{slackError}</p>}
                {!showEmailLogin && (
                  <p className="login-hint">
                    사내 Slack 계정으로 로그인합니다.
                    <br />
                    <span className="login-browser-hint">
                      최신 브라우저에서 로그인됩니다 — {SUPPORTED_BROWSERS}. 안 되면 브라우저를 업데이트하거나 Chrome을 사용하세요.
                    </span>
                  </p>
                )}
                {showEmailLogin && (
                  <div className="login-divider" aria-hidden="true">
                    <span>또는 사내메일로 (백업)</span>
                  </div>
                )}
              </>
            )}

            {/* 이메일+비번은 백업 경로. Slack 이 있으면 로고 탭으로만 펼친다(관리자/비상용). */}
            {showEmailLogin && (
              <>
                {mode === 'signup' && (
                  <label>
                    이름
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이선민" />
                  </label>
                )}

                <label>
                  사내메일
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@sk.com"
                  />
                </label>

                {mode === 'login' && (
                  <label>
                    비밀번호
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="비밀번호"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="login-link"
                      onClick={() => {
                        setPhase('reset-request');
                        resetFields();
                      }}
                    >
                      비밀번호를 잊으셨나요?
                    </button>
                  </label>
                )}

                {mode === 'signup' && (
                  <>
                    <label>
                      소속 파트
                      <select value={part} onChange={(event) => setPart(event.target.value as TeamPart)}>
                        {teamParts.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>

                    {/*
                      권한은 가입 폼에서 고르지 않는다. 신청자가 '팀리더'를 선택할 수 있으면
                      승인자가 권한 항목을 눈여겨보지 않는 순간 그대로 통과한다.
                      권한 상향은 계정 관리 화면에서 팀리더가 명시적으로 처리한다.
                    */}
                    <div className="role-note">
                      <strong>권한은 팀원으로 시작합니다</strong>
                      <span>파트리더·팀리더 권한이 필요하면 가입 승인 후 팀리더가 계정 관리에서 변경합니다.</span>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-success">{notice}</p>}

        {/* 강제 변경·초기화 단계의 액션 */}
        {phase !== 'auth' ? (
          <div className="login-actions">
            <button className="primary-button" type="submit" disabled={busy}>
              <ShieldCheck size={18} />
              {busy
                ? '처리 중…'
                : phase === 'change'
                  ? '새 비밀번호로 시작하기'
                  : phase === 'reset-request'
                    ? '인증번호 받기'
                    : '비밀번호 바꾸기'}
            </button>
            {phase !== 'change' && (
              <button className="secondary-button" type="button" onClick={backToAuth}>
                취소
              </button>
            )}
          </div>
        ) : showEmailLogin ? (
          <div className="login-actions">
            <button className="primary-button" type="submit" disabled={busy}>
              {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
              {mode === 'login' ? (busy ? '확인 중…' : '로그인') : '가입 요청'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setNotice('');
                setPassword('');
              }}
            >
              {mode === 'login' ? '가입' : '로그인으로'}
            </button>
          </div>
        ) : null}
      </form>
    </main>
  );
}
