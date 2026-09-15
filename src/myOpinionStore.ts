// "내가 낸 캔미팅 의견" 기억장치.
//
// 익명 제출은 DB 에 작성자를 남기지 않는다. 그래서 본인 삭제를 붙이려면 작성자를 알아야 하는데,
// 행에 작성자 키(해시 등)를 같이 저장하면 팀 명단을 대입해 "이 사람이 이 내용을 썼다"를
// 역으로 맞출 수 있다 — 익명의 의미가 사라진다(agenda_ballots 가 사람과 선택을 굳이 다른
// 테이블로 떼어 둔 이유와 같다).
//
// 그래서 작성자는 이 브라우저에만 남긴다. 다른 기기에서는 본인 의견이라도 삭제 버튼이 안 뜨고,
// 실명 제출은 이름으로 판별되므로 기기와 무관하게 뜬다(canRules.isMyOpinion).
// 테넌트가 바뀌면 cacheScope 가 skgrove: 키를 전부 비우므로 이 기록도 함께 사라진다.
const KEY = 'skgrove:mycanopinions';

type Store = Record<string, string[]>;

const slot = (email: string, sessionId: string) => `${email.trim().toLowerCase()}|${sessionId}`;

function read(): Store {
  try {
    const saved = window.localStorage.getItem(KEY);
    const parsed = saved ? (JSON.parse(saved) as Store) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 저장 실패는 무시한다. 삭제 버튼이 안 뜰 뿐 의견 자체는 정상이다.
  }
}

/** 이 사람이 이 세션에서 제출한 의견 id 목록. */
export function myOpinionIds(email: string, sessionId: string): string[] {
  return read()[slot(email, sessionId)] ?? [];
}

export function rememberMyOpinion(email: string, sessionId: string, opinionId: string) {
  const store = read();
  const key = slot(email, sessionId);
  const next = new Set([...(store[key] ?? []), opinionId]);
  store[key] = [...next];
  write(store);
}

export function forgetMyOpinion(email: string, sessionId: string, opinionId: string) {
  const store = read();
  const key = slot(email, sessionId);
  const left = (store[key] ?? []).filter((id) => id !== opinionId);
  if (left.length) store[key] = left;
  else delete store[key];
  write(store);
}
