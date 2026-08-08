/*
  성향 진단 문항 은행 + 채점. 순수 로직만 여기 모아 단위 테스트한다(UI 없음).

  - 평소 성향 = MBTI 4축(E/I·S/N·T/F·J/P), 강제선택 A/B 16문항(축당 4).
  - 업무 성향 = DISC(주도D·사교I·안정S·신중C), 4지선다 12문항.
  벤치마킹: MBTI는 강제선택 표 합산, DISC 4행동축은 소통·갈등과 직결(D=결론·C=근거·I=관계·S=안심).
*/
import type { DiscKey, DiscScores, MbtiScores, Profile } from '../../types';

// ── MBTI ─────────────────────────────────────────────
export type MbtiAxis = keyof MbtiScores; // 'EI' | 'SN' | 'TF' | 'JP'
// a 는 첫 글자(E/S/T/J) 쪽, b 는 둘째 글자(I/N/F/P) 쪽.
export type MbtiQuestion = { id: string; axis: MbtiAxis; a: string; b: string };

export const MBTI_QUESTIONS: MbtiQuestion[] = [
  { id: 'ei1', axis: 'EI', a: '사람들과 얘기하다 보면 아이디어가 샘솟는다', b: '혼자 정리한 뒤에 공유하고 싶다' },
  { id: 'ei2', axis: 'EI', a: '사람들과 어울릴 때 힘이 난다', b: '혼자만의 시간에 힘이 채워진다' },
  { id: 'ei3', axis: 'EI', a: '떠오르는 대로 말하며 생각을 정리한다', b: '생각을 다 정리한 뒤에 말한다' },
  { id: 'ei4', axis: 'EI', a: '처음 보는 자리에서 먼저 말을 건다', b: '상대가 다가오길 기다리는 편이다' },

  { id: 'sn1', axis: 'SN', a: '구체적인 사실과 사례부터 본다', b: '큰 그림과 가능성부터 본다' },
  { id: 'sn2', axis: 'SN', a: '단계와 예시가 있어야 이해가 편하다', b: '개념과 의미가 먼저 와닿는다' },
  { id: 'sn3', axis: 'SN', a: '검증된 방식을 신뢰한다', b: '새로운 방식을 시도하고 싶다' },
  { id: 'sn4', axis: 'SN', a: '지금 필요한 현실에 집중한다', b: '앞으로의 변화를 상상한다' },

  { id: 'tf1', axis: 'TF', a: '결정할 때 논리와 효율이 우선이다', b: '결정할 때 사람과 관계가 우선이다' },
  { id: 'tf2', axis: 'TF', a: '피드백은 문제를 직설적으로 짚는다', b: '피드백은 상대 기분을 먼저 살핀다' },
  { id: 'tf3', axis: 'TF', a: '갈등에선 무엇이 옳은지 따진다', b: '갈등에선 모두가 편한지 살핀다' },
  { id: 'tf4', axis: 'TF', a: '타당한 근거가 나를 움직인다', b: '공감과 인정이 나를 움직인다' },

  { id: 'jp1', axis: 'JP', a: '일정을 미리 계획하고 지킨다', b: '상황에 따라 유연하게 움직인다' },
  { id: 'jp2', axis: 'JP', a: '마감은 일찍 끝내야 안심된다', b: '막판 집중이 더 잘 된다' },
  { id: 'jp3', axis: 'JP', a: '계획을 짜두면 마음이 편하다', b: '즉흥적으로 하는 게 즐겁다' },
  { id: 'jp4', axis: 'JP', a: '할 일과 자리는 정리돼 있어야 한다', b: '조금 어수선해도 괜찮다' },
];

const AXIS_LETTERS: Record<MbtiAxis, [string, string]> = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P'],
};

/** answers: 문항 id → 'a' | 'b'. 미응답은 중립으로 둔다(50). */
export function scoreMbti(answers: Record<string, 'a' | 'b'>): { type: string; scores: MbtiScores } {
  const scores = {} as MbtiScores;
  let type = '';
  (Object.keys(AXIS_LETTERS) as MbtiAxis[]).forEach((axis) => {
    const qs = MBTI_QUESTIONS.filter((q) => q.axis === axis);
    let a = 0;
    let answered = 0;
    qs.forEach((q) => {
      const ans = answers[q.id];
      if (ans === 'a') {
        a += 1;
        answered += 1;
      } else if (ans === 'b') {
        answered += 1;
      }
    });
    // 첫 글자 쪽 비중(0~100). 미응답만 있으면 50(중립).
    const lean = answered === 0 ? 50 : Math.round((a / answered) * 100);
    scores[axis] = lean;
    type += lean >= 50 ? AXIS_LETTERS[axis][0] : AXIS_LETTERS[axis][1];
  });
  return { type, scores };
}

// ── DISC ─────────────────────────────────────────────
export type DiscOption = { text: string; key: DiscKey };
export type DiscQuestion = { id: string; prompt: string; options: DiscOption[] };

export const DISC_QUESTIONS: DiscQuestion[] = [
  { id: 'd1', prompt: '새 업무가 주어지면 먼저', options: [
    { text: '목표와 결과부터 잡는다', key: 'D' },
    { text: '함께할 사람들과 논의한다', key: 'I' },
    { text: '기존 흐름에 맞춰 안정적으로 시작', key: 'S' },
    { text: '요건과 기준을 꼼꼼히 확인', key: 'C' },
  ] },
  { id: 'd2', prompt: '회의에서 내 역할은', options: [
    { text: '결론으로 몰고 간다', key: 'D' },
    { text: '분위기를 띄운다', key: 'I' },
    { text: '의견을 조율하고 경청한다', key: 'S' },
    { text: '근거와 데이터를 챙긴다', key: 'C' },
  ] },
  { id: 'd3', prompt: '갈등이 생기면', options: [
    { text: '정면돌파해 빠르게 결론', key: 'D' },
    { text: '대화로 관계를 회복', key: 'I' },
    { text: '한발 물러나 진정시킴', key: 'S' },
    { text: '사실관계부터 정리', key: 'C' },
  ] },
  { id: 'd4', prompt: '마감이 촉박할 때', options: [
    { text: '밀어붙여 끝낸다', key: 'D' },
    { text: '팀을 독려한다', key: 'I' },
    { text: '차분히 순서대로 한다', key: 'S' },
    { text: '품질 기준은 지킨다', key: 'C' },
  ] },
  { id: 'd5', prompt: '피드백을 줄 때', options: [
    { text: '핵심만 직설적으로', key: 'D' },
    { text: '긍정적으로 북돋우며', key: 'I' },
    { text: '부드럽고 배려 있게', key: 'S' },
    { text: '근거와 예시를 들어', key: 'C' },
  ] },
  { id: 'd6', prompt: '새 도구·변화가 오면', options: [
    { text: '일단 써보고 판단', key: 'D' },
    { text: '신나서 남에게 알림', key: 'I' },
    { text: '충분한 적응기간이 필요', key: 'S' },
    { text: '검증한 뒤 도입', key: 'C' },
  ] },
  { id: 'd7', prompt: '의사결정은', options: [
    { text: '빠르게 내가 결정', key: 'D' },
    { text: '함께 합의해 결정', key: 'I' },
    { text: '모두 편한 쪽으로', key: 'S' },
    { text: '데이터로 결정', key: 'C' },
  ] },
  { id: 'd8', prompt: '스트레스를 받으면', options: [
    { text: '더 강하게 밀어붙인다', key: 'D' },
    { text: '말이 많아진다', key: 'I' },
    { text: '조용해지고 참는다', key: 'S' },
    { text: '혼자 파고든다', key: 'C' },
  ] },
  { id: 'd9', prompt: '인정받고 싶은 지점은', options: [
    { text: '성과와 결과', key: 'D' },
    { text: '영향력과 인기', key: 'I' },
    { text: '신뢰와 성실', key: 'S' },
    { text: '정확성과 전문성', key: 'C' },
  ] },
  { id: 'd10', prompt: '협업에서 가장 답답한 건', options: [
    { text: '느린 진행', key: 'D' },
    { text: '딱딱한 분위기', key: 'I' },
    { text: '잦은 변경', key: 'S' },
    { text: '근거 없는 결정', key: 'C' },
  ] },
  { id: 'd11', prompt: '내 강점은', options: [
    { text: '추진력', key: 'D' },
    { text: '사교성', key: 'I' },
    { text: '안정감', key: 'S' },
    { text: '정확성', key: 'C' },
  ] },
  { id: 'd12', prompt: '일할 때 중요한 건', options: [
    { text: '속도와 결과', key: 'D' },
    { text: '관계와 재미', key: 'I' },
    { text: '조화와 지속', key: 'S' },
    { text: '정확과 원칙', key: 'C' },
  ] },
];

/** answers: 문항 id → DiscKey. 최다 득표가 1차, 그다음이 2차. 동점은 D>I>S>C 순. */
export function scoreDisc(answers: Record<string, DiscKey>): {
  type: DiscKey;
  secondary: DiscKey;
  scores: DiscScores;
} {
  const scores: DiscScores = { D: 0, I: 0, S: 0, C: 0 };
  Object.values(answers).forEach((key) => {
    if (key in scores) scores[key] += 1;
  });
  const order: DiscKey[] = ['D', 'I', 'S', 'C'];
  const sorted = [...order].sort((a, b) => scores[b] - scores[a] || order.indexOf(a) - order.indexOf(b));
  return { type: sorted[0], secondary: sorted[1], scores };
}

// ── 매핑: DISC → 색 · 라벨 · 소통 가이드 ──────────────
export const DISC_COLOR: Record<DiscKey, Profile['color']> = { D: 'red', I: 'yellow', S: 'green', C: 'blue' };
export const DISC_LABEL: Record<DiscKey, string> = { D: '주도형', I: '사교형', S: '안정형', C: '신중형' };
export const DISC_GUIDE: Record<DiscKey, string> = {
  D: '결론부터 간결하게. 목표·결과 중심으로 말하면 빠르게 통합니다.',
  I: '밝게 관계부터. 인정과 열정을 곁들이면 잘 움직입니다.',
  S: '안심과 시간을 주며 부드럽게. 급한 변경은 미리 알려주세요.',
  C: '근거·데이터와 함께. 정확한 기준과 이유를 주면 신뢰합니다.',
};

const DISC_TRAIT: Record<DiscKey, string> = {
  D: '실행형 문제 해결가',
  I: '관계형 촉진자',
  S: '맥락형 조율가',
  C: '기준형 설계자',
};
const DISC_STYLE: Record<DiscKey, string> = {
  D: '목표를 빠르게 쪼개고 바로 실행합니다.',
  I: '사람 사이 연결과 분위기를 잘 살립니다.',
  S: '흐름을 안정적으로 잡고 팀을 조율합니다.',
  C: '기준과 근거를 세워 정확하게 진행합니다.',
};
const DISC_FEEDBACK: Record<DiscKey, string> = {
  D: '핵심 이슈를 짧게 짚어주면 즉시 방향을 조정합니다.',
  I: '좋았던 점을 먼저 인정하며 말해주면 빠르게 반영합니다.',
  S: '부드럽고 구체적으로, 시간을 주면 안정적으로 반영합니다.',
  C: '수정 이유와 근거가 함께 있으면 바로 반영합니다.',
};

/**
 * 진단 결과로 기존 Profile 텍스트 필드를 자동 요약해 채운다(조뽑기·기존 화면 호환).
 * character 는 "INFP · 신중형" 형태로.
 */
export function summaryFrom(mbtiType: string | undefined, disc: DiscKey) {
  return {
    character: mbtiType ? `${mbtiType} · ${DISC_LABEL[disc]}` : DISC_LABEL[disc],
    trait: DISC_TRAIT[disc],
    style: DISC_STYLE[disc],
    collaboration: DISC_GUIDE[disc],
    feedback: DISC_FEEDBACK[disc],
    guide: DISC_GUIDE[disc],
  };
}
