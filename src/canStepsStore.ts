// 캔미팅 단계 설정 — 모든 캔미팅에 공통 적용되는 팀 약속이라 공용 설정(app_config)에 둔다.
// 기기별 localStorage에만 있으면 진행자가 바꾼 단계가 참여자 화면엔 반영되지 않는다.
import { CAN_STEPS, type CanStepConfig } from './canConfig';
import { CAN_STEPS_KEY, loadConfig, saveConfig } from './configStore';

export async function loadCanSteps(): Promise<CanStepConfig[]> {
  const steps = await loadConfig<CanStepConfig[]>(CAN_STEPS_KEY, CAN_STEPS);
  return Array.isArray(steps) && steps.length > 0 ? steps : CAN_STEPS;
}

export async function saveCanSteps(steps: CanStepConfig[]) {
  await saveConfig(CAN_STEPS_KEY, steps);
}

export function makeStepId() {
  return `step-${Date.now().toString(36)}`;
}
