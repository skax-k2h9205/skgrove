import SwiftUI

@main
struct SKonnectionApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isLoggedIn {
                    RootView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(session)
            .tint(Theme.Palette.primary)
            // 디자인 토큰이 라이트 전용(웹앱과 동일)이라 라이트 모드로 고정한다.
            // 안 그러면 시스템 다크에서 네이티브 List 등이 검게 떠 화면이 어긋난다.
            .preferredColorScheme(.light)
        }
    }
}

/// 브랜드 마크 — 웹앱 사이드바의 heart-handshake 마크와 같은 파란 라운드 사각형.
/// (정확한 heart-handshake 글리프는 앱 아이콘에 반영됨. 인앱 마크는 SF Symbol 로 근사.)
struct BrandMark: View {
    var size: CGFloat = 44
    var body: some View {
        RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
            .fill(Theme.Palette.primary)
            .frame(width: size, height: size)
            .overlay(
                Image(systemName: "heart.fill")
                    .font(.system(size: size * 0.44, weight: .semibold))
                    .foregroundStyle(.white)
            )
    }
}
