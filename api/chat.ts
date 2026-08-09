// AI 상담 챗봇 서버리스 프록시 — 프론트(aiChat.ts)가 /api/chat 으로 대화를 POST하면
// OpenRouter(Claude)로 호출해 **전체 답을 한 번에 JSON 으로** 돌려준다.
//
// 왜 스트리밍이 아니라 한 번에? — 이미지 생성(api/gathering-image.ts)·검토(api/review.ts)와
// 같은 방식이다. Vercel 서버리스에서 스트리밍 응답은 버퍼링·첫바이트 지연으로 504 가 나기
// 쉬웠다. 이미지처럼 완성해서 한 번에 반환하면 maxDuration 안에서 안정적으로 동작한다.
// (로컬 개발은 scripts/chat-proxy.mjs 가 SSE 로 토큰별 스트리밍 — 프론트가 둘 다 처리한다.)
//
// 이미지·검토와 같은 OPENROUTER_API_KEY 를 재사용한다 — 비밀은 서버에만, 새 설정 불필요.
// 룰 모드 지식은 프론트가 body.knowledge 로 실어 보낸다.
// 페르소나는 scripts/chat-proxy.mjs 와 동일하게 유지할 것(런타임이 달라 두 벌).

type FaceBrief = Record<string, unknown>;
type CaseBrief = { source: string; id: string; title: string; status: string; snippet: string };
type ChatTurn = { role: 'user' | 'assistant'; content: string };
type ChatBody = {
  mode?: 'counsel' | 'rule';
  messages?: ChatTurn[];
  self?: FaceBrief;
  partner?: FaceBrief;
  cases?: CaseBrief[];
  knowledge?: string;
};

// LLM 완성까지 시간이 걸리므로 함수 최대 실행시간을 넉넉히(이미지 함수와 동일).
export const maxDuration = 60;

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

const PERSONA = [
  '너는 SK의 팀 문화 서비스 "SKonnection" 안의 마음상담 챗봇이다.',
  '오은영 선생님처럼 따뜻하되 직설적인 관계 코칭을 한다. 한국어로, 존댓말로 답한다.',
  '항상 이 골격을 따른다: (1) 감정을 인정·요약한다 (2) 나와 상대의 성향을 상대의 언어로',
  '번역해 오해를 풀어준다 (3) 오늘 할 수 있는 작은 다음 한 걸음을 1개 제안한다.',
  '특정인을 깎아내리지 않는다. 의료·심리 진단은 하지 않는다. 자·타해 등 위기 신호가',
  '보이면 조언 대신 전문 상담창구(예: 자살예방상담 109, 사내 EAP) 안내로 전환한다.',
  '답 끝에 근거를 짧게 밝힌다 — 예: "(근거: OO님 성향 \'기준형 설계자\', 유사사례 SOOP-142)".',
  // 사례를 안 주면 모델이 지시를 지키려고 없는 번호(예: SKC-089)를 만들어낸다. 실제로 확인된 동작이다.
  '단, 아래 [팀의 유사 사례]에 실제로 제시된 건만 인용한다. 사례가 제공되지 않았으면',
  '사례 번호를 지어내지 말고 성향 근거만 밝히거나 근거 표기를 생략한다.',
].join(' ');

const RULE_PERSONA = [
  '너는 팀 운영·예산·근태·AI 도구·KPI 규칙과 SK하이닉스 출입·보안 절차를 안내하는 챗봇이다.',
  '한국어 존댓말로 답한다. 아래 제공된 문서들에 근거해서만 답한다.',
  '팀 운영 문서의 "챗봇 답변 규칙"을 지킨다: 관련 규정부터, 금액·기간·절차는 정확한 수치와',
  '함께, 원칙/권고/가능/필수를 구분, 문서에 없는 승인·예외를 지어내지 말고 승인권자(팀장/',
  '파트장/담당 BR) 협의가 필요하다고 안내, 프로젝트비/조직비·개인 L/A·팀 CL/AI·프로젝트코드·',
  '공통 KPI/파트 KPI 를 혼동하지 않는다. 하이닉스 절차는 일정·담당자·URL 이 바뀔 수 있으므로',
  '정확한 내용은 담당자 확인이 필요하다고 덧붙인다. 어느 문서에서 왔는지 간단히 밝힌다.',
].join(' ');

// 답을 그리는 쪽(웹 Markdownish, iOS ChatMarkdown, Android chatAnnotated)이 아는 서식만
// 쓰게 한다. 여기 없는 걸 모델이 쓰면 화면에 `**이렇게**` 별표째로 남는다 — 실제로 상담
// 답변 한 건에 별표 8개·구분선·기울임이 그대로 노출됐다(2026-08 확인).
// 이 목록을 늘리려면 세 렌더러도 같이 늘려야 한다.
const FORMAT_RULES = [
  '\n\n[답변 서식]',
  '아래 서식만 쓴다. 여기 없는 표기는 앱에서 기호가 글자로 그대로 보인다.',
  '- 문단은 빈 줄로 나눈다',
  '- 목록은 "- " 또는 "1. " 로 시작한다',
  '- 강조는 **굵게** 와 *기울임* 만 쓴다',
  '표, 제목(#), 인용(>), 링크([]()), 코드블록(```)은 쓰지 않는다.',
  '한 답변에 강조는 3개를 넘기지 않는다 — 다 굵으면 아무것도 강조되지 않는다.',
].join('\n');

function buildMessages(body: ChatBody) {
  const { mode, messages = [], self, partner, cases, knowledge } = body;
  const system: string[] = [];
  if (mode === 'rule') {
    system.push(RULE_PERSONA);
    system.push('\n\n[지식 문서]\n' + (knowledge || '(지식 문서가 제공되지 않았습니다.)'));
  } else {
    system.push(PERSONA);
    if (self) system.push('\n\n[상담을 요청한 사람의 성향]\n' + JSON.stringify(self, null, 2));
    if (partner) system.push('\n\n[갈등 상대의 성향]\n' + JSON.stringify(partner, null, 2));
    if (Array.isArray(cases) && cases.length) {
      system.push(
        '\n\n[팀의 유사 사례(대나무숲·안건)]\n' +
          cases.map((c) => `- [${c.source} ${c.id}] ${c.title} (${c.status}): ${c.snippet}`).join('\n'),
      );
    }
  }
  system.push(FORMAT_RULES);
  return [
    { role: 'system', content: system.join('') },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

// Vercel 은 default export 를 (req,res) 로 호출해 반환 Response 를 버린다(→ 응답 없음 → 504).
// api/ai.ts·version.ts 처럼 메서드별 named export 를 써야 Web Response 를 제대로 보낸다.
export async function POST(request: Request): Promise<Response> {
  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) return Response.json({ ok: false, reason: 'OPENROUTER_API_KEY not configured' });

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const model = env('OPENROUTER_MODEL') || 'anthropic/claude-haiku-4.5';
  try {
    const upstream = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Connectioner',
      },
      body: JSON.stringify({ model, messages: buildMessages(body) }),
    });
    const data = (await upstream.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!upstream.ok || !data) {
      return Response.json({ ok: false, reason: data?.error?.message || `openrouter ${upstream.status}` });
    }
    const text = (data.choices?.[0]?.message?.content ?? '').trim();
    if (!text) return Response.json({ ok: false, reason: 'empty' });
    return Response.json({ ok: true, text });
  } catch (error) {
    return Response.json({ ok: false, reason: String(error) });
  }
}
