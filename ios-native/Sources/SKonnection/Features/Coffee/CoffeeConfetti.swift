import SwiftUI

/// 당첨 순간의 축하 조각. 결과가 텍스트만 바뀌면 "뽑혔다"는 감각이 안 산다.
///
/// seed 로 배치를 정한다 — 다시보기에서도 같은 조각이 같은 자리에 떨어져야
/// "그때 그 장면"이 된다. 매번 다르면 재생이 아니라 새 애니메이션이 된다.
struct CoffeeConfetti: View {
    let seed: UInt64
    @State private var fall = false

    private struct Piece {
        let x: CGFloat, delay: Double, size: CGFloat, spin: Double, color: Color
    }

    private var pieces: [Piece] {
        var rng = SplitMix64(seed: seed &+ 0x9E37)
        let palette: [Color] = [
            Theme.Palette.primary, Theme.Palette.heart, Theme.Palette.success,
            Color(hex: 0xE8A33D), Color(hex: 0x7C3AED),
        ]
        return (0..<26).map { _ in
            Piece(
                x: CGFloat(rng.next() % 1000) / 1000,
                delay: Double(rng.next() % 500) / 1000,
                size: 5 + CGFloat(rng.next() % 6),
                spin: Double(rng.next() % 720) - 360,
                color: palette[Int(rng.next() % UInt64(palette.count))]
            )
        }
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                ForEach(Array(pieces.enumerated()), id: \.offset) { _, p in
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(p.color)
                        .frame(width: p.size, height: p.size * 1.7)
                        .rotationEffect(.degrees(fall ? p.spin : 0))
                        .offset(x: p.x * geo.size.width - geo.size.width / 2,
                                y: fall ? geo.size.height + 40 : -30)
                        .opacity(fall ? 0 : 1)
                        .animation(.easeIn(duration: 1.4).delay(p.delay), value: fall)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .allowsHitTesting(false)
        .onAppear { fall = true }
    }
}
