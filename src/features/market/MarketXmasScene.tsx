import { useEffect, useRef, useState } from 'react';
import type { AnimationItem } from 'lottie-web';
import { ChristmasSleigh } from './ChristmasSleigh';

const SNOW = [
  { cx: 40, dur: 7, delay: 0 },
  { cx: 110, dur: 9, delay: 1.3 },
  { cx: 180, dur: 6, delay: 0.6 },
  { cx: 250, dur: 8, delay: 2.1 },
  { cx: 320, dur: 7.5, delay: 0.3 },
  { cx: 390, dur: 10, delay: 1.6 },
  { cx: 455, dur: 6.8, delay: 2.6 },
  { cx: 520, dur: 8.6, delay: 0.9 },
  { cx: 585, dur: 7.2, delay: 3.2 },
  { cx: 645, dur: 9.4, delay: 1.9 },
];

const SPARKLES = [
  { x: 150, y: 42, s: 1, twinkle: true },
  { x: 300, y: 30, s: 0.7, twinkle: false },
  { x: 430, y: 58, s: 0.85, twinkle: true },
  { x: 560, y: 36, s: 0.7, twinkle: false },
];

/* public/xmas-scene.json 이 있으면 전문 Lottie 에셋을 재생하고, 없으면(또는 로드 실패) 아래 손그림으로
   폴백한다. 파일만 떨어뜨리면 코드 수정 없이 즉시 적용된다. (사내/상업 라이선스 확인 필수)
   lottie-web 은 이 컴포넌트가 마운트될 때만 동적 import 되어 메인 번들을 키우지 않는다. */
const LOTTIE_PATH = '/xmas-scene.json';

export function MarketXmasScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'loading' | 'lottie' | 'fallback'>('loading');

  useEffect(() => {
    let cancelled = false;
    let anim: AnimationItem | undefined;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => {
      if (motion.matches) anim?.pause();
      else anim?.play();
    };
    motion.addEventListener('change', syncMotion);
    void (async () => {
      try {
        const lottie = (await import('lottie-web')).default;
        if (cancelled || !ref.current) return;
        anim = lottie.loadAnimation({
          container: ref.current,
          renderer: 'svg',
          loop: true,
          autoplay: !motion.matches,
          path: LOTTIE_PATH,
        });
        anim.addEventListener('DOMLoaded', () => {
          if (!cancelled) setMode('lottie');
        });
        anim.addEventListener('data_failed', () => {
          if (!cancelled) setMode('fallback');
        });
      } catch {
        if (!cancelled) setMode('fallback');
      }
    })();
    return () => {
      cancelled = true;
      motion.removeEventListener('change', syncMotion);
      anim?.destroy();
    };
  }, []);

  return (
    <div className="xmas-hero" aria-hidden="true">
      <div className="xmas-lottie" hidden={mode !== 'lottie'} ref={ref} />
      {mode !== 'lottie' && <XmasSceneSvg />}
      <ChristmasSleigh />
    </div>
  );
}

function XmasSceneSvg() {
  return (
    <svg className="xmas-fallback" viewBox="0 0 680 260">
        {/* 달 + 은은한 빛무리 */}
        <circle cx="612" cy="50" r="32" fill="#fdf6d8" opacity="0.45" />
        <circle cx="612" cy="50" r="22" fill="#fbefc0" />

        {/* 하늘 반짝임 */}
        {SPARKLES.map((sp, i) => (
          <g key={i} transform={`translate(${sp.x} ${sp.y}) scale(${sp.s})`}>
            <path
              className={sp.twinkle ? 'xh-star' : undefined}
              d="M0 -7 L1.8 -1.8 7 0 1.8 1.8 0 7 -1.8 1.8 -7 0 -1.8 -1.8 Z"
              fill="#f2c84b"
            />
          </g>
        ))}

        {/* 눈밭 (앞뒤 두 겹으로 깊이감) */}
        <path d="M0 196 Q110 176 230 192 Q350 206 470 186 Q590 172 680 192 L680 260 L0 260 Z" fill="#ffffff" />
        <path d="M0 216 Q170 202 340 214 T680 212 L680 260 L0 260 Z" fill="#eaf1f8" />

        {/* 발밑 그림자 (바닥선 y≈207) — 그라운딩으로 정돈돼 보인다 */}
        <g fill="#d6e2ef" opacity="0.65">
          <ellipse cx="248" cy="209" rx="42" ry="6" />
          <ellipse cx="340" cy="208" rx="24" ry="5" />
          <ellipse cx="428" cy="208" rx="40" ry="7" />
        </g>

        {/* 선물 — 바닥 y205 */}
        <g transform="translate(205 169)">
          <rect x="0" y="0" width="42" height="36" rx="5" fill="#e8503f" />
          <rect x="17" y="0" width="8" height="36" fill="#ffd27a" />
          <rect x="0" y="14" width="42" height="7" fill="#ffd27a" />
          <rect x="48" y="10" width="32" height="26" rx="5" fill="#3a8f60" />
          <rect x="60" y="10" width="7" height="26" fill="#ffffff" />
          <rect x="48" y="20" width="32" height="6" fill="#ffffff" />
        </g>

        {/* 눈사람 — 중심 x340, 바닥 y205 */}
        <g transform="translate(316 141)">
          <g className="xh-snowman">
            <ellipse cx="24" cy="48" rx="17" ry="16" fill="#ffffff" />
            <circle cx="24" cy="22" r="12" fill="#ffffff" />
            <path d="M6 44 Q24 54 42 44" fill="none" stroke="#d7e3ee" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="1.8" fill="#3a2e26" />
            <circle cx="28" cy="20" r="1.8" fill="#3a2e26" />
            <path d="M24 23 L37 26 L24 28 Z" fill="#f0922e" />
            <circle cx="24" cy="40" r="2" fill="#4a3b30" />
            <circle cx="24" cy="48" r="2" fill="#4a3b30" />
            <path d="M8 30 Q24 36 40 30" fill="none" stroke="#e8503f" strokeWidth="5" strokeLinecap="round" />
            <path d="M40 30 l3 10" fill="none" stroke="#e8503f" strokeWidth="4" strokeLinecap="round" />
            <path d="M7 40 L-6 34 M41 40 L54 34" stroke="#8a5a33" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>

        {/* 산타 — 중심 x428, 바닥 y205 (위치 g + 애니메이션 g 분리) */}
        <g transform="translate(372 81)">
          <g className="xh-santa">
            <path d="M18 120 Q10 70 56 70 Q102 70 94 120 Z" fill="#e8503f" />
            <rect x="16" y="112" width="80" height="12" rx="6" fill="#ffffff" />
            <circle cx="56" cy="118" r="6" fill="#4a3b30" />
            <circle cx="56" cy="44" r="30" fill="#ffd9b8" />
            <path d="M30 42 Q28 86 56 86 Q84 86 82 42 Q74 60 56 60 Q38 60 30 42 Z" fill="#ffffff" />
            <circle cx="48" cy="54" r="7" fill="#ffffff" />
            <circle cx="64" cy="54" r="7" fill="#ffffff" />
            <circle cx="40" cy="48" r="6" fill="#ffb0a3" opacity="0.75" />
            <circle cx="72" cy="48" r="6" fill="#ffb0a3" opacity="0.75" />
            <circle cx="56" cy="50" r="5" fill="#f0a98f" />
            <circle cx="46" cy="40" r="3" fill="#3a2e26" />
            <circle cx="66" cy="40" r="3" fill="#3a2e26" />
            <path d="M26 30 Q40 2 92 10 Q86 26 82 32 Q60 20 30 34 Z" fill="#e8503f" />
            <rect x="24" y="28" width="62" height="12" rx="6" fill="#ffffff" />
            <circle cx="94" cy="8" r="9" fill="#ffffff" />
          </g>
        </g>

        {/* 배너 안 눈 */}
        <g fill="#ffffff">
          {SNOW.map((s, i) => (
            <circle
              key={i}
              className="xh-flake"
              cx={s.cx}
              cy="-10"
              r={i % 3 === 0 ? 4.5 : i % 3 === 1 ? 2.8 : 3.6}
              style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
            />
          ))}
        </g>
      </svg>
  );
}
