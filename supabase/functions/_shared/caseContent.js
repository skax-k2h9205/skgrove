// 상담 사례 색인 정책(순수). reindex-cases(Deno)와 vitest 가 함께 쓴다.
// 프라이버시 경계가 이 함수 하나에 모인다: '리더만 보기'는 색인하지 않고(null),
// E2E 암호글은 서버가 본문을 읽을 수 없으므로 제목·카테고리·상태만 넣는다.
const CAP = 1200;

function snip(text, n = 80) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * @param {'issue'|'agenda'} source
 * @param {Record<string, unknown>} row  DB 행(snake_case)
 * @returns {{title:string,status:string,snippet:string,content:string}|null} null=색인 제외
 */
export function caseContentOf(source, row) {
  if (!row || typeof row !== 'object') return null;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!title) return null;
  const status = typeof row.status === 'string' ? row.status : '';

  if (source === 'issue') {
    if (row.visibility !== '안건 후보로 공개 가능') return null;
    if (row.encrypted) {
      const content = [title, row.category, status].filter(Boolean).join('\n').slice(0, CAP);
      return { title, status, snippet: snip(title), content };
    }
    const body = typeof row.body === 'string' ? row.body : '';
    const expected = typeof row.expected_change === 'string' ? row.expected_change : '';
    const content = [title, body, expected].filter(Boolean).join('\n').slice(0, CAP);
    return { title, status, snippet: snip(body || expected || title), content };
  }

  if (source === 'agenda') {
    const desc = typeof row.description === 'string' ? row.description : '';
    const content = [title, desc].filter(Boolean).join('\n').slice(0, CAP);
    return { title, status, snippet: snip(desc || title), content };
  }

  return null;
}
