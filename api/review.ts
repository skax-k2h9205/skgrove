// 접수 검토 프록시 — 대나무숲 접수 본문에서 욕설·인신공격을 찾아 다듬은 문장을 제안한다.
//
// 프론트(intakeReview.ts)는 VITE_REVIEW_ENDPOINT로 아래 규격을 POST한다:
//   { title: string, body: string, expectedChange: string }
// 응답: { ok: boolean, findings?: [{ field, kind, reason, rewritten }], reason?: string }
//
// 서버 환경변수(비밀은 서버에만):
//   OPENROUTER_API_KEY : OpenRouter 키(sk-or-...). 없으면 휴면 → 프론트는 검토 없이 통과.
//   OPENROUTER_MODEL   : 모델 슬러그(기본 anthropic/claude-haiku-4.5)

type ReviewPayload = { title?: string; body?: string; expectedChange?: string };

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

// 이 프롬프트는 scripts/review-proxy.mjs 의 SYSTEM 상수와 내용이 동일해야 한다.
// 런타임(서버리스 TS vs 로컬 Node .mjs)이 달라 공유 모듈로 묶기 어려워 두 벌을 유지한다 — 수정 시 두 파일을 함께 고칠 것.
export const REVIEW_SYSTEM_PROMPT = [
  '당신은 사내 익명 의견 접수 글을 검토합니다.',
  '목적은 검열이 아니라, 접수자의 진짜 사안이 리더에게 존중 있고 실행가능하게 전달되도록 다듬는 것입니다.',
  '',
  '지적할 것은 두 가지입니다.',
  '1) 욕설·비속어 → kind: "profanity"',
  '2) 특정인의 인격·능력에 대한 평가·비하 → kind: "personal-attack"',
  '',
  '수정안(rewritten) — "건설적 재구성":',
  '- 욕설·비난·인격 평가는 걷어내고, 같은 사안을 존중 있고 실행가능한 요청/관찰로 다시 씁니다.',
  '- 반드시 보존합니다: 대상(누구·무엇에 관한 일인지), 구체적 행동·상황·영향, 접수자가 바라는 변화.',
  '- 절대 하지 않습니다: 없는 사실·새로운 주제·다른 인물 추가, 사안 축소·삭제, 감정의 존재 자체 부정.',
  '- 사람을 공격하지 말고 행동·상황을 말합니다. 가능하면 "~하면 좋겠다" 형태의 개선 요청으로 바꿉니다.',
  '- 여전히 부정적 평가("무능한 사람")로 끝나면 안 됩니다. 무엇이 어떻게 불편했고 무엇이 바뀌면 좋은지로 씁니다.',
  '',
  '항목별 형태:',
  '- title(제목): 사안을 요약한 간결하고 중립적인 제목 한 줄. 마침표로 끝내지 않습니다.',
  '- body(내용): 상황·영향을 담담히 서술하고 바라는 개선을 덧붙인 완성된 문단.',
  '- expectedChange(기대 변화): 바라는 변화를 건설적으로 한 문장.',
  '',
  '지적 범위:',
  '- 본인이 겪은 피해 진술, 인용된 발언 안의 표현은 접수자의 표현이 아니므로 지적하지 않습니다.',
  '    "저 사람이 저에게 욕설을 했습니다" → 사실 진술 → 지적하지 않습니다',
  '    "그 사람이 저에게 \\"XX새끼\\"라고 했습니다" → 피해 진술의 인용 → 지적하지 않습니다',
  '    "그 XX새끼 때문에 못 해먹겠다" → 접수자 본인의 욕설 → 지적합니다',
  '- 맞춤법·어투는 지적하지 않습니다.',
  '- 한 항목에 문제가 여러 종류라도 findings 에는 그 항목당 하나만 넣습니다(같은 rewritten 을 중복하지 않습니다).',
  '- 지적할 것이 없으면 findings 를 빈 배열로 둡니다. 억지로 찾지 않습니다.',
  '',
  '반드시 아래 JSON 스키마로만 답하세요. 설명·인사말·코드펜스 없이 JSON 객체 하나만 출력합니다.',
  '{"findings":[{"field":"title|body|expectedChange","kind":"profanity|personal-attack","reason":"<한 문장, 담담하게>","rewritten":"<그 항목 전체를 대체할 완성 문장>"}]}',
  '- reason 은 접수자에게 그대로 보여집니다. 비난하지 말고 담담하게 한 문장으로 씁니다.',
].join('\n');

// LLM 출력에서 코드펜스를 걷어내고 JSON만 파싱.
function parseJson(content: string): { findings?: unknown } | null {
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

// Vercel 은 default export 를 (req,res) 로 호출해 반환 Response 를 버린다(→ 응답 없음 → 504).
// api/ai.ts·version.ts 처럼 메서드별 named export 를 써야 Web Response 를 제대로 보낸다.
export async function POST(request: Request): Promise<Response> {
  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) {
    // 키 미주입 → 휴면. reason 은 반드시 'disabled' 여야 한다.
    // ReviewGate.tsx 는 이 문자열로만 "기능 없음(조용히 통과)"과 "검사 실패(경고 배너)"를 구분한다.
    return Response.json({ ok: false, reason: 'disabled' });
  }

  let payload: ReviewPayload;
  try {
    payload = (await request.json()) as ReviewPayload;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  const expectedChange = String(payload.expectedChange ?? '').trim();
  if (!title && !body) {
    return Response.json({ ok: false, reason: 'empty input' });
  }

  const model = env('OPENROUTER_MODEL') || 'anthropic/claude-haiku-4.5';
  try {
    const upstream = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'Connectioner',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ title, body, expectedChange }) },
        ],
        temperature: 0,
      }),
    });
    const data = (await upstream.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!upstream.ok || !data) {
      return Response.json({ ok: false, reason: data?.error?.message || `openrouter ${upstream.status}` });
    }
    const parsed = parseJson(data.choices?.[0]?.message?.content ?? '');
    if (!parsed || !Array.isArray(parsed.findings)) {
      return Response.json({ ok: false, reason: 'parse failed' });
    }
    return Response.json({ ok: true, findings: parsed.findings });
  } catch (error) {
    return Response.json({ ok: false, reason: String(error) });
  }
}
