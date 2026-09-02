import { afterEach, describe, expect, it } from 'vitest';
import { scopeAccountsToTenant } from './accountStore';
import { setCurrentTenantId } from './tenantContext';
import type { ManagedAccount } from './types';

const SK = 'tenant-sk';
const DEMO = 'tenant-demo';

const acc = (name: string, tenantId?: string) =>
  ({ id: name, name, email: `${name}@x`, role: '팀원', part: '전체', status: '활성', joinedAt: '2026-01-01', tenantId }) as ManagedAccount;

afterEach(() => setCurrentTenantId(null));

describe('scopeAccountsToTenant', () => {
  it('로그인 전(테넌트 null)에는 전체를 그대로 둔다(로그인 매칭용)', () => {
    setCurrentTenantId(null);
    const all = [acc('김승현', SK), acc('나윤서', DEMO)];
    expect(scopeAccountsToTenant(all)).toHaveLength(2);
  });

  it('로그인 후에는 다른 테넌트(데모) 계정을 걸러낸다', () => {
    setCurrentTenantId(SK);
    const kept = scopeAccountsToTenant([acc('김승현', SK), acc('나윤서', DEMO)]);
    expect(kept.map((a) => a.name)).toEqual(['김승현']);
  });

  it('테넌트 없는 시스템 계정(관리자 시드)은 남긴다', () => {
    setCurrentTenantId(SK);
    const kept = scopeAccountsToTenant([acc('관리자', undefined), acc('나윤서', DEMO)]);
    expect(kept.map((a) => a.name)).toEqual(['관리자']);
  });
});
