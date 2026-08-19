// 현재 로그인한 사용자의 테넌트 id 를 모듈 레벨로 보관한다.
// prop 드릴 없이 스토어(remoteTable 등)가 쓰기 시 tenant_id 를 스탬핑할 수 있게 하기 위함.
// 로그인/로그아웃 시 App 이 setCurrentTenantId 로 세팅한다.
let currentTenantId: string | null = null;

export function setCurrentTenantId(id: string | null) {
  currentTenantId = id ?? null;
}

export function getCurrentTenantId(): string | null {
  return currentTenantId;
}

// 읽기(select)를 현재 테넌트로 스코프한다. 테넌트가 정해진 뒤에만(로그인 후) 필터를 걸어,
// 로그인 전 계정 매칭용 로드는 전체를 읽게 둔다. select 직후·order 이전에 감싸 쓴다:
//   withTenant(supabase.from(T).select('*')).order(...)
export function withTenant<T>(query: T): T {
  if (!currentTenantId) return query;
  // 빌더의 .eq 는 같은 타입을 돌려준다. 자기참조 제네릭 제약은 Supabase 빌더 타입과
  // 만나면 TS 무한 재귀(TS2589)를 내므로, 캐스팅으로 호출하고 반환 타입만 보존한다.
  const q = query as unknown as { eq(column: string, value: string): T };
  return q.eq('tenant_id', currentTenantId);
}

// 스토리지 업로드 경로를 테넌트 폴더로 감싼다 — `${tenantId}/<원래 경로>`.
// Stage 2b 스토리지 정책이 foldername[1] = 테넌트로 격리하는 것과 짝을 이룬다.
// 로그인 전(테넌트 미확정)엔 기본 테넌트(#1) 폴더로 — tenantStore.DEFAULT_TENANT_ID 와 동일.
export function tenantPath(subpath: string): string {
  const tid = currentTenantId ?? '00000000-0000-0000-0000-000000000001';
  return `${tid}/${subpath}`;
}
