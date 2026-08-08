/*
  뽑는 동안 무대를 덮는 춤추는 동물 영상.

  왜 필요했나: 뽑기가 1.28초 만에 끝나서 "누가 걸리나" 하는 시간이 없었다.
  3D 무대는 그 간극을 못 메운다 — 1초 남짓 도는 조각은 결과를 꾸미는 장식이지
  긴장을 만드는 장치가 아니다. 긴장은 영상이 만들고, 결과는 3D 가 낸다.

  캔버스를 언마운트하지 않고 그 위를 덮는 이유는 drawScene.ts 서두에 있다 —
  뽑을 때마다 3D 를 껐다 켜면 WebGL 컨텍스트가 쌓이다 브라우저 한도에 걸린다.
*/
import { useEffect, useRef, useState } from 'react';

export const HYPE_CLIPS = ['cat', 'hippo'] as const;
export type HypeClip = (typeof HYPE_CLIPS)[number];

/** 뽑기를 시작할 때 한 번 부른다. 회차마다 달라야 반복해서 써도 견딘다. */
export function pickHypeClip(): HypeClip {
  return HYPE_CLIPS[Math.floor(Math.random() * HYPE_CLIPS.length)];
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type DrawHypeProps = {
  /** 뽑는 중인가. 꺼지면 200ms 에 걷히고 밑의 3D 가 드러난다. */
  active: boolean;
  /** 이번 회차에 고를 영상. 시작 순간에 정해져 재생 내내 바뀌지 않는다. */
  clip: HypeClip | null;
};

export function DrawHype({ active, clip }: DrawHypeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // 파일을 못 읽는 브라우저(webm 미지원)에서는 조용히 사라진다. 영상이 없어도 뽑기는 된다.
  const [broken, setBroken] = useState(false);
  const [allowed] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (!active) {
      video.pause();
      return undefined;
    }

    /* 첫 뽑기에서는 이 효과가 파일이 도착하기 전에 돈다. 그때 currentTime 을
       건드리면 재생 요청이 끊겨 영상이 첫 프레임에 멈춘 채로 남는다 —
       "포스터가 떠 있으니 됐다" 로 보여서 놓치기 쉬운 자리다.
       실제로 밟았고, 그래서 준비된 뒤에 시작한다. */
    const start = () => {
      if (video.readyState >= 1) video.currentTime = 0;
      // 자동재생이 막혀도 포스터는 남으므로 실패는 삼킨다.
      void video.play().catch(() => undefined);
    };

    if (video.readyState >= 2) {
      start();
      return undefined;
    }
    video.addEventListener('loadeddata', start, { once: true });
    return () => video.removeEventListener('loadeddata', start);
  }, [active, clip]);

  if (!allowed || broken || !clip) return null;

  return (
    <video
      aria-hidden="true"
      className={active ? 'draw-hype on' : 'draw-hype'}
      loop
      muted
      onError={() => setBroken(true)}
      playsInline
      poster={`/hype/${clip}.jpg`}
      ref={videoRef}
      src={`/hype/${clip}.webm`}
    />
  );
}
