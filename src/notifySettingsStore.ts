// 알림 발송 설정 — 커넥셔너가 시스템 관리 화면에서 조정하는 팀 공용 설정.
// app_config(configStore) 한 행에 JSON으로 저장하므로 신규 테이블이 필요 없다.
// 프론트가 이 설정으로 라우팅을 결정하고, 채널 경로면 실제 채널 ID를 프록시로 보낸다.
import { NOTIFY_SETTINGS_KEY, loadConfig, saveConfig } from './configStore';
import type { NotificationKind } from './types';

// 각 알림 종류를 어디로 보낼지: 팀 채널 / 커넥셔너 채널 / 개인 DM / 끔(인앱만).
export type NotifyRoute = 'team' | 'connector' | 'dm' | 'off';

export type NotifySettings = {
  slackEnabled: boolean; // 마스터 스위치. 끄면 어떤 슬랙도 안 나가고 인앱 알림만.
  dmEnabled: boolean; // DM 경로 허용 여부.
  routes: Record<NotificationKind, NotifyRoute>;
  channels: { team: string; connector: string }; // 실제 슬랙 채널 ID(C…). 비우면 서버 env 폴백.
};

// 기본값 = 현재 동작 유지. 채널 ID는 비워 두고, 입력 전에는 서버 env(SLACK_CHANNEL_*)로 폴백된다.
export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  slackEnabled: true,
  // 기본은 꺼짐 — 배포해도 지금과 동일(DM 안 나감). 시스템 관리 화면에서 켠다.
  dmEnabled: false,
  routes: {
    issue: 'dm',
    message: 'dm',
    agenda: 'team',
    deadline: 'team',
    tea: 'connector',
    action: 'off',
    humor: 'off',
    gathering: 'off',
    market: 'off',
  },
  channels: { team: '', connector: '' },
};

export function routeForKind(settings: NotifySettings, kind: NotificationKind): NotifyRoute {
  return settings.routes[kind] ?? DEFAULT_NOTIFY_SETTINGS.routes[kind] ?? 'off';
}

export function channelIdFor(settings: NotifySettings, route: 'team' | 'connector'): string {
  return settings.channels[route] ?? '';
}

// 부분 저장/누락 필드를 기본값과 병합해 항상 완전한 설정을 돌려준다.
export async function loadNotifySettings(): Promise<NotifySettings> {
  const loaded = await loadConfig<Partial<NotifySettings>>(NOTIFY_SETTINGS_KEY, DEFAULT_NOTIFY_SETTINGS);
  return {
    ...DEFAULT_NOTIFY_SETTINGS,
    ...loaded,
    routes: { ...DEFAULT_NOTIFY_SETTINGS.routes, ...(loaded.routes ?? {}) },
    channels: { ...DEFAULT_NOTIFY_SETTINGS.channels, ...(loaded.channels ?? {}) },
  };
}

export async function saveNotifySettings(settings: NotifySettings) {
  await saveConfig(NOTIFY_SETTINGS_KEY, settings);
}
