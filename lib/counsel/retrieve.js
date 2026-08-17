// 룰 RAG 검색 이음새(서버측). api/chat.ts 가 Supabase Edge Function 'rag-search' 를 호출한다.
// 실패·빈결과·미설정은 모두 null 을 돌려 호출부가 '전체주입 폴백'으로 안전하게 되돌아가게 한다.

/**
 * @param {string} query
 * @param {{functionsUrl:string, anonKey:string, matchCount?:number, fetchImpl?:typeof fetch, timeoutMs?:number}} opts
 * @returns {Promise<Array<{doc:string,heading:string,content:string}>|null>}
 */
export async function retrieveRuleChunks(query, opts) {
  const { functionsUrl, anonKey, matchCount = 20, fetchImpl = fetch, timeoutMs = 5000 } = opts || {};
  if (!functionsUrl || !anonKey || !query) return null;
  try {
    const res = await fetchImpl(`${functionsUrl.replace(/\/$/, '')}/rag-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ query, matchCount }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const chunks = data && data.ok && Array.isArray(data.chunks) ? data.chunks : null;
    return chunks && chunks.length ? chunks : null;
  } catch {
    return null;
  }
}

/**
 * 상담 유사사례 의미검색. 실패·빈결과·설정누락은 null(호출부가 클라 cases 로 폴백).
 * @param {string} query
 * @param {{functionsUrl:string, anonKey:string, tenantId?:string|null, matchCount?:number,
 *   timeoutMs?:number, fetchImpl?:typeof fetch}} opts
 * @returns {Promise<Array<{source:string,id:string,title:string,status:string,snippet:string}>|null>}
 */
export async function retrieveCases(query, opts) {
  const { functionsUrl, anonKey, tenantId = null, matchCount = 6, timeoutMs = 5000, fetchImpl = fetch } = opts || {};
  if (!functionsUrl || !anonKey || !query) return null;
  try {
    const res = await fetchImpl(`${functionsUrl.replace(/\/$/, '')}/rag-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ scope: 'cases', query, tenantId, matchCount }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const rows = data && data.ok && Array.isArray(data.chunks) ? data.chunks : null;
    if (!rows || rows.length === 0) return null;
    return rows.map((r) => ({
      source: r.source === 'issue' ? '대나무숲' : '안건',
      id: String(r.refId ?? ''),
      title: String(r.title ?? ''),
      status: String(r.status ?? ''),
      snippet: String(r.snippet ?? ''),
    }));
  } catch {
    return null;
  }
}

/**
 * @param {Array<{doc:string,heading:string,content:string}>} chunks
 * @returns {string}
 */
export function knowledgeFromChunks(chunks) {
  return (chunks || [])
    .map((c) => `\n\n===== ${c.doc} · ${c.heading} =====\n${c.content}`)
    .join('\n');
}
