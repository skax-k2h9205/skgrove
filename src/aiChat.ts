// AI 상담 챗봇 이음새(seam). VITE_CHAT_ENDPOINT 프록시로 대화를 POST하고 SSE로 답을 받는다.
// 프론트는 어느 LLM/키냐를 모른다 — URL·규격에만 의존하고 키는 프록시에만 둔다
// (aiSummarize.ts·aiPoster.ts 와 같은 규약). 미설정이면 disabled 로 폴백해 위젯이
// "AI 미설정" 안내만 보이고 앱은 깨지지 않는다.
import type { Profile } from './types';

// 배포(프로덕션)에선 같은 도메인의 서버리스 함수(/api/chat)를 기본으로 쓴다 — 이미지 생성과
// 같은 OPENROUTER_API_KEY 를 재사용하므로 새 설정이 필요 없다. 로컬은 VITE_CHAT_ENDPOINT 로
// 로컬 프록시를 가리킨다. 둘 다 없으면(로컬 미설정) disabled 로 조용히 폴백한다.
const ENDPOINT =
  (import.meta.env as Record<string, string | undefined>).VITE_CHAT_ENDPOINT ||
  (import.meta.env.PROD ? '/api/chat' : undefined);
export const CHAT_ENABLED = Boolean(ENDPOINT);

// 룰 모드 지식(src/content/*.md)은 프론트가 번들해 요청에 실어 보낸다 — 서버리스 함수가
// 런타임에 파일을 읽지 못해도 동작하고, md 가 단일 출처로 유지된다. glob 이라 파일을 더 넣으면 자동 포함.
const KNOWLEDGE_FILES = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const RULE_KNOWLEDGE = Object.entries(KNOWLEDGE_FILES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, text]) => `\n\n===== 문서: ${path.split('/').pop()} =====\n${text}`)
  .join('\n');

export type ChatMode = 'counsel' | 'rule';
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// 프록시에 넘기는 성향 요약. 상담에 쓰는 필드만 담고 생일 등 민감정보는 뺀다.
export type FaceBrief = {
  name: string;
  part?: string;
  character?: string;
  trait?: string;
  style?: string;
  collaboration?: string;
  feedback?: string;
  guide?: string;
  mbti?: string; // 평소 성향(MBTI 4글자)
  disc?: string; // 업무 성향(DISC: D/I/S/C)
  collabGuide?: string; // 본인이 밝힌 "나와 일하는 법"
};

export function briefOf(p: Profile | undefined): FaceBrief | undefined {
  if (!p) return undefined;
  const { name, part, character, trait, style, collaboration, feedback, guide } = p;
  return {
    name,
    part,
    character,
    trait,
    style,
    collaboration,
    feedback,
    guide,
    mbti: p.mbtiType,
    disc: p.discType,
    collabGuide: p.collabGuide,
  };
}

export type CaseBrief = { source: string; id: string; title: string; status: string; snippet: string };

export type ChatRequest = {
  mode: ChatMode;
  messages: ChatTurn[];
  self?: FaceBrief;
  partner?: FaceBrief;
  cases?: CaseBrief[];
  knowledge?: string; // 룰 모드 지식(프론트가 번들해 실어 보냄)
  tenantId?: string; // 서버 사례 의미검색용 — 없으면 서버가 클라 cases 사용
};

// reason:'aborted' 는 사용자가 취소한 것이다. 실패가 아니므로 화면에 에러를 띄우면 안 된다.
export type ChatResult = { ok: boolean; reason?: string };

/**
 * 프록시 SSE 를 읽어 토큰마다 onToken 을 부른다.
 * 프록시 이벤트 규약: `data: {"token":"..."}` 반복 → `data: {"done":true}` | `data: {"error":"..."}`.
 * 성공(ok:true)이면 onToken 으로 흘려보낸 조각을 이어붙인 것이 최종 답이다.
 */
export async function streamChat(
  req: ChatRequest,
  onToken: (t: string) => void,
  signal?: AbortSignal,
): Promise<ChatResult> {
  if (!ENDPOINT) return { ok: false, reason: 'disabled' };
  // 룰 모드면 지식 문서를 실어 보낸다(서버리스 함수가 파일을 못 읽어도 동작).
  const payload: ChatRequest =
    req.mode === 'rule' && !req.knowledge ? { ...req, knowledge: RULE_KNOWLEDGE } : req;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok || !res.body) return { ok: false, reason: `http ${res.status}` };

    // 배포 서버리스(api/chat)는 비스트리밍 JSON({ok,text})으로 답한다 — 전체를 한 번에 표시.
    // 로컬 프록시는 SSE 로 토큰별 스트리밍. Content-Type 으로 구분한다.
    const contentType = res.headers.get('Content-Type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      const data = (await res.json().catch(() => null)) as { ok?: boolean; text?: string; reason?: string } | null;
      if (data?.ok && data.text) {
        onToken(data.text);
        return { ok: true };
      }
      return { ok: false, reason: data?.reason || 'failed' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let failed: string | undefined;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 는 줄 단위다. 완성된 줄만 처리하고 잘린 마지막 줄은 버퍼에 남겨 다음 청크와 잇는다.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload) as { token?: string; done?: boolean; error?: string };
          if (evt.error) failed = evt.error;
          else if (evt.token) onToken(evt.token);
        } catch {
          /* 부분 프레임 — 다음 청크에서 완성된다. 무시. */
        }
      }
    }
    return failed ? { ok: false, reason: failed } : { ok: true };
  } catch (error) {
    // 취소는 실패가 아니다. 호출부가 에러 문구를 띄우지 않도록 따로 알린다.
    if (signal?.aborted || (error as { name?: string })?.name === 'AbortError') {
      return { ok: false, reason: 'aborted' };
    }
    return { ok: false, reason: String(error) };
  }
}
