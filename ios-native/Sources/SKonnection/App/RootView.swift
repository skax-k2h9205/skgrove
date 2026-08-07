import SwiftUI

/// 앱의 최상위 탭 셸. iOS 네이티브 TabView 로 핵심 화면을 오간다.
/// (웹의 가로 스크롤 하단바 대신, 5개 탭 + '더보기'의 네이티브 관례를 따른다.)
struct RootView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("홈", systemImage: "house.fill") }
            IntakeView()
                .tabItem { Label("대나무숲", systemImage: "tray.and.arrow.down.fill") }
            AgendaView()
                .tabItem { Label("안건/투표", systemImage: "checkmark.square.fill") }
            ActionsView()
                .tabItem { Label("액션", systemImage: "bolt.fill") }
            MoreView()
                .tabItem { Label("더보기", systemImage: "ellipsis") }
        }
    }
}

/// 화면 공통 뼈대 — 헤더(제목 + 사용자 칩)를 얹고 콘텐츠를 담는다.
struct ScreenScaffold<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    // 제목을 콘텐츠 안 진한 헤딩으로(웹 홈처럼). 네비 라지타이틀은
                    // 옅은 대비 문제가 있어 쓰지 않는다.
                    Text(title)
                        .font(.largeTitle.bold())
                        .foregroundStyle(Theme.Palette.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let user = session.currentUser {
                        HStack(spacing: Theme.Space.x3) {
                            BrandMark(size: 36)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(user.name).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                                Text("\(user.role.rawValue) · \(user.part)")
                                    .font(.caption).foregroundStyle(Theme.Palette.muted)
                            }
                            Spacer()
                            Button { session.logout() } label: {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                            }
                            .tint(Theme.Palette.muted)
                        }
                        .padding(Theme.Space.x3)
                        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
                    }
                    content()
                }
                .padding(Theme.Space.x4)
            }
            .background(Theme.Palette.sunken)
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

/// Phase 1+ 에서 네이티브로 채울 자리. 지금은 톤을 맞춘 플레이스홀더.
struct FeaturePlaceholder: View {
    let icon: String
    let text: String
    var body: some View {
        VStack(spacing: Theme.Space.x3) {
            Image(systemName: icon)
                .font(.system(size: 36))
                .foregroundStyle(Theme.Palette.primary)
            Text(text).font(.subheadline).foregroundStyle(Theme.Palette.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Space.x8)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
    }
}

struct AgendaView: View {
    var body: some View { ScreenScaffold(title: "안건 / 투표") {
        FeaturePlaceholder(icon: "checkmark.square.fill", text: "안건·투표 — 네이티브 구현 예정")
    } }
}
struct ActionsView: View {
    var body: some View { ScreenScaffold(title: "액션아이템") {
        FeaturePlaceholder(icon: "bolt.fill", text: "액션아이템 — 네이티브 구현 예정")
    } }
}
struct MoreView: View {
    var body: some View { ScreenScaffold(title: "더보기") {
        FeaturePlaceholder(icon: "ellipsis", text: "리더관리함·유머·성향·모임·파트지수 — 네이티브 구현 예정")
    } }
}
