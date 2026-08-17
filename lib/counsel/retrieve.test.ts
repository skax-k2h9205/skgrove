import { describe, expect, it, vi } from 'vitest';
import { retrieveRuleChunks, knowledgeFromChunks, retrieveCases } from './retrieve.js';

const ok = (chunks: unknown) =>
  vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, chunks }) }) as unknown as Response);

describe('retrieveRuleChunks', () => {
  it('성공 시 청크 배열을 반환한다', async () => {
    const chunks = [{ doc: 'team.md', heading: '예산', content: '한도 30만원' }];
    const out = await retrieveRuleChunks('의욕관리비 한도', {
      functionsUrl: 'https://x.functions.supabase.co',
      anonKey: 'anon',
      fetchImpl: ok(chunks),
    });
    expect(out).toEqual(chunks);
  });

  it('빈 결과면 null(폴백 신호)', async () => {
    const out = await retrieveRuleChunks('q', {
      functionsUrl: 'https://x', anonKey: 'a', fetchImpl: ok([]),
    });
    expect(out).toBeNull();
  });

  it('HTTP 오류/예외면 null(폴백 신호)', async () => {
    const boom = vi.fn(async () => { throw new Error('network'); });
    const out = await retrieveRuleChunks('q', { functionsUrl: 'https://x', anonKey: 'a', fetchImpl: boom });
    expect(out).toBeNull();
  });

  it('functionsUrl 이 없으면 null', async () => {
    const out = await retrieveRuleChunks('q', { functionsUrl: '', anonKey: 'a', fetchImpl: ok([]) });
    expect(out).toBeNull();
  });

  it('anonKey 가 없으면 null', async () => {
    const out = await retrieveRuleChunks('q', { functionsUrl: 'https://x', anonKey: '', fetchImpl: ok([]) });
    expect(out).toBeNull();
  });

  it('타임아웃 시 null(폴백 신호)', async () => {
    const hang = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;
    const out = await retrieveRuleChunks('q', {
      functionsUrl: 'https://x', anonKey: 'a', fetchImpl: hang, timeoutMs: 20,
    });
    expect(out).toBeNull();
  });

  it('요청 본문에 matchCount 를 담는다(기본값 20)', async () => {
    const fetchImpl = ok([{ doc: 'd.md', heading: 'h', content: 'c' }]);
    await retrieveRuleChunks('q', { functionsUrl: 'https://x', anonKey: 'a', fetchImpl });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.matchCount).toBe(20);
  });
});

describe('retrieveCases', () => {
  const okCases = (chunks: unknown) =>
    vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, chunks }) }) as unknown as Response);

  it('성공 시 CaseBrief 로 변환한다(issue→대나무숲, agenda→안건)', async () => {
    const rows = [
      { source: 'issue', refId: 'SOOP-1', title: '회의 갈등', status: '검토중', snippet: '요약' },
      { source: 'agenda', refId: 'AG-2', title: '재택 규칙', status: '투표중', snippet: '설명' },
    ];
    const out = await retrieveCases('회의에서 힘들어요', {
      functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: okCases(rows),
    });
    expect(out).toEqual([
      { source: '대나무숲', id: 'SOOP-1', title: '회의 갈등', status: '검토중', snippet: '요약' },
      { source: '안건', id: 'AG-2', title: '재택 규칙', status: '투표중', snippet: '설명' },
    ]);
  });

  it('요청 body 에 scope:cases·tenantId·기본 matchCount 6 이 실린다', async () => {
    const f = okCases([{ source: 'issue', refId: 'S', title: 't', status: 's', snippet: 'n' }]);
    await retrieveCases('q', { functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: f });
    const init = f.mock.calls[0][1] as { body: string };
    const sent = JSON.parse(init.body);
    expect(sent.scope).toBe('cases');
    expect(sent.tenantId).toBe('T1');
    expect(sent.matchCount).toBe(6);
  });

  it('빈 결과·오류·env 누락은 null(폴백 신호)', async () => {
    expect(await retrieveCases('q', { functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: okCases([]) })).toBeNull();
    const boom = vi.fn(async () => { throw new Error('net'); });
    expect(await retrieveCases('q', { functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: boom })).toBeNull();
    expect(await retrieveCases('q', { functionsUrl: '', anonKey: 'a', tenantId: 'T1' })).toBeNull();
  });
});

describe('knowledgeFromChunks', () => {
  it('문서·헤딩 표기를 포함해 문자열로 만든다', () => {
    const s = knowledgeFromChunks([{ doc: 'team.md', heading: '예산 > 의욕관리비', content: '한도 30만원' }]);
    expect(s).toContain('team.md');
    expect(s).toContain('예산 > 의욕관리비');
    expect(s).toContain('한도 30만원');
  });
});
