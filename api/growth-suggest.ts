// 성장/커리어 입력 도우미 — 지금까지 한 프로젝트를 적으면 역량 레벨과 성장 목표를 추천한다.
//
// 왜 서버인가: OPENROUTER_API_KEY 는 서버에만 둔다(api/chat.ts 와 같은 규약).
// 왜 비스트리밍인가: Vercel 서버리스에서 스트리밍은 버퍼링·첫바이트 지연으로 504 가 나기 쉬웠다.
// 완성해서 한 번에 JSON 으로 돌려주면 maxDuration 안에서 안정적이다.
//
// 앱(iOS)·웹이 같이 쓴다. 실패하면 { ok:false } 만 돌려주고 호출부는 수동 입력으로 떨어진다 —
// 추천은 어디까지나 거들 뿐, 없다고 화면이 막히면 안 된다.

type SuggestBody = {
  projects?: string;      // 사용자가 적은 프로젝트 경험(자유 서술)
  competencies?: string[]; // 앱이 쓰는 고정 역량 목록(이 안에서만 고르게 한다)
  role?: string;          // 직무/파트(선택) — 있으면 눈높이를 맞춘다
};

export const maxDuration = 60;

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

// 레벨의 뜻을 프롬프트와 앱이 같은 문장으로 쓴다 — 서로 다르면 추천 레벨과 화면 설명이 어긋난다.
const LEVEL_GUIDE = [
  '1 = 배우는 중(도움을 받아 수행)',
  '2 = 혼자 할 수 있음(정해진 범위)',
  '3 = 안정적으로 함(스스로 판단해 수행)',
  '4 = 남을 이끎(설계·리뷰·표준을 만듦)',
  '5 = 조직 기준(다른 팀도 참고, 멘토링)',
].join(' / ');

function buildPrompt(body: SuggestBody): string {
  const list = (body.competencies ?? []).join(', ');
  return [
    '너는 팀원의 성장 기록을 돕는 코치다. 아래 프로젝트 경험을 읽고, 주어진 역량 목록에 대해서만',
    `현재 레벨(1~5)과 그렇게 본 근거 한 줄을 정한다. 레벨 기준: ${LEVEL_GUIDE}.`,
    '근거는 반드시 적힌 경험에서 끌어온다 — 경험에 없는 내용을 지어내지 않는다.',
    '경험에서 판단할 단서가 없는 역량은 낮게 찍지 말고 아예 빼라(추측보다 공백이 낫다).',
    '이어서 이번 분기에 할 만한 성장 목표를 2개 제안한다. 목표는 "무엇을 어디까지"가 드러나게',
    '구체적으로 쓰고, 지금 레벨보다 한 단계 위를 겨냥한다.',
    '',
    `[역량 목록] ${list}`,
    body.role ? `[직무] ${body.role}` : '',
    `[프로젝트 경험]\n${body.projects ?? ''}`,
    '',
    '아래 JSON 만 출력한다(설명·코드블록 금지):',
    '{"levels":[{"competency":"...","level":3,"evidence":"..."}],"goals":[{"title":"...","detail":"..."}]}',
  ].filter(Boolean).join('\n');
}

/** 모델이 코드블록이나 잡문을 섞어도 JSON 만 건져낸다. */
function parseJSON(text: string): { levels?: unknown; goals?: unknown } | null {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Vercel 은 default export 를 (req,res) 로 호출해 반환 Response 를 버린다(→ 504).
// api/chat.ts 처럼 메서드별 named export 를 써야 Web Response 가 제대로 나간다.
export async function POST(request: Request): Promise<Response> {
  const apiKey = env('OPENROUTER_API_KEY');

  let body: SuggestBody;
  try {
    body = (await request.json()) as SuggestBody;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  if (!body.projects || !body.projects.trim()) {
    return Response.json({ ok: false, reason: '프로젝트 경험이 비어 있어요.' });
  }
  if (!apiKey) return Response.json({ ok: false, reason: 'OPENROUTER_API_KEY not configured' });

  const model = env('OPENROUTER_MODEL') || 'anthropic/claude-haiku-4.5';
  try {
    const upstream = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'SKonnection',
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: buildPrompt(body) }] }),
    });
    const data = (await upstream.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!upstream.ok || !data) {
      return Response.json({ ok: false, reason: data?.error?.message || `openrouter ${upstream.status}` });
    }
    const parsed = parseJSON(data.choices?.[0]?.message?.content ?? '');
    if (!parsed) return Response.json({ ok: false, reason: 'AI 응답을 읽지 못했어요.' });

    // 화면이 믿고 쓸 수 있게 여기서 형태를 고정한다 — 모델이 범위를 벗어난 값을 주기도 한다.
    const allowed = new Set(body.competencies ?? []);
    const levels = (Array.isArray(parsed.levels) ? parsed.levels : [])
      .map((r) => r as { competency?: unknown; level?: unknown; evidence?: unknown })
      .filter((r) => typeof r.competency === 'string' && allowed.has(r.competency as string))
      .map((r) => ({
        competency: String(r.competency),
        level: Math.max(1, Math.min(5, Number(r.level) || 1)),
        evidence: String(r.evidence ?? '').slice(0, 120),
      }));
    const goals = (Array.isArray(parsed.goals) ? parsed.goals : [])
      .map((r) => r as { title?: unknown; detail?: unknown })
      .filter((r) => typeof r.title === 'string' && (r.title as string).trim())
      .slice(0, 3)
      .map((r) => ({ title: String(r.title).slice(0, 80), detail: String(r.detail ?? '').slice(0, 200) }));

    if (levels.length === 0 && goals.length === 0) {
      return Response.json({ ok: false, reason: '추천할 내용을 찾지 못했어요. 경험을 조금 더 적어주세요.' });
    }
    return Response.json({ ok: true, levels, goals });
  } catch (error) {
    return Response.json({ ok: false, reason: String(error) });
  }
}
