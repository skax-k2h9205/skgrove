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
import { buildSystemContent } from '../lib/counsel/persona.js';
import { detectCrisis, CRISIS_RESPONSE } from '../lib/counsel/route.js';

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

function buildMessages(body) {
  const { messages = [] } = body;
  // 룰 모드는 프론트가 실어 보낸 지식을 우선 쓰고, 없으면 디스크에서 읽는다(서버리스와 규약 일치).
  const knowledgeText = body.mode === 'rule' ? (body.knowledge || knowledge()) : body.knowledge;
  const content = buildSystemContent({ ...body, knowledge: knowledgeText });
  return [{ role: 'system', content }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
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

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    sse({ error: '잘못된 요청 형식' });
    return res.end();
  }

  // 위기 신호는 LLM 호출 없이 즉시 안전 응답을 흘려보내고 종료(서버리스와 동일 동작).
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (detectCrisis(lastUser)) {
    sse({ token: CRISIS_RESPONSE });
    sse({ done: true });
    return res.end();
  }

  if (!API_KEY) {
    sse({ error: 'OPENROUTER_API_KEY 미설정 — .env.ai.local 을 확인하세요.' });
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
