// 옛 번들 탭을 최신 코드로 자동 갱신한다.
//
// 왜 필요한가: DB 를 공유하므로, 오래 켜둔 탭 하나가 옛 로직으로 계정을 저장하면 전체가
// 영향받는다. 실제로 두 번 겪었다 — (1) 옛 loadAccounts 가 로드 때 전체를 되저장해 계정
// 사진이 통째로 사라졌고, (2) 옛 ensureAdminAccount 가 이선민을 팀리더로 강제해, 팀원으로
// 바꿔도 옛 탭이 열릴 때마다 원복됐다. 코드는 고쳤지만 '옛 탭'이 남아 있으면 다시 벌어진다.
//
// 방법: 배포 식별자(/api/version)가 부팅 시점과 달라지면 스스로 새로고침한다. 조작 중
// 방해를 줄이려 '탭에 돌아올 때'와 '배경일 때'에만 실행한다(포그라운드 입력 중엔 안 끊는다).

async function liveVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    // 네트워크 실패는 무시한다. 되돌리는 것보다 안 되돌리는 쪽이 안전하다.
    return null;
  }
}

/**
 * 계속 보고 있는 탭에는 새로고침을 강요하지 않는다 — 쓰던 글이 날아간다.
 * 대신 눈에 띄는 띠를 띄워 사용자가 직접 누르게 한다.
 */
function showStaleBanner() {
  if (document.getElementById('version-stale-banner')) return;

  const bar = document.createElement('div');
  bar.id = 'version-stale-banner';
  bar.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.textContent = '새 버전이 배포됐어요. 새로고침해야 최신 데이터로 저장됩니다.';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '새로고침';
  button.addEventListener('click', () => window.location.reload());

  bar.append(text, button);
  document.body.appendChild(bar);
}

export async function startVersionWatch() {
  const boot = await liveVersion();
  // 로컬(dev)이거나 식별자를 못 얻으면 비활성 — 헛된 새로고침을 만들지 않는다.
  if (!boot || boot === 'dev') return;

  let reloading = false;
  const isStale = async () => {
    const live = await liveVersion();
    return Boolean(live && live !== boot);
  };

  const reloadIfStale = async () => {
    if (reloading) return;
    if (await isStale()) {
      reloading = true;
      window.location.reload();
    }
  };

  // 오래 켜둔 탭이 주 원인이다. 다시 볼 때 갱신하면, 사용자가 옛 코드로 뭔가 하기 전에 최신화된다.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reloadIfStale();
  });

  /*
    예전에는 배경 탭만 검사했다. 그러면 모니터에 계속 띄워둔 탭은 아무리 오래돼도
    갱신되지 않는다 — 옛 번들이 공유 DB 를 되돌리는 사고가 실제로 그 탭에서 났다.
    이제 포그라운드도 같은 주기로 보되, 처리 방식만 가른다:
      · 배경  → 조용히 새로고침 (끊길 입력이 없다)
      · 포그라운드 → 띠로 알리고 판단은 사용자에게 (쓰던 글을 날리지 않는다)
  */
  window.setInterval(() => {
    void (async () => {
      if (reloading || !(await isStale())) return;
      if (document.hidden) {
        reloading = true;
        window.location.reload();
      } else {
        showStaleBanner();
      }
    })();
  }, 5 * 60 * 1000);
}
