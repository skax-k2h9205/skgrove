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
                // 브랜드 로고 — 그라데이션 위에서 대비되도록 흰 라운드 카드 + 브랜드블루 하트.
                // (앱 아이콘/로그인 헤더의 하트 모티프와 동일. 옛 hand-drawn 악수 글리프는 깨져 보여 뺐던 것.)
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .fill(.white)
                    .frame(width: 120, height: 120)
                    .overlay(
                        Image(systemName: "heart.fill")
                            .font(.system(size: 58, weight: .semibold))
                            .foregroundStyle(Theme.Palette.primary)
                    )
                    .shadow(color: .black.opacity(0.18), radius: 24, y: 10)

                VStack(spacing: Theme.Space.x2) {
                    Text("SKonnection")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundStyle(.white)
                    Text("팀을 잇는 곳")
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .scaleEffect(appeared ? 1 : 0.9)
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.7)) { appeared = true }
        }
    }
}
