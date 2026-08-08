import { useContext, useState } from 'react';
import { ProfilesContext } from '../profilesContext';
import type { Profile } from '../types';

// 이름 → 라이브 아바타(색·사진) 조회. 사진 있으면 <img>, 없으면 이니셜 칩으로 폴백.
// 색은 성향 프로필, 사진은 계정에서 오며 App이 ProfilesContext로 합쳐 제공하므로
// 사진 변경이 전역에 즉시 반영된다.
// 사진 URL이 사내망 전용(telinfo 등)이라 사외에서 로드 실패할 수 있으므로,
// onError 시 이니셜 칩으로 우아하게 폴백하고 referrerPolicy=no-referrer로
// 레퍼러 기반 차단을 피한다.
type AvatarProps = {
  name: string;
  color?: Profile['color']; // 조뽑기 등 프로필 색과 다른 색을 강제할 때만 전달.
  className?: string;
};

export function Avatar({ name, color, className }: AvatarProps) {
  const directory = useContext(ProfilesContext);
  const info = directory.get(name);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const tone = color ?? info?.color ?? 'blue';
  const cls = `tiny-avatar ${tone}${className ? ` ${className}` : ''}`;
  if (info?.photoUrl && info.photoUrl !== failedSrc) {
    return (
      <span className={cls}>
        <img
          src={info.photoUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(info.photoUrl ?? null)}
        />
      </span>
    );
  }
  return <span className={cls}>{name.slice(0, 1)}</span>;
}
