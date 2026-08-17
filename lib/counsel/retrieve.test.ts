import { describe, expect, it, vi } from 'vitest';
import { retrieveRuleChunks, knowledgeFromChunks } from './retrieve.js';

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
});

describe('knowledgeFromChunks', () => {
  it('문서·헤딩 표기를 포함해 문자열로 만든다', () => {
    const s = knowledgeFromChunks([{ doc: 'team.md', heading: '예산 > 의욕관리비', content: '한도 30만원' }]);
    expect(s).toContain('team.md');
    expect(s).toContain('예산 > 의욕관리비');
    expect(s).toContain('한도 30만원');
  });
});
