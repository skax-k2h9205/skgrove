import type { ElementType } from 'react';
import {
  Armchair,
  BookOpen,
  Gamepad2,
  Gift,
  Headphones,
  Keyboard,
  Laptop,
  Monitor,
  Package,
  Shirt,
  Smartphone,
  Coffee,
} from 'lucide-react';
import { formatPrice } from '../../marketRules';
import type { GatheringPoster, MarketItem } from '../../types';

/*
  물건 포스터의 '틀'. 모임·번개의 PosterFrame 과 같은 규칙을 따른다 —
  비율(4:5)·타이포·여백은 CSS 가 쥐고, 바뀌는 것은 색·아이콘·문구뿐이다.
  격자가 흐트러지지 않는 것이 개별 카드의 화려함보다 우선이다.

  모임과 다른 점 하나: 여기엔 AI 를 부르지 않는다. 물건 제목은 이미 "기계식 키보드"처럼
  구체적이라 다듬을 게 없고, 등록 한 번에 외부 호출을 붙일 이유가 없다.
*/

const MOTIF_ICON: Record<string, ElementType> = {
  Armchair,
  BookOpen,
  Coffee,
  Gamepad2,
  Gift,
  Headphones,
  Keyboard,
  Laptop,
  Monitor,
  Package,
  Shirt,
  Smartphone,
};

const MOTIFS = Object.keys(MOTIF_ICON);

// 제목에 이 말이 있으면 그 아이콘을 쓴다. 포스터 품질은 대부분 여기서 나온다.
const KEYWORD_MOTIF: Array<[string[], string]> = [
  [['의자', '체어', '책상', '가구', '소파'], 'Armchair'],
  [['키보드', '키캡', '마우스'], 'Keyboard'],
  [['모니터', '받침대', '거치대', '모니터암'], 'Monitor'],
  [['노트북', '맥북', '랩탑'], 'Laptop'],
  [['아이패드', '태블릿', '폰', '휴대폰', '아이폰'], 'Smartphone'],
  [['이어폰', '헤드폰', '헤드셋', '스피커'], 'Headphones'],
  [['커피', '머신', '텀블러', '컵', '차'], 'Coffee'],
  [['책', '도서', '문제집', '교재'], 'BookOpen'],
  [['게임', '닌텐도', '플스', '패드'], 'Gamepad2'],
  [['옷', '자켓', '신발', '가방', '의류'], 'Shirt'],
];

/** 제목이 같으면 언제나 같은 포스터가 나오게 하는 결정적 해시. */
function hash(text: string) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }
  return value;
}

function motifFor(item: MarketItem) {
  if (item.kind === 'giveaway') return 'Gift';
  const lowered = item.title.toLowerCase();
  const hit = KEYWORD_MOTIF.find(([words]) => words.some((word) => lowered.includes(word)));
  if (hit) return hit[1];
  return MOTIFS[hash(item.title) % MOTIFS.length];
}

/** 사진이 없을 때 쓰는 포스터. 모임과 달리 외부 호출 없이 여기서 끝난다. */
export function localItemPoster(item: MarketItem): GatheringPoster {
  const price = item.kind === 'giveaway' ? '나눔 · 선착순' : `시작가 ${formatPrice(item.startPrice)}`;
  return {
    headline: item.title.trim(),
    caption: [price, item.place.trim()].filter(Boolean).join(' · '),
    // 나눔은 clay 로 고정한다. 격자에서 색만 봐도 나눔이 눈에 걸려야 한다.
    tone: item.kind === 'giveaway' ? 'clay' : 'moss',
    motif: motifFor(item),
    source: 'local',
  };
}

type ItemPosterProps = {
  item: MarketItem;
  /** 우측 상단 배지(경매·나눔·거래완료). 호출부가 상태를 보고 정한다. */
  badge?: string;
  badgeTone?: 'moss' | 'clay' | 'muted';
};

export function ItemPoster({ item, badge, badgeTone = 'moss' }: ItemPosterProps) {
  const poster = item.poster ?? localItemPoster(item);
  const Motif = MOTIF_ICON[poster.motif] ?? Package;
  const hasPhoto = Boolean(item.imageUrl);

  return (
    <div className={hasPhoto ? 'poster photo' : `poster ${poster.tone}`}>
      {hasPhoto ? (
        <img alt="" className="poster-photo" loading="lazy" src={item.imageUrl} />
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
