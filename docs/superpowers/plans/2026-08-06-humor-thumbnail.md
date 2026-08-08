# 유머게시판 내용 기반 썸네일 자동 생성 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미지가 없는 유머 글에 대해 글 내용(body)으로 크레파스 썸네일을 자동 생성해 릴스 배경으로 깐다 — 이음장터·모임번개와 같은 화풍·배관으로.

**Architecture:** 등록 즉시 글을 저장하고, 백그라운드에서 서버 엔드포인트(`api/gathering-image.ts`의 세 번째 `humor` 갈래)로 내용만 보내 크레파스 이미지를 생성한다. 글자 제거 검사(최대 3회 재시도)를 통과한 이미지만 `humor-images` 버킷에 올리고 그 글의 `imageUrl`만 갱신한다. 엔드포인트가 없거나 실패하면 썸네일 없이 그대로 둔다.

**Tech Stack:** React 18 + TypeScript, Vite, Supabase(storage/postgres), Vitest, Node http 프록시(OpenRouter).

## Global Constraints

- 생성 이미지는 사용자가 붙인 `mediaUrl`과 **별개 필드** `imageUrl`에 저장한다 — 절대 `mediaUrl`을 덮어쓰지 않는다.
- 엔드포인트 env(`VITE_HUMOR_IMAGE_ENDPOINT`) 미설정 시 조용히 휴면 — 글 등록은 어떤 경우에도 성공해야 한다.
- 화풍은 서버에 고정(크레파스). 프론트는 등록값(사실)만 넘긴다. OpenRouter 키는 서버에만 존재하며 브라우저로 나가면 안 된다.
- 팀 관례: 순수 함수는 `*Rules.ts` + 단위 테스트(Vitest). React/상태 의존 없음.
- 인터페이스 기호는 이모지가 아니라 lucide 아이콘.
- 커밋 메시지는 한국어 한 줄 + 아래 Co-Authored-By 트레일러:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

---

## 파일 구조

- `src/humorRules.ts` (수정) — 미디어 판별(`resolveMedia`/`youtubeId`/`Media` 타입)을 여기로 올려 App·Board가 공유. 순수 함수 + 테스트.
- `src/humorRules.test.ts` (수정) — 미디어 판별 테스트 추가.
- `src/types.ts` (수정) — `HumorPost.imageUrl?` 추가.
- `supabase-schema.sql` (수정) — `humor_posts.image_url` 컬럼 + `humor-images` 버킷/정책.
- `src/humorStore.ts` (수정) — row 매핑 + `uploadHumorImage`.
- `api/gathering-image.ts` (수정) — humor 갈래(유일한 서버 구현; Task 3의 로컬 프록시 미러링은 취소).
- `src/humorImage.ts` (신규) — `requestHumorImage` 이음새.
- `.env.example` / `.env.ai.example` (수정) — `VITE_HUMOR_IMAGE_ENDPOINT` 예시 주석.
- `src/App.tsx` (수정) — `addHumorPost` 백그라운드 생성 + `patchHumorPost` + pending 전달.
- `src/features/humor/HumorBoard.tsx` (수정) — `imageUrl` 배경 렌더 + pending 표시 + 상세.

---

### Task 1: 미디어 판별을 humorRules로 올리고 테스트

App(생성 여부 판단)과 HumorBoard(렌더)가 "이 mediaUrl이 이미지인가"를 같은 기준으로 봐야 한다. 지금 `HumorBoard.tsx` 안에 있는 `resolveMedia`/`youtubeId`/`Media`를 순수 모듈로 올린다.

**Files:**
- Modify: `src/humorRules.ts`
- Modify: `src/humorRules.test.ts`
- Modify: `src/features/humor/HumorBoard.tsx` (import 교체, 로컬 정의 삭제)

**Interfaces:**
- Produces:
  - `export type Media = { type: 'image' | 'youtube' | 'video' | 'link'; src: string }`
  - `export function resolveMedia(url: string): Media | null`
  - `export function isImageMedia(url: string): boolean` — `resolveMedia(url)?.type === 'image'`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/humorRules.test.ts` 하단에 추가

```ts
import { isImageMedia, resolveMedia } from './humorRules';

describe('resolveMedia — 붙여넣은 URL을 종류별로 판별한다', () => {
  it('이미지 확장자와 data:image는 이미지', () => {
    expect(resolveMedia('https://x.com/a.png')?.type).toBe('image');
    expect(resolveMedia('https://x.com/a.JPG?v=1')?.type).toBe('image');
    expect(resolveMedia('data:image/png;base64,AAAA')?.type).toBe('image');
  });
  it('유튜브 링크는 embed로 바뀐다', () => {
    const m = resolveMedia('https://youtu.be/abcdefghijk');
    expect(m?.type).toBe('youtube');
    expect(m?.src).toContain('/embed/abcdefghijk');
  });
  it('mp4는 video, 그 외 http는 link', () => {
    expect(resolveMedia('https://x.com/a.mp4')?.type).toBe('video');
    expect(resolveMedia('https://x.com/post')?.type).toBe('link');
  });
  it('빈 값·위험 scheme은 null', () => {
    expect(resolveMedia('')).toBeNull();
    expect(resolveMedia('javascript:alert(1)')).toBeNull();
    expect(resolveMedia('data:text/html,<b>x')).toBeNull();
  });
  it('isImageMedia는 이미지일 때만 참', () => {
    expect(isImageMedia('https://x.com/a.png')).toBe(true);
    expect(isImageMedia('https://youtu.be/abcdefghijk')).toBe(false);
    expect(isImageMedia('')).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- humorRules`
Expected: FAIL — `resolveMedia`/`isImageMedia`가 humorRules에 없음.

- [ ] **Step 3: humorRules.ts에 구현 추가** — `HumorBoard.tsx`의 기존 `Media`/`youtubeId`/`resolveMedia`를 그대로 옮기고 `isImageMedia` 추가

```ts
// 붙여넣은 링크에서 유튜브 영상 id 추출(watch·youtu.be·shorts·embed).
export function youtubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export type Media = { type: 'image' | 'youtube' | 'video' | 'link'; src: string };

// 안전한 scheme(http(s)·data:image)만 허용한다. javascript:·data:text/html 등은 미디어로 취급하지 않는다.
export function resolveMedia(url: string): Media | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const yt = youtubeId(trimmed);
  if (yt) return { type: 'youtube', src: `https://www.youtube.com/embed/${yt}` };

  const isHttp = /^https?:\/\//i.test(trimmed);
  const isDataImage = /^data:image\//i.test(trimmed);

  if (isHttp && /\.(mp4|webm|ogg)(\?|$)/i.test(trimmed)) return { type: 'video', src: trimmed };
  if (isDataImage || (isHttp && /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/i.test(trimmed))) {
    return { type: 'image', src: trimmed };
  }
  if (isHttp) return { type: 'link', src: trimmed };
  return null;
}

// 이미지 배경을 이미 가진 글인가 — App이 "썸네일 생성할지" 판단할 때 쓴다.
export function isImageMedia(url: string): boolean {
  return resolveMedia(url)?.type === 'image';
}
```

- [ ] **Step 4: HumorBoard에서 로컬 정의 삭제하고 import로 교체**

`src/features/humor/HumorBoard.tsx`:
- 파일 내 `youtubeId`, `type Media = ...`, `resolveMedia` 정의(29–65행 부근) 삭제.
- import에 추가: `import { monthOf, rankCommenters, ... , resolveMedia } from '../../humorRules';` 및 `import type { Media } from '../../humorRules';`
  (기존 humorRules import 줄에 `resolveMedia`를 더하고, `Media` 타입 import를 추가한다. `mediaGlyph`/`MediaBlock`은 그대로 두되 `Media` 타입을 humorRules에서 가져온 것으로 참조.)

- [ ] **Step 5: 테스트·타입 확인**

Run: `npm test -- humorRules && npx tsc --noEmit`
Expected: PASS, 타입 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/humorRules.ts src/humorRules.test.ts src/features/humor/HumorBoard.tsx
git commit -m "유머 미디어 판별을 humorRules로 올려 App·Board가 공유

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 데이터 모델 + 저장소 (imageUrl 필드·컬럼·버킷·업로드)

**Files:**
- Modify: `src/types.ts` (`HumorPost`)
- Modify: `supabase-schema.sql` (`humor_posts` 컬럼 + `humor-images` 버킷/정책)
- Modify: `src/humorStore.ts` (row 매핑 + `uploadHumorImage`)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `HumorPost.imageUrl?: string`
  - `export async function uploadHumorImage(postId: string, file: File): Promise<{ imageUrl: string }>`

- [ ] **Step 1: 타입에 필드 추가** — `src/types.ts`의 `HumorPost`에

```ts
  imageUrl?: string; // 내용으로 생성한 크레파스 썸네일. mediaUrl(사용자가 붙인 링크)과 별개.
```

(`HumorPost` 타입 정의를 찾아 `mediaUrl` 아래에 추가.)

- [ ] **Step 2: 스키마 — 컬럼 추가** — `supabase-schema.sql`의 `humor_posts` create-table에 `image_url` 추가하고, 기존 DB 반영용 alter를 그 블록 아래(정책 뒤)에 넣는다

```sql
create table if not exists public.humor_posts (
  id text primary key,
  author text not null,
  body text not null default '',
  media_url text not null default '',
  image_url text,
  created_at text not null default '',
  liked_by jsonb not null default '[]'::jsonb
);
alter table public.humor_posts enable row level security;
drop policy if exists "Allow prototype humor posts all" on public.humor_posts;
create policy "Allow prototype humor posts all" on public.humor_posts for all using (true) with check (true);
-- 이미 만들어진 DB에도 컬럼을 더한다(create table if not exists 는 기존 테이블을 안 건드린다).
alter table public.humor_posts add column if not exists image_url text;
```

- [ ] **Step 3: 스키마 — 버킷/정책 추가** — `gathering-images` 블록을 그대로 복제해 `humor-images`로. `supabase-schema.sql`의 gathering-images 버킷 블록 근처에 이어서 추가

```sql
insert into storage.buckets (id, name, public)
values ('humor-images', 'humor-images', true)
on conflict (id) do nothing;

drop policy if exists "Allow prototype humor image reads" on storage.objects;
drop policy if exists "Allow prototype humor image writes" on storage.objects;
drop policy if exists "Allow prototype humor image updates" on storage.objects;
drop policy if exists "Allow prototype humor image deletes" on storage.objects;

create policy "Allow prototype humor image reads"
  on storage.objects for select
  using (bucket_id = 'humor-images');
create policy "Allow prototype humor image writes"
  on storage.objects for insert
  with check (bucket_id = 'humor-images');
create policy "Allow prototype humor image updates"
  on storage.objects for update
  using (bucket_id = 'humor-images')
  with check (bucket_id = 'humor-images');
create policy "Allow prototype humor image deletes"
  on storage.objects for delete
  using (bucket_id = 'humor-images');
```

> gathering-images 블록의 정확한 정책 문법을 이 파일에서 확인해 그대로 맞춘다(select/insert/update/delete 구분).

- [ ] **Step 4: humorStore — row 매핑** — `src/humorStore.ts`

`HumorPostRow`에 필드 추가:
```ts
  image_url?: string | null;
```
`postFromRow`에 추가:
```ts
    imageUrl: row.image_url ?? undefined,
```
`postToRow`에 추가:
```ts
    image_url: post.imageUrl ?? null,
```

- [ ] **Step 5: humorStore — uploadHumorImage 추가** — `uploadMarketImage`를 복제. 파일 상단 상수에 버킷 이름 추가 후 함수 추가

상단 상수:
```ts
const IMAGE_BUCKET = 'humor-images';
```
함수(파일 하단, id 생성기 근처):
```ts
/**
 * 생성 썸네일 업로드. Supabase 가 없으면 브라우저 안에서만 보이는 objectURL 로 폴백한다.
 * 로컬 개발에서도 생성 흐름을 끝까지 확인할 수 있어야 한다.
 */
export async function uploadHumorImage(postId: string, file: File): Promise<{ imageUrl: string }> {
  if (!supabase) return { imageUrl: URL.createObjectURL(file) };

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const storagePath = `${postId}/${safeName}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) {
    console.warn('Supabase humor image upload failed. Browser preview is still available.', error);
    return { imageUrl: URL.createObjectURL(file) };
  }
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
  return { imageUrl: data.publicUrl };
}
```

- [ ] **Step 6: 타입·기존 테스트 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 에러 없음, 기존 테스트 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/types.ts supabase-schema.sql src/humorStore.ts
git commit -m "유머 글에 생성 썸네일 imageUrl 필드·humor-images 버킷·업로드 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: [삭제됨 — 로컬 프록시 humor 갈래]

**결정(2026-08-06):** 이 태스크는 취소됐다. 이음장터(market)가 로컬 프록시(`scripts/image-proxy.mjs`)를
건드리지 않고 `api/gathering-image.ts`에만 item 갈래를 두었듯, humor도 **서버 로직을 `api/gathering-image.ts`
한 곳(Task 4)에만** 둔다. 로컬 라이브 생성은 검증하지 않으며(dev 배포 환경에서 확인), 프록시↔서버리스
프롬프트 이중화도 피한다. 원래 이 태스크로 넣었던 커밋 8f377d3 은 되돌렸다.

### Task 4: 서버리스(api/gathering-image.ts)에 humor 갈래 — 유일한 서버 구현

humor 서버 로직은 이 파일 한 곳에만 둔다(Task 3 삭제). 이 파일이 배포 환경에서 실제로 도는 구현이며, market의 item 갈래와 같은 구조다. 프론트는 같은 `/api/gathering-image` 엔드포인트로 `{ humor: { body } }`를 보낸다.

**Files:**
- Modify: `api/gathering-image.ts`

**Interfaces:**
- Consumes: 기존 `STYLE`/`chat`/`usableSubject`/`generateClean`(글자검사·재시도) 재사용.
- Produces: `POST`가 `{ humor: { body } }`를 받으면 humor 이미지를 반환.

- [ ] **Step 1: HumorInput 타입 추가** — `GatheringInput`/`ItemInput` 옆에

```ts
type HumorInput = {
  body?: string;
};
```

- [ ] **Step 2: HUMOR_FRAME + 빌더 + 주제 질의 추가** — `MARKET_FRAME`/`buildItemPrompt` 근처에 (Task 3과 동일 문구)

```ts
const HUMOR_FRAME = [
  'Vertical 4:5 thumbnail, single continuous funny scene filling the whole frame.',
  'Full bleed edge to edge, no border, no white margin.',
  'A light, wholesome, gently comic moment — nothing mean or crude.',
  'No speech bubbles, no captions, no letters, no numbers anywhere.',
  'Every surface is blank and unmarked. Faces simplified, no identifiable real person.',
].join(' ');

/** 유머: 화풍(고정) + 장면 묘사(가변) + 장면 제약(고정). */
function buildHumorPrompt(subject: string): string {
  return `${STYLE} A single funny everyday scene: ${subject}. ${HUMOR_FRAME}`;
}

function askHumorSubject(apiKey: string, textModel: string, humor: HumorInput): Promise<string> {
  return chat(
    apiKey,
    textModel,
    [
      {
        role: 'user',
        content:
          'You write one-line scene descriptions for an illustrator.\n' +
          'Turn this Korean humor post into ONE English sentence, 8-15 words, describing a single ' +
          'funny visual scene one could draw. No speech, no captions, no text in the scene.\n' +
          'Replace any real person or brand with a generic type. Keep it light and wholesome.\n' +
          'Reply with the sentence alone — no markdown, no quotes, no preamble.\n' +
          `글: ${humor.body ?? ''}`,
      },
    ],
    60,
  );
}
```

- [ ] **Step 3: POST 분기에 humor 추가** — 기존 `if (payload.item?.title) {...} else if (payload.gathering?.title) {...} else {...}` 사슬에 humor 가지 삽입

```ts
  let basePrompt: string;
  let label: string;
  if (payload.item?.title) {
    const item = payload.item;
    const translated = await askItemSubject(apiKey, models.text, item).catch(() => '');
    const subject = usableSubject(translated) ? translated : 'a simple everyday second-hand object';
    basePrompt = buildItemPrompt(subject);
    label = item.title;
  } else if (payload.gathering?.title) {
    const gathering = payload.gathering;
    const translated = await askGatheringSubject(apiKey, models.text, gathering).catch(() => '');
    const subject = usableSubject(translated) ? translated : 'Coworkers spending time together after work.';
    basePrompt = buildGatheringPrompt(subject, gathering);
    label = gathering.title;
  } else if (payload.humor?.body) {
    const humor = payload.humor;
    const translated = await askHumorSubject(apiKey, models.text, humor).catch(() => '');
    const subject = usableSubject(translated) ? translated : 'Coworkers laughing together at something silly.';
    basePrompt = buildHumorPrompt(subject);
    label = humor.body.slice(0, 20);
  } else {
    return Response.json({ ok: false, reason: 'no subject' });
  }
```

그리고 payload 타입을 확장:
```ts
  let payload: { gathering?: GatheringInput; item?: ItemInput; humor?: HumorInput };
  try {
    payload = (await request.json()) as { gathering?: GatheringInput; item?: ItemInput; humor?: HumorInput };
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
```

- [ ] **Step 4: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 타입 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add api/gathering-image.ts
git commit -m "서버리스 이미지 함수에 유머 갈래 추가 (프록시와 동일 프롬프트)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 프론트 이음새 humorImage.ts + env 예시

**Files:**
- Create: `src/humorImage.ts`
- Modify: `.env.example`
- Modify: `.env.ai.example`

**Interfaces:**
- Consumes: `fileFromDataUri`(gatheringImage.ts), `HumorPost`(types)
- Produces: `export async function requestHumorImage(post: HumorPost): Promise<File | null>`

- [ ] **Step 1: humorImage.ts 작성** — `marketImage.ts` 규약을 따른다

```ts
// 유머 썸네일 생성 이음새(seam) — 이미지가 없는 유머 글의 대표 이미지를 서버에서 그려온다.
// gatheringImage.ts / marketImage.ts 와 같은 규약: VITE_HUMOR_IMAGE_ENDPOINT 가 없으면
// 조용히 휴면하고 호출부는 썸네일 없이 글을 그대로 둔다.
//
// 서버 함수(api/gathering-image)는 모임·물건·유머를 함께 처리한다. 유머는 { humor: { body } }
// 형태로 보내면 '우스운 장면 하나를 크레파스로' 그려 돌려준다. 화풍은 서버가 갖고, 프론트는 사실만 넘긴다.
// data URI → File 변환은 gatheringImage 와 공유한다(첨부 사진과 같은 업로드 경로를 태우려고).
import { fileFromDataUri } from './gatheringImage';
import type { HumorPost } from './types';

function endpoint() {
  return (import.meta.env as Record<string, string | undefined>).VITE_HUMOR_IMAGE_ENDPOINT || undefined;
}

/**
 * 유머 썸네일을 만들어 File 로 돌려준다.
 * 엔드포인트가 없거나, 생성이 실패하거나, 글자를 못 지웠으면 null —
 * 호출부는 "없으면 썸네일 없이" 한 갈래만 다루면 된다.
 */
export async function requestHumorImage(post: HumorPost): Promise<File | null> {
  const url = endpoint();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ humor: { body: post.body } }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; dataUri?: string } | null;
    if (!data?.ok || !data.dataUri) return null;
    return fileFromDataUri(data.dataUri, post.id);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: env 예시 추가** — `.env.example`의 gathering 줄 아래에

```
# VITE_HUMOR_IMAGE_ENDPOINT=http://127.0.0.1:8787/api/gathering-image
```

`.env.ai.example`에도 gathering/market 이미지 관련 주석 근처에 같은 한 줄을 추가(파일에 gathering 예시가 있으면 그 옆에, 없으면 이미지 엔드포인트 설명 블록에).

- [ ] **Step 3: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 타입 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/humorImage.ts .env.example .env.ai.example
git commit -m "유머 썸네일 생성 프론트 이음새·env 예시 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: App 배선 — 등록 후 백그라운드 생성

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `requestHumorImage`(humorImage), `uploadHumorImage`(humorStore), `isImageMedia`(humorRules), 기존 `imagePendingIds`/`setImagePendingIds` state.
- Produces: `HumorBoard`에 `imagePendingIds` prop 전달. `addHumorPost`가 이미지 없는 글에 대해 백그라운드로 `imageUrl`을 채운다.

- [ ] **Step 1: import 추가** — `src/App.tsx` 상단 import 블록

```ts
import { requestHumorImage } from './humorImage';
import { isImageMedia } from './humorRules';
```
그리고 humorStore import에 `uploadHumorImage` 추가:
```ts
import { ..., uploadHumorImage } from './humorStore';
```
(기존 `loadHumorPosts` 등을 들여오는 humorStore import 줄에 더한다.)

- [ ] **Step 2: patchHumorPost 헬퍼 추가** — `persistHumorPosts` 아래에

```ts
  const patchHumorPost = (id: string, patch: Partial<HumorPost>) => {
    setHumorPosts((prev) => {
      const next = prev.map((post) => (post.id === id ? { ...post, ...patch } : post));
      saveHumorPosts(next);
      return next;
    });
  };
```

> 주의: `patchMarketItem`(1066행)과 같은 형태다. `setHumorPosts` 함수형 갱신을 써서 백그라운드 콜백이 오래된 목록을 덮어쓰지 않게 한다.

- [ ] **Step 3: addHumorPost에 백그라운드 생성 추가** — 기존 `addHumorPost`의 `persistHumorPosts([post, ...humorPosts]);` 뒤에

```ts
    persistHumorPosts([post, ...humorPosts]);

    /*
      이미지가 없는 글이면 등록을 마친 뒤 배경에서 크레파스 썸네일을 그린다 — 이음장터·모임과 같은 방식.
      그동안 릴스는 텍스트만 보여주고, 다 그려지면 그 글에만 imageUrl 이 붙어 배경이 깔린다. 실패하면 그대로.
    */
    if (!isImageMedia(post.mediaUrl)) {
      setImagePendingIds((prev) => [...prev, post.id]);
      void (async () => {
        try {
          const generated = await requestHumorImage(post);
          if (!generated) return;
          const { imageUrl } = await uploadHumorImage(post.id, generated);
          patchHumorPost(post.id, { imageUrl });
        } finally {
          setImagePendingIds((prev) => prev.filter((pendingId) => pendingId !== post.id));
        }
      })();
    }
```

- [ ] **Step 4: HumorBoard에 imagePendingIds 전달** — `<HumorBoard ... />`에 prop 추가

```tsx
        <HumorBoard
          posts={humorPosts}
          comments={humorComments}
          currentUser={currentUser}
          canModerate={isTeamLeader(currentUser)}
          imagePendingIds={imagePendingIds}
          onAddPost={addHumorPost}
          onToggleLike={toggleHumorLike}
          onAddComment={addHumorComment}
          onEditPost={editHumorPost}
          onDeletePost={deleteHumorPost}
          onDeleteComment={deleteHumorComment}
        />
```

- [ ] **Step 5: 타입 확인** (HumorBoard prop은 Task 7에서 추가하므로 이 시점엔 타입 에러가 날 수 있음 — Task 7과 함께 컴파일된다)

Run: `npx tsc --noEmit`
Expected: `imagePendingIds` prop 관련 에러만 남고 그 외 없음. (Task 7에서 해소)

- [ ] **Step 6: 커밋**

```bash
git add src/App.tsx
git commit -m "유머 글 등록 후 이미지 없는 글에 크레파스 썸네일 백그라운드 생성

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: HumorBoard UI — imageUrl 배경·pending·상세

**Files:**
- Modify: `src/features/humor/HumorBoard.tsx`

**Interfaces:**
- Consumes: `HumorBoardProps`에 `imagePendingIds: string[]` 추가. `post.imageUrl`, `resolveMedia`(humorRules), `isImageMedia` 개념.

- [ ] **Step 1: prop 타입·구조분해 추가** — `HumorBoardProps`에

```ts
  imagePendingIds: string[];
```
컴포넌트 시그니처 구조분해에 `imagePendingIds` 추가:
```ts
export function HumorBoard({
  posts,
  comments,
  currentUser,
  canModerate,
  imagePendingIds,
  onAddPost,
  ...
```

- [ ] **Step 2: Hourglass 아이콘 import 추가** — lucide import 줄에 `Hourglass` 추가

```ts
import { AlertTriangle, ArrowLeft, Crown, FileText, Hourglass, Image as ImageIcon, Laugh, Link2, MessageCircle, Medal, PenLine, PlayCircle, Send, Sparkles, Trash2, Trophy, X } from 'lucide-react';
```

- [ ] **Step 3: 릴스 카드 — 생성 배경·pending 렌더** — 목록 렌더의 릴스 버튼(462–499행 부근)을 수정

배경 이미지 결정과 pending 표시를 추가한다. 현재 `media?.type === 'image'`일 때만 배경을 깐다. 사용자 이미지가 없고 `post.imageUrl`이 있으면 그걸 배경으로 쓴다:

```tsx
        {visiblePosts.map((post) => {
          const postComments = commentsByPost.get(post.id) ?? [];
          const media = resolveMedia(post.mediaUrl);
          const Glyph = mediaGlyph(media);
          const liked = post.likedBy.includes(currentUser.name);
          // 배경: 사용자가 붙인 이미지 우선, 없으면 생성 썸네일(imageUrl).
          const bgSrc = media?.type === 'image' ? media.src : post.imageUrl || null;
          const drawing = imagePendingIds.includes(post.id);
          return (
            <button
              className={bgSrc ? 'ig-reel has-media' : 'ig-reel'}
              key={post.id}
              onClick={() => openDetail(post.id)}
              type="button"
            >
              {bgSrc && <img alt="" className="ig-reel-bg" loading="lazy" src={bgSrc} />}
              {drawing && !bgSrc && (
                <span className="ig-drawing">
                  <Hourglass size={14} />
                  그림 그리는 중
                </span>
              )}

              <span className="ig-reel-side">
                <span className={liked ? 'liked' : ''}>
                  <Laugh size={22} />
                  {post.likedBy.length}
                </span>
                <span>
                  <MessageCircle size={22} />
                  {postComments.length}
                </span>
                <span>
                  <Glyph size={20} />
                </span>
              </span>

              <span className="ig-reel-text">
                <b>
                  <Avatar name={post.author} />
                  {post.author}
                </b>
                <em>{post.body}</em>
                <small>{post.createdAt}</small>
              </span>
            </button>
          );
        })}
```

> `.ig-drawing`/`.ig-reel-bg`/`.ig-reel.has-media` 는 이음장터에서 이미 쓰는 클래스라 styles.css에 존재한다. 새 CSS 불필요.

- [ ] **Step 4: 상세 화면 — 생성 썸네일 표시** — 상세의 `<MediaBlock media={resolveMedia(detailPost.mediaUrl)} />`(270행 부근) 다음에, 사용자 미디어가 없고 생성 썸네일이 있으면 표시

```tsx
              <p className="humor-card-body">{detailPost.body}</p>
              <MediaBlock media={resolveMedia(detailPost.mediaUrl)} />
              {!resolveMedia(detailPost.mediaUrl) && detailPost.imageUrl && (
                <div className="humor-card-image">
                  <img src={detailPost.imageUrl} alt="" loading="lazy" />
                </div>
              )}
```

> `.humor-card-image` 는 이미 MediaBlock의 이미지 분기에서 쓰는 클래스라 존재한다.

- [ ] **Step 5: 타입·테스트 확인** (이제 App+Board 함께 컴파일)

Run: `npx tsc --noEmit && npm test`
Expected: 타입 에러 없음, 전체 테스트 PASS.

- [ ] **Step 6: 브라우저 검증** — dev 서버(preview_start `skgrove-dev`)에서 로그인 → 유머게시판. 엔드포인트 미설정이라 생성은 휴면이지만, 다음을 확인:
  - 콘솔 에러 없음
  - 텍스트 전용 글이 지금처럼 텍스트만 보임(회귀 없음)
  - 이미지 링크를 붙인 글은 그대로 배경 이미지

Run: preview_start → 스크린샷 → read_console_messages(onlyErrors)
Expected: 유머게시판 정상 렌더, 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/features/humor/HumorBoard.tsx
git commit -m "유머 릴스에 생성 썸네일 배경·그리는 중 표시·상세 반영

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (작성자 체크)

**Spec coverage:**
- 데이터 모델(imageUrl/컬럼/버킷) → Task 2 ✅
- 저장소 매핑·업로드 → Task 2 ✅
- 프론트 이음새 → Task 5 ✅
- 서버 분기(로컬+프로덕션) → Task 3, 4 ✅
- UI(배경·pending·상세) → Task 7 ✅
- 호출 흐름(addHumorPost·patchHumorPost·pending) → Task 6 ✅
- 미디어 판별 공유(resolveMedia→humorRules) → Task 1 ✅
- 휴면·env → Task 5 ✅
- 테스트: 미디어 판별(Task 1), 프롬프트(Task 3) ✅. `requestHumorImage`/store 매핑은 기존 패턴(marketImage/marketStore)과 동일하게 fetch/DB 의존이라 단위 테스트 없이 tsc+브라우저로 검증 — 기존 코드베이스 관례를 따름.

**Placeholder scan:** TBD/TODO 없음. 모든 코드 단계에 실제 코드 포함. ✅

**Type consistency:**
- `resolveMedia`/`isImageMedia`/`Media`(Task 1) — Task 6·7에서 같은 이름으로 사용 ✅
- `uploadHumorImage(postId, file) → { imageUrl }`(Task 2) — Task 6에서 동일 시그니처 사용 ✅
- `requestHumorImage(post) → File|null`(Task 5) — Task 6에서 동일 ✅
- `buildHumorPrompt`/`HUMOR_FRAME`/`askHumorSubject` 문구 — Task 3(mjs)·Task 4(ts) 동일 문장 ✅
- `imagePendingIds`(기존 state 재사용) — Task 6 전달, Task 7 소비 ✅
- `patchHumorPost(id, patch)`(Task 6) — 함수형 setState 사용, market 패턴 일치 ✅

**주의(교차 태스크 컴파일):** Task 6은 `imagePendingIds` prop을 전달하지만 그 prop 타입은 Task 7에서 추가된다. 두 태스크는 함께 컴파일돼야 tsc가 깨끗하다(Task 6 Step 5 참고). 순차 실행 시 Task 6에서 일시적 타입 에러가 예상되며 Task 7에서 해소된다.
