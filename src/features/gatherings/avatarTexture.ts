/*
  프로필 사진을 3D 원반에 입히기 위한 텍스처.

  Avatar 컴포넌트와 같은 철학을 3D 에도 그대로 가져온다: 사진 URL 이 사내망 전용
  (telinfo 등)이라 사외·배포에서 자주 실패한다. 그래서 **먼저 색 원 + 이니셜을 동기로
  그려 두고**, 사진이 뜨면 그 위에 원형으로 덮어 그린다. 실패하면 이니셜이 그대로 남는다.
  로드 실패 시 아예 그리지 않으므로 캔버스가 CORS 로 오염(tainted)되지도 않는다.
*/
import * as THREE from 'three';

// 아바타 색 이름 → hex. 조뽑기 무대와 같은 계열을 쓴다(3D 두 곳의 색감을 맞춘다).
const COLOR_HEX: Record<string, string> = {
  green: '#3f6b52',
  blue: '#2f6fd0',
  red: '#c2553f',
  yellow: '#c08a2e',
};

const hexOf = (color?: string) => COLOR_HEX[color ?? ''] ?? '#2f6fd0';

export type AvatarFace = { name: string; color?: string; photoUrl?: string };

/**
 * 원형 프로필 텍스처를 만든다. 사진이 있으면 비동기로 덮어 그린다.
 * 반환한 텍스처는 호출부(무대)가 dispose 한다.
 */
export function makeAvatarTexture({ name, color, photoUrl }: AvatarFace): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const radius = size / 2;

  const paintInitial = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = hexOf(color);
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(size * 0.42)}px Pretendard, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 1), radius, radius + size * 0.02);
  };

  paintInitial();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  if (photoUrl && ctx) {
    const img = new Image();
    // 사외에서 사진이 뜨는 경우엔 텍스처로 올려야 하므로 교차출처 허용을 요청한다.
    // 서버가 CORS 헤더를 안 주면 로드가 실패(onerror)해 이니셜이 유지된다 — 안전한 폴백.
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      // 원형으로 클립해 사진을 덮어 그린다. cover 방식으로 가운데를 채운다.
      ctx.save();
      ctx.beginPath();
      ctx.arc(radius, radius, radius, 0, Math.PI * 2);
      ctx.clip();
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      ctx.restore();
      texture.needsUpdate = true;
    };
    img.onerror = () => {
      /* 사내망 밖이라 못 불러온다 — 이니셜을 그대로 둔다. */
    };
    img.src = photoUrl;
  }

  return texture;
}
