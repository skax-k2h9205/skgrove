// 유머게시판 월간 랭킹 — 순수 함수(팀 관례: *Rules.ts + 단위 테스트). React·상태 의존 없음.
import type { HumorComment, HumorPost } from './types';

export type Ranker = { name: string; count: number };

// 'YYYY-MM-DD' → 'YYYY-MM'
export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// 동점은 수치 내림차순 → 이름 오름차순. 유효 데이터(count>0)만, 상위 limit명.
function rankOf(counts: Map<string, number>, limit: number): Ranker[] {
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .filter((ranker) => ranker.count > 0)
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, limit);
}

// 이번 달 글 수 집계(글쓰기왕)
function posterCounts(posts: HumorPost[], month: string): Map<string, number> {
  const counts = new Map<string, number>();
  posts
    .filter((post) => monthOf(post.createdAt) === month)
    .forEach((post) => counts.set(post.author, (counts.get(post.author) ?? 0) + 1));
  return counts;
}

// 이번 달 댓글 수 집계(댓글왕)
function commenterCounts(comments: HumorComment[], month: string): Map<string, number> {
  const counts = new Map<string, number>();
  comments
    .filter((comment) => monthOf(comment.createdAt) === month)
    .forEach((comment) => counts.set(comment.author, (counts.get(comment.author) ?? 0) + 1));
  return counts;
}

// 이번 달 자기 글이 받은 좋아요 합 집계(빵터짐왕)
function likedCounts(posts: HumorPost[], month: string): Map<string, number> {
  const counts = new Map<string, number>();
  posts
    .filter((post) => monthOf(post.createdAt) === month)
    .forEach((post) => counts.set(post.author, (counts.get(post.author) ?? 0) + post.likedBy.length));
  return counts;
}

// ── 상위 N 랭킹(명예의 전당 1~3등) ──
export function rankPosters(posts: HumorPost[], month: string, limit = 3): Ranker[] {
  return rankOf(posterCounts(posts, month), limit);
}
export function rankCommenters(comments: HumorComment[], month: string, limit = 3): Ranker[] {
  return rankOf(commenterCounts(comments, month), limit);
}
export function rankLiked(posts: HumorPost[], month: string, limit = 3): Ranker[] {
  return rankOf(likedCounts(posts, month), limit);
}

// ── 1등만(지난 달 수상자 한 줄 등) ──
export function topPoster(posts: HumorPost[], month: string): Ranker | null {
  return rankPosters(posts, month, 1)[0] ?? null;
}
export function topCommenter(comments: HumorComment[], month: string): Ranker | null {
  return rankCommenters(comments, month, 1)[0] ?? null;
}
export function topLiked(posts: HumorPost[], month: string): Ranker | null {
  return rankLiked(posts, month, 1)[0] ?? null;
}

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

// 유튜브 링크에서 영상 썸네일 URL을 만든다. API 키·서버 불필요(고정 주소).
// hqdefault 는 어느 영상에나 존재하는 480x360 썸네일이다(maxres 는 없는 영상이 있어 안 쓴다).
export function youtubeThumb(url: string): string | undefined {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined;
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
