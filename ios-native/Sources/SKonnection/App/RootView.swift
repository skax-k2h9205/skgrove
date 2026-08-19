import SwiftUI

/// 앱의 최상위 탭 셸. iOS 네이티브 TabView 로 핵심 화면을 오간다.
/// (웹의 가로 스크롤 하단바 대신, 5개 탭 + '더보기'의 네이티브 관례를 따른다.)
/// 홈 '말하기'에서 고를 수 있는 작성 대상.
enum ComposeTarget: String, Identifiable, CaseIterable {
    case humor, gathering, market, intake
    var id: String { rawValue }
    var label: String {
        switch self {
        case .humor: return "유머"
        case .gathering: return "모임 · 번개"
        case .market: return "이음장터"
        case .intake: return "대나무숲 접수"
        }
    }
    var icon: String {
        switch self {
        case .humor: return "face.smiling.fill"
        case .gathering: return "bolt.fill"
        case .market: return "shippingbox.fill"
        case .intake: return "tray.and.arrow.down.fill"
        }
    }
    /// 이름만으로는 무엇을 쓰는 자리인지 알기 어렵다 — 한 줄로 알려준다.
    var desc: String {
        switch self {
        case .humor: return "웃긴 이야기나 짤을 공유해요"
        case .gathering: return "번개·커피 내기를 열어요"
        case .market: return "나눔·경매로 물건을 주고받아요"
        case .intake: return "팀에 하고 싶은 이야기를 남겨요"
        }
    }
    var tint: Color {
        switch self {
        case .humor: return Theme.Palette.tintDanger
        case .gathering: return Theme.Palette.tintPrimary
        case .market: return Theme.Palette.tintNeutral
        case .intake: return Theme.Palette.tintSuccess
        }
    }
    var ink: Color {
        switch self {
        case .humor: return Theme.Palette.danger
        case .gathering: return Theme.Palette.tintPrimaryInk
        case .market: return Theme.Palette.ink
        case .intake: return Theme.Palette.tintSuccessInk
        }
    }
}

struct RootView: View {
    @State private var showChat = false
    @State private var tab = 0
    // 작성 상태를 여기까지 끌어올린다 — 홈 '말하기'가 각 화면의 작성 폼을 바로 열 수 있어야 한다.
    @State private var composeHumor = false
    @State private var composeGathering = false
    @State private var composeMarket = false
    @State private var composeIntake = false

    var body: some View {
        TabView(selection: $tab) {
            HomeView(onOpen: { tab = $0 }, onCompose: startCompose)
                .tabItem { Label("홈", systemImage: "house.fill") }.tag(0)
            HumorView(composing: $composeHumor)
                .tabItem { Label("유머", systemImage: "face.smiling.fill") }.tag(1)
            GatheringsView(composing: $composeGathering)
                .tabItem { Label("모임", systemImage: "bolt.fill") }.tag(2)
            MarketView(composing: $composeMarket)
                .tabItem { Label("이음장터", systemImage: "shippingbox.fill") }.tag(3)
            MoreView()
                .tabItem { Label("더보기", systemImage: "ellipsis") }.tag(4)
        }
        // 대나무숲 접수는 탭이 아니라 독립 화면이라 시트로 띄운다.
        .sheet(isPresented: $composeIntake) {
            NavigationStack {
                IntakeView()
                    .toolbar { ToolbarItem(placement: .cancellationAction) {
                        Button("닫기") { composeIntake = false }
                    } }
            }
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

    /// 고른 대상의 탭으로 옮기고 그 화면의 작성 폼을 연다(접수만 시트).
    private func startCompose(_ target: ComposeTarget) {
        switch target {
        case .humor: tab = 1; composeHumor = true
        case .gathering: tab = 2; composeGathering = true
        case .market: tab = 3; composeMarket = true
        case .intake: composeIntake = true
        }
    }
}

/// 화면 공통 뼈대 — 제목 헤딩(+선택적 사용자 칩)을 얹고 콘텐츠를 담는다.
/// NavigationStack 은 포함하지 않는다(탭 루트는 불필요, 더보기 하위는 상위 스택을 씀).
struct ScreenScaffold<Content: View>: View {
    let title: String
    var showUserChip: Bool = true
    /// 당겨서 새로고침 동작(있으면 pull-to-refresh 활성).
    var onRefresh: (() async -> Void)? = nil
    /// 있으면 타이틀 좌측에 작성용 '+' 버튼을 얹는다(유머·모임·장터·미팅 공용).
    var onCompose: (() -> Void)? = nil
    @ViewBuilder var content: () -> Content
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                HStack(spacing: Theme.Space.x3) {
                    if let onCompose {
                        Button(action: onCompose) {
                            Image(systemName: "plus")
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(Theme.Palette.cta)
                                .frame(width: 40, height: 40)
                                .background(Theme.Palette.tintPrimary, in: Circle())
                                .overlay(Circle().stroke(Theme.Palette.cta.opacity(0.35), lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                    Text(title)
                        .font(.largeTitle.bold())
                        .foregroundStyle(Theme.Palette.ink)
                    Spacer(minLength: 0)
                }
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
        .refreshableIf(onRefresh)
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

/// 더보기 허브 — 프로필 헤더 + 나머지 화면 리스트(인스타의 프로필 탭 격).
struct MoreView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var confirmLogout = false

    var body: some View {
        NavigationStack {
            List {
                // 홈에 있던 로그인 정보를 여기로. 프로필 탭 → 마이페이지(인스타 프로필 탭 격).
                if let user = session.currentUser {
                    Section {
                        NavigationLink { MyPageView() } label: {
                            HStack(spacing: Theme.Space.x3) {
                                BrandMark(size: 44)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(user.name).font(.headline).foregroundStyle(Theme.Palette.ink)
                                    Text("\(user.role.rawValue) · \(user.part)")
                                        .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                                }
                            }
                            .padding(.vertical, Theme.Space.x1)
                        }
                    }
                }

                Section("워크") {
                    link("대나무숲 접수", "tray.and.arrow.down.fill", Theme.Palette.primary) { IntakeView() }
                    link("안건 / 투표", "checkmark.square.fill", Theme.Palette.primary) { AgendaView() }
                    link("액션아이템", "bolt.fill", Theme.Palette.success) { ActionsView() }
                    link("캔미팅 / 티미팅", "dot.radiowaves.left.and.right", Theme.Palette.primary) { MeetingsView() }
                }
                // 리더 관리함은 실제 리더 역할만 — 예전엔 조건이 없어 팀원에게도 보였고,
                // 열면 남의 파트로 간 대나무숲 접수까지 다 보였다(웹은 원래 막혀 있었다).
                if session.currentUser?.role.hasLeaderRole == true {
                    Section("리더") {
                        link("리더 관리함", "tray.full.fill", Theme.Palette.primary) { LeaderView() }
                    }
                }
                Section("팀") {
                    link("팀 추억", "photo.stack.fill", Theme.Palette.cta) { MemoryView() }
                }
                Section("사람") {
                    link("동료 성향", "person.2.fill", Theme.Palette.primary) { ProfilesView() }
                    link("조 뽑기", "shuffle", Theme.Palette.success) { ConnectView() }
                }
                Section("지표 · 알림") {
                    link("성장 · 커리어", "leaf.fill", Theme.Palette.success) { GrowthView() }
                    link("파트지수 / 리포트", "chart.bar.fill", Theme.Palette.primaryStrong) { MetricsView() }
                    link("알림 / 메시지", "bell.fill", Theme.Palette.cta) { NotificationsView() }
                }

                // 관리 화면의 문턱은 웹과 같게 나눈다 — 예전엔 둘을 한 덩어리로 묶어
                // 파트리더도 계정·시스템 관리에 들어갈 수 있었다.
                if session.currentUser?.role.canManageAccounts == true
                    || session.currentUser?.role.canManageSystem == true {
                    Section("관리") {
                        if session.currentUser?.role.canManageAccounts == true {
                            link("계정 관리", "person.2.badge.gearshape.fill", Theme.Palette.primaryStrong) { AccountsView() }
                        }
                        if session.currentUser?.role.canManageSystem == true {
                            link("시스템 관리", "gearshape.2.fill", Theme.Palette.muted) { SystemView() }
                        }
                    }
                }
                Section {
                    Button(role: .destructive) { confirmLogout = true } label: {
                        Label("로그아웃", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("더보기")
            .confirmationDialog("로그아웃할까요?", isPresented: $confirmLogout, titleVisibility: .visible) {
                Button("로그아웃", role: .destructive) { session.logout() }
                Button("취소", role: .cancel) {}
            }
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
