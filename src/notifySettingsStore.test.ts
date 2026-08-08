import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFY_SETTINGS, channelIdFor, routeForKind, type NotifySettings } from './notifySettingsStore';

const base: NotifySettings = {
  ...DEFAULT_NOTIFY_SETTINGS,
  channels: { team: 'C-TEAM', connector: 'C-CONN' },
};

describe('routeForKind', () => {
  it('설정된 종류는 그 목적지를 돌려준다', () => {
    const settings = { ...base, routes: { ...base.routes, agenda: 'connector' as const } };
    expect(routeForKind(settings, 'agenda')).toBe('connector');
  });

  it('기본값: 대나무숲·개인 메시지는 DM, 안건·마감은 팀, 티미팅은 커넥셔너, 나머지는 끔', () => {
    expect(routeForKind(base, 'issue')).toBe('dm');
    expect(routeForKind(base, 'message')).toBe('dm');
    expect(routeForKind(base, 'agenda')).toBe('team');
    expect(routeForKind(base, 'deadline')).toBe('team');
    expect(routeForKind(base, 'tea')).toBe('connector');
    expect(routeForKind(base, 'action')).toBe('off');
    expect(routeForKind(base, 'market')).toBe('off');
  });
});

describe('channelIdFor', () => {
  it('team/connector 채널 ID를 돌려준다', () => {
    expect(channelIdFor(base, 'team')).toBe('C-TEAM');
    expect(channelIdFor(base, 'connector')).toBe('C-CONN');
  });

  it('채널 ID가 비어 있으면 빈 문자열(서버 env 폴백 신호)', () => {
    expect(channelIdFor(DEFAULT_NOTIFY_SETTINGS, 'team')).toBe('');
  });
});
