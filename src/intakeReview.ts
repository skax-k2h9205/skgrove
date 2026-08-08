// 접수 검토 이음새(seam): 제출 직전 본문을 LLM으로 검토해 욕설·인신공격을 걸러낸다.
// VITE_REVIEW_ENDPOINT가 설정되면 프록시로 POST하고, 없으면 disabled를 돌려줘 호출부가 그냥 통과시킨다.
// 프론트는 "어느 LLM/키냐"를 모르고 URL·규격에만 의존한다(키는 프록시에만 존재).
export type ReviewField = 'title' | 'body' | 'expectedChange';
export type ReviewKind = 'profanity' | 'personal-attack';

export type ReviewFinding = {
  field: ReviewField;
  kind: ReviewKind;
  reason: string;
  rewritten: string;
};

export type ReviewInput = { title: string; body: string; expectedChange: string };
export type ReviewResult = { ok: boolean; findings?: ReviewFinding[]; reason?: string };

const FIELDS: ReviewField[] = ['title', 'body', 'expectedChange'];
// 서버리스 콜드스타트 + LLM 이 3개 항목을 건설적으로 재작성하는 데 8초로는 부족해
// 배포에서 요청이 취소(canceled)됐다. 넉넉히 잡되 무한정 매달리지는 않는다.
const TIMEOUT_MS = 30000;

// 모듈 로드 시점이 아니라 호출 시점에 읽는다. 테스트에서 환경변수를 갈아끼울 수 있어야 한다.
function endpoint(): string | undefined {
  // 배포(프로덕션)에선 같은 도메인의 서버리스 함수(/api/review)를 기본으로 쓴다 — 이미지 생성과
  // 같은 OPENROUTER_API_KEY 를 재사용하므로 새 설정이 필요 없다. 로컬은 VITE_REVIEW_ENDPOINT.
  return (
    (import.meta.env as Record<string, string | undefined>).VITE_REVIEW_ENDPOINT ||
    (import.meta.env.PROD ? '/api/review' : undefined)
  );
}

// 응답이 신뢰할 수 없는 형태여도 앱이 깨지지 않게 방어적으로 정제한다.
// 정제 후 0개면 "지적할 것 없음"과 같게 취급된다.
export function sanitizeFindings(raw: unknown): ReviewFinding[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      // LLM이 findings 배열 안에 null/undefined 원소를 섞어 보내는 경우가 있다. 캐스팅 전에 걸러야 한다.
      if (!item || typeof item !== 'object') return null;
      const f = item as { field?: unknown; kind?: unknown; reason?: unknown; rewritten?: unknown };
      const field = FIELDS.find((name) => name === f.field);
      const rewritten = typeof f.rewritten === 'string' ? f.rewritten.trim() : '';
      const reason = typeof f.reason === 'string' ? f.reason.trim() : '';
      // 모르는 kind는 안전한 쪽으로 내린다. 욕설이라고 잘못 단정하면 문구가 과해진다.
      const kind: ReviewKind = f.kind === 'profanity' ? 'profanity' : 'personal-attack';

      if (!field || !rewritten) return null;
      return { field, kind, reason, rewritten };
    })
    .filter((item): item is ReviewFinding => item !== null);
}

export type FindingGroup = Pick<ReviewFinding, 'kind' | 'reason' | 'rewritten'> & { fields: ReviewField[] };

// 같은 문장을 제목·내용·기대 변화에 그대로 쓰면, 사유도 대안도 똑같은 카드가 항목 수만큼 쌓인다.
// 세 번 읽어도 작성자가 얻는 정보는 하나다. 항목명만 합쳐 한 장으로 보여준다.
export function groupFindings(findings: ReviewFinding[]): FindingGroup[] {
  const groups: FindingGroup[] = [];
  const index = new Map<string, FindingGroup>();

  for (const finding of findings) {
    const key = `${finding.kind}|${finding.reason}|${finding.rewritten}`;
    const existing = index.get(key);
    if (existing) {
      // 같은 항목이 두 번 실려 오면 라벨이 "제목, 제목"이 된다.
      if (!existing.fields.includes(finding.field)) existing.fields.push(finding.field);
      continue;
    }
    const group: FindingGroup = {
      kind: finding.kind,
      reason: finding.reason,
      rewritten: finding.rewritten,
      fields: [finding.field],
    };
    index.set(key, group);
    groups.push(group);
  }

  return groups;
}

async function postOnce(url: string, input: ReviewInput): Promise<ReviewResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 접수자 정보는 검토에 필요 없다. 보내지 않는다.
      body: JSON.stringify({ title: input.title, body: input.body, expectedChange: input.expectedChange }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; findings?: unknown; reason?: string }
      | null;

    if (!data) return { ok: false, reason: 'bad json' };
    if (!data.ok) return { ok: false, reason: data.reason || 'failed' };
    return { ok: true, findings: sanitizeFindings(data.findings) };
  } catch (error) {
    return { ok: false, reason: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** 검토를 요청한다. 실패하면 한 번만 자동 재시도한다(일시적 오류가 접수를 막지 않도록). */
export async function reviewIntake(input: ReviewInput): Promise<ReviewResult> {
  const url = endpoint();
  if (!url) return { ok: false, reason: 'disabled' };

  const first = await postOnce(url, input);
  if (first.ok) return first;

  return postOnce(url, input);
}
