/*
  AI 상담 챗봇 프록시. 프론트(aiChat.ts)가 여기로 대화를 POST하면, OpenRouter(Claude)로
  스트리밍 호출해 토큰을 SSE 로 되돌린다. 키는 오직 여기에만 둔다(프론트에 노출 금지).

  실행:
    cp .env.ai.example .env.ai.local   # 값 채우기(OPENROUTER_API_KEY 등)
    node scripts/chat-proxy.mjs
  프론트의 VITE_CHAT_ENDPOINT 를 http://localhost:<CHAT_PORT>/ 로 맞춘다.

  이벤트 규약(프론트와 합의): `data: {"token":"..."}` 반복 → `data: {"done":true}`,
  오류 시 `data: {"error":"..."}`.
*/
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// .env.ai.local 을 가볍게 읽는다(dotenv 의존 없이).
function loadEnv() {
  try {
    const text = readFileSync(join(HERE, '..', '.env.ai.local'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* 파일 없으면 실제 환경변수만 사용 */
  }
}
loadEnv();

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const PORT = Number(process.env.CHAT_PORT || 8790);

// 룰 모드 지식은 요청마다 보내지 않고 서버가 src/content 의 모든 .md 를 읽어 합친다.
// 문서를 추가하려면 그 폴더에 .md 파일만 넣으면 자동 반영된다(팀 운영룰·하이닉스 출입 등).
function knowledge() {
  const dir = join(HERE, '..', 'src', 'content');
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    if (files.length === 0) return '(지식 문서를 찾지 못했습니다.)';
    return files
      .map((f) => `\n\n===== 문서: ${f} =====\n${readFileSync(join(dir, f), 'utf8')}`)
      .join('\n');
  } catch {
    return '(지식 문서를 찾지 못했습니다.)';
  }
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

function buildMessages(body) {
  const { mode, messages = [], self, partner, cases, knowledge: sent } = body;
  const system = [];
  if (mode === 'rule') {
    system.push(RULE_PERSONA);
    // 프론트가 실어 보낸 지식을 우선 쓰고, 없으면 디스크에서 읽는다(서버리스와 규약 일치).
    system.push('\n\n[지식 문서]\n' + (sent || knowledge()));
  } else {
    system.push(PERSONA);
    if (self) system.push('\n\n[상담을 요청한 사람의 성향]\n' + JSON.stringify(self, null, 2));
    if (partner) system.push('\n\n[갈등 상대의 성향]\n' + JSON.stringify(partner, null, 2));
    if (Array.isArray(cases) && cases.length) {
      system.push('\n\n[팀의 유사 사례(대나무숲·안건)]\n' + cases.map((c) => `- [${c.source} ${c.id}] ${c.title} (${c.status}): ${c.snippet}`).join('\n'));
    }
  }
  return [{ role: 'system', content: system.join('') }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
}

const server = createServer(async (req, res) => {
  // CORS(로컬 개발 프론트에서 호출).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method !== 'POST') return res.writeHead(405).end();

  let raw = '';
  for await (const chunk of req) raw += chunk;

  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  if (!API_KEY) {
    sse({ error: 'OPENROUTER_API_KEY 미설정 — .env.ai.local 을 확인하세요.' });
    return res.end();
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    sse({ error: '잘못된 요청 형식' });
    return res.end();
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, stream: true, messages: buildMessages(body) }),
    });

    if (!upstream.ok || !upstream.body) {
      sse({ error: `LLM 오류 ${upstream.status}` });
      return res.end();
    }

    // OpenRouter 의 SSE 델타를 읽어 우리 규약(token)으로 변환해 흘려보낸다.
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const token = JSON.parse(payload)?.choices?.[0]?.delta?.content;
          if (token) sse({ token });
        } catch {
          /* keep-alive 주석 등 — 무시 */
        }
      }
    }
    sse({ done: true });
    res.end();
  } catch (error) {
    sse({ error: String(error) });
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`chat-proxy on http://localhost:${PORT} (model: ${MODEL}${API_KEY ? '' : ', KEY 미설정'})`);
});
