// 내 캐릭터 그림 이음새(seam) — gatheringImage.ts 와 같은 규약.
// 프롬프트·화풍·키는 전부 서버(api/gathering-image.ts)에 있다. 여기서는 프로필 값만 넘긴다.
// 엔드포인트가 없으면 조용히 휴면하고, 호출부는 "캐릭터 없음"(이니셜 폴백) 한 갈래만 다룬다.
import { fileFromDataUri } from './gatheringImage';
import type { Profile } from './types';

function endpoint() {
  return (import.meta.env as Record<string, string | undefined>).VITE_GATHERING_IMAGE_ENDPOINT || undefined;
}

/** 캐릭터를 만들 만큼 값이 찼는가. 최소한 '어떤 모습'은 골라야 한다. */
export function canMakeCharacter(profile: Pick<Profile, 'avatarKind'>): boolean {
  return Boolean(profile.avatarKind);
}

/**
 * 캐릭터 그림을 만들어 File 로 돌려준다.
 * 실패(휴면·생성 실패·글자 못 지움)는 전부 null — 화면은 캐릭터 없이도 성립한다.
 */
export async function requestCharacterImage(profile: Profile): Promise<File | null> {
  const url = endpoint();
  if (!url || !canMakeCharacter(profile)) return null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          avatarKind: profile.avatarKind,
          color: profile.color,
          trait: profile.trait,
          deskItem: profile.deskItem,
          intoLately: profile.intoLately,
          energyTime: profile.energyTime,
        },
      }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { ok?: boolean; dataUri?: string };
    if (!data.ok || !data.dataUri) return null;

    // 파일명에 이름을 쓰지 않는다 — 버킷 경로가 그대로 공개 URL 이 되기 때문이다.
    return fileFromDataUri(data.dataUri, `character-${Date.now()}`);
  } catch {
    return null;
  }
}
