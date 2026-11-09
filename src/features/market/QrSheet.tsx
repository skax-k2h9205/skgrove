import { ArrowLeft, Printer } from 'lucide-react';
import { QrCode } from '../../components/QrCode';
import { publicTitle } from '../../marketRules';
import type { MarketItem } from '../../types';

/*
  행사 물건들의 QR 시트. 접수가 끝난 뒤 운영자가 한 장으로 뽑아, 오프라인 진열대
  물건 옆에 잘라 붙인다. 스캔하면 로그인 후 그 물건 상세(입찰 화면)로 바로 간다.
  인쇄는 브라우저 기본 인쇄를 쓴다 — 화면/인쇄 전환은 styles.css 의 @media print 가 맡는다.
*/
export function QrSheet({
  items,
  linkFor,
  title,
  onBack,
}: {
  items: MarketItem[];
  /** 물건 → 딥링크 URL(스캔 대상). */
  linkFor: (item: MarketItem) => string;
  /** 시트 제목(행사명 등). */
  title: string;
  onBack: () => void;
}) {
  return (
    <section className="screen">
      <button className="btn-ghost back-link no-print" onClick={onBack} type="button">
        <ArrowLeft size={16} />
        목록으로
      </button>

      <div className="qr-sheet">
        <div className="qr-sheet-head no-print">
          <div>
            <h2>{title} QR 시트</h2>
            <p className="field-note">
              물건 옆에 붙여두면 스캔해서 해당 상품 입찰 화면으로 바로 이동해요. 총 {items.length}개.
            </p>
          </div>
          <button className="primary-button" onClick={() => window.print()} type="button">
            <Printer size={16} />
            인쇄
          </button>
        </div>

        {items.length === 0 ? (
          <p className="field-note no-print">아직 올라온 물건이 없어요. 접수가 모이면 여기서 QR을 뽑을 수 있어요.</p>
        ) : (
          <div className="qr-grid">
            {items.map((item) => (
              <div className="qr-item" key={item.id}>
                <QrCode className="qr-img" size={160} value={linkFor(item)} />
                {/* 안 연 랜덤박스는 진열대에 붙는 종이에도 '랜덤박스'로만. */}
                <strong className="qr-item-title">{publicTitle(item)}</strong>
                <span className="qr-item-sub">
                  {item.kind === 'giveaway' ? '나눔' : '경매'} · {item.seller}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
