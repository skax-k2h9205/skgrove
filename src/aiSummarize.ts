// AI 취합 이음새(seam): 캔미팅 선정 의견을 LLM(오픈라우터)로 유사·중복 병합한다.
// VITE_AI_ENDPOINT가 설정되면 프록시로 POST하고, 없으면 disabled를 돌려줘 호출부가 로컬 취합으로 폴백한다.
// 프론트는 "어느 LLM/키냐"를 모르고 URL·규격에만 의존한다(키는 프록시에만 존재).
const ENDPOINT = (import.meta.env as Record<string, string | undefined>).VITE_AI_ENDPOINT;

export type CanGroup = { label: string; points: string[] };
export type AiSummaryResult = { ok: boolean; groups?: CanGroup[]; reason?: string };

// 응답이 신뢰할 수 없는 형태여도 앱이 깨지지 않게 방어적으로 정제한다.
function sanitize(groups: unknown): CanGroup[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => {
      const g = group as { label?: unknown; points?: unknown };
      const label = typeof g.label === 'string' ? g.label : '';
      const points = Array.isArray(g.points)
        ? g.points.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
        : [];
      return { label, points };
    })
    .filter((group) => group.label && group.points.length > 0);
}

export async function summarizeCanMeeting(prompt: string, groups: CanGroup[]): Promise<AiSummaryResult> {
  if (!ENDPOINT) return { ok: false, reason: 'disabled' };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, groups }),
    });
    const data = (await res.json().catch(() => ({ ok: false, reason: 'bad json' }))) as {
      ok?: boolean;
      groups?: unknown;
      reason?: string;
    };
    if (!data.ok) return { ok: false, reason: data.reason || 'failed' };
    const clean = sanitize(data.groups);
    return clean.length ? { ok: true, groups: clean } : { ok: false, reason: 'empty' };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}
