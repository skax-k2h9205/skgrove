# 유머게시판 내용 기반 썸네일 자동 생성 — 설계

작성일: 2026-08-06
브랜치: `feature/humor-thumbnail`

## 배경

이음장터(market)·모임번개(gathering)는 사진을 첨부하지 않은 카드에 대해 등록값을
바탕으로 크레파스 화풍 썸네일을 서버에서 그려 붙인다. 유머게시판(humor)에는 이 기능이
없어, 이미지 링크를 붙이지 않은 글은 릴스에서 배경 없이 텍스트만 보인다.

이 작업은 **이미지가 없는 유머 글에 대해 글 내용(body)을 바탕으로 크레파스 썸네일을
자동 생성**해 릴스 배경으로 깔아준다. 이음장터·모임번개와 같은 화풍·같은 배관을 쓴다.

## 결정 사항

- **그림 소재**: 글 내용(body)이 묘사하는 장면을 크레파스 화풍으로. 이음장터/모임번개와
  동일한 화풍이라 세 격자가 나란히 통일돼 보인다.
- **생성 조건**: 이미지 배경이 없는 글에만. 즉 `mediaUrl`이 이미지 타입이 **아닌** 모든
  글(순수 텍스트·유튜브·mp4·링크). 유튜브 글은 크레파스 배경 위에 재생 아이콘이 얹힌다.
  이미지 링크를 붙인 글은 그대로 둔다.
- **저장 방식(A)**: 이음장터·모임번개와 똑같이 Supabase 버킷에 업로드하고 URL만 저장.
  생성 이미지는 사용자가 붙인 `mediaUrl`과 **별개 필드**(`imageUrl`)에 둔다.

## 아키텍처 개요

기존 이음장터·모임번개 흐름을 그대로 따른다:

1. 글 등록 즉시 저장(썸네일 없이) — 등록 버튼이 생성 시간을 기다리지 않는다.
2. 백그라운드에서 `requestHumorImage(post)`가 등록값(글 내용, "사실")만 엔드포인트로 POST.
3. 서버가 화풍(고정)+내용(가변)+구도(고정)를 조합해 이미지 모델 호출 → 비전 모델로
   "글자 있나" 검사, 최대 3회 재시도 → 글자 없는 이미지만 dataUri로 반환.
4. 프론트가 dataUri를 File로 바꿔 `humor-images` 버킷에 업로드하고 그 글의 `imageUrl`만
   갱신. 실패하면 썸네일 없이 그대로(텍스트/기존 미디어 유지).
5. 엔드포인트 env(`VITE_HUMOR_IMAGE_ENDPOINT`)가 없으면 조용히 휴면.

서버 분기의 "진짜" 구현은 `api/gathering-image.ts`(Vercel 서버리스, gathering+item 처리)다.
여기에 `humor` 세 번째 갈래를 추가한다. 로컬 개발 프록시 `scripts/image-proxy.mjs`에도
같은 갈래를 미러링해 로컬에서 검증 가능하게 한다.

## 변경 대상

### 1. 데이터 모델

**`src/types.ts`** — `HumorPost`에 필드 추가:
```ts
imageUrl?: string; // 내용으로 생성한 크레파스 썸네일. mediaUrl(사용자가 붙인 링크)과 별개.
```

**`supabase-schema.sql`**:
- `humor_posts` create-table 정의에 `image_url text` 추가
- 기존 DB 반영용 `alter table public.humor_posts add column if not exists image_url text;`
- `humor-images` 스토리지 버킷 + 읽기/쓰기/수정/삭제 정책 (`gathering-images` 블록 복제)

### 2. 저장소 — `src/humorStore.ts`

- `HumorPostRow`에 `image_url?: string | null` 추가
- `postFromRow`: `imageUrl: row.image_url ?? undefined`
- `postToRow`: `image_url: post.imageUrl ?? null`
- `uploadHumorImage(postId, file)` 신규 — `uploadMarketImage` 복제, 버킷 `humor-images`.
  Supabase 없으면 `URL.createObjectURL(file)` 폴백.

### 3. 프론트 이음새 — `src/humorImage.ts` (신규)

`gatheringImage.ts`/`marketImage.ts`와 같은 규약:
```ts
export async function requestHumorImage(post: HumorPost): Promise<File | null>
```
- `VITE_HUMOR_IMAGE_ENDPOINT` 없으면 `null`
- `{ humor: { body: post.body } }` POST
- 응답 `{ ok, dataUri }` → `fileFromDataUri(dataUri, post.id)` (gatheringImage에서 재사용)
- 실패·글자 잔존 시 `null`

### 4. 서버 분기 — `api/gathering-image.ts`

`HumorInput { body?: string }` 타입 추가. 다음을 추가:
- `HUMOR_FRAME`: 크레파스 화풍 유지, 4:5, 얼굴 단순화(식별 가능한 실인물 금지), 밝고 순한
  장면. 말풍선·글자·기호가 들어갈 자리가 없도록 카메라를 인물/사물에 당긴다("그리지 마라"가
  아니라 "그럴 자리가 없다" 방식 — 기존 FRAME들과 동일한 이유).
- `askHumorSubject(apiKey, textModel, humor)`: 한국어 농담/짤 설명을 영어 장면 한 줄(8-15
  단어)로. **말풍선·글자·캡션 없이** 물리적으로 무슨 우스운 장면인지만 묘사하게 지시. 고유명사·
  실인물·브랜드는 일반명사로.
- `buildHumorPrompt(subject)`: `STYLE + subject + HUMOR_FRAME`
- `POST` 핸들러 분기에 `humor` 추가. 우선순위: item → gathering → humor
  (`payload.humor?.body`가 있으면 humor 경로). 번역 실패 시 fallback 주제
  (예: "Coworkers laughing together at something silly.")
- 글자 검사기(`findText`)·재시도(`generateClean`)는 그대로 재사용.

### 5. 로컬 프록시 — `scripts/image-proxy.mjs`

로컬 검증을 위해 humor 갈래를 미러링(현재 이 파일은 gathering만 처리). `payload.humor?.body`가
있으면 humor 프롬프트로 생성. api/gathering-image.ts와 같은 프롬프트·검사 로직.

> 참고: 이 파일은 이미 `api/gathering-image.ts`의 gathering 로직을 중복 보유한 상태다(기존
> 구조). market은 로컬 프록시가 다루지 않아 로컬에서 휴면이다. humor는 gathering처럼 로컬에서도
> 동작하도록 미러링한다. 두 구현의 통합 리팩터는 이 작업 범위 밖.

### 6. UI — `src/features/humor/HumorBoard.tsx`

- 릴스 카드: `media?.type === 'image'`이면 지금처럼 `media.src`를 배경으로. **아니면서**
  `post.imageUrl`이 있으면 `post.imageUrl`을 `ig-reel-bg` 배경으로 렌더(재생 아이콘 등 오버레이
  유지). 둘 다 없으면 지금처럼 텍스트만.
- 생성 중 표시: 해당 글이 pending이면 모래시계/스피너를 릴스에 표시(이음장터의 pending 표시
  방식 참고). pending id 집합은 App.tsx에서 내려준다.
- 상세 화면(`MediaBlock` 부근): 사용자 미디어가 없고 `imageUrl`이 있으면 그 이미지를 상세에도
  표시.

### 7. 호출 흐름 — `src/App.tsx`

- `addHumorPost`: 기존처럼 글을 먼저 persist. 이어서 `resolveMedia(mediaUrl)?.type !== 'image'`
  이면 백그라운드 생성:
  ```
  setHumorImagePendingIds 추가
  → requestHumorImage(post)
  → 성공 시 uploadHumorImage(post.id, file) → patchHumorPost(post.id, { imageUrl })
  → finally pending 제거
  ```
- `patchHumorPost(id, patch)` 헬퍼 필요(없으면 추가) — 목록의 해당 글만 갱신 후 persist.
- pending id state(`humorImagePendingIds`)를 HumorBoard에 prop으로 전달.
- `resolveMedia`는 현재 HumorBoard 내부 함수 → 판별 로직을 공유하려면 `humorRules.ts` 등으로
  올리거나, App에서는 간단히 "이미지 확장자/ data:image 여부"만 재판별. **결정: `resolveMedia`의
  판별부를 `humorRules.ts`로 옮겨 App·Board가 공유**(작은 정리, 이 작업에 필요한 범위).

### 8. 휴면·환경변수

- `.env.example`·`.env.ai.example`에 `VITE_HUMOR_IMAGE_ENDPOINT` 예시 주석 추가(gathering 옆).
- env 미설정 시 `requestHumorImage`가 `null` → 글은 그대로. 기능 전체가 옵션.

## 오류 처리

- 엔드포인트 없음/생성 실패/글자 잔존/업로드 실패 → 모두 "썸네일 없이 진행" 한 갈래로 수렴.
  글 등록 자체는 어떤 경우에도 성공한다.
- Supabase 없음 → `uploadHumorImage`가 objectURL 폴백(브라우저 세션 내에서만 보임). 로컬 개발
  흐름을 끝까지 확인 가능.

## 테스트

- `humorRules.ts`로 옮긴 미디어 판별(`resolveMedia`/이미지 여부)에 단위 테스트 추가
  (`humorRules.test.ts`): 이미지 확장자·data:image·youtube·mp4·링크·빈 값 분기.
- `requestHumorImage`: 엔드포인트 없음 → null, ok:false → null, ok+dataUri → File (marketImage/
  gatheringImage에 대응 테스트가 있으면 같은 형태로).
- 서버 프롬프트 순수함수(`buildHumorPrompt`, `askHumorSubject`의 usableSubject 통과 여부)는
  기존 image-proxy 테스트 패턴이 있으면 그에 맞춰 추가.

## 범위 밖 (YAGNI)

- 유머 썸네일 수동 재생성 버튼(이음장터도 없음 — 재등록으로 대신).
- 유튜브 자체 썸네일(img.youtube.com) 활용 — 이번엔 내용 기반 생성만.
- image-proxy.mjs ↔ api/gathering-image.ts 중복 통합 리팩터.
