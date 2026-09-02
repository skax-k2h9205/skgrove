// localStorage 콘텐츠 캐시를 테넌트별로 격리한다.
//
// 캐시 키(skgrove:*)는 테넌트 구분이 없어 한 기기에서 여러 팀(테넌트) 계정을 오가면
// 이전 테넌트의 캐시가 다음 테넌트 화면에 샐 수 있다(예: 데모 팀 안건이 SK 안건함에 뜸).
// 특히 DB 읽기가 실패하면 스토어가 이 낡은 캐시를 그대로 돌려주므로 더 두드러진다.
//
// 그래서 '현재 캐시가 속한 테넌트'를 마커로 남기고, 로그인한 테넌트가 그와 다르면
// skgrove: 콘텐츠 캐시를 전부 비운다. 같은 테넌트면 그대로 둔다(오프라인 복원력 유지).
// 세션 내 원격 스냅샷(remoteTable)도 테넌트 경계에서 함께 잊는다.
import { forgetRemote } from './remoteTable';

const CACHE_TENANT_KEY = 'skgrove:cacheTenant';

export function scopeCachesToTenant(tenantId: string | null): void {
  if (!tenantId) return; // 로그인 전(테넌트 미정)에는 손대지 않는다.
  try {
    if (localStorage.getItem(CACHE_TENANT_KEY) === tenantId) return; // 같은 팀 → 유지

    // 테넌트가 바뀌었거나(다른 팀 로그인) 마커가 없다(최초/업그레이드) → 캐시 격리.
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('skgrove:') && key !== CACHE_TENANT_KEY) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(CACHE_TENANT_KEY, tenantId);
    forgetRemote(); // 이전 테넌트의 세션 스냅샷으로 잘못 동기화하지 않도록 초기화
  } catch {
    /* localStorage 접근 불가 시 무시 — 캐시는 없어도 DB 로드로 채워진다. */
  }
}
