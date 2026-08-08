// 이음장터 썸네일 생성 이음새(seam) — 사진을 첨부하지 않은 물건의 대표 이미지를 서버에서 그려온다.
// gatheringImage.ts 와 같은 규약: VITE_MARKET_IMAGE_ENDPOINT 가 없으면 조용히 휴면하고
// 호출부는 기존 로컬 포스터(ItemPoster)를 그대로 쓴다.
//
// 서버 함수(api/gathering-image)는 모임과 물건을 함께 처리한다. 물건은 { item } 형태로 보내면
// '사물 하나를 크레파스로' 그려 돌려준다. 화풍은 서버가 갖고, 프론트는 사실만 넘긴다.
// data URI → File 변환은 gatheringImage 와 공유한다(첨부 사진과 같은 업로드 경로를 태우려고).
import { fileFromDataUri } from './gatheringImage';
import type { MarketItem } from './types';

function endpoint() {
  return (import.meta.env as Record<string, string | undefined>).VITE_MARKET_IMAGE_ENDPOINT || undefined;
}

/**
 * 물건 썸네일을 만들어 File 로 돌려준다.
 * 엔드포인트가 없거나, 생성이 실패하거나, 글자를 못 지웠으면 null —
 * 호출부는 "없으면 로컬 포스터" 한 갈래만 다루면 된다.
 */
export async function requestMarketImage(item: MarketItem): Promise<File | null> {
  const url = endpoint();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // 프론트는 프롬프트를 조립하지 않고 사실만 넘긴다. kind 로 나눔/경매를 구분하지만
        // 그림은 사물 자체라 kind 가 그림을 바꾸지는 않는다(서버가 참고만 한다).
        item: {
          kind: item.kind,
          title: item.title,
          desc: item.desc,
          place: item.place,
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; dataUri?: string } | null;
    if (!data?.ok || !data.dataUri) return null;
    return fileFromDataUri(data.dataUri, item.id);
  } catch {
    return null;
  }
}
