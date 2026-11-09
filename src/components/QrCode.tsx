import qrcode from 'qrcode-generator';

/*
  물건별 QR. 외부 QR API 를 쓰지 않는다 — 물건 id 가 바깥으로 나가지 않도록
  순수 JS 인코더로 모듈 행렬을 만들고 SVG 로 직접 그린다(인쇄해도 또렷하다).
  스캐너 대비를 위해 색은 테마 토큰이 아니라 항상 검정/흰색으로 고정한다.
*/
export function QrCode({
  value,
  size = 150,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const qr = qrcode(0, 'M'); // 0 = 자동 버전, M = 25% 오류정정(살짝 가려도 읽힘)
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 4; // 표준 'quiet zone'
  const total = count + margin * 2;

  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        path += `M${col + margin},${row + margin}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      aria-label="QR 코드"
      className={className}
      height={size}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#ffffff" height={total} width={total} />
      <path d={path} fill="#000000" />
    </svg>
  );
}
