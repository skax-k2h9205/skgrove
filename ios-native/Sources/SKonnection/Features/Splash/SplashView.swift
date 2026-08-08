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

            VStack(spacing: Theme.Space.x3) {
                Text("SKonnection")
                    .font(.system(size: 44, weight: .bold))
                    .foregroundStyle(.white)
                Text("팀을 잇는 곳")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.85))
            }
            .scaleEffect(appeared ? 1 : 0.92)
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.7)) { appeared = true }
        }
    }
}
