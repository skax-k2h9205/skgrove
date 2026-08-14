// 로컬 AI 취합 프록시 (OpenRouter) — 캔미팅 선정 의견을 LLM으로 Step별 결론 도출(유사·중복 병합).
// 단독 실행: node scripts/ai-proxy.mjs   |   통합 실행: scripts/proxy.mjs 가 handleAi 를 /api/ai 로 라우팅.
// 키는 .env.ai.local 에만 존재(프론트/깃 미노출). Node 18+.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// .env.ai.local 로드 (KEY=VALUE 단순 파서). 없으면 휴면(프론트는 로컬 취합 폴백).
const env = {};
try {
  const text = readFileSync(new URL('../.env.ai.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch {
  console.warn('⚠️  .env.ai.local 없음 — AI 취합 휴면. 설정: cp .env.ai.example .env.ai.local');
}

const PORT = Number(env.PORT || 8788);
const API_KEY = env.OPENROUTER_API_KEY;
const MODEL = env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// LLM 출력에서 코드펜스를 걷어내고 JSON만 파싱.
function parseJson(content) {
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

// 각 Step 안에서만 유사·중복 의견을 병합해 그 Step의 결론을 도출하도록 지시.
function buildSystem(prompt) {
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

// 통합/단독 공용 요청 핸들러 (/api/ai).
export function handleAi(req, res) {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(405, { ok: false, reason: 'method' });
    return;
  }
  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', async () => {
    if (!API_KEY) {
      send(200, { ok: false, reason: 'OPENROUTER_API_KEY 미설정' });
      return;
    }
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      send(400, { ok: false, reason: 'bad json' });
      return;
    }
    const groups = Array.isArray(p.groups) ? p.groups : [];
    if (groups.length === 0) {
      send(200, { ok: false, reason: 'no groups' });
      return;
    }
    try {
      const upstream = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'X-Title': 'SKonnection',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: buildSystem(p.prompt || '') },
            { role: 'user', content: JSON.stringify({ steps: groups }) },
          ],
          temperature: 0.2,
        }),
      });
      const data = await upstream.json().catch(() => null);
      if (!upstream.ok || !data) {
        const reason = data?.error?.message || `openrouter ${upstream.status}`;
        console.error('[ai] upstream error:', reason);
        send(200, { ok: false, reason });
        return;
      }
      const parsed = parseJson(data.choices?.[0]?.message?.content);
      if (!parsed || !Array.isArray(parsed.steps)) {
        console.error('[ai] parse failed');
        send(200, { ok: false, reason: 'parse failed' });
        return;
      }
      console.log(`[ai] ${MODEL} → ${parsed.steps.length} steps OK`);
      send(200, { ok: true, groups: parsed.steps });
    } catch (error) {
      console.error('[ai] error:', String(error));
      send(502, { ok: false, reason: String(error) });
    }
  });
}

// 단독 실행일 때만 서버를 띄운다(통합 실행 시엔 import 만).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  createServer(handleAi).listen(PORT, () => {
    console.log(`🤖 ai-proxy 실행 중 → http://127.0.0.1:${PORT}/api/ai  (model: ${MODEL})`);
  });
}
