import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/*
  사진 한 장을 화면 가득 띄워 보는 겹창.

  장터 사진은 격자에서 4:5 로 잘려 나온다. 흠집이나 모델명처럼 정작 사려는 사람이
  봐야 할 것이 잘리므로, 상세에서 원본 비율로 한 번 더 볼 수 있게 한다.

  배경은 대나무숲·캔미팅이 쓰는 .modal-backdrop 을 그대로 쓴다. 다만 .modal-card 는
  폼에 맞춘 420px 라 사진에는 안 맞아, 사진용 치수만 따로 둔다.

  닫는 길을 셋 둔다(Esc · 배경 누르기 · 닫기 단추). 화면을 전부 덮는 창에서
  빠져나갈 길이 하나뿐이면 그 하나를 못 찾은 사람은 갇힌다.
*/

type PhotoViewerProps = {
  src: string;
  /** 읽어 줄 이름. 보통 물건 제목. */
  alt: string;
  onClose: () => void;
};

export function PhotoViewer({ src, alt, onClose }: PhotoViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // 겹창 뒤의 목록이 같이 밀리면 닫았을 때 보던 자리를 잃는다.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // 열자마자 닫기 단추에 초점을 둔다 — 키보드만 쓰는 사람이 Tab 을 더듬지 않도록.
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div aria-label={alt} aria-modal="true" className="modal-backdrop photo-viewer" onClick={onClose} role="dialog">
      <button aria-label="닫기" className="photo-viewer-close" onClick={onClose} ref={closeRef} type="button">
        <X size={20} />
      </button>

      {/* 사진 자체를 누른 것은 닫으려는 뜻이 아니다. 배경을 누른 경우에만 닫는다. */}
      <img alt={alt} className="photo-viewer-img" onClick={(event) => event.stopPropagation()} src={src} />
    </div>
  );
}
