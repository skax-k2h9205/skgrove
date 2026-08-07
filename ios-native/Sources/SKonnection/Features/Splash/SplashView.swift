import SwiftUI

/// 앱 시작 splash — 브랜드 블루 그라데이션 + HeartHandshake 로고 + 워드마크.
/// 런치 후 잠깐 보여주고 앱으로 부드럽게 전환한다(SKonnectionApp).
struct SplashView: View {
    @State private var appeared = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.Palette.primary, Theme.Palette.primaryStrong],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: Theme.Space.x5) {
                HeartHandshakeGlyph()
                    .stroke(.white, style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                    .frame(width: 132, height: 132)
                    .shadow(color: .white.opacity(0.35), radius: 24)
                    .scaleEffect(appeared ? 1 : 0.8)
                    .opacity(appeared ? 1 : 0)

                VStack(spacing: Theme.Space.x2) {
                    Text("SKonnection")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(.white)
                    Text("팀을 잇는 곳")
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.85))
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 12)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.7)) { appeared = true }
        }
    }
}

/// lucide heart-handshake 를 SwiftUI Path 로 옮긴 글리프(앱 아이콘과 동일 모티프).
/// 원본 viewBox 0…24 를 프레임 크기에 맞춰 그린다.
struct HeartHandshakeGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * s, y: rect.minY + y * s) }

        var path = Path()

        // 하트 외곽: M19 14 c1.49-1.46 3-3.21 3-5.5 A5.5 5.5 0 0 0 16.5 3
        //           c-1.76 0-3 .5-4.5 2 -1.5-1.5-2.74-2-4.5-2 A5.5 5.5 0 0 0 2 8.5
        //           c0 2.3 1.5 4.05 3 5.5 l7 7 Z
        path.move(to: p(19, 14))
        path.addCurve(to: p(22, 8.5), control1: p(20.49, 12.54), control2: p(22, 10.79))
        path.addArc(center: p(16.5, 8.5), radius: 5.5 * s,
                    startAngle: .degrees(0), endAngle: .degrees(-90), clockwise: true)
        path.addCurve(to: p(12, 5), control1: p(14.74, 3), control2: p(13.5, 3.5))
        path.addCurve(to: p(7.5, 3), control1: p(10.5, 3.5), control2: p(9.26, 3))
        path.addArc(center: p(7.5, 8.5), radius: 5.5 * s,
                    startAngle: .degrees(-90), endAngle: .degrees(180), clockwise: true)
        path.addCurve(to: p(8, 14), control1: p(2, 10.8), control2: p(3.5, 12.55))
        path.addLine(to: p(15, 21))
        path.closeSubpath()

        // 악수: M12 5 L9.04 7.96 a2.17 2.17 0 0 0 0 3.08 c.82.82 2.13.85 3 .07
        //       l2.07-1.9 a2.82 2.82 0 0 1 3.79 0 l2.96 2.66
        path.move(to: p(12, 5))
        path.addLine(to: p(9.04, 7.96))
        path.addCurve(to: p(9.04, 11.04), control1: p(8.2, 8.8), control2: p(8.2, 10.2))
        path.addCurve(to: p(12.04, 11.11), control1: p(9.86, 11.86), control2: p(11.17, 11.89))
        path.addLine(to: p(14.11, 9.21))
        path.addCurve(to: p(17.9, 9.21), control1: p(15.2, 8.2), control2: p(16.8, 8.2))
        path.addLine(to: p(20.86, 11.87))

        // 손가락 디테일: m18 15 -2-2 / m15 18 -2-2
        path.move(to: p(18, 15)); path.addLine(to: p(16, 13))
        path.move(to: p(15, 18)); path.addLine(to: p(13, 16))

        return path
    }
}
