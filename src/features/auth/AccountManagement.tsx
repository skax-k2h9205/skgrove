import { KeyRound, ShieldCheck, UserCheck, UsersRound } from 'lucide-react';
import { userRoles } from '../../auth';
import { useTenantParts } from '../../tenantParts';
import { PanelHeader } from '../../components/PanelHeader';
import type { AccountStatus, ManagedAccount, TeamPart, UserRole } from '../../types';

type AccountManagementProps = {
  accounts: ManagedAccount[];
  onAccountsChange: (accounts: ManagedAccount[]) => void;
  onDelete?: (id: string) => void;
  currentEmail?: string;
};

const ROLE_ORDER: Record<UserRole, number> = { 팀리더: 0, 파트리더: 1, 팀원: 2 };

export function AccountManagement({ accounts, onAccountsChange, onDelete, currentEmail }: AccountManagementProps) {
  const parts = useTenantParts();
  // 팀리더 → 다른 역할로 내릴 때 '전체'는 구체 파트가 필요하다. 이 팀의 첫 파트로 채운다.
  const normalizePart = (part: TeamPart): TeamPart => (part === '전체' ? parts[0] ?? part : part);
  const removeAccount = (account: ManagedAccount) => {
    if (!onDelete) return;
    if (window.confirm(`'${account.name}'(${account.email}) 계정을 삭제할까요? 되돌릴 수 없습니다.`)) {
      onDelete(account.id);
    }
  };
  const updateRole = (id: string, role: UserRole) => {
    onAccountsChange(
      accounts.map((account) =>
        account.id === id ? { ...account, role, part: role === '팀리더' ? '전체' : normalizePart(account.part) } : account,
      ),
    );
  };

  const updatePart = (id: string, part: TeamPart) => {
    onAccountsChange(accounts.map((account) => (account.id === id ? { ...account, part } : account)));
  };

  const updateStatus = (id: string, status: AccountStatus) => {
    onAccountsChange(accounts.map((account) => (account.id === id ? { ...account, status } : account)));
  };

  const updateConnectioner = (id: string, connectioner: boolean) => {
    onAccountsChange(accounts.map((account) => (account.id === id ? { ...account, connectioner } : account)));
  };

  const updateSlackEmail = (id: string, slackEmail: string) => {
    onAccountsChange(
      accounts.map((account) => (account.id === id ? { ...account, slackEmail: slackEmail.trim() || undefined } : account)),
    );
  };

  const pendingCount = accounts.filter((account) => account.status === '승인 대기').length;
  const leaderCount = accounts.filter((account) => account.role !== '팀원').length;
  const connectionerCount = accounts.filter((account) => account.connectioner).length;

  // 권한(팀리더>파트리더>팀원) → 파트 → 이름 순으로 정렬. 가입 순서(joined_at)라 뒤섞여 보이던 걸 정리한다.
  const sortedAccounts = [...accounts].sort((a, b) => {
    const roleDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (roleDiff !== 0) return roleDiff;
    const partDiff = a.part.localeCompare(b.part, 'ko');
    if (partDiff !== 0) return partDiff;
    return a.name.localeCompare(b.name, 'ko');
  });

  return (
    <section className="screen">
      <div className="account-summary">
        <div>
          <UsersRound size={22} />
          <span>가입 계정</span>
          <strong>{accounts.length}</strong>
        </div>
        <div>
          <ShieldCheck size={22} />
          <span>리더 권한</span>
          <strong>{leaderCount}</strong>
        </div>
        <div>
          <UserCheck size={22} />
          <span>승인 대기</span>
          <strong>{pendingCount}</strong>
        </div>
        <div>
          <KeyRound size={22} />
          <span>커넥셔너</span>
          <strong>{connectionerCount}</strong>
        </div>
      </div>

      <section className="panel">
        <PanelHeader icon={UsersRound} title="가입 계정 관리" />
        <p className="account-hint">
          권한·파트·상태·커넥셔너는 바꾸는 즉시 저장됩니다. 슬랙 이메일은 입력 후 다른 곳을 클릭하면 저장되고, <b>등록한 사람에게만</b>{' '}
          슬랙 DM이 발송됩니다(미등록 시 인앱 알림만).
        </p>
        <div className="account-table">
          <div className="account-table-head">
            <span>계정</span>
            <span>권한</span>
            <span>파트</span>
            <span>상태</span>
            <span>커넥셔너</span>
          </div>
          {sortedAccounts.map((account) => (
            <div className="account-row" key={account.id}>
              <div>
                <strong>{account.name}</strong>
                <span>
                  {account.email} · {account.joinedAt}
                </span>
                <input
                  key={account.id}
                  className="account-slack-email"
                  aria-label={`${account.name} 슬랙 이메일`}
                  defaultValue={account.slackEmail ?? ''}
                  placeholder="슬랙 이메일(입력해야 DM 발송됨)"
                  onBlur={(event) => updateSlackEmail(account.id, event.target.value)}
                />
              </div>
              <select
                aria-label={`${account.name} 권한`}
                value={account.role}
                onChange={(event) => updateRole(account.id, event.target.value as UserRole)}
              >
                {userRoles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
              {account.role === '팀리더' ? (
                <span className="part-static">전체</span>
              ) : (
                <select
                  aria-label={`${account.name} 소속 파트`}
                  value={account.part}
                  onChange={(event) => updatePart(account.id, event.target.value as TeamPart)}
                >
                  {parts.map((part) => (
                    <option key={part}>{part}</option>
                  ))}
                </select>
              )}
              <select
                aria-label={`${account.name} 계정 상태`}
                value={account.status}
                onChange={(event) => updateStatus(account.id, event.target.value as AccountStatus)}
              >
                <option>승인 대기</option>
                <option>활성</option>
                <option>비활성</option>
              </select>
              <label className={account.connectioner ? 'connectioner-toggle on' : 'connectioner-toggle'}>
                <input
                  type="checkbox"
                  aria-label={`${account.name} 커넥셔너 전권`}
                  checked={account.connectioner ?? false}
                  onChange={(event) => updateConnectioner(account.id, event.target.checked)}
                />
              </label>
              {onDelete && account.email !== currentEmail && (
                <button
                  type="button"
                  className="account-delete"
                  aria-label={`${account.name} 계정 삭제`}
                  onClick={() => removeAccount(account)}
                  style={{ color: '#dc2626', border: '1px solid #f0999599', background: '#fef2f2', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

