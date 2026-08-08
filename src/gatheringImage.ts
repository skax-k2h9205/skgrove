// 모임 썸네일 생성 이음새(seam) — 사진을 첨부하지 않은 모임의 대표 이미지를 서버에서 그려온다.
// aiSummarize.ts / intakeReview.ts 와 같은 규약: VITE_GATHERING_IMAGE_ENDPOINT 가 없으면
// 조용히 휴면하고 호출부는 기존 로컬 포스터를 그대로 쓴다.
//
// 프롬프트와 화풍은 프록시(scripts/image-proxy.mjs)가 갖는다. 여기서는 등록값만 넘긴다.
// 화풍을 바꾸려고 프론트를 다시 배포할 이유가 없고, 무엇보다 키가 브라우저로 나가지 않는다.
import type { Gathering } from './types';

function endpoint() {
  return (import.meta.env as Record<string, string | undefined>).VITE_GATHERING_IMAGE_ENDPOINT || undefined;
}

/*
  data URI 를 File 로 바꾼다.
  이렇게 해야 첨부 사진과 똑같이 uploadGatheringImage() 를 태울 수 있다.
  생성 이미지만을 위한 별도 저장 경로를 만들면 버킷 정리·삭제 규칙이 둘로 갈라진다.
*/
export function fileFromDataUri(dataUri: string, name: string): File | null {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUri);
  if (!match) return null;

  const [, mime, base64] = match;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    // 확장자는 실제 형식에서 만든다. 모델이 png 가 아니라 jpeg 를 주는 일이 실제로 있었다.
    const ext = mime.split('/')[1] ?? 'bin';
    return new File([bytes], `${name}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

/**
 * 썸네일을 만들어 File 로 돌려준다.
 * 엔드포인트가 없거나, 생성이 실패하거나, 글자를 못 지웠으면 null —
 * 호출부는 "없으면 기존 포스터" 한 갈래만 다루면 된다.
 */
export async function requestGatheringImage(gathering: Gathering): Promise<File | null> {
  const url = endpoint();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // 프론트는 프롬프트를 조립하지 않고 사실만 넘긴다.
        gathering: {
          kind: gathering.kind,
          title: gathering.title,
          startAt: gathering.startAt,
          place: gathering.place,
          capacity: gathering.capacity,
          desc: gathering.desc,
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; dataUri?: string } | null;
    if (!data?.ok || !data.dataUri) return null;
    return fileFromDataUri(data.dataUri, gathering.id);
  } catch {
    return null;
  }
}
