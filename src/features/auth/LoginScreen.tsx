import { FormEvent, useEffect, useState } from 'react';
import { HeartHandshake, LogIn, UserPlus, KeyRound, ShieldCheck, Slack } from 'lucide-react';
import { teamParts, isCompanyEmail } from '../../auth';
import { supabase } from '../../supabaseClient';
import { fetchTenantByJoinCode, type Tenant } from '../../tenantStore';
import type { TeamPart } from '../../types';

// 새 비밀번호의 최소 길이. 너무 짧으면 금방 뚫린다.
const MIN_PASSWORD_LENGTH = 6;

// Slack 로그인 노출 시에만 쓰는 지원 브라우저 안내(Slack이 구버전 브라우저를 막아서).
const SUPPORTED_BROWSERS = 'Chrome 137+ · Edge 136+ · Firefox 139+ · Safari 26+';

// 인증은 6자리 코드 방식(OTP). 회사메일 보안이 링크를 미리 열어 토큰을 태워버리는 문제를
// 코드 입력으로 피한다.
//  login        : 이메일+비번 로그인
//  signup       : 이름·메일·비번·파트 입력 → 확인 코드 발송
//  verify-signup: 발송된 6자리 코드 입력 → 인증 완료 → 로그인
//  reset        : 메일 입력 → 재설정 코드 발송
//  verify-reset : 코드 + 새 비번 입력 → 재설정 완료 → 로그인
type View = 'login' | 'signup' | 'verify-signup' | 'reset' | 'verify-reset';

type LoginScreenProps = {
  // Slack 로그인 시작. undefined면 버튼을 숨긴다(기본 숨김 — 이메일 인증이 주 경로).
  onSlackLogin?: () => void;
  // App이 세션→계정 해석 중 막은 사유(비활성·비사내 등)를 표시.
  authError?: string;
};

export function LoginScreen({ onSlackLogin, authError }: LoginScreenProps) {
  const [view, setView] = useState<View>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [part, setPart] = useState<TeamPart>('TEST혁신파트');
  // 가입 초대코드 + 그 코드로 확정된 테넌트(팀). 파트 선택지도 이 팀 것으로 바뀐다.
  const [joinCode, setJoinCode] = useState('');
  const [resolvedTenant, setResolvedTenant] = useState<Tenant | null>(null);
  // 초대 링크(?join=코드)로 팀이 확정된 경우 코드칸 대신 확인 배지만 보여준다.
  const [linkLocked, setLinkLocked] = useState(false);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (next: View, keepNotice = false) => {
    setView(next);
    setError('');
    if (!keepNotice) setNotice('');
    setCode('');
  };

  // 초대 링크(?join=코드)로 들어오면 코드를 자동 채우고 가입 화면으로. 팀이 확정되면
  // 코드칸을 숨기고(확인 배지) 파트도 그 팀 것으로. 링크가 유효하지 않으면 수동 입력으로 폴백.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const jc = new URLSearchParams(window.location.search).get('join');
    if (!jc) return;
    setJoinCode(jc);
    setView('signup');
    fetchTenantByJoinCode(jc).then((t) => {
      if (!t) return;
      setResolvedTenant(t);
      setLinkLocked(true);
      if (t.parts.length) setPart(t.parts[0] as TeamPart);
    });
  }, []);

  // 초대코드를 입력/이탈하면 그 팀을 조회해 파트 선택지를 그 팀 것으로 바꾼다.
  const resolveTenant = async () => {
    const t = await fetchTenantByJoinCode(joinCode);
    setResolvedTenant(t);
    if (t && t.parts.length && !t.parts.includes(part)) setPart(t.parts[0] as TeamPart);
  };

  // 가입 파트 선택지: 확정된 팀의 파트, 없으면 기본(SK) 파트.
  const partOptions: readonly string[] = resolvedTenant?.parts.length ? resolvedTenant.parts : teamParts;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!supabase) {
      setError('로그인 서버가 설정되지 않았어요. 관리자에게 문의해 주세요.');
      return;
    }
    setError('');
    setNotice('');
    const em = email.trim().toLowerCase();
    // 로그인/재설정은 기존 사내(@sk.com) 게이트 유지. 가입은 초대코드로 정해진 팀의
    // allowedDomain 규칙을 따르므로 여기서 걸지 않는다(가입 분기에서 검사).
    if ((view === 'login' || view === 'reset') && !isCompanyEmail(em)) {
      setError('사내메일은 @sk.com 계정만 사용할 수 있어요.');
      return;
    }
    setBusy(true);
    try {
      // ── 로그인 ──
      if (view === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: em, password });
        if (e) {
          setError(/confirm/i.test(e.message) ? '메일 인증이 아직이에요. 가입 후 받은 코드로 인증해 주세요.' : '이메일 또는 비밀번호가 올바르지 않아요.');
        }
        // 성공하면 App의 onAuthStateChange 가 세션→계정→로그인까지 처리한다.
        return;
      }

      // ── 가입: 확인 코드 발송 ──
      if (view === 'signup') {
        if (!name.trim()) {
          setError('이름을 입력해주세요.');
          return;
        }
        // 초대코드로 팀 확정(이탈 시 이미 잡아뒀으면 재사용).
        const tenant = resolvedTenant ?? (await fetchTenantByJoinCode(joinCode));
        if (!tenant) {
          setError('초대코드가 올바르지 않아요. 팀 관리자에게 코드를 확인해 주세요.');
          setResolvedTenant(null);
          return;
        }
        if (tenant.allowedDomain && !em.endsWith(`@${tenant.allowedDomain}`)) {
          setError(`이 팀은 @${tenant.allowedDomain} 이메일만 가입할 수 있어요.`);
          return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
          setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`);
          return;
        }
        const { data, error: e } = await supabase.auth.signUp({
          email: em,
          password,
          // 이름·파트·테넌트를 metadata 로 넘겨, 확인 후 첫 로그인 때 그 팀 계정으로 생성.
          options: { data: { full_name: name.trim(), part, tenant_id: tenant.id } },
        });
        if (e) {
          setError(e.message);
          return;
        }
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError('이미 가입된 사내메일이에요. 로그인하거나 비밀번호 찾기를 이용해주세요.');
          setView('login');
          return;
        }
        setView('verify-signup');
        setNotice('메일로 6자리 인증 코드를 보냈어요. 코드를 입력해 주세요.');
        return;
      }

      // ── 가입 코드 확인 ──
      if (view === 'verify-signup') {
        if (!code.trim()) {
          setError('인증 코드를 입력해 주세요.');
          return;
        }
        const { error: e } = await supabase.auth.verifyOtp({ email: em, token: code.trim(), type: 'signup' });
        if (e) {
          setError('코드가 올바르지 않거나 만료됐어요. 다시 확인해 주세요.');
          return;
        }
        // 인증 성공 → 세션 생성 → App이 계정 만들고 홈으로.
        return;
      }

      // ── 재설정: 코드 발송 ──
      if (view === 'reset') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(em);
        if (e) {
          setError(e.message);
          return;
        }
        setView('verify-reset');
        setNotice('가입된 계정이라면 6자리 재설정 코드를 보냈어요. 코드와 새 비밀번호를 입력해 주세요.');
        return;
      }

      // ── 재설정 코드 확인 + 새 비번 ──
      if (view === 'verify-reset') {
        if (!code.trim()) {
          setError('인증 코드를 입력해 주세요.');
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
        const { error: e } = await supabase.auth.verifyOtp({ email: em, token: code.trim(), type: 'recovery' });
        if (e) {
          setError('코드가 올바르지 않거나 만료됐어요. 다시 확인해 주세요.');
          return;
        }
        // 복구 세션에서 새 비밀번호 확정 → 그대로 로그인 상태로 홈 진입.
        const { error: e2 } = await supabase.auth.updateUser({ password: newPw });
        if (e2) {
          setError('비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  const isCode = view === 'verify-signup' || view === 'verify-reset';
  const primaryLabel = busy
    ? '처리 중…'
    : view === 'login'
      ? '로그인'
      : view === 'signup'
        ? '인증 코드 받기'
        : view === 'verify-signup'
          ? '코드 확인하고 시작하기'
          : view === 'reset'
            ? '재설정 코드 받기'
            : '비밀번호 바꾸기';

  return (
    <main className="login-page">
      <form aria-label="사내 계정 인증" className="login-panel" onSubmit={submit}>
        <div className="brand login-brand">
          <div className="brand-mark" title="SKonnection">
            <HeartHandshake size={24} />
          </div>
          <div>
            <strong>SKonnection</strong>
            <span>팀을 잇는 곳</span>
          </div>
        </div>

        {(view === 'reset' || view === 'verify-reset') && (
          <div className="role-note">
            <strong>
              <KeyRound size={15} /> 비밀번호 재설정
            </strong>
            <span>사내메일로 6자리 코드를 보내드려요. 코드로 새 비밀번호를 정합니다.</span>
          </div>
        )}
        {view === 'verify-signup' && (
          <div className="role-note">
            <strong>
              <ShieldCheck size={15} /> 이메일 인증
            </strong>
            <span>메일로 받은 6자리 코드를 입력하면 가입이 완료돼요.</span>
          </div>
        )}

        {view === 'signup' && (
          <>
            {linkLocked && resolvedTenant ? (
              // 초대 링크로 팀이 확정됨 → 코드 입력 없이 확인만.
              <div className="role-note">
                <strong>{resolvedTenant.name}</strong>
                <span>초대 링크로 이 팀에 가입합니다.</span>
              </div>
            ) : (
              <label>
                초대코드
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onBlur={resolveTenant}
                  placeholder="팀 관리자에게 받은 코드"
                />
                {resolvedTenant && <span className="field-ok">{resolvedTenant.name}으로 가입합니다</span>}
              </label>
            )}
            <label>
              이름
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이선민" />
            </label>
          </>
        )}

        {/* 이메일: 코드 입력 단계에서는 읽기전용으로 어떤 계정인지만 보여준다. */}
        {(view === 'login' || view === 'signup' || view === 'reset') ? (
          <label>
            사내메일
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@sk.com" autoComplete="email" />
          </label>
        ) : (
          <label>
            사내메일
            <input type="email" value={email} readOnly />
          </label>
        )}

        {isCode && (
          <label>
            인증 코드
            <input value={code} inputMode="numeric" autoComplete="one-time-code" onChange={(e) => setCode(e.target.value)} placeholder="메일로 받은 6자리" />
          </label>
        )}

        {(view === 'login' || view === 'signup') && (
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={view === 'signup' ? `${MIN_PASSWORD_LENGTH}자 이상` : '비밀번호'}
              autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
            />
            {view === 'login' && (
              <button type="button" className="login-link" onClick={() => go('reset')}>
                비밀번호를 잊으셨나요?
              </button>
            )}
          </label>
        )}

        {view === 'verify-reset' && (
          <>
            <label>
              새 비밀번호
              <input type="password" value={newPw} autoComplete="new-password" onChange={(e) => setNewPw(e.target.value)} placeholder={`${MIN_PASSWORD_LENGTH}자 이상`} />
            </label>
            <label>
              새 비밀번호 확인
              <input type="password" value={newPw2} autoComplete="new-password" onChange={(e) => setNewPw2(e.target.value)} placeholder="한 번 더" />
            </label>
          </>
        )}

        {view === 'signup' && (
          <>
            <label>
              소속 파트
              <select value={part} onChange={(e) => setPart(e.target.value as TeamPart)}>
                {partOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </>
        )}

        {(error || authError) && <p className="form-error">{error || authError}</p>}
        {notice && <p className="form-success">{notice}</p>}

        <div className="login-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {view === 'login' ? <LogIn size={18} /> : view === 'signup' ? <UserPlus size={18} /> : <ShieldCheck size={18} />}
            {primaryLabel}
          </button>
          {/* 보조 버튼: 코드/재설정 단계는 '취소', 기본은 로그인↔가입 전환 */}
          {isCode || view === 'reset' ? (
            <button className="secondary-button" type="button" onClick={() => go('login')}>
              취소
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={() => go(view === 'login' ? 'signup' : 'login')}>
              {view === 'login' ? '가입' : '로그인으로'}
            </button>
          )}
        </div>

        {/* Slack 로그인은 기본 숨김(보존). onSlackLogin 이 있을 때만 노출. */}
        {onSlackLogin && view === 'login' && (
          <>
            <div className="login-divider" aria-hidden="true">
              <span>또는</span>
            </div>
            <button type="button" className="primary-button slack-login-button" onClick={onSlackLogin}>
              <Slack size={18} /> Slack으로 로그인
            </button>
            <div className="login-note">
              <p className="login-note-browsers">지원 브라우저 · {SUPPORTED_BROWSERS}</p>
              <p className="login-note-fallback">안 되면 브라우저를 업데이트하거나 Chrome을 사용하세요.</p>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
