const LIGHTS = [
  [62, 50], [75, 57], [87, 61], [53, 79], [67, 85],
  [84, 89], [101, 91], [39, 108], [55, 115], [75, 120],
  [95, 122], [115, 122], [28, 140], [45, 146], [65, 150],
  [86, 152], [107, 152],
];

export function ChristmasSleigh() {
  return (
    <svg className="xmas-sleigh" aria-hidden="true" viewBox="0 0 720 360">
      <defs>
        <linearGradient id="xh-fir" x1="0" y1="0" x2=".9" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor="#609e86" />
          <stop offset=".45" stopColor="#337d68" />
          <stop offset="1" stopColor="#20584d" />
        </linearGradient>
        <radialGradient id="xh-bulb">
          <stop stopColor="#fff9d1" />
          <stop offset=".32" stopColor="#ffdb85" />
          <stop offset="1" stopColor="#f6bb58" stopOpacity="0" />
        </radialGradient>
        <g id="xh-bough">
          <path d="M0 0C-8 16 -14 28 -24 41Q-22 43 -17 42Q-33 61 -44 65Q-43 69 -36 69Q-47 83 -63 90Q-58 94 -47 92L-51 98Q-37 100 -24 94Q-25 100 -28 103Q-13 103 -3 96Q0 101 1 104Q12 102 21 96L21 100Q35 99 43 92Q53 95 63 90Q46 79 39 65Q44 66 47 64Q27 49 18 35L23 37Q8 17 0 0Z" fill="url(#xh-fir)" />
          <path d="M-61 90Q-46 82 -36 69Q-42 85 -52 91Q-58 93 -61 90M-43 65Q-31 59 -18 43Q-25 59 -36 65Q-41 68 -43 65M24 90Q40 87 46 85Q40 93 25 95Z" fill="#c8e3d8" />
          <path d="M-40 93q17 -6 22 -16m5 20q11 -8 17 -19m20 10q9 -3 13 -8M0 68q9 -7 12 -14" fill="none" stroke="#85b8a1" strokeOpacity=".64" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <g id="xh-reindeer-body">
          <path d="M19 41Q7 46 7 34q8 0 12 7" fill="#fff2d5" />
          <path d="M13 44q0 -10 14 -10q12 2 17 -4l5 -10l12 8q-4 4 -8 17q-5 11 -21 9q-19 -1 -19 -10" fill="#bd814e" />
          <path d="M49 31q2 7 8 5l3 -7" fill="#f9e3bd" />
          <path d="M53 18q1 -7 -5 -13m4 8q7 -4 6 -11m-8 8l-7 -2m10 1l6 -4" fill="none" stroke="#74503c" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M52 22q-12 -1 -14 -9q10 0 14 9" fill="#a66a49" />
          <path d="M50 26q-1 -10 7 -10q9 0 11 8l8 2q2 6 -7 8q-10 2 -19 -8" fill="#c48a57" />
          <path d="M65 25q6 3 11 1q1 6 -6 7l-5 -2" fill="#fbe4c5" />
          <circle cx="61" cy="22" r="1.7" fill="#312d2a" />
          <circle cx="75" cy="26" r="3.4" fill="#ce4940" />
          <path d="M46 31l9 6" stroke="#477769" strokeWidth="3.8" />
          <circle cx="52" cy="38" r="2.3" fill="#e7ac44" />
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" id="xh-reindeer-legs">
          <path d="M23 48l-9 9l-9 -3M43 46l9 6l9 -7" stroke="#925f42" />
          <path d="M25 48l-6 13l-9 1M42 48l11 9l9 -3" stroke="#bd814e" />
        </g>
      </defs>
      <svg viewBox="0 0 150 190" x="32.4" y="126" width="153.47" height="194.4">
        <ellipse cx="75" cy="177" rx="59" ry="6" fill="#d6dfe2" opacity=".55" />
        <path d="M68 151l-2 24q7 5 17 0l-3 -25" fill="#976649" />
        <path d="M70 157l-1 17" fill="none" stroke="#b98459" strokeWidth="2" />
        <g transform="translate(74 62) scale(1 0.99)">
          <use href="#xh-bough" />
        </g>
        <g transform="translate(73 43) scale(0.81 0.86)">
          <use href="#xh-bough" />
        </g>
        <g transform="translate(74 26) scale(0.61 0.67)">
          <use href="#xh-bough" />
        </g>
        <g transform="translate(74 14) scale(0.37 0.52)">
          <use href="#xh-bough" />
        </g>
        <path d="M60 48Q76 62 94 62M50 76Q63 88 104 91M36 106Q66 124 118 122M24 137Q46 153 111 152" fill="none" stroke="#dab56a" strokeWidth="1.25" strokeLinecap="round" />
        {LIGHTS.map(([cx, cy], index) => (
          <g key={index} className="xh-lamp" style={{ animationDelay: `-${index * 0.54}s` }}>
            <circle cx={cx} cy={cy} r="5" fill="url(#xh-bulb)" />
            <circle cx={cx} cy={cy} r="1.4" fill="#fff4c4" />
          </g>
        ))}
        <path d="M69 34.9v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="69" cy="41" r="3.1" fill="#c9584d" />
        <circle cx="68.0" cy="40.0" r=".9" fill="#ffebbd" />
        <path d="M80 64v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="80" cy="71" r="4" fill="#d5a458" />
        <circle cx="78.7" cy="69.7" r=".9" fill="#ffebbd" />
        <path d="M61 63.8v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="61" cy="70" r="3.2" fill="#db7e68" />
        <circle cx="59.9" cy="68.9" r=".9" fill="#ffebbd" />
        <path d="M59 90.6v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="59" cy="98" r="4.4" fill="#bf4a48" />
        <circle cx="57.5" cy="96.5" r=".9" fill="#ffebbd" />
        <path d="M92 93.2v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="92" cy="100" r="3.8" fill="#e4b969" />
        <circle cx="90.7" cy="98.7" r=".9" fill="#ffebbd" />
        <path d="M76 103.9v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="76" cy="110" r="3.1" fill="#d0765c" />
        <circle cx="75.0" cy="109.0" r=".9" fill="#ffebbd" />
        <path d="M46 122.4v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="46" cy="130" r="4.6" fill="#d4a04e" />
        <circle cx="44.5" cy="128.5" r=".9" fill="#ffebbd" />
        <path d="M65 128.4v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="65" cy="135" r="3.6" fill="#c15150" />
        <circle cx="63.8" cy="133.8" r=".9" fill="#ffebbd" />
        <path d="M96 126.3v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="96" cy="134" r="4.7" fill="#bf4e49" />
        <circle cx="94.4" cy="132.4" r=".9" fill="#ffebbd" />
        <path d="M112 135v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="112" cy="141" r="3" fill="#dca75e" />
        <circle cx="111.0" cy="140.0" r=".9" fill="#ffebbd" />
        <path d="M44 148.4v4" stroke="#a59163" strokeWidth="1" />
        <circle cx="44" cy="155" r="3.6" fill="#c35d53" />
        <circle cx="42.8" cy="153.8" r=".9" fill="#ffebbd" />
        <path d="M74 1l3.4 7.2 7.8 1-5.5 5.4 1.1 7.8-6.8-3.7-6.9 3.7 1.4-7.8-5.6-5.4 7.8-1Z" fill="#eabd61" stroke="#d09b49" strokeWidth=".7" />
        <path d="M74 1v12.8l-6.9 8.6 1.4-7.8-5.6-5.4 7.8-1Z" fill="#ffdf91" />
        <path d="M74 13.8l11.2-4.6-5.5 5.4 1.1 7.8Z" fill="#e1aa50" />
        <g transform="translate(83 163) rotate(-4)">
          <rect width="19" height="14" rx="2" fill="#bb5551" />
          <path d="M8 0h3v14H8z" fill="#ebc477" />
          <path d="M0 3h19" stroke="#e59c75" strokeWidth="1.6" />
        </g>
        <g transform="translate(103 169)">
          <rect width="11" height="10" rx="1.3" fill="#d6ab63" />
          <path d="M5 0v10" stroke="#568573" strokeWidth="2" />
        </g>
      </svg>
      <g className="xh-flight">
        <g className="xh-altitude">
          <g transform="translate(0 6) rotate(-5 40 40)">
            <rect x="20" y="22" width="21" height="20" rx="2" fill="#61968b" />
            <path d="M30 22v20" stroke="#ffe5a9" strokeWidth="4" />
            <rect x="39" y="16" width="20" height="24" rx="2" fill="#df6855" />
            <path d="M49 16v22" stroke="#ffd590" strokeWidth="4" />
            <path d="M49 16q-15 -2 -9 -7q5 -3 9 7q0 -12 6 -10q6 2 -6 10" fill="none" stroke="#eab856" strokeWidth="2.6" />
            <path d="M6 26q5 -4 10 4l5 6h38q8 0 12 -9q5 -10 10 -6q3 3 -2 6q-2 -2 -4 3q-4 20 -19 22H25Q13 50 10 37Z" fill="#ba3744" />
            <path d="M8 26q5 -1 9 6l5 5h36q10 0 15 -12" fill="none" stroke="#f4cb75" strokeWidth="3" />
            <path d="M29 53l-3 7m29 -8l-2 8M12 60h49q12 0 17 -9" fill="none" stroke="#aa7940" strokeWidth="3.8" strokeLinecap="round" />
          </g>
          <path fill="none" stroke="#b5775a" strokeWidth="1.4" d="M76 34 Q103 41 127 32 Q171 38 195 28 Q239 34 263 24 Q307 30 331 20" />
          {[0, 1, 2, 3].map((index) => (
            <g key={index} transform={`translate(${86 + index * 68} ${3 - index * 4}) scale(.86)`}>
              <g className="xh-stride" style={{ animationDelay: `-${index * 0.16}s` }}>
                <use href="#xh-reindeer-legs" />
              </g>
              <use href="#xh-reindeer-body" />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
