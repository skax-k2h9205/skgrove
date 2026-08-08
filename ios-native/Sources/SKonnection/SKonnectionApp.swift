import SwiftUI

@main
struct SKonnectionApp: App {
    @StateObject private var session = SessionStore()
    // 앱 전역 공유 스토어 — 화면마다 새로 만들지 않고 여기서 한 번만 생성해 주입한다.
    // (접수↔리더, 안건 투표, 액션 상태가 화면을 넘나들며 일관되게 유지되고 영속화된다.)
    @StateObject private var issues = IssueStore()
    @StateObject private var agendas = AgendaStore()
    @StateObject private var actions = ActionStore()
    @StateObject private var meetings = MeetingStore()
    @StateObject private var market = MarketStore()
    @StateObject private var gatherings = GatheringStore()
    @StateObject private var humor = HumorStore()
    @StateObject private var profiles = ProfileStore()
    @StateObject private var memories = MemoryStore()
    @StateObject private var system = SystemStore()
    @State private var showSplash = true
    @State private var splashScheduled = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                Group {
                    if session.isLoggedIn {
                        RootView()
                    } else {
                        LoginView()
                    }
                }
                .environmentObject(session)
                .environmentObject(issues)
                .environmentObject(agendas)
                .environmentObject(actions)
                .environmentObject(meetings)
                .environmentObject(market)
                .environmentObject(gatherings)
                .environmentObject(humor)
                .environmentObject(profiles)
                .environmentObject(memories)
                .environmentObject(system)

                if showSplash {
                    SplashView()
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .tint(Theme.Palette.primary)
            // 디자인 토큰이 라이트 전용(웹앱과 동일)이라 라이트 모드로 고정한다.
            // 안 그러면 시스템 다크에서 네이티브 List 등이 검게 떠 화면이 어긋난다.
            .preferredColorScheme(.light)
            // 시작 splash 를 잠깐 보여준 뒤 앱으로 전환한다.
            // 시작 splash 를 1.4초 보여준 뒤 전환한다. asyncAfter 는 뷰 재렌더에
            // 취소되지 않아 splash 가 조기 종료되지 않는다(가드로 1회만 예약).
            .onAppear {
                guard !splashScheduled else { return }
                splashScheduled = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
                    withAnimation(.easeInOut(duration: 0.45)) { showSplash = false }
                }
            }
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
