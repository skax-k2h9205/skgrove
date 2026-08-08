// 캔미팅 3-Step 정의 — 단계 추가/삭제/이름 변경은 이 배열만 수정하면 됩니다.
// 의견에는 안정적인 id를 저장하고, 화면에는 label을 보여줍니다.
// (label을 바꿔도 기존 데이터는 id로 연결되어 깨지지 않음)
export type CanStepConfig = {
  id: string;
  label: string;
  hint: string;
};

export const CAN_STEPS: CanStepConfig[] = [
  { id: 'speakout', label: 'Step 1 · Speak-out', hint: "먼저 해결해야 할 '진짜' 문제 · Bottleneck · 비효율" },
  { id: 'ideation', label: 'Step 2 · Ideation', hint: '우리 팀만이 할 수 있는 해결 / 개선 방안' },
  { id: 'quickwin', label: 'Step 3 · Quick-win', hint: '바로 실천할 과제 (역할 · 기한 구체화)' },
];
