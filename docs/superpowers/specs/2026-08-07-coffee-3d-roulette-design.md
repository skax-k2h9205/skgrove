# 커피뽑기 3D 프로필 룰렛 — 설계

- 날짜: 2026-08-07
- 대상: 번개 상세의 커피뽑기(당첨자 추첨) 연출
- 배경: 지금은 이름을 빠르게 훑는 텍스트 룰렛(`.coffee-roulette`). 참여자
  **프로필 사진**이 3D로 둥둥 떠 섞이다 **천천히 감속해** 한 명에게 걸리는
  몰입형 연출로 바꾼다. 공정성(재추첨 차단·후보 박제)은 그대로 둔다.

## 원칙

1. **당첨은 애니메이션 전에 확정된다.** `drawCoffeePick`(App)이 winner·coffeePool을
   먼저 저장한다. 3D는 그 결과를 *보여줄 뿐* 결정하지 않는다 — 조작 의심 차단.
2. **누구에게나 원반이 보인다.** 사진이 사내망 전용이라 사외/배포에서 실패한다.
   실패 시 이니셜 원으로 폴백(Avatar와 같은 철학).
3. **퇴화 없음.** WebGL 불가·`prefers-reduced-motion`이면 지금의 CSS 텍스트 룰렛으로.
4. **기존 무대 재활용.** `mountDrawScene`(렌더러·조명·감속 이징·폴백)은 손대지 않는다.

## 구성

### 1. `src/features/gatherings/avatarTexture.ts`
`makeAvatarTexture({ name, color, photoUrl }): THREE.CanvasTexture`
- 캔버스(256²)에 아바타 색 원 + 흰 이니셜을 **즉시** 그린다(동기 폴백).
- `photoUrl`이 있으면 `Image`(`crossOrigin='anonymous'`, `referrerPolicy='no-referrer'`)
  로 로드 → 성공 시 원형 클립으로 사진을 덮어 그리고 `texture.needsUpdate=true`.
  실패(onerror·CORS)면 이니셜 유지. 텍스처는 tainted 되지 않는다(로드 실패 = 그리지 않음).
- 색 이름→hex는 조뽑기와 같은 팔레트를 공유한다.

### 2. `src/features/gatherings/coffeeStage.ts`
`buildCoffeeStage(ctx, state, members): DrawStageHandle`
- `CoffeeMember = { name; color; photoUrl? }`, 원반 = 얇은 원기둥/원판 + 아바타 텍스처,
  **카메라를 향하는 빌보드**(사진이 늘 정면). 바닥 그림자로 부양감.
- `CoffeeState = { phase: 'idle'|'rolling'|'landing'; startedAt; winner? }`.
- **rolling**: 리사주 궤도로 빠르게 떠 섞인다(조뽑기 churn과 유사).
- **landing**: `since/ DURATION`(≈2.6s)에 `easeOutCubic` — 궤도 속도를 줄이며 전원 감속.
  당첨 원반은 중앙·앞으로 미끄러지고 `easeOutBack`으로 살짝 커진다(클로즈업).
  나머지는 반경을 넓히며 뒤로 물러나 흐려진다(scale↓/뒤로).
- `fit`은 스토리 뷰어 폭(납작 프레임)에서도 안 잘리게 여유 반경.

### 3. `src/features/gatherings/CoffeeDrawCanvas.tsx`
- `DrawCanvas`를 미러: `prefers-reduced-motion`/WebGL 실패 시 `children`(현재 CSS 룰렛).
- props: `members`, `winner`, `spinning`, `onLanded`. 상태를 ref로 흘려보내고
  씬은 명단 바뀔 때만 재생성(컨텍스트 누수 방지 — 기존 주의사항 동일).
- `spinning`이 true→landing 전환 시각을 기록, `DURATION+ε` 후 `onLanded()` 1회 호출.

### 4. `src/features/gatherings/GatheringBoard.tsx`
- pool 이름 → `CoffeeMember` 매핑: `useContext(ProfilesContext)`로 색·사진 조회.
- "룰렛 돌리기" → `drawSpin`(현행) 대신 `<CoffeeDrawCanvas spinning members winner
  onLanded={() => setSpinning(false)}>` 마운트. children으로 기존 텍스트 룰렛 유지(폴백).
- `onLanded` 후 기존 **히어로 결과 카드**(`.coffee-result-hero` + 후보 chips)로 전환.
- 상세를 그냥 열 때는 안 돈다(`justDrewRef` 유지).

## 테스트

- `avatarTexture.test.ts`: photoUrl 없을 때 이니셜만, 잘못된 URL이어도 예외 없이
  텍스처 반환(폴백). (jsdom canvas는 no-op이라 스모크 수준.)
- `coffeeStage` 순수 이징/좌표 헬퍼가 있으면 단위 검증. three 렌더는 테스트 제외.
- 회귀: designTokens(하드코딩 hex 0·브레이크포인트 720/1100) 유지 — 새 색은 토큰 경유.

## 폴백 계층

WebGL O + motion O → 3D 룰렛. 아니면 → CSS 텍스트 룰렛(현행). 결과 카드는 공통.
