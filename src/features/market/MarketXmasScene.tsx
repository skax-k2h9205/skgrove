/*
  캔미팅 탭 상단 크리스마스 히어로 장면 — 산타·루돌프·트리·선물을 직접 그린 일러스트.
  루돌프 코가 반짝이고, 별이 깜빡이고, 캐릭터가 살짝 들썩이고, 눈이 내린다.
  움직임은 '동작 줄이기(prefers-reduced-motion)' 설정 시 멈춘다(styles.css).

  주의: CSS 애니메이션의 transform 은 SVG transform 속성을 '덮어쓴다'. 그래서 위치용 <g>(transform 속성)와
  애니메이션용 <g>(class)를 분리해 중첩한다 — 안 그러면 캐릭터가 좌상단으로 튕긴다.

  색은 일러스트 특성상 토큰이 아니라 리터럴로 둔다(styles.css 가 아니라 이 파일에만 있음).
*/
const SNOW = [
  { cx: 60, dur: 7, delay: 0 },
  { cx: 160, dur: 9, delay: 1 },
  { cx: 250, dur: 6, delay: 0.6 },
  { cx: 360, dur: 8, delay: 2 },
  { cx: 470, dur: 7.5, delay: 0.3 },
  { cx: 560, dur: 10, delay: 1.5 },
  { cx: 630, dur: 6.8, delay: 2.6 },
  { cx: 120, dur: 8.6, delay: 0.9 },
  { cx: 410, dur: 7.2, delay: 3 },
  { cx: 520, dur: 9.4, delay: 1.8 },
];

export function MarketXmasScene() {
  return (
    <div className="xmas-hero" aria-hidden="true">
      <svg viewBox="0 0 680 300" role="img" aria-label="산타, 루돌프, 크리스마스 트리가 있는 눈 내리는 장면">
        {/* 눈밭 */}
        <path d="M0 250 Q170 220 340 250 T680 248 L680 300 L0 300 Z" fill="#ffffff" />
        <path d="M0 262 Q170 238 340 262 T680 260 L680 300 L0 300 Z" fill="#eef4fb" />

        {/* 트리 */}
        <g transform="translate(70 70)">
          <g className="xh-star">
            <path
              d="M60 0 l7 16 17 2 -13 12 4 17 -15 -9 -15 9 4 -17 -13 -12 17 -2 Z"
              fill="#f2c84b"
              stroke="#e0ad2f"
              strokeWidth="2"
              strokeLinejoin="round"
              transform="translate(-34 -2)"
            />
          </g>
          <path d="M60 24 L92 84 Q60 74 28 84 Z" fill="#3a8f60" />
          <path d="M60 58 L100 128 Q60 116 20 128 Z" fill="#2e7d52" />
          <path d="M60 96 L112 176 Q60 162 8 176 Z" fill="#256a45" />
          <rect x="50" y="176" width="20" height="26" rx="6" fill="#8a5a33" />
          <circle cx="48" cy="104" r="5" fill="#e8503f" />
          <circle cx="74" cy="118" r="5" fill="#f2c84b" />
          <circle cx="40" cy="146" r="5" fill="#f2c84b" />
          <circle cx="68" cy="150" r="5" fill="#e8503f" />
          <circle cx="86" cy="150" r="5" fill="#6db5e8" />
          <circle cx="60" cy="130" r="5" fill="#ffffff" />
          <circle cx="54" cy="166" r="5" fill="#6db5e8" />
          <circle cx="82" cy="168" r="5" fill="#ffffff" />
        </g>

        {/* 선물 */}
        <g transform="translate(210 232)">
          <rect x="0" y="0" width="42" height="36" rx="5" fill="#e8503f" />
          <rect x="17" y="0" width="8" height="36" fill="#ffd27a" />
          <rect x="0" y="14" width="42" height="7" fill="#ffd27a" />
          <rect x="48" y="10" width="32" height="26" rx="5" fill="#3a8f60" />
          <rect x="60" y="10" width="7" height="26" fill="#ffffff" />
          <rect x="48" y="20" width="32" height="6" fill="#ffffff" />
        </g>

        {/* 산타 (위치 g + 애니메이션 g 분리) */}
        <g transform="translate(330 120)">
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

        {/* 루돌프 */}
        <g transform="translate(500 120)">
          <g className="xh-rudolph">
            <path
              d="M40 28 Q30 4 16 6 M40 28 Q34 12 22 16 M40 28 Q46 8 58 6 M56 28 Q66 10 78 14"
              fill="none"
              stroke="#8a5a33"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <ellipse cx="22" cy="44" rx="11" ry="8" fill="#9c6a39" transform="rotate(-25 22 44)" />
            <ellipse cx="74" cy="44" rx="11" ry="8" fill="#9c6a39" transform="rotate(25 74 44)" />
            <path d="M14 108 Q6 60 48 60 Q90 60 82 108 Z" fill="#a9743f" />
            <ellipse cx="48" cy="52" rx="30" ry="28" fill="#b07c45" />
            <ellipse cx="48" cy="64" rx="19" ry="15" fill="#cea575" />
            <circle cx="38" cy="46" r="4" fill="#3a2e26" />
            <circle cx="58" cy="46" r="4" fill="#3a2e26" />
            <circle cx="39.5" cy="44.5" r="1.3" fill="#ffffff" />
            <circle cx="59.5" cy="44.5" r="1.3" fill="#ffffff" />
            <circle className="xh-nose" cx="48" cy="66" r="6" fill="#ff5a4e" />
            <circle cx="48" cy="66" r="6" fill="#e23b3b" />
            <circle cx="46" cy="64" r="2" fill="#ffd0c8" />
            <path d="M22 86 Q48 98 74 86" fill="none" stroke="#2e7d52" strokeWidth="6" strokeLinecap="round" />
            <circle cx="48" cy="95" r="5" fill="#f2c84b" stroke="#e0ad2f" strokeWidth="1.5" />
          </g>
        </g>

        {/* 눈 */}
        <g fill="#ffffff">
          {SNOW.map((s, i) => (
            <circle
              key={i}
              className="xh-flake"
              cx={s.cx}
              cy="-10"
              r={i % 3 === 0 ? 5 : i % 3 === 1 ? 3 : 4}
              style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
