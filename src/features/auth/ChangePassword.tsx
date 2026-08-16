import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// 로그인 상태에서 본인 비밀번호를 바꾼다(Supabase Auth updateUser).
// 임시 비번으로 처음 들어온 팀원이 마이페이지에서 바로 바꿀 수 있게 한다.
const MIN_PASSWORD_LENGTH = 6;

export function ChangePassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    if (pw.length < MIN_PASSWORD_LENGTH) {
      setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`);
      return;
    }
    if (pw !== pw2) {
      setError('두 비밀번호가 서로 달라요.');
      return;
    }
    if (!supabase) {
      setError('로그인 서버가 설정되지 않았어요.');
      return;
    }
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password: pw });
      if (e) {
        setError(e.message || '비밀번호를 바꾸지 못했어요.');
        return;
      }
      setPw('');
      setPw2('');
      setNotice('비밀번호를 바꿨어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card change-password">
      <h3>
        <KeyRound size={18} /> 비밀번호 변경
      </h3>
      <p className="change-password-lead">임시 비밀번호로 로그인했다면 여기서 바꿔주세요.</p>
      <form onSubmit={submit}>
        <label>
          새 비밀번호
          <input type="password" value={pw} autoComplete="new-password" onChange={(e) => setPw(e.target.value)} placeholder={`${MIN_PASSWORD_LENGTH}자 이상`} />
        </label>
        <label>
          새 비밀번호 확인
          <input type="password" value={pw2} autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} placeholder="한 번 더" />
        </label>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-success">{notice}</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? '변경 중…' : '비밀번호 바꾸기'}
        </button>
      </form>
    </section>
  );
}
