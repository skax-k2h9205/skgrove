import type { ElementType } from 'react';

type PanelHeaderProps = {
  icon: ElementType;
  title: string;
  /* 패널을 열기 전에 알아야 하는 한 마디(예: "지연 2"). 없으면 렌더하지 않는다. */
  note?: string;
};

export function PanelHeader({ icon: Icon, title, note }: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <Icon size={20} />
      <h2>{title}</h2>
      {note ? <span className="panel-header-note">{note}</span> : null}
    </div>
  );
}
