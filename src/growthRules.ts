// 성장 카드 순수 규칙 — UI/저장과 분리해 테스트한다.
import { competencies, type Competency, type CompetencyLogEntry, type GoalStatus } from './types';

/** 진척은 0–100 정수. NaN/음수/초과를 안전하게 클램프. */
export function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** 역량 레벨은 1–5 정수. */
export function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** 정의된 역량 세트 안인지. 스키마 드리프트/오타 방어. */
export function isValidCompetency(s: string): s is Competency {
  return (competencies as readonly string[]).includes(s);
}

/** 진척으로 상태를 추정. 100이면 완료, 그 외 진행중(보류는 명시 전환만 — 여기서 되돌리지 않는다). */
export function nextStatus(progress: number): GoalStatus {
  return clampProgress(progress) >= 100 ? '완료' : '진행중';
}

/** 성장 곡선용: 특정 역량·주체(self/leader)의 레벨 변화를 시간순으로. */
export function curveSeries(
  log: CompetencyLogEntry[],
  competency: Competency,
  by: 'self' | 'leader',
): { at: string; level: number }[] {
  return log
    .filter((e) => e.competency === competency && e.by === by)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => ({ at: e.at, level: e.level }));
}
