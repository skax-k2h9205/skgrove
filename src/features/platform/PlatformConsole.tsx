import { FormEvent, useState } from 'react';
import { Building2, Copy, Check } from 'lucide-react';
import type { Tenant, NewTenantInput } from '../../tenantStore';

// 플랫폼 오너 콘솔 — 여러 테넌트(팀/회사)를 한눈에 보고, 새 팀을 개설하고, 초대 링크를 복사한다.
type PlatformConsoleProps = {
  tenants: Tenant[];
  onCreate: (input: NewTenantInput) => Promise<{ ok: true; tenant: Tenant } | { ok: false; error: string }>;
};

const origin = typeof window !== 'undefined' ? window.location.origin : '';
const inviteLink = (joinCode: string) => `${origin}/?join=${encodeURIComponent(joinCode)}`;

export function PlatformConsole({ tenants, onCreate }: PlatformConsoleProps) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [partsText, setPartsText] = useState('');
  const [allowedDomain, setAllowedDomain] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (joinCode: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(joinCode));
      setCopied(joinCode);
      window.setTimeout(() => setCopied((c) => (c === joinCode ? null : c)), 1500);
    } catch {
      setError('클립보드 복사에 실패했어요. 링크를 직접 선택해 복사해주세요.');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    const parts = partsText
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!name.trim() || !joinCode.trim()) {
      setError('팀 이름과 초대코드는 필수예요.');
      return;
    }
    if (parts.length === 0) {
      setError('소속 파트를 최소 1개 이상 쉼표로 구분해 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const r = await onCreate({ name, joinCode, parts, allowedDomain });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNotice(`"${r.tenant.name}" 팀을 만들었어요. 초대 링크를 공유하세요.`);
      setName('');
      setJoinCode('');
      setPartsText('');
      setAllowedDomain('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="board platform-console">
      <div className="board-head">
        <h2>
          <Building2 size={20} /> 플랫폼 관리
        </h2>
        <p>여러 팀(테넌트)을 개설하고 초대 링크로 온보딩합니다. 각 팀은 자기 데이터·설정을 따로 관리해요.</p>
      </div>

      {/* 새 팀 개설 */}
      <form className="card platform-create" onSubmit={submit}>
        <h3>새 팀 개설</h3>
        <div className="platform-create-grid">
          <label>
            팀 이름
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="○○ 관계사 혁신팀" />
          </label>
          <label>
            초대코드
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="예: ACME-01" />
          </label>
          <label>
            소속 파트 (쉼표로 구분)
            <input value={partsText} onChange={(e) => setPartsText(e.target.value)} placeholder="개발파트, 기획파트, 디자인파트" />
          </label>
          <label>
            허용 이메일 도메인 (선택)
            <input value={allowedDomain} onChange={(e) => setAllowedDomain(e.target.value)} placeholder="예: acme.com (비우면 제한 없음)" />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-success">{notice}</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? '만드는 중…' : '팀 만들기'}
        </button>
      </form>

      {/* 테넌트 목록 */}
      <div className="card">
        <h3>팀 목록 ({tenants.length})</h3>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>팀 이름</th>
                <th>초대코드</th>
                <th>파트</th>
                <th>초대 링크</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.name}
                    {!t.active && <span className="pill-off"> (정지)</span>}
                  </td>
                  <td><code>{t.joinCode}</code></td>
                  <td>{t.parts.join(', ')}</td>
                  <td>
                    <button type="button" className="secondary-button copy-link" onClick={() => copy(t.joinCode)}>
                      {copied === t.joinCode ? <Check size={15} /> : <Copy size={15} />}
                      {copied === t.joinCode ? '복사됨' : '링크 복사'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
