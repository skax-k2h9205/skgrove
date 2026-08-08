import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HYPE_CLIPS } from './DrawHype';

/*
  뽑기 영상은 코드가 경로를 문자열로 조립해서 가져온다(`/hype/${clip}.webm`).
  번들러가 확인해 주지 않으므로, 파일 이름이 어긋나면 빌드도 타입검사도 통과하고
  화면에서만 조용히 까맣게 나온다. 그 어긋남을 여기서 잡는다.
*/
const publicDir = fileURLToPath(new URL('../../../public/hype/', import.meta.url));

// 첫 화면에서 받는 파일이다. 크게 만들어 놓고 잊지 않도록 상한을 박아 둔다.
const MAX_CLIP_BYTES = 300 * 1024;

describe('뽑기 긴장 영상', () => {
  it.each(HYPE_CLIPS)('%s 의 영상과 포스터가 모두 있다', (clip) => {
    expect(existsSync(`${publicDir}${clip}.webm`), `${clip}.webm 없음`).toBe(true);
    expect(existsSync(`${publicDir}${clip}.jpg`), `${clip}.jpg 없음`).toBe(true);
  });

  it.each(HYPE_CLIPS)('%s 가 상한보다 가볍다', (clip) => {
    expect(statSync(`${publicDir}${clip}.webm`).size).toBeLessThanOrEqual(MAX_CLIP_BYTES);
  });
});
