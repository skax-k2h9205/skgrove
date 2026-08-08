import { useState } from 'react';
import type { ElementType } from 'react';
import {
  Bell,
  BellOff,
  Clock,
  Coffee,
  FileCheck2,
  Inbox,
  Laugh,
  Mail,
  MessageSquare,
  Store,
  Vote,
  Zap,
} from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { PanelHeader } from '../../components/PanelHeader';
import type { AppNotification, CurrentUser, ManagedAccount, NotificationKind, Section } from '../../types';

type NotificationCenterProps = {
  notifications: AppNotification[];
  currentUser: CurrentUser;
  accounts: ManagedAccount[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSend: (recipientName: string, body: string) => void;
  onOpen: (section: Section) => void;
};

const KIND_LABEL: Record<NotificationKind, string> = {
  issue: '의견',
  agenda: '안건',
  deadline: '마감',
  action: '액션',
  tea: '티미팅',
  humor: '유머',
  message: '메시지',
  gathering: '모임',
  market: '이음장터',
};

const KIND_ICON: Record<NotificationKind, ElementType> = {
  issue: Inbox,
  agenda: Vote,
  deadline: Clock,
  action: FileCheck2,
  tea: Coffee,
  humor: Laugh,
  message: MessageSquare,
  gathering: Zap,
  market: Store,
};

export function NotificationCenter({
  notifications,
  currentUser,
  accounts,
  onMarkRead,
  onMarkAllRead,
  onSend,
  onOpen,
}: NotificationCenterProps) {
  const recipients = accounts.filter((account) => account.status === '활성' && account.name !== currentUser.name);
  const [to, setTo] = useState<string>(recipients[0]?.name ?? '');
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const received = notifications.filter((item) => item.recipientName === currentUser.name);
  const sent = notifications.filter((item) => item.kind === 'message' && item.fromName === currentUser.name);
  const unread = received.filter((item) => !item.read).length;
  const readCount = received.length - unread;
  const visibleReceived = received.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'read') return item.read;
    return true;
  });
  const emptyMessage =
    received.length === 0
      ? '받은 알림이 없습니다.'
      : filter === 'unread'
        ? '안읽은 알림이 없습니다.'
        : filter === 'read'
          ? '읽은 알림이 없습니다.'
          : '받은 알림이 없습니다.';

  const openNotification = (item: AppNotification) => {
    if (!item.read) onMarkRead(item.id);
    if (item.section !== 'notifications') onOpen(item.section);
  };

  const submit = () => {
    if (!to || !body.trim()) return;
    onSend(to, body.trim());
    setBody('');
  };

  return (
    <section className="screen">
      <section className="panel">
        <div className="notif-head">
          <PanelHeader icon={Bell} title="받은 알림" />
          {received.length > 0 && (
            <button className="secondary-button" onClick={onMarkAllRead} disabled={unread === 0}>
              모두 읽음
            </button>
          )}
        </div>
        {received.length > 0 && (
          <div className="segmented">
            <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>
              전체 {received.length}
            </button>
            <button className={filter === 'unread' ? 'selected' : ''} onClick={() => setFilter('unread')}>
              안읽음 {unread}
            </button>
            <button className={filter === 'read' ? 'selected' : ''} onClick={() => setFilter('read')}>
              읽음 {readCount}
            </button>
          </div>
        )}
        <div className="ig-activity">
          {visibleReceived.length === 0 && (
            <EmptyState
              icon={BellOff}
              title={emptyMessage}
              description={
                filter === 'all'
                  ? '리더 답변이나 안건 소식이 오면 여기로 도착합니다.'
                  : '필터를 바꾸면 다른 알림을 볼 수 있어요.'
              }
            />
          )}
          {/*
            인스타 활동(Activity) 목록. 아바타 · 한 문장 · 시간 · 우측 종류 표시.
            줄바꿈된 카드가 아니라 한 줄짜리 문장이라 열 개가 한 화면에 들어온다.
            안읽음은 우측 파란 점 하나로만 표시한다 — 행 전체를 칠하면
            "안읽은 것이 많다"가 아니라 "화면이 시끄럽다"로 읽힌다.
          */}
          {visibleReceived.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <button
                key={item.id}
                className={item.read ? 'ig-act' : 'ig-act unread'}
                onClick={() => openNotification(item)}
                type="button"
              >
                <span className="ig-ava">{item.fromName.slice(0, 1)}</span>
                <span className="ig-act-text">
                  <span>
                    <b>{item.fromName}</b>
                    {item.title}
                    <em>{item.createdAt}</em>
                  </span>
                  {item.body && <small>{item.body}</small>}
                </span>
                <span className={`ig-act-kind ${item.kind}`} title={KIND_LABEL[item.kind]}>
                  <Icon size={16} />
                </span>
                {!item.read && <span className="ig-act-dot" aria-label="안읽음" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel form-panel">
        <PanelHeader icon={Mail} title="메시지 보내기" />
        {recipients.length === 0 ? (
          <p className="can-empty">보낼 수 있는 대상이 없습니다.</p>
        ) : (
          <>
            <label>
              받는 사람
              <select value={to} onChange={(event) => setTo(event.target.value)}>
                {recipients.map((account) => (
                  <option key={account.id} value={account.name}>
                    {account.name} · {account.role} · {account.part}
                  </option>
                ))}
              </select>
            </label>
            <label>
              내용
              <textarea
                value={body}
                placeholder="메시지를 입력하세요"
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            {(!to || !body.trim()) && (
              <p className="field-note gate-note">
                {!to && !body.trim()
                  ? '받는 사람과 내용을 채우면 보낼 수 있어요.'
                  : !to
                    ? '받는 사람을 고르면 보낼 수 있어요.'
                    : '내용을 채우면 보낼 수 있어요.'}
              </p>
            )}
            <button className="primary-button wide" disabled={!to || !body.trim()} onClick={submit}>
              보내기
            </button>
          </>
        )}
      </section>

      <section className="panel">
        <PanelHeader icon={MessageSquare} title={`보낸 메시지 · ${sent.length}`} />
        <div className="ig-activity">
          {sent.length === 0 && <p className="can-empty">보낸 메시지가 없습니다.</p>}
          {sent.map((item) => (
            <div className="ig-act" key={item.id}>
              <span className="ig-ava">{item.recipientName.slice(0, 1)}</span>
              <span className="ig-act-text">
                <span>
                  <b>{item.recipientName}</b>
                  님에게
                  <em>{item.createdAt}</em>
                </span>
                <small>{item.body}</small>
              </span>
              <span className="ig-act-kind message">
                <MessageSquare size={16} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
