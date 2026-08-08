import { FormEvent, useState } from 'react';
import { HeartHandshake, LogIn, UserPlus } from 'lucide-react';
import { teamParts, isCompanyEmail } from '../../auth';
import { hashPassword, verifyPassword } from '../../passwordHash';
import type { CurrentUser, ManagedAccount, TeamPart } from '../../types';

// 첫 로그인 때 정할 비밀번호의 최소 길이. 너무 짧으면 해시를 걸어도 금방 뚫린다.
const MIN_PASSWORD_LENGTH = 6;

const toCurrentUser = (account: ManagedAccount): CurrentUser => ({
  name: account.name,
  email: account.email,
  role: account.role,
  part: account.part,
  connectioner: account.connectioner ?? false,
});

// 빠른 로그인(데모) 대상 계정. 리더=심상준(팀리더), 팀원=이수현(팀원).
const DEMO_LEADER_EMAIL = 'simair@sk.com';
const DEMO_MEMBER_EMAIL = 'suhyunle@sk.com';

type LoginScreenProps = {
  accounts: ManagedAccount[];
  onLogin: (user: CurrentUser) => void;
  onRegister: (account: Omit<ManagedAccount, 'id' | 'joinedAt' | 'status'>) => void;
  // 첫 로그인 때 정한 비밀번호 해시를 그 계정에 저장한다.
  onSetPassword: (email: string, passwordHash: string) => void;
};

type AuthMode = 'login' | 'signup';

export function LoginScreen({ accounts, onLogin, onRegister, onSetPassword }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [part, setPart] = useState<TeamPart>('TEST혁신파트');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // 입력한 메일과 맞는 계정. 아직 비번을 정하지 않았으면 '첫 로그인'(비번 설정) 흐름.
  const matchedAccount = accounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  const isFirstLogin = mode === 'login' && Boolean(matchedAccount) && !matchedAccount?.passwordHash;
  // 빠른 로그인(데모)은 로그인 화면 로고를 눌러야 열리는 히든 제스처. 일반 유저는 발견하기 어렵다.
  const [showQuickLogin, setShowQuickLogin] = useState(false);

  const quickLeader = accounts.find(
    (account) => account.email.toLowerCase() === DEMO_LEADER_EMAIL && account.status === '활성',
  );
  const quickMember = accounts.find(
    (account) => account.email.toLowerCase() === DEMO_MEMBER_EMAIL && account.status === '활성',
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // 데이터 정제용 관리자 우회 계정(이름·사내메일 검사 없이).
    if (trimmedEmail === 'admin' && password === 'admin123') {
      onLogin({ name: '관리자', email: 'admin', part: 'ITS혁신파트', role: '팀리더' } as CurrentUser);
      return;
    }

    if (!trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (!isCompanyEmail(trimmedEmail)) {
      setError('사내메일은 @sk.com 계정만 사용할 수 있어요.');
      return;
    }

    if (mode === 'login') {
      const account = accounts.find((item) => item.email.toLowerCase() === trimmedEmail);

      if (!account) {
        setError('가입된 계정이 없어요. 먼저 가입 요청을 해주세요.');
        return;
      }

      if (account.name !== trimmedName) {
        setError('이름과 사내메일이 가입 정보와 일치하지 않아요.');
        return;
      }

      if (account.status === '승인 대기') {
        setError('아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요.');
        return;
      }

      if (account.status === '비활성') {
        setError('비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요.');
        return;
      }

      // 첫 로그인: 아직 비밀번호가 없으면 지금 입력한 값을 새 비밀번호로 등록한다.
      if (!account.passwordHash) {
        if (password.length < MIN_PASSWORD_LENGTH) {
          setError(`첫 로그인이에요. 사용할 비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상 정해주세요.`);
          return;
        }
        setBusy(true);
        try {
          const hash = await hashPassword(password);
          onSetPassword(account.email, hash);
          setError('');
          setNotice('');
          onLogin(toCurrentUser(account));
        } finally {
          setBusy(false);
        }
        return;
      }

      // 이후 로그인: 비밀번호 검증.
      if (!password) {
        setError('비밀번호를 입력해주세요.');
        return;
      }
      setBusy(true);
      try {
        const ok = await verifyPassword(password, account.passwordHash);
        if (!ok) {
          setError('비밀번호가 일치하지 않아요.');
          return;
        }
        setError('');
        setNotice('');
        onLogin(toCurrentUser(account));
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
        noValidate
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
          <div className="brand-mark" onClick={() => setShowQuickLogin((prev) => !prev)} title="SKonnection">
            <HeartHandshake size={24} />
          </div>
          <div>
            <strong>SKonnection</strong>
            <span>팀을 잇는 곳</span>
          </div>
        </div>

        <label>
          이름
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이선민" />
        </label>

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
            {isFirstLogin ? '비밀번호 설정' : '비밀번호'}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isFirstLogin ? `앞으로 쓸 비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)` : '비밀번호'}
              autoComplete={isFirstLogin ? 'new-password' : 'current-password'}
            />
            {isFirstLogin && (
              <small className="login-hint">👋 처음이면, 여기 입력한 비밀번호가 그대로 등록돼요.</small>
            )}
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

        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-success">{notice}</p>}

        {/*
          로그인과 가입을 한 줄에 둔다. 다만 둘은 성질이 다르다 — 왼쪽은 폼을
          제출하고 오른쪽은 폼의 종류를 바꾼다. 같은 무게로 그리면 가입을
          누르는 순간 신청이 들어간 줄 안다. 제출만 채운 버튼으로 둔다.
        */}
        <div className="login-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mode === 'login' ? (busy ? '확인 중…' : isFirstLogin ? '비밀번호 설정하고 로그인' : '로그인') : '가입 요청'}
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

        {showQuickLogin && (quickLeader || quickMember) && (
          <div className="quick-login">
            <span>빠른 로그인 (데모)</span>
            <div className="quick-login-row">
              {quickLeader && (
                <button type="button" onClick={() => onLogin(toCurrentUser(quickLeader))}>
                  리더 · {quickLeader.name}
                </button>
              )}
              {quickMember && (
                <button type="button" onClick={() => onLogin(toCurrentUser(quickMember))}>
                  팀원 · {quickMember.name}
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
