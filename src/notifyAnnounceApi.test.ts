import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../api/notify';

// 슬랙 Web API 를 흉내 낸다. 호출된 메서드·본문을 기록하고 메서드별 응답을 돌려준다.
type Call = { method: string; body?: Record<string, unknown>; query?: string };
let calls: Call[];
let replies: Record<string, unknown>;

const announceMsg = (ts: string, bot = 'B_ME') => ({ ts, bot_id: bot, attachments: [{ fallback: '이번 티미팅 안내' }] });

beforeEach(() => {
  calls = [];
  replies = {
    'auth.test': { ok: true, bot_id: 'B_ME' },
    'chat.postMessage': { ok: true, channel: 'C1', ts: '111.1' },
    'chat.update': { ok: true },
    'chat.delete': { ok: true },
    'conversations.history': { ok: true, messages: [] },
  };
  (globalThis as { process?: { env?: Record<string, string> } }).process!.env!.SLACK_BOT_TOKEN = 'xoxb-test';
  vi.stubGlobal('fetch', async (url: string, init?: { body?: string }) => {
    const [path, query] = url.replace('https://slack.com/api/', '').split('?');
    calls.push({ method: path, body: init?.body ? JSON.parse(init.body) : undefined, query });
    return new Response(JSON.stringify(replies[path] ?? { ok: false, error: 'unknown' }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { process?: { env?: Record<string, string> } }).process!.env!.SLACK_BOT_TOKEN;
});

const call = async (payload: Record<string, unknown>) =>
  (await (await POST(new Request('http://x/api/notify', { method: 'POST', body: JSON.stringify(payload) }))).json()) as Record<
    string,
    unknown
  >;

describe('티미팅 공지 관리 API', () => {
  it('공지를 보내면 channel·ts 를 돌려준다', async () => {
    const res = await call({ announce: true, channel: 'team', channelId: 'C1', text: '📢 *이번 티미팅 안내*' });
    expect(res).toMatchObject({ ok: true, channel: 'C1', ts: '111.1' });
  });

  it('find 는 봇이 보낸 티미팅 공지 중 최신을 고른다 (다른 봇·다른 알림은 제외)', async () => {
    replies['conversations.history'] = {
      ok: true,
      messages: [
        { ts: '300.0', bot_id: 'B_OTHER', attachments: [{ fallback: '이번 티미팅 안내' }] },
        { ts: '250.0', bot_id: 'B_ME', attachments: [{ fallback: '안건 등록: x' }] },
        announceMsg('200.0'),
        announceMsg('100.0'),
      ],
    };
    const res = await call({ announceAction: 'find', channel: 'team', channelId: 'C1' });
    expect(res).toMatchObject({ ok: true, channel: 'C1', ts: '200.0' });
  });

  it('기록 조회 권한이 없으면 missing_scope 를 그대로 알린다', async () => {
    replies['conversations.history'] = { ok: false, error: 'missing_scope' };
    const res = await call({ announceAction: 'find', channel: 'team', channelId: 'C1' });
    expect(res).toMatchObject({ ok: false, reason: 'missing_scope' });
  });

  it('update 는 티미팅 공지일 때만 chat.update 한다', async () => {
    replies['conversations.history'] = { ok: true, messages: [announceMsg('200.0')] };
    const res = await call({ announceAction: 'update', channel: 'team', channelId: 'C1', ts: '200.0', text: '새 공지' });
    expect(res.ok).toBe(true);
    expect(calls.find((c) => c.method === 'chat.update')?.body).toMatchObject({ channel: 'C1', ts: '200.0' });
  });

  it('티미팅 공지가 아닌 메시지는 지우지 않는다', async () => {
    replies['conversations.history'] = { ok: true, messages: [{ ts: '250.0', bot_id: 'B_ME', attachments: [{ fallback: '안건 등록: x' }] }] };
    const res = await call({ announceAction: 'delete', channel: 'team', channelId: 'C1', ts: '250.0' });
    expect(res).toMatchObject({ ok: false, reason: 'not_found' });
    expect(calls.some((c) => c.method === 'chat.delete')).toBe(false);
  });

  it('권한이 없어 확인을 못 해도 ts 가 있으면 삭제한다 (슬랙이 봇 자신의 메시지로 제한)', async () => {
    replies['conversations.history'] = { ok: false, error: 'missing_scope' };
    const res = await call({ announceAction: 'delete', channel: 'team', channelId: 'C1', ts: '200.0' });
    expect(res.ok).toBe(true);
    expect(calls.find((c) => c.method === 'chat.delete')?.body).toMatchObject({ channel: 'C1', ts: '200.0' });
  });

  it('ts 없는 update/delete 는 거절한다', async () => {
    const res = await call({ announceAction: 'delete', channel: 'team', channelId: 'C1' });
    expect(res).toMatchObject({ ok: false, reason: 'no ts' });
  });
});
