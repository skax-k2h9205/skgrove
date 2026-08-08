import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { AlertTriangle, ArrowLeft, Crown, FileText, Hourglass, Image as ImageIcon, Laugh, Link2, MessageCircle, Medal, PenLine, PlayCircle, Send, Sparkles, Trash2, Trophy, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { PanelHeader } from '../../components/PanelHeader';
import { monthOf, rankCommenters, rankLiked, rankPosters, resolveMedia, topCommenter, topLiked, topPoster, youtubeThumb } from '../../humorRules';
import type { Media, Ranker } from '../../humorRules';
import type { CurrentUser, HumorComment, HumorPost } from '../../types';

type HumorBoardProps = {
  posts: HumorPost[];
  comments: HumorComment[];
  currentUser: CurrentUser;
  canModerate: boolean;
  imagePendingIds: string[];
  onAddPost: (draft: { body: string; mediaUrl: string }) => void;
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, body: string) => void;
  onEditPost: (postId: string, draft: { body: string; mediaUrl: string }) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  /** 홈 피드에서 이 글을 눌러 들어온 경우 그 id. 바로 상세를 열고 한 번만 소비한다. */
  focusId?: string | null;
  onFocusHandled?: () => void;
};

// 'YYYY-MM' 기준으로 delta개월 이동.
function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
}

/*
  목록 행에 붙는 미디어 표시(무거운 플레이어 대신 종류 아이콘만).
  이모지는 OS 마다 다른 그림으로 그려진다 — 한국어 폰트를 Pretendard 로 고정한 것과
  같은 이유로 인터페이스 기호는 아이콘을 쓴다. 스크린리더가 "사진" 대신 "액자"를
  읽는 문제와 --color-* 토큰으로 색을 못 맞추는 문제도 함께 사라진다.
*/
function mediaGlyph(media: Media | null): ElementType {
  if (!media) return FileText;
  if (media.type === 'image') return ImageIcon;
  if (media.type === 'youtube' || media.type === 'video') return PlayCircle;
  return Link2;
}

// 상세에서만 실제 미디어를 로드(첫 목록 화면은 가볍게 유지).
function MediaBlock({ media }: { media: Media | null }) {
  if (!media) return null;
  if (media.type === 'image') {
    return (
      <div className="humor-card-image">
        <img src={media.src} alt="" loading="lazy" />
      </div>
    );
  }
  if (media.type === 'youtube') {
    return (
      <div className="humor-card-video">
        <iframe
          src={media.src}
          title="유머 영상"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (media.type === 'video') {
    return (
      <div className="humor-card-video">
        <video src={media.src} controls />
      </div>
    );
  }
  return (
    <a className="humor-card-link" href={media.src} target="_blank" rel="noreferrer">
      <Link2 size={16} />
      링크 열기
    </a>
  );
}

type RankerCard = { key: string; icon: ElementType; title: string; unit: string; list: Ranker[] };


export function HumorBoard({
  posts,
  comments,
  currentUser,
  canModerate,
  imagePendingIds,
  onAddPost,
  onToggleLike,
  onAddComment,
  onEditPost,
  onDeletePost,
  onDeleteComment,
  focusId,
  onFocusHandled,
}: HumorBoardProps) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  // 글 수정: 상세 화면에서 본인 글의 내용/미디어를 인라인 편집.
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editMedia, setEditMedia] = useState('');
  // 삭제는 되돌릴 수 없는 행동 — 네이티브 confirm() 대신 카드 안에서 펼치는 확인 UI로 받는다.
  const [deletingPost, setDeletingPost] = useState(false);

  const openDetail = (postId: string | null) => {
    setDetailId(postId);
    setEditing(false);
    setDeletingPost(false);
  };

  // 홈 피드에서 이 글을 눌러 들어오면 바로 그 상세를 연다(한 번만 소비).
  useEffect(() => {
    if (focusId) {
      openDetail(focusId);
      onFocusHandled?.();
    }
  }, [focusId]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);

  const commentsByPost = useMemo(() => {
    const map = new Map<string, HumorComment[]>();
    comments.forEach((comment) => {
      const list = map.get(comment.postId) ?? [];
      list.push(comment);
      map.set(comment.postId, list);
    });
    map.forEach((list) => list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
    return map;
  }, [comments]);

  const submitComment = (postId: string) => {
    const draft = commentDrafts[postId]?.trim();
    if (!draft) return;
    onAddComment(postId, draft);
    setCommentDrafts({ ...commentDrafts, [postId]: '' });
  };

  const canDeletePost = (post: HumorPost) => post.author === currentUser.name || canModerate;
  const canDeleteComment = (comment: HumorComment) => comment.author === currentUser.name || canModerate;
  const canEditPost = (post: HumorPost) => post.author === currentUser.name; // 수정은 본인 글만

  const startEditPost = (post: HumorPost) => {
    setEditBody(post.body);
    setEditMedia(post.mediaUrl);
    setEditing(true);
    setDeletingPost(false);
  };
  const saveEditPost = (postId: string) => {
    if (!editBody.trim()) return;
    onEditPost(postId, { body: editBody, mediaUrl: editMedia });
    setEditing(false);
  };

  // ── 글상세 화면 ──────────────────────────────
  const detailPost = detailId ? posts.find((post) => post.id === detailId) ?? null : null;
  if (detailPost) {
    const postComments = commentsByPost.get(detailPost.id) ?? [];
    const liked = detailPost.likedBy.includes(currentUser.name);
    return (
      <section className="screen humor-screen">
        <button className="humor-back" onClick={() => openDetail(null)}>
          <ArrowLeft size={16} />
          목록으로
        </button>
        <article className="humor-card humor-detail">
          <header className="humor-card-head">
            <Avatar name={detailPost.author} />
            <div>
              <strong>{detailPost.author}</strong>
              <small>{detailPost.createdAt}</small>
            </div>
            {!editing && !deletingPost && (canEditPost(detailPost) || canDeletePost(detailPost)) && (
              <div className="humor-owner-actions">
                {canEditPost(detailPost) && (
                  <button className="humor-owner-btn edit" onClick={() => startEditPost(detailPost)}>
                    <PenLine size={15} />
                    수정
                  </button>
                )}
                {canDeletePost(detailPost) && (
                  <button className="humor-owner-btn delete" onClick={() => setDeletingPost(true)}>
                    <Trash2 size={15} />
                    삭제
                  </button>
                )}
              </div>
            )}
          </header>
          {deletingPost && (
            <div className="agenda-close-box">
              <AlertTriangle size={18} />
              <p>이 글을 삭제하면 되돌릴 수 없어요. 댓글도 함께 사라집니다.</p>
              <div className="vote-confirm-actions">
                <button className="secondary-button" onClick={() => setDeletingPost(false)}>
                  취소
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    onDeletePost(detailPost.id);
                    openDetail(null);
                  }}
                >
                  <Trash2 size={15} />
                  삭제 확정
                </button>
              </div>
            </div>
          )}
          {editing ? (
            <div className="humor-edit">
              <label>
                내용
                <textarea value={editBody} autoFocus onChange={(event) => setEditBody(event.target.value)} />
              </label>
              <label>
                이미지 · 영상 링크 (선택)
                <input
                  value={editMedia}
                  placeholder="이미지 주소나 유튜브 링크"
                  onChange={(event) => setEditMedia(event.target.value)}
                />
              </label>
              <div className="humor-edit-actions">
                <button className="secondary-button" onClick={() => setEditing(false)}>
                  취소
                </button>
                <button className="primary-button" disabled={!editBody.trim()} onClick={() => saveEditPost(detailPost.id)}>
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="humor-card-body">{detailPost.body}</p>
              <MediaBlock media={resolveMedia(detailPost.mediaUrl)} />
            </>
          )}
          <div className="humor-card-actions">
            <button className={liked ? 'humor-like active' : 'humor-like'} onClick={() => onToggleLike(detailPost.id)}>
              <Laugh size={16} />
              빵터짐 {detailPost.likedBy.length}
            </button>
            <span className="humor-comment-count">
              <MessageCircle size={16} />
              댓글 {postComments.length}
            </span>
          </div>
          <div className="humor-comments">
            {postComments.map((comment) => (
              <div className="humor-comment" key={comment.id}>
                <Avatar name={comment.author} />
                <div className="humor-comment-body">
                  <strong>{comment.author}</strong>
                  <p>{comment.body}</p>
                  <small>{comment.createdAt}</small>
                </div>
                {canDeleteComment(comment) && (
                  <button className="humor-icon-btn" aria-label="댓글 삭제" onClick={() => onDeleteComment(comment.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {postComments.length === 0 && <p className="humor-comment-empty">첫 댓글을 남겨보세요.</p>}
            <div className="humor-comment-input">
              <input
                value={commentDrafts[detailPost.id] ?? ''}
                placeholder="댓글 달기"
                onChange={(event) => setCommentDrafts({ ...commentDrafts, [detailPost.id]: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitComment(detailPost.id);
                }}
              />
              <button className="secondary-button" onClick={() => submitComment(detailPost.id)}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </article>
      </section>
    );
  }

  // ── 목록 화면 ────────────────────────────────
  const rankers: RankerCard[] = [
    { key: 'liked', icon: Laugh, title: '빵터짐왕', unit: '좋아요', list: rankLiked(posts, thisMonth) },
    { key: 'poster', icon: PenLine, title: '글쓰기왕', unit: '글', list: rankPosters(posts, thisMonth) },
    { key: 'commenter', icon: MessageCircle, title: '댓글왕', unit: '댓글', list: rankCommenters(comments, thisMonth) },
  ];

  const lastWinners = [
    { icon: Laugh, label: '빵터짐왕', ranker: topLiked(posts, lastMonth) },
    { icon: PenLine, label: '글쓰기왕', ranker: topPoster(posts, lastMonth) },
    { icon: MessageCircle, label: '댓글왕', ranker: topCommenter(comments, lastMonth) },
  ].filter((item) => item.ranker);

  const visiblePosts = [...posts];
  if (sort === 'popular') {
    visiblePosts.sort((a, b) => b.likedBy.length - a.likedBy.length || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  } else {
    visiblePosts.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  const submitPost = () => {
    if (!body.trim()) return;
    onAddPost({ body, mediaUrl });
    setBody('');
    setMediaUrl('');
    setWriting(false);
  };

  return (
    <section className="screen humor-screen">
      {/*
        명예의 전당을 이음장터와 같은 모양·자리로. 아바타 시상대 대신 압축 순위표를
        맨 위에 둔다. 카드·번호는 이음장터(.market-rank*)를 그대로 재사용해 두 화면의
        명예의 전당이 같은 모양이 되게 하고, 여긴 카테고리가 3개라 그리드만 3열로 둔다.
        아무 실적도 없으면 4칸 '아직 없음' 대신 안내 한 줄로 첫 주인공을 유도한다.
      */}
      <section className="panel humor-hall">
        <div className="market-hall-head">
          <Trophy size={18} />
          <strong>이번 달 명예의 전당</strong>
        </div>
        {rankers.some((card) => card.list.length > 0) ? (
          <div className="humor-rank-grid">
            {rankers.map((card) => (
              <div className="market-rank" key={card.key}>
                <h3>{card.title}</h3>
                {card.list.length === 0 ? (
                  <p className="field-note">아직 없음</p>
                ) : (
                  <ol>
                    {card.list.map((ranker, index) => (
                      <li key={ranker.name}>
                        <span className="market-rank-no">{index + 1}</span>
                        {ranker.name}
                        <em>
                          {ranker.count}
                          {card.unit}
                        </em>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="market-hall-empty">
            아직 이번 달 웃음왕이 없어요. 글 올리고 좋아요·댓글을 받아 첫 주인공이 되어보세요.
          </p>
        )}
        <p className="humor-hall-foot">
          <Medal size={14} aria-hidden />
          지난 달 수상자 ·{' '}
          {lastWinners.length === 0
            ? '기록 없음'
            : lastWinners.map((item) => `${item.label} ${item.ranker!.name}`).join('  ·  ')}
        </p>
      </section>

      <div className="humor-controls">
        <div className="humor-sort">
          <button className={sort === 'latest' ? 'active' : ''} onClick={() => setSort('latest')}>
            최신순
          </button>
          <button className={sort === 'popular' ? 'active' : ''} onClick={() => setSort('popular')}>
            인기순
          </button>
        </div>
        <button className={writing ? 'secondary-button humor-write-toggle' : 'primary-button humor-write-toggle'} onClick={() => setWriting((prev) => !prev)}>
          {writing ? (
            <>
              <X size={16} />
              닫기
            </>
          ) : (
            <>
              <PenLine size={16} />
              글쓰기
            </>
          )}
        </button>
      </div>

      {writing && (
        <section className="panel form-panel humor-compose">
          <p className="humor-compose-author">
            작성자 <Avatar name={currentUser.name} />
            <strong>{currentUser.name}</strong> · 실명으로 게시돼요
          </p>
          <label>
            내용
            <textarea
              value={body}
              placeholder="웃긴 이야기나 짤 설명을 적어보세요"
              autoFocus
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <label>
            이미지 · 영상 링크 (선택)
            <input
              value={mediaUrl}
              placeholder="이미지 주소나 유튜브 링크를 붙여넣어요"
              onChange={(event) => setMediaUrl(event.target.value)}
            />
            <small className="humor-media-hint">이미지 주소 · 유튜브 · mp4 링크를 알아서 붙여 보여줘요.</small>
          </label>
          <button className="primary-button wide" disabled={!body.trim()} onClick={submitPost}>
            올리기
          </button>
        </section>
      )}

      {/*
        릴스. 짧고 소비가 빠른 콘텐츠라 세로 9:16 카드가 맞다. 미디어가 배경이
        되고 글과 반응이 그 위에 얹힌다. 미디어가 없는 글은 배경 없이 글만
        크게 보여준다 — 인스타에도 텍스트 릴스가 있다.

        목록 화면에서는 실제 플레이어를 붙이지 않는다. 영상 열 개가 동시에
        로드되면 스크롤이 끊긴다. 이미지만 배경으로 깔고 영상은 표시만 한다.
      */}
      <div className="ig-reels">
        {visiblePosts.length === 0 && <p className="can-empty">아직 글이 없어요. 첫 유머를 올려보세요!</p>}
        {visiblePosts.map((post) => {
          const postComments = commentsByPost.get(post.id) ?? [];
          const media = resolveMedia(post.mediaUrl);
          const Glyph = mediaGlyph(media);
          const liked = post.likedBy.includes(currentUser.name);
          // 배경: 사용자가 붙인 이미지, 또는 유튜브 링크면 그 영상 썸네일. AI 생성 썸네일은 안 쓴다.
          const bgSrc =
            media?.type === 'image' ? media.src : media?.type === 'youtube' ? youtubeThumb(post.mediaUrl) ?? null : null;
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
                  <span className="ig-reel-author">{post.author}</span>
                </b>
                <em>{post.body}</em>
                <small>{post.createdAt}</small>
              </span>
            </button>
          );
        })}
      </div>

    </section>
  );
}
