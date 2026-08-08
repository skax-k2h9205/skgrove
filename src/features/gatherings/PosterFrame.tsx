import { useState } from 'react';
import type { ElementType } from 'react';
import {
  Beer,
  Bike,
  BookOpen,
  Clapperboard,
  Coffee,
  Dumbbell,
  Gamepad2,
  Mountain,
  Music,
  PartyPopper,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { localPoster } from '../../aiPoster';
import type { Gathering } from '../../types';

/*
  포스터의 '틀'. 사진이 있든 없든, AI 가 만들었든 로컬이 만들었든 이 틀은 같다.
  요청의 이유가 "쌓이면 한눈에 보기 좋게"였으므로, 격자가 흐트러지지 않는 것이
  개별 카드의 화려함보다 우선한다. 비율·타이포·여백은 여기서 고정하고
  바뀌는 것은 색·아이콘·문구뿐이다.
*/

// 문자열 → 컴포넌트. lucide 전체를 동적으로 끌어오면 번들이 커지므로
// 포스터가 쓸 수 있는 것만 정적으로 들고 있는다(aiPoster 의 MOTIFS 와 같은 목록).
const MOTIF_ICON: Record<string, ElementType> = {
  Coffee,
  UtensilsCrossed,
  Beer,
  Mountain,
  Bike,
  Dumbbell,
  Gamepad2,
  Music,
  Clapperboard,
  BookOpen,
  PartyPopper,
  Sparkles,
};

type PosterFrameProps = {
  gathering: Gathering;
  /** 우측 상단 배지(모집중·마감 등). 없으면 배지를 그리지 않는다. */
  badge?: string;
  /** 배지 색조. 상태에 따라 호출부가 정한다. */
  badgeTone?: 'moss' | 'clay' | 'muted';
};

/*
  스토리 트레이용 원형 썸네일. 포스터는 4:5 라 원에 넣으면 위아래가 잘려
  무엇인지 알 수 없어진다. 모티프 아이콘 하나만 틴트 위에 올린다.
*/
export function PosterThumb({ gathering }: { gathering: Gathering }) {
  const poster = gathering.poster ?? localPoster(gathering);
  const Motif = MOTIF_ICON[poster.motif] ?? Sparkles;
  return (
    <span className={`ig-thumb ${poster.tone}`}>
      <Motif aria-hidden size={24} strokeWidth={1.6} />
    </span>
  );
}

export function PosterFrame({ gathering, badge, badgeTone = 'moss' }: PosterFrameProps) {
  /*
    사진이 안 열리면 포스터로 되돌아간다. 격자에서 캡션을 없앤 뒤로 깨진 사진은
    글자 하나 없는 흰 칸이 된다 — 무슨 모임인지 알 방법이 사라진다.
    실제로 밟은 경우는 Supabase 버킷이 없어 blob: 로 떨어진 URL 이 새로고침에서
    죽은 것이었지만, 파일이 지워지거나 주소가 바뀌어도 같은 일이 난다.
  */
  const [photoBroken, setPhotoBroken] = useState(false);

  // 저장된 포스터가 없어도 빈 카드를 보여주지 않는다. 즉석에서 로컬 포스터를 만든다.
  const poster = gathering.poster ?? localPoster(gathering);
  const Motif = MOTIF_ICON[poster.motif] ?? Sparkles;
  const hasPhoto = Boolean(gathering.imageUrl) && !photoBroken;

  return (
    <div className={hasPhoto ? 'poster photo' : `poster ${poster.tone}`}>
      {hasPhoto ? (
        <img
          alt=""
          className="poster-photo"
          loading="lazy"
          onError={() => setPhotoBroken(true)}
          src={gathering.imageUrl}
        />
      ) : (
        <Motif aria-hidden className="poster-motif" size={64} strokeWidth={1.25} />
      )}

      {badge ? <span className={`poster-badge ${badgeTone}`}>{badge}</span> : null}

      {/* 사진 위에도 글자가 읽혀야 하므로 아래쪽에 어둠을 깔고 그 위에 얹는다. */}
      <div className="poster-text">
        <strong>{poster.headline}</strong>
        <span>{poster.caption}</span>
      </div>
    </div>
  );
}
