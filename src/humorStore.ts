// 유머게시판 영속화 — Supabase(humor_posts/humor_comments) 있으면 DB, 없으면 localStorage.
// 삭제가 있으므로 save 시 "upsert + 목록에 없는 행 prune"으로 DB에도 삭제를 반영한다.
import { initialHumorComments, initialHumorPosts } from './data/mockData';
import { supabase } from './supabaseClient';
import type { HumorComment, HumorPost } from './types';

const POSTS_KEY = 'skgrove:humorposts';
const COMMENTS_KEY = 'skgrove:humorcomments';
const POSTS_TABLE = 'humor_posts';
const COMMENTS_TABLE = 'humor_comments';
const IMAGE_BUCKET = 'humor-images';
const SEED_VERSION_KEY = 'skgrove:humorseedv';
// 시드(mockData)를 바꾸면 이 값을 올린다 → 옛 localStorage 캐시를 한 번 비운다(데모용).
const SEED_VERSION = '2026-07-29c';

try {
  if (window.localStorage.getItem(SEED_VERSION_KEY) !== SEED_VERSION) {
    window.localStorage.removeItem(POSTS_KEY);
    window.localStorage.removeItem(COMMENTS_KEY);
    window.localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  }
} catch {
  // localStorage 접근 불가 시 무시
}

type HumorPostRow = {
  id: string;
  author: string;
  body?: string | null;
  media_url?: string | null;
  image_url?: string | null;
  created_at?: string | null;
  liked_by?: unknown;
};
type HumorCommentRow = {
  id: string;
  post_id: string;
  author: string;
  body?: string | null;
  created_at?: string | null;
};

// save 후 현재 id 목록에 없는 DB 행을 제거(삭제 반영). id는 영숫자·하이픈이라 따옴표 불필요.
async function pruneMissing(table: string, ids: string[]) {
  if (!supabase) return;
  const query = supabase.from(table).delete();
  const { error } = ids.length
    ? await query.not('id', 'in', `(${ids.join(',')})`)
    : await query.neq('id', '__none__');
  if (error) console.warn(`Supabase ${table} prune failed.`, error);
}

export async function loadHumorPosts(): Promise<HumorPost[]> {
  if (supabase) {
    const { data, error } = await supabase.from(POSTS_TABLE).select('*').order('created_at', { ascending: false });
    if (!error && data) {
      const posts = (data as HumorPostRow[]).map(postFromRow);
      window.localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
      return posts;
    }
  }
  try {
    const saved = window.localStorage.getItem(POSTS_KEY);
    if (!saved) return initialHumorPosts;
    const parsed = JSON.parse(saved) as HumorPost[];
    return Array.isArray(parsed) ? parsed : initialHumorPosts;
  } catch {
    return initialHumorPosts;
  }
}

export async function saveHumorPosts(posts: HumorPost[]) {
  try {
    window.localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch {
    // 저장 실패 무시
  }
  if (!supabase) return;
  if (posts.length > 0) {
    const { error } = await supabase.from(POSTS_TABLE).upsert(posts.map(postToRow), { onConflict: 'id' });
    if (error) console.warn('Supabase humor post save failed. Local fallback updated.', error);
  }
  await pruneMissing(POSTS_TABLE, posts.map((post) => post.id));
}

export async function loadHumorComments(): Promise<HumorComment[]> {
  if (supabase) {
    const { data, error } = await supabase.from(COMMENTS_TABLE).select('*').order('created_at', { ascending: true });
    if (!error && data) {
      const comments = (data as HumorCommentRow[]).map(commentFromRow);
      window.localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
      return comments;
    }
  }
  try {
    const saved = window.localStorage.getItem(COMMENTS_KEY);
    if (!saved) return initialHumorComments;
    const parsed = JSON.parse(saved) as HumorComment[];
    return Array.isArray(parsed) ? parsed : initialHumorComments;
  } catch {
    return initialHumorComments;
  }
}

export async function saveHumorComments(comments: HumorComment[]) {
  try {
    window.localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  } catch {
    // 저장 실패 무시
  }
  if (!supabase) return;
  if (comments.length > 0) {
    const { error } = await supabase.from(COMMENTS_TABLE).upsert(comments.map(commentToRow), { onConflict: 'id' });
    if (error) console.warn('Supabase humor comment save failed. Local fallback updated.', error);
  }
  await pruneMissing(COMMENTS_TABLE, comments.map((comment) => comment.id));
}

let humorSequence = 0;
export function makeHumorId() {
  humorSequence += 1;
  return `HUM-${Date.now().toString(36).toUpperCase()}-${humorSequence.toString(36).toUpperCase()}`;
}

let commentSequence = 0;
export function makeHumorCommentId() {
  commentSequence += 1;
  return `HMC-${Date.now().toString(36).toUpperCase()}-${commentSequence.toString(36).toUpperCase()}`;
}

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

function postFromRow(row: HumorPostRow): HumorPost {
  return {
    id: row.id,
    author: row.author,
    body: row.body ?? '',
    mediaUrl: row.media_url ?? '',
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at ?? '',
    likedBy: Array.isArray(row.liked_by) ? (row.liked_by as string[]) : [],
  };
}

function postToRow(post: HumorPost): HumorPostRow {
  return {
    id: post.id,
    author: post.author,
    // body·media_url·created_at 는 DB에서 not null default ''. 빈 값에 null 을 보내면
    // 23502(not-null 위반)로 저장이 통째로 막힌다 — 특히 미디어 없는 썸네일 전용 글.
    // 값이 없으면 default 와 같은 빈 문자열로 저장한다.
    body: post.body || '',
    media_url: post.mediaUrl || '',
    // image_url 만 nullable 이라 없으면 null 로 둔다.
    image_url: post.imageUrl ?? null,
    created_at: post.createdAt || '',
    liked_by: post.likedBy,
  };
}

function commentFromRow(row: HumorCommentRow): HumorComment {
  return {
    id: row.id,
    postId: row.post_id,
    author: row.author,
    body: row.body ?? '',
    createdAt: row.created_at ?? '',
  };
}

function commentToRow(comment: HumorComment): HumorCommentRow {
  return {
    id: comment.id,
    post_id: comment.postId,
    author: comment.author,
    body: comment.body || null,
    created_at: comment.createdAt || null,
  };
}
