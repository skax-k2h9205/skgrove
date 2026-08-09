// 유머게시판 영속화 — Supabase(humor_posts/humor_comments) 있으면 DB, 없으면 localStorage.
// 저장은 remoteTable.syncRows 로 "내가 바꾼 것만" 쓴다. 예전처럼 배열 전체를 밀어넣고
// 목록에 없는 행을 prune 하면, 오래된 탭 하나가 남이 지운 데이터를 통째로 되살린다.
import { initialHumorComments, initialHumorPosts } from './data/mockData';
import { rememberRemote, syncRows } from './remoteTable';
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

// 우리가 저장할 때 쓰는 컬럼. 원격 스냅샷을 만들 때 이 컬럼만 비교한다
// (created_at 기본값 등 우리가 안 건드리는 값 때문에 매번 '바뀐 것'으로 보이지 않게).
const POST_WRITE_KEYS = ['id', 'author', 'body', 'media_url', 'created_at', 'liked_by'];
const COMMENT_WRITE_KEYS = ['id', 'post_id', 'author', 'body', 'created_at'];

/** localStorage 캐시만 읽는다. 없으면 빈 배열 — 시드로 떨어지지 않는다. */
function readLocal<T>(key: string): T[] {
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadHumorPosts(): Promise<HumorPost[]> {
  if (supabase) {
    const { data, error } = await supabase.from(POSTS_TABLE).select('*').order('created_at', { ascending: false });
    if (!error && data) {
      const posts = (data as HumorPostRow[]).map(postFromRow);
      rememberRemote(POSTS_TABLE, data as unknown as Record<string, unknown>[], POST_WRITE_KEYS);
      window.localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
      return posts;
    }
    // DB 를 못 읽었다 — 시드로 떨어지면 안 된다. 시드가 저장을 타고 프로덕션에 올라간다.
    return readLocal(POSTS_KEY);
  }
  // Supabase 미설정(로컬 전용 데모)일 때만 시드를 쓴다.
  const local = readLocal<HumorPost>(POSTS_KEY);
  return local.length ? local : initialHumorPosts;
}

export async function saveHumorPosts(posts: HumorPost[]) {
  try {
    window.localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch {
    // 저장 실패 무시
  }
  await syncRows(POSTS_TABLE, posts.map(postToRow));
}

export async function loadHumorComments(): Promise<HumorComment[]> {
  if (supabase) {
    const { data, error } = await supabase.from(COMMENTS_TABLE).select('*').order('created_at', { ascending: true });
    if (!error && data) {
      const comments = (data as HumorCommentRow[]).map(commentFromRow);
      rememberRemote(COMMENTS_TABLE, data as unknown as Record<string, unknown>[], COMMENT_WRITE_KEYS);
      window.localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
      return comments;
    }
    return readLocal(COMMENTS_KEY);
  }
  const local = readLocal<HumorComment>(COMMENTS_KEY);
  return local.length ? local : initialHumorComments;
}

export async function saveHumorComments(comments: HumorComment[]) {
  try {
    window.localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  } catch {
    // 저장 실패 무시
  }
  await syncRows(COMMENTS_TABLE, comments.map(commentToRow));
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
