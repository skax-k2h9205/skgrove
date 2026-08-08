// 상담 맥락용 '유사 사례' 추리기. 임베딩·RAG 없이 키워드 겹침으로 상위 N건만 고른다(YAGNI).
// 팀 안에서 실제 제기된 일이 쌓이는 곳 — 대나무숲 접수(Issue)와 안건(Agenda) — 에서
// 질문과 겹치는 단어가 많은 것을 근거로 삼아 "우리 팀에도 이런 일이 있었다"에 답한다.
import type { CaseBrief } from '../../aiChat';
import type { Agenda, Issue } from '../../types';

// 조사·접속사 등 흔한 말은 겹쳐도 의미가 없어 점수에서 뺀다.
const STOP = new Set([
  '그리고', '하지만', '그런데', '저는', '제가', '너무', '정말', '우리', '회사', '있어요',
  '있는', '해요', '하고', '하는', '그냥', '근데', '어떻게', '때문', '에서', '으로', '합니다',
  '같아요', '싶어요', '거예요', '거에요', '어요', '네요', '이에요', '예요',
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []).filter((t) => !STOP.has(t));
}

function snip(text: string, n = 80): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** 질문과 키워드가 겹치는 접수·안건을 점수순 상위 limit 건으로. 겹치는 게 없으면 빈 배열. */
export function findSimilarCases(query: string, issues: Issue[], agendas: Agenda[], limit = 3): CaseBrief[] {
  const q = new Set(tokens(query));
  if (q.size === 0) return [];
  const score = (text: string) => tokens(text).reduce((n, t) => (q.has(t) ? n + 1 : n), 0);

  const pool: Array<CaseBrief & { s: number }> = [];
  for (const issue of issues) {
    const s = score(`${issue.title} ${issue.body} ${issue.expectedChange}`);
    if (s > 0) {
      pool.push({ s, source: '대나무숲', id: issue.id, title: issue.title, status: issue.status, snippet: snip(issue.body || issue.expectedChange) });
    }
  }
  for (const agenda of agendas) {
    const s = score(`${agenda.title} ${agenda.description}`);
    if (s > 0) {
      pool.push({ s, source: '안건', id: agenda.id, title: agenda.title, status: agenda.status, snippet: snip(agenda.description) });
    }
  }

  return pool
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ s: _s, ...rest }) => rest);
}
