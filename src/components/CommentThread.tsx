import { useState } from 'react';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { Avatar } from './Avatar';
import type { CurrentUser } from '../types';

// 유머·이음장터가 함께 쓰는 댓글 스레드. 좋아요·본인 수정/삭제·대댓글(1단계)을 담는다.
// 게시판별 데이터(postId/itemId)는 이미 걸러 flat list 로 넘겨받는다.
export type ThreadComment = {
  id: string;
  parentId?: string;
  author: string;
  body: string;
  createdAt: string;
  likedBy?: string[];
};

type Props = {
  comments: ThreadComment[];
  currentUser: CurrentUser;
  /** 관리자면 남의 댓글도 삭제 가능. */
  canModerate?: boolean;
  onAdd: (parentId: string | null, body: string) => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
};

export function CommentThread({ comments, currentUser, canModerate = false, onAdd, onEdit, onDelete, onToggleLike }: Props) {
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const sorted = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const tops = sorted.filter((c) => !c.parentId);
  const repliesOf = (id: string) => sorted.filter((c) => c.parentId === id);

  const canDelete = (c: ThreadComment) => c.author === currentUser.name || canModerate;

  const saveEdit = () => {
    if (editId && editDraft.trim()) onEdit(editId, editDraft.trim());
    setEditId(null);
    setEditDraft('');
  };
  const submitReply = (parentId: string) => {
    if (replyDraft.trim()) onAdd(parentId, replyDraft.trim());
    setReplyTo(null);
    setReplyDraft('');
  };
  const submitTop = () => {
    if (!draft.trim()) return;
    onAdd(null, draft.trim());
    setDraft('');
  };

  const row = (c: ThreadComment, isReply: boolean) => {
    const likes = c.likedBy ?? [];
    const iLiked = likes.includes(currentUser.name);
    return (
      <div className={`cmt${isReply ? ' cmt-reply' : ''}`} key={c.id}>
        <Avatar name={c.author} />
        <div className="cmt-body">
          <strong>{c.author}</strong>
          {editId === c.id ? (
            <div className="cmt-edit">
              <input
                value={editDraft}
                autoFocus
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                }}
              />
              <button className="secondary-button" onClick={saveEdit}>저장</button>
              <button className="btn-ghost" onClick={() => setEditId(null)}>취소</button>
            </div>
          ) : (
            <p>{c.body}</p>
          )}
          <div className="cmt-meta">
            <small>{c.createdAt}</small>
            <button
              className={`cmt-like${iLiked ? ' on' : ''}`}
              onClick={() => onToggleLike(c.id)}
              title={likes.length ? likes.join(', ') : '좋아요'}
              aria-pressed={iLiked}
            >
              <Heart size={13} />
              {likes.length > 0 && <span>{likes.length}</span>}
            </button>
            {!isReply && (
              <button
                className="cmt-act"
                onClick={() => {
                  setReplyTo(replyTo === c.id ? null : c.id);
                  setReplyDraft('');
                }}
              >
                답글
              </button>
            )}
            {c.author === currentUser.name && editId !== c.id && (
              <button className="cmt-act" onClick={() => { setEditId(c.id); setEditDraft(c.body); }}>수정</button>
            )}
            {canDelete(c) && (
              <button
                className="cmt-act danger"
                onClick={() => {
                  if (window.confirm('댓글을 삭제할까요?')) onDelete(c.id);
                }}
              >
                삭제
              </button>
            )}
          </div>
          {replyTo === c.id && (
            <div className="cmt-input cmt-reply-input">
              <input
                value={replyDraft}
                autoFocus
                placeholder="답글 달기"
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitReply(c.id);
                }}
              />
              <button className="secondary-button" onClick={() => submitReply(c.id)} aria-label="답글 등록">
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cmt-thread">
      <p className="cmt-count">
        <MessageCircle size={15} /> 댓글 {comments.length}
      </p>
      {tops.length === 0 && <p className="field-note">첫 댓글을 남겨보세요.</p>}
      {tops.map((c) => (
        <div className="cmt-group" key={c.id}>
          {row(c, false)}
          {repliesOf(c.id).map((r) => row(r, true))}
        </div>
      ))}
      <div className="cmt-input">
        <input
          value={draft}
          placeholder="댓글 달기"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitTop();
          }}
        />
        <button className="secondary-button" onClick={submitTop} aria-label="댓글 등록">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
