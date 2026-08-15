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
