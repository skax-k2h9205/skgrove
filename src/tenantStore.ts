// 테넌트(팀/회사) 저장소. tenants 테이블을 읽고, 가입 시 초대코드로 테넌트를 찾는다.
import { supabase } from './supabaseClient';

const TENANT_TABLE = 'tenants';

// 기존 팀 = tenant#1. Supabase 미연결(로컬) 환경 폴백.
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export type Tenant = {
  id: string;
  name: string;
  joinCode: string;
  parts: string[]; // 그 팀의 조직 파트 목록(SK teamParts 를 대체)
  allowedDomain?: string; // 옵션: 이메일 도메인 제한
  active: boolean;
};

type TenantRow = {
  id: string;
  name: string;
  join_code: string;
  parts: unknown;
  allowed_domain?: string | null;
  active?: boolean | null;
};

const seedTenant: Tenant = {
  id: DEFAULT_TENANT_ID,
  name: 'SK AI ITS 혁신팀',
  joinCode: 'SK-AITS',
  parts: ['TEST혁신파트', 'ITS혁신파트', 'PM혁신파트'],
  active: true,
};

function tenantFromRow(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    joinCode: row.join_code,
    parts: Array.isArray(row.parts) ? (row.parts as string[]) : [],
    allowedDomain: row.allowed_domain ?? undefined,
    active: row.active ?? true,
  };
}

/** 전체 테넌트 목록(플랫폼 오너 콘솔·현재 테넌트 조회용). 실패 시 시드 1개. */
export async function loadTenants(): Promise<Tenant[]> {
  if (supabase) {
    const { data, error } = await supabase.from(TENANT_TABLE).select('*');
    if (!error && data && data.length) return (data as TenantRow[]).map(tenantFromRow);
  }
  return [seedTenant];
}

export type NewTenantInput = {
  name: string;
  joinCode: string;
  parts: string[];
  allowedDomain?: string;
};

/** 새 테넌트 개설(플랫폼 오너 콘솔). 성공 시 생성된 Tenant, 실패 시 에러 메시지. */
export async function createTenant(
  input: NewTenantInput,
): Promise<{ ok: true; tenant: Tenant } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: '서버가 연결되지 않았어요.' };
  const { data, error } = await supabase
    .from(TENANT_TABLE)
    .insert({
      name: input.name.trim(),
      join_code: input.joinCode.trim(),
      parts: input.parts,
      allowed_domain: input.allowedDomain?.trim() || null,
      active: true,
    })
    .select()
    .single();
  if (error) {
    // 초대코드 유니크 충돌이 가장 흔하다.
    const dup = /duplicate|unique/i.test(error.message);
    return { ok: false, error: dup ? '이미 쓰이는 초대코드예요. 다른 코드를 써주세요.' : error.message };
  }
  return { ok: true, tenant: tenantFromRow(data as TenantRow) };
}

/** 초대코드로 활성 테넌트를 찾는다(가입 화면에서 직접 호출). 없으면 null. */
export async function fetchTenantByJoinCode(code: string): Promise<Tenant | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (supabase) {
    const { data, error } = await supabase
      .from(TENANT_TABLE)
      .select('*')
      .eq('join_code', trimmed)
      .eq('active', true)
      .maybeSingle();
    if (!error && data) return tenantFromRow(data as TenantRow);
    return null;
  }
  // 로컬 폴백: 시드 코드만 통과.
  return trimmed === seedTenant.joinCode ? seedTenant : null;
}
