import type { ElementType } from 'react';
import { CheckCircle2, Clock, PlayCircle, RotateCcw } from 'lucide-react';
import type { ActionStatus } from '../../types';

/*
  이 두 규칙은 액션아이템 화면 안에만 있었다. 그래서 홈의 요약 목록은
  상태 넷을 아이콘 하나(CheckCircle2)로 그리고, 목표일을 "2026-07-30" 원본
  그대로 찍었다. 같은 데이터를 두 화면이 다르게 말하면 사용자는 어느 쪽을
  믿을지 판단해야 한다. 규칙을 화면 밖으로 꺼내 한 벌만 남긴다.
*/

/*
  상태 전환 버튼 네 개가 전부 같은 CircleDot 을 달고 있었다. 같은 아이콘이
  다른 동작에 붙으면 아이콘은 정보를 나르지 않고 자리만 차지한다.
  상태 하나에 아이콘 하나를 고정해, 배지에서 보던 모양이 버튼에서도 같게 한다.
*/
export const STATUS_ICON: Record<ActionStatus, ElementType> = {
  대기: Clock,
  진행중: PlayCircle,
  완료: CheckCircle2,
  재검토: RotateCcw,
};

// 완료된 항목도 목표일이 과거일 수 있다. 부호를 보고 문구를 정해야
// "-1일 남음" 같은 표시가 나오지 않는다.
// 완료된 건에 "9일 지남"을 붙이면 아직 밀린 일로 읽힌다. 상단 배너의 지연 건수는
// isOverdue로 완료를 이미 빼고 세므로, 카드 문구만 배너와 어긋나 있었다.
export function dueLabel(left: number | null, done: boolean) {
  if (left === null) return '목표일 미정';
  if (done) return left < 0 ? '목표일 이후 완료' : '완료';
  if (left < 0) return `${Math.abs(left)}일 지남`;
  if (left === 0) return '오늘 마감';
  return `${left}일 남음`;
}
