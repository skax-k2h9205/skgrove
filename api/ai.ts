// AI 취합 프록시 — 캔미팅 선정 의견을 LLM(OpenRouter)로 "Step별 결론" 도출(유사·중복 병합).
//
// 프론트(aiSummarize.ts)는 VITE_AI_ENDPOINT로 아래 규격을 POST한다:
//   { prompt: string, groups: [{ label: string, points: string[] }] }
// 응답: { ok: boolean, groups?: [{ label, points }], reason?: string }
//
// 서버 환경변수(비밀은 서버에만):
//   OPENROUTER_API_KEY : OpenRouter 키(sk-or-...). 없으면 휴면 → 프론트는 로컬 취합으로 폴백.
//   OPENROUTER_MODEL   : 모델 슬러그(기본 anthropic/claude-haiku-4.5)

type CanGroup = { label: string; points: string[] };
type AiPayload = { prompt?: string; groups?: CanGroup[] };

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

// 각 Step 안에서만 유사·중복 의견을 병합해 그 Step의 결론을 도출하도록 지시.
function buildSystem(prompt: string): string {
  return (
    `${prompt || ''}\n\n` +
    '반드시 아래 JSON 스키마로만 답하세요. 설명·인사말·코드펜스 없이 JSON 객체 하나만 출력합니다.\n' +
    '{"steps":[{"label":"<단계명>","points":["<그 Step의 결론>", "..."]}]}\n' +
    '- label 은 입력의 각 단계 label 을 그대로 사용합니다(순서 유지).\n' +
    '- 각 Step 안에서만 유사·중복 의견을 병합해 그 Step의 결론(핵심 point)을 도출합니다. 다른 Step끼리 절대 섞지 않습니다.\n' +
    '- points 는 Step별 핵심 결론 1~3개로 간결하게 정리합니다.\n' +
    '- 입력에 없는 내용을 새로 지어내지 않습니다. 한국어로 씁니다.'
  );
}

// LLM 출력에서 코드펜스를 걷어내고 JSON만 파싱.
function parseJson(content: string): { steps?: unknown } | null {
  const stripped = String(content || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Vercel Node.js 함수는 기본 export를 (req,res)=>void 로 취급해 Response를 그냥 무시한다
// (반환값이 버려져 응답이 안 나가고 300초 뒤 타임아웃). named export(POST)로 Web API 시그니처를 쓴다.
export async function POST(request: Request): Promise<Response> {
  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) {
    // 키 미주입 → 휴면. 프론트는 로컬 취합으로 폴백한다.
    return Response.json({ ok: false, reason: 'OPENROUTER_API_KEY not configured' });
  }

  let payload: AiPayload;
  try {
    payload = (await request.json()) as AiPayload;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  if (groups.length === 0) {
    return Response.json({ ok: false, reason: 'no groups' });
  }

  const model = env('OPENROUTER_MODEL') || 'anthropic/claude-haiku-4.5';
  try {
    const upstream = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'SKonnection',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystem(payload.prompt ?? '') },
          { role: 'user', content: JSON.stringify({ steps: groups }) },
        ],
        temperature: 0.2,
      }),
    });
    const data = (await upstream.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!upstream.ok || !data) {
      return Response.json({ ok: false, reason: data?.error?.message || `openrouter ${upstream.status}` });
    }
    const parsed = parseJson(data.choices?.[0]?.message?.content ?? '');
    if (!parsed || !Array.isArray(parsed.steps)) {
      return Response.json({ ok: false, reason: 'parse failed' });
    }
    return Response.json({ ok: true, groups: parsed.steps });
  } catch (error) {
    return Response.json({ ok: false, reason: String(error) });
  }
}
