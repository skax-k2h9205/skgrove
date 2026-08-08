# 성향 진단 3기둥 시스템 — 설계

- 날짜: 2026-08-07
- 한 줄: 마이페이지의 간단 4지선다를 **MBTI(평소) + DISC(업무) 강제선택 진단 +
  AI 협업 가이드(자유서술)** 로 키운다. 결과는 AI 상담의 근거가 된다.

## 기둥

1. **평소 성향 = MBTI 4글자** — 강제선택 A/B 16문항(축당 4: E/I·S/N·T/F·J/P).
   결과: `INFP` + 각 축 기울기 %. 경계값을 한 글자로 못박지 않게 %도 함께 보여준다.
2. **업무 성향 = DISC** — 강제선택 12문항. 각 보기가 D/I/S/C 중 하나에 가점.
   결과: 1차 유형(+2차). 소통·갈등 한 줄 가이드 자동 생성.
   - **색 파생**: D=red(주도) · I=yellow(사교) · S=green(안정) · C=blue(신중).
     지금까지 순번으로 배정돼 의미 없던 `color` 에 업무 성향의 뜻이 생긴다(조뽑기도 성향 기반).
3. **나와 일하는 법 = AI 협업 가이드** — 자유서술 텍스트. 사용자가 자기 AI(Codex/
   ChatGPT/Claude)에 앱이 제공한 프롬프트를 돌려 결과를 붙여넣는다. 앱은 "프롬프트 복사"만.

## 데이터 (Profile 확장)

`mbtiType?: string`, `mbtiScores?: {EI,SN,TF,JP}`(각 -100~100 또는 0~100 lean),
`discType?: 'D'|'I'|'S'|'C'`, `discSecondary?`, `discScores?: {D,I,S,C}`,
`collabGuide?: string`. 기존 `trait/style/collaboration/feedback/guide` 는 유지하되
진단 결과로 자동 요약해 채운다(조뽑기·기존 화면 호환). `color` 는 DISC 파생.

Supabase: profiles 테이블에 위 컬럼 추가(모두 nullable). profileStore row 매핑 확장.

## 채점 (순수 함수, 단위 테스트)

- MBTI: 축별 A/B 표 합산 → 우세 글자 + lean%. `scoreMbti(answers)`.
- DISC: 보기별 D/I/S/C 가점 합산 → 정렬 → primary/secondary. `scoreDisc(answers)`.
- `discToColor(disc)`, `discGuide(disc)`, `summaryFrom(mbti, disc)` → trait/style 등 자동 채움.

## UI

- `src/features/profiles/Assessment.tsx` — 단계형 카드: 인트로 → MBTI 16 → DISC 12 →
  결과 요약 → 협업 가이드 붙여넣기. 진행바 · 한 문항씩 · 뒤로가기 · 재검사.
- `Profiles.tsx` 통합: 기존 간단 설문 자리에 "성향 진단 시작" + 결과 카드 표시 +
  "나와 일하는 법" 섹션(프롬프트 복사 + 붙여넣기 + 마크다운 표시).
- 문항 총량: 표준 28(평소16+업무12) + 협업 가이드 1.

## 상담 연동

`aiChat.briefOf` 에 mbtiType/discType/discScores/collabGuide 추가 → 프록시 페르소나가
"평소 INFP · 업무 신중(C) · 본인이 밝힌 협업법"을 근거로 조언.

## 벤치마킹 근거

- MBTI: 4 dichotomy 강제선택, 축당 문항 수가 신뢰도 → 캐주얼판 축당 4문항.
- DISC: 직장 4행동축이 소통·갈등과 직결(D=결론, C=근거, I=관계, S=안심·시간).
- 강제선택이 사회적 바람직성 편향을 낮춤(정통 방식).

## 스코프 밖(후속)

컴퓨터 적응형 문항, 신뢰도 지표 노출, 팀 단위 성향 대시보드, 협업 가이드 AI 자동생성(서버).
