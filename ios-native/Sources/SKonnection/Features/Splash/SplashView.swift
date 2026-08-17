import SwiftUI

/// 24x24 로고 패스를 주어진 사각형에 맞춰 그리는 Shape.
/// Shape 로 감싸야 .trim 이 애니메이션된다(Path 를 직접 그리면 보간되지 않는다).
struct MarkShape: Shape {
    let build: (CGFloat, CGPoint) -> Path
    func path(in rect: CGRect) -> Path {
        build(min(rect.width, rect.height) / 24, CGPoint(x: rect.minX, y: rect.minY))
    }
}

/// 앱 시작 splash — 브랜드 마크가 **그려지면서** 나타난다.
///
/// 연출은 로고가 원래 담고 있는 뜻을 시간축으로 편 것이다:
///   1. 두 팔이 양쪽에서 가운데로 들어와 **맞잡고**
///   2. 그 지점에서 **하트가 그려져 나가고**
///   3. 한 번 뛴다.
///
/// 영상이 아니라 **로고 패스 그대로** 그린다. 콜드 스타트에 디코딩 부담이 없고,
/// 어떤 화면에서도 선명하며, 방금 누른 앱 아이콘과 픽셀 단위로 같은 마크가 나온다.
struct SplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var clasp: CGFloat = 0   // 두 팔이 모이는 정도 0→1
    @State private var grip: CGFloat = 0    // 손가락 두 획
    @State private var heart: CGFloat = 0   // 하트 외곽선 그려짐 0→1
    @State private var beat = false         // 완성 후 한 번 뛰기
    @State private var word: CGFloat = 0    // 워드마크

    private let side: CGFloat = 132
    private var lineWidth: CGFloat { side / 24 * 2 }   // 원본 stroke-width 2 비율 유지

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.Palette.primary, Theme.Palette.primaryStrong],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: Theme.Space.x5) {
                mark
                    .frame(width: side, height: side)
                    .scaleEffect(beat ? 1.0 : 0.96)

                VStack(spacing: Theme.Space.x1) {
                    Text("SKonnection")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(.white)
                    Text("팀을 잇는 곳")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                }
                .opacity(word)
                .offset(y: (1 - word) * 8)
            }
        }
        .onAppear(perform: play)
    }

    // MARK: 마크

    /// Canvas 로 그리면 안 된다 — 드로잉 클로저 안의 값은 SwiftUI 가 보간해주지 않아
    /// 애니메이션 없이 최종 상태로 점프한다. Shape 의 .trim 은 animatableData 를 갖고
    /// 있어서 선이 그려져 나가는 연출이 실제로 보인다.
    private var mark: some View {
        let stroke = StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
        return ZStack {
            // 1) 두 팔 — 한 획(clasp)의 양 끝에서 가운데(0.5)로 각각 자라 들어온다.
            MarkShape(build: BrandMarkPath.clasp)
                .trim(from: 0, to: 0.5 * clasp)
                .stroke(.white, style: stroke)
            MarkShape(build: BrandMarkPath.clasp)
                .trim(from: 1 - 0.5 * clasp, to: 1)
                .stroke(.white, style: stroke)

            // 2) 손가락 두 획 — 맞잡고 나서 쥐는 느낌으로 뒤늦게 붙는다.
            Group {
                MarkShape(build: BrandMarkPath.finger1).stroke(.white, style: stroke)
                MarkShape(build: BrandMarkPath.finger2).stroke(.white, style: stroke)
            }
            .opacity(grip)
            .scaleEffect(0.86 + 0.14 * grip)

            // 3) 하트 외곽선 — 맞잡은 뒤 그려져 나간다.
            MarkShape(build: BrandMarkPath.heart)
                .trim(from: 0, to: heart)
                .stroke(.white, style: stroke)
        }
        .accessibilityLabel("SKonnection")
    }

    // MARK: 타임라인

    private func play() {
        guard !reduceMotion else {
            clasp = 1; grip = 1; heart = 1; beat = true; word = 1
            return
        }
        withAnimation(.easeOut(duration: 0.55)) { clasp = 1 }
        withAnimation(.spring(response: 0.34, dampingFraction: 0.55).delay(0.46)) { grip = 1 }
        withAnimation(.easeInOut(duration: 0.55).delay(0.50)) { heart = 1 }
        withAnimation(.easeOut(duration: 0.35).delay(0.92)) { word = 1 }
        withAnimation(.spring(response: 0.32, dampingFraction: 0.42).delay(1.02)) { beat = true }
    }
}
