// 전송 이음새(seam): 알림을 외부(슬랙)로 보낼지 URL 하나로 결정한다.
// VITE_NOTIFY_ENDPOINT가 설정되면 프록시로 고정 규격 JSON을 POST하고, 없으면 no-op(인앱 전용).
// 프론트는 "어느 서버냐"를 모르고 URL·규격에만 의존하므로 호스트를 바꿔도 프론트는 그대로다.
//
// 1단계(채널 방식): 이벤트당 1회, kind→채널(team/connector) 라우팅. 프록시가 채널별 웹훅을 고른다.
import type { SlackChannel } from './notificationRules';
import type { NotificationKind } from './types';

const ENDPOINT = (import.meta.env as Record<string, string | undefined>).VITE_NOTIFY_ENDPOINT;

function post(body: Record<string, unknown>) {
  if (!ENDPOINT) return; // 미설정 → 인앱만, 외부 영향 0
  // fire-and-forget: 목업이라 전송 실패가 인앱 알림에 영향 주지 않는다.
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    /* 전송 실패 무시 */
  });
}

// 채널 게시(공지·제안 등, 이벤트당 1회). kind는 프록시가 헤더/이모지를 꾸미는 데 쓴다.
// channelId: 설정에 든 실제 슬랙 채널 ID. 비어 있으면 서버가 env(SLACK_CHANNEL_*)로 폴백한다.
export function deliverToSlack(
  channel: SlackChannel,
  channelId: string,
  kind: NotificationKind,
  title: string,
  text: string,
  from: string,
) {
  post({ channel, channelId, kind, title, text, from });
}

// 개인 DM(수신자별). 프록시가 SLACK_DM_ENABLED로 잠가둬, 세팅 완료 전까지 실제 발송되지 않는다.
export function deliverDm(
  recipientEmail: string,
  kind: NotificationKind,
  title: string,
  text: string,
  from: string,
) {
  post({ dm: true, recipientEmail, kind, title, text, from });
}

// 슬랙에 올라간 티미팅 공지 한 건 — 나중에 고치거나 지울 때 이걸로 메시지를 가리킨다.
export type AnnounceRef = { channel: string; ts: string; text: string; sentAt: string };

// 공지 관리 결과. noscope: 봇에 채널 기록 조회 권한이 없어 지난 공지를 못 찾음. notfound: 지울/고칠 공지가 없음.
export type AnnounceResult = 'sent' | 'failed' | 'disabled' | 'noscope' | 'notfound';

type AnnounceResponse = { ok?: boolean; reason?: string; channel?: string; ts?: string };

async function postAnnounce(body: Record<string, unknown>): Promise<AnnounceResponse | null> {
  if (!ENDPOINT) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => ({ ok: false }))) as AnnounceResponse;
  } catch {
    return { ok: false };
  }
}

const failureOf = (data: AnnounceResponse): AnnounceResult =>
  data.reason === 'missing_scope' ? 'noscope' : data.reason === 'not_found' || data.reason === 'message_not_found' ? 'notfound' : 'failed';

// 이번 티미팅 공지문을 채널로 전송(버튼). 성공하면 나중에 고칠 수 있게 메시지 위치(ref)도 돌려준다.
export async function sendAnnouncement(
  channel: SlackChannel,
  channelId: string,
  text: string,
): Promise<{ result: AnnounceResult; ref?: AnnounceRef }> {
  const data = await postAnnounce({ channel, channelId, announce: true, text });
  if (!data) return { result: 'disabled' };
  if (!data.ok) return { result: 'failed' };
  const ref = data.channel && data.ts ? { channel: data.channel, ts: data.ts, text, sentAt: new Date().toISOString() } : undefined;
  return { result: 'sent', ref };
}

// 위치를 모르는(이 기능 전에 보낸) 공지 — 채널 최근 기록에서 봇이 보낸 마지막 티미팅 공지를 찾는다.
export async function findLatestAnnouncement(
  channel: SlackChannel,
  channelId: string,
): Promise<{ result: AnnounceResult; ref?: AnnounceRef }> {
  const data = await postAnnounce({ channel, channelId, announceAction: 'find' });
  if (!data) return { result: 'disabled' };
  if (!data.ok || !data.channel || !data.ts) return { result: failureOf(data) };
  return { result: 'sent', ref: { channel: data.channel, ts: data.ts, text: '', sentAt: '' } };
}

// 이미 보낸 공지의 내용을 바꾼다.
export async function updateAnnouncement(channel: SlackChannel, ref: AnnounceRef, text: string): Promise<AnnounceResult> {
  const data = await postAnnounce({ channel, channelId: ref.channel, announceAction: 'update', ts: ref.ts, text });
  if (!data) return 'disabled';
  return data.ok ? 'sent' : failureOf(data);
}

// 이미 보낸 공지를 채널에서 지운다.
export async function deleteAnnouncement(channel: SlackChannel, ref: AnnounceRef): Promise<AnnounceResult> {
  const data = await postAnnounce({ channel, channelId: ref.channel, announceAction: 'delete', ts: ref.ts });
  if (!data) return 'disabled';
  return data.ok ? 'sent' : failureOf(data);
}
