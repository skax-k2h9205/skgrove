// 취소가 실패로 둔갑하지 않는지 본다.
//
// 사용자가 [그만 받기]를 누르면 fetch 가 AbortError 로 터진다. 그걸 그냥 catch 하면
// "답변을 가져오지 못했어요"가 뜬다 — 내가 멈춰 놓고 앱이 고장 난 것처럼 보인다.
// 그래서 reason:'aborted' 만은 따로 구분되어야 하고, 그 구분이 이 파일의 전부다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = { mode: 'counsel' as const, messages: [{ role: 'user' as const, content: '안녕' }] };

// ENDPOINT 는 모듈을 읽는 순간 import.meta.env 에서 굳는다. 미설정이면 함수가 곧바로
// disabled 를 돌려주고 fetch 까지 가지도 않으므로, 환경을 먼저 세우고 새로 불러와야 한다.
let streamChat: typeof import('./aiChat').streamChat;

beforeEach(async () => {
  vi.stubEnv('VITE_CHAT_ENDPOINT', 'http://test.invalid/chat');
  vi.resetModules();
  streamChat = (await import('./aiChat')).streamChat;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** 실제 fetch 처럼 signal 을 지켜보다 취소되면 AbortError 로 터지는 가짜. */
function abortableFetch() {
  return vi.fn((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }),
  );
}

describe('streamChat 취소', () => {
  it('취소하면 reason 이 aborted 다 — 호출부가 에러 문구를 띄우지 않도록', async () => {
    vi.stubGlobal('fetch', abortableFetch());
    const controller = new AbortController();
    const pending = streamChat(request, () => {}, controller.signal);
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: 'aborted' });
  });

  it('진짜 실패는 aborted 로 뭉개지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('네트워크 끊김'))));
    const result = await streamChat(request, () => {});
    expect(result.ok).toBe(false);
    expect(result.reason).not.toBe('aborted');
    expect(result.reason).toContain('네트워크 끊김');
  });

  it('비스트리밍 JSON 응답은 통째로 한 번에 흘려보낸다 — 배포 서버리스가 이 형태다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          body: {},
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ ok: true, text: '**굵게** 답변' }),
        }),
      ),
    );
    const chunks: string[] = [];
    const result = await streamChat(request, (t) => chunks.push(t));
    expect(result).toEqual({ ok: true });
    expect(chunks).toEqual(['**굵게** 답변']);
  });
});
