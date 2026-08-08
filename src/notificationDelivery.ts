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

// 이번 티미팅 공지문을 채널로 전송(버튼). 결과를 반환해 UI 피드백에 쓴다.
export async function sendAnnouncement(
  channel: SlackChannel,
  channelId: string,
  text: string,
): Promise<'sent' | 'failed' | 'disabled'> {
  if (!ENDPOINT) return 'disabled';
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, channelId, announce: true, text }),
    });
    const data = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean };
    return data.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
