# 캔미팅 크리스마스 히어로 — 전문 에셋 교체 방법

캔미팅 탭 상단 장면(`MarketXmasScene`)은 **전문 Lottie 에셋을 우선 사용**하고, 없으면 직접 그린
손그림 SVG(산타·루돌프·눈사람·트리)로 **자동 폴백**한다.

## 전문 에셋 적용 (코드 수정 불필요)

1. 마음에 드는 크리스마스 **Lottie 애니메이션**(JSON)을 구한다.
   - 예: [LottieFiles](https://lottiefiles.com) — "christmas", "santa", "reindeer" 검색.
   - ⚠️ **라이선스가 사내/상업 사용 가능한지 반드시 확인** (무료라도 표기 조건이 있을 수 있음).
2. 받은 JSON 파일을 **`public/xmas-scene.json`** 으로 저장(파일명 그대로).
3. 끝. 배포되면 캔미팅 탭에서 자동으로 그 Lottie 가 재생된다.
   - 파일이 없거나 로드 실패 시 손그림 SVG 가 그대로 뜬다(화면이 비는 일 없음).
   - 가로 비율은 배너 폭에 맞춰 자동. 너무 세로로 길면 배너가 길어지니 와이드한 장면 권장.

## 가로형이 아니라 특정 캐릭터만 쓰고 싶다면
`MarketXmasScene.tsx` 의 `LOTTIE_PATH` 만 바꾸거나, 여러 개를 배치하도록 컴포넌트를 조금 손보면 된다.

## 접근성
`prefers-reduced-motion`(동작 줄이기) 설정 사용자는 Lottie 가 **정지 상태(autoplay off)** 로 뜬다.

## 폴백 손그림 수정
`MarketXmasScene.tsx` 의 `XmasSceneSvg` 안의 SVG 를 고치면 된다. 캐릭터는 같은 바닥선(y≈205)에 맞춰 배치.
