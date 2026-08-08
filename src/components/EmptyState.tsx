import type { ElementType } from 'react';

export type EmptyStateProps = {
  icon: ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /*
    목적지 화면에서 비어 있다는 건 그 화면의 전부이므로 크게 말해야 한다.
    반면 홈의 요약 패널은 "없음"도 여러 정보 중 하나다. 258px 짜리 빈 상자가
    화면에서 가장 큰 블록이 되면, 할 일이 없다는 사실이 할 일보다 커진다.
    같은 문구를 한 줄로 눕혀 자리만 줄인다.
  */
  compact?: boolean;
};

/*
  빈 상태가 화면마다 맨 텍스트였다. "조건에 맞는 안건이 없습니다"로 끝나면
  다음에 뭘 해야 하는지가 없다. 다음 행동을 함께 둔다.
*/
export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'}>
      <Icon aria-hidden size={compact ? 20 : 28} />
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-desc">{description}</p> : null}
      {action ? (
        <button type="button" className="btn-secondary" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
