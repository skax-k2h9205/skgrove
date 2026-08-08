// 로컬 접수 검토 프록시 (OpenRouter) — 접수 본문에서 욕설·인신공격을 찾아 다듬은 문장을 제안.
// 단독 실행: node scripts/review-proxy.mjs   |   통합 실행: scripts/proxy.mjs 가 handleReview 를 /api/review 로 라우팅.
// 키는 .env.ai.local 에만 존재(AI 취합 프록시와 같은 파일을 공유). Node 18+.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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
  console.warn('⚠️  .env.ai.local 없음 — 접수 검토 휴면. 설정: cp .env.ai.example .env.ai.local');
}

const PORT = Number(env.REVIEW_PORT || 8789);
const API_KEY = env.OPENROUTER_API_KEY;
const MODEL = env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 이 프롬프트는 api/review.ts 의 REVIEW_SYSTEM_PROMPT 상수와 내용이 동일해야 한다.
// 런타임(서버리스 TS vs 로컬 Node .mjs)이 달라 공유 모듈로 묶기 어려워 두 벌을 유지한다 — 수정 시 두 파일을 함께 고칠 것.
const SYSTEM = [
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

// 통합/단독 공용 요청 핸들러 (/api/review).
export function handleReview(req, res) {
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
      // 키 미주입 → 휴면. reason 은 반드시 'disabled' 여야 한다.
      // ReviewGate.tsx 는 이 문자열로만 "기능 없음(조용히 통과)"과 "검사 실패(경고 배너)"를 구분한다.
      send(200, { ok: false, reason: 'disabled' });
      return;
    }
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      send(400, { ok: false, reason: 'bad json' });
      return;
    }
    const title = String(p.title || '').trim();
    const body = String(p.body || '').trim();
    const expectedChange = String(p.expectedChange || '').trim();
    if (!title && !body) {
      send(200, { ok: false, reason: 'empty input' });
      return;
    }
    try {
      const upstream = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'X-Title': 'Connectioner',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: JSON.stringify({ title, body, expectedChange }) },
          ],
          temperature: 0,
        }),
      });
      const data = await upstream.json().catch(() => null);
      if (!upstream.ok || !data) {
        const reason = data?.error?.message || `openrouter ${upstream.status}`;
        console.error('[review] upstream error:', reason);
        send(200, { ok: false, reason });
        return;
      }
      const parsed = parseJson(data.choices?.[0]?.message?.content);
      if (!parsed || !Array.isArray(parsed.findings)) {
        send(200, { ok: false, reason: 'parse failed' });
        return;
      }
      send(200, { ok: true, findings: parsed.findings });
    } catch (error) {
      console.error('[review] error:', error);
      send(200, { ok: false, reason: String(error) });
    }
  });
}

// 단독 실행일 때만 서버를 띄운다(import 되면 핸들러만 제공).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  createServer(handleReview).listen(PORT, () => {
    console.log(`🧐 review-proxy 실행 중 → http://127.0.0.1:${PORT}/api/review`);
  });
}
