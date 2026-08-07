import SwiftUI

/// 앱의 최상위 탭 셸. iOS 네이티브 TabView 로 핵심 화면을 오간다.
/// (웹의 가로 스크롤 하단바 대신, 5개 탭 + '더보기'의 네이티브 관례를 따른다.)
struct RootView: View {
    @State private var showChat = false
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            HomeView { tab = $0 }   // 피드 타일 탭 → 해당 섹션 탭으로 이동
                .tabItem { Label("홈", systemImage: "house.fill") }.tag(0)
            HumorView()
                .tabItem { Label("유머", systemImage: "face.smiling.fill") }.tag(1)
            GatheringsView()
                .tabItem { Label("모임", systemImage: "bolt.fill") }.tag(2)
            MarketView()
                .tabItem { Label("이음장터", systemImage: "shippingbox.fill") }.tag(3)
            MoreView()
                .tabItem { Label("더보기", systemImage: "ellipsis") }.tag(4)
        }
        // AI 상담 챗봇 FAB — 웹처럼 어느 화면에서나 뜬다. 탭바 위에 띄운다.
        .overlay(alignment: .bottomTrailing) {
            Button { showChat = true } label: {
                Image(systemName: "message.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Theme.Palette.cta, in: Circle())
                    .shadow(color: Theme.Palette.surfaceDark.opacity(0.2), radius: 6, y: 3)
            }
            .padding(.trailing, Theme.Space.x5)
            .padding(.bottom, 68)
        }
        .sheet(isPresented: $showChat) { ChatView() }
    }
}

/// 화면 공통 뼈대 — 제목 헤딩(+선택적 사용자 칩)을 얹고 콘텐츠를 담는다.
/// NavigationStack 은 포함하지 않는다(탭 루트는 불필요, 더보기 하위는 상위 스택을 씀).
struct ScreenScaffold<Content: View>: View {
    let title: String
    var showUserChip: Bool = true
    @ViewBuilder var content: () -> Content
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                Text(title)
                    .font(.largeTitle.bold())
                    .foregroundStyle(Theme.Palette.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if showUserChip, let user = session.currentUser {
                    userChip(user)
                }
                content()
            }
            .padding(Theme.Space.x4)
        }
        .background(Theme.Palette.sunken)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func userChip(_ user: CurrentUser) -> some View {
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

/// 더보기 허브 — 나머지 화면으로 가는 네이티브 리스트. 각 항목을 push 한다.
struct MoreView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("워크") {
                    link("대나무숲 접수", "tray.and.arrow.down.fill", Theme.Palette.primary) { IntakeView() }
                    link("안건 / 투표", "checkmark.square.fill", Theme.Palette.primary) { AgendaView() }
                    link("액션아이템", "bolt.fill", Theme.Palette.success) { ActionsView() }
                }
                Section("리더") {
                    link("리더 관리함", "tray.full.fill", Theme.Palette.primary) { LeaderView() }
                }
                Section("팀") {
                    link("팀 추억", "photo.stack.fill", Theme.Palette.cta) { MemoryView() }
                }
                Section("사람") {
                    link("동료 성향", "person.2.fill", Theme.Palette.primary) { ProfilesView() }
                    link("조 뽑기", "shuffle", Theme.Palette.success) { ConnectView() }
                }
                Section("지표 · 알림") {
                    link("파트지수 / 리포트", "chart.bar.fill", Theme.Palette.primaryStrong) { MetricsView() }
                    link("알림 / 메시지", "bell.fill", Theme.Palette.cta) { NotificationsView() }
                }
            }
            .navigationTitle("더보기")
        }
    }

    private func link(_ title: String, _ icon: String, _ color: Color,
                      @ViewBuilder _ dest: @escaping () -> some View) -> some View {
        NavigationLink { dest() } label: {
            Label {
                Text(title).foregroundStyle(Theme.Palette.ink)
            } icon: {
                Image(systemName: icon).foregroundStyle(color)
            }
        }
    }
}
