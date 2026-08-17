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
// 페르소나·시스템 프롬프트 조립은 lib/counsel/persona.js 단일 출처를 서버(여기)와 로컬 프록시(chat-proxy.mjs)가 공유한다.

import { buildSystemContent } from '../lib/counsel/persona.js';
import { detectCrisis, CRISIS_RESPONSE } from '../lib/counsel/route.js';
import { retrieveRuleChunks, retrieveCases, knowledgeFromChunks } from '../lib/counsel/retrieve.js';

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
  tenantId?: string;
};

// LLM 완성까지 시간이 걸리므로 함수 최대 실행시간을 넉넉히(이미지 함수와 동일).
export const maxDuration = 60;

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function buildMessages(body: ChatBody) {
  const { messages = [] } = body;
  return [
    { role: 'system', content: buildSystemContent(body) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

// Vercel 은 default export 를 (req,res) 로 호출해 반환 Response 를 버린다(→ 응답 없음 → 504).
// api/ai.ts·version.ts 처럼 메서드별 named export 를 써야 Web Response 를 제대로 보낸다.
export async function POST(request: Request): Promise<Response> {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // 위기 신호는 OpenRouter 호출 없이 즉시 안전 응답으로 단락한다(0 콜).
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (detectCrisis(lastUser)) {
    return Response.json({ ok: true, text: CRISIS_RESPONSE });
  }

  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) return Response.json({ ok: false, reason: 'OPENROUTER_API_KEY not configured' });

  // 룰 모드: 관련 룰 청크만 의미검색으로 주입(Phase 1b). 실패/미설정이면 body.knowledge(전체) 폴백.
  let effectiveBody = body;
  if (body.mode === 'rule') {
    const supabaseUrl = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    if (supabaseUrl && anonKey && lastUser) {
      const functionsUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
      const chunks = await retrieveRuleChunks(lastUser, { functionsUrl, anonKey });
      if (chunks) effectiveBody = { ...body, knowledge: knowledgeFromChunks(chunks) };
    }
  } else if (body.mode !== 'rule') {
    // 상담 모드: 서버 의미검색으로 유사사례 교체(Phase 2). 실패·미설정·tenantId 없음 → 클라 cases 폴백.
    const supabaseUrl = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    if (supabaseUrl && anonKey && lastUser && body.tenantId) {
      const functionsUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
      const found = await retrieveCases(lastUser, { functionsUrl, anonKey, tenantId: body.tenantId });
      if (found) effectiveBody = { ...effectiveBody, cases: found };
    }
  }

  const model = env('OPENROUTER_MODEL') || 'anthropic/claude-haiku-4.5';
  try {
    const upstream = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'SKonnection',
      },
      body: JSON.stringify({ model, messages: buildMessages(effectiveBody) }),
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
