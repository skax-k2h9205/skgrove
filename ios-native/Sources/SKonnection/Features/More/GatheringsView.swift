import SwiftUI

/// 모임 · 번개 — 인스타 3열 그리드. 타일 탭 시 상세에서 신청/취소·대기·커피뽑기. 웹 gatheringRules 이식.
struct GatheringsView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var store: GatheringStore
    @State private var filter = "모집중"
    /// 작성 폼 표시 여부 — 홈 '말하기'에서도 열 수 있게 RootView 가 소유한다.
    @Binding var composing: Bool
    @State private var selected: Gathering?
    @State private var reporting: ReportTarget?
    /// 취소 확인 대상. 되돌릴 수 없어 한 번 더 묻는다.
    @State private var cancelingGathering: String?
    @EnvironmentObject private var moderation: ModerationStore
    private let filters = ["모집중", "내가 신청", "내가 연 것", "전체"]

    private var myName: String { session.currentUser?.name ?? "나" }

    private var visible: [Gathering] {
        // 차단·신고한 것은 필터와 무관하게 먼저 걸러낸다(심사 지침 1.2).
        store.gatherings.filter { !moderation.isHidden(.gathering, id: $0.id, author: $0.host) }.filter { g in
            switch filter {
            case "모집중": return store.status(g) == .open || store.status(g) == .closed
            case "내가 신청": return store.mySeat(g, name: myName) != nil
            case "내가 연 것": return g.host == myName
            default: return true
            }
        }
    }

    var body: some View {
        ScreenScaffold(title: "모임 · 번개", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) },
                       onCompose: { composing = true }) {
            ChipRow(items: filters, selection: $filter)

            if visible.isEmpty {
                EmptyState(icon: "calendar.badge.exclamationmark", title: "해당 모임이 없어요",
                           message: "다른 필터를 골라보거나 모임을 열어보세요.")
            } else {
                InstaGrid(items: visible) { g in
                    Button { Haptics.selection(); selected = g } label: {
                        GridTile(imageURL: URL(string: g.imageURL), icon: icon(g.kind), title: g.title, meta: metaFor(g),
                                 tint: store.status(g).tint, ink: store.status(g).ink,
                                 caption: (author: g.host.isEmpty ? "우리 팀" : g.host, text: g.title))
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        ModerationMenuItems(
                            target: ReportTarget(kind: .gathering, targetId: g.id, author: g.host),
                            onReport: { reporting = $0 },
                            onDelete: { cancelingGathering = g.id })
                    }
                }
            }
        }
        .sheet(item: $selected) { g in GatheringDetailSheet(gatheringId: g.id) }
        .sheet(item: $reporting) { ReportSheet(target: $0) }
        .confirmationDialog("이 모임을 취소할까요?",
                            isPresented: Binding(get: { cancelingGathering != nil },
                                                 set: { if !$0 { cancelingGathering = nil } }),
                            presenting: cancelingGathering) { id in
            Button("모임 취소", role: .destructive) {
                withAnimation(.snappy) { store.cancel(id, host: myName) }
                Haptics.success()
            }
            Button("돌아가기", role: .cancel) {}
        } message: { _ in
            Text("신청한 사람들에게도 취소로 표시됩니다.")
        }
        .sheet(isPresented: $composing) {
            GatheringComposeSheet { kind, title, startAt, place, capacity, desc in
                let k: GatheringKind = kind == "번개" ? .flash : (kind == "커피" ? .coffee : .gathering)
                store.create(kind: k, title: title, host: myName,
                             startAt: MarketClock.isoString(startAt), closeAt: MarketClock.isoString(startAt),
                             capacity: capacity, place: place, desc: desc, coffeeDraw: k == .coffee)
                Haptics.success()
            }
        }
    }

    /// 타일 메타 — 모집중이면 정원/남은시간, 끝났으면 상태.
    private func metaFor(_ g: Gathering) -> String {
        let s = store.status(g)
        guard s == .open || s == .closed else { return s.rawValue }
        let cap = g.capacity.map { "\(store.confirmedCount(g))/\($0)명" } ?? "\(store.confirmedCount(g))명"
        return "\(cap) · \(store.timeUntil(g))"
    }

    private func icon(_ kind: GatheringKind) -> String {
        switch kind {
        case .flash: return "bolt.fill"
        case .coffee: return "cup.and.saucer.fill"
        case .gathering: return "calendar"
        }
    }
}

/// 모임 상세 — 확정/대기 로스터 + 신청/취소, 대기 안내, 주최자 커피뽑기·취소.
/// 홈 스토리에서도 바로 띄운다(탭 전환 없이 상세로) — 그래서 private 이 아니다.
struct GatheringDetailSheet: View {
    let gatheringId: String
    @EnvironmentObject private var store: GatheringStore
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var coffeeGames: CoffeeGameStore
    @Environment(\.dismiss) private var dismiss
    @State private var showCoffeeGame = false
    @State private var reporting: ReportTarget?
    @State private var confirmingCancel = false
    @EnvironmentObject private var moderation: ModerationStore

    private var myName: String { session.currentUser?.name ?? "나" }
    private var g: Gathering? { store.gatherings.first { $0.id == gatheringId } }

    /// 신고·차단한 모임은 상세도 함께 닫는다(심사 지침 1.2 '즉시 제거').
    private var hiddenNow: Bool {
        guard let g else { return false }
        return moderation.isHidden(.gathering, id: g.id, author: g.host)
    }
    /// 지금 이 모임에서 돌아가는(또는 끝난) 게임.
    private var liveGame: CoffeeGame? { coffeeGames.game(for: gatheringId) }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let g {
                    VStack(alignment: .leading, spacing: Theme.Space.x4) {
                        header(g)
                        if !g.desc.isEmpty {
                            Text(g.desc).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                        }
                        infoCard(g)
                        if !g.coffeePick.isEmpty { coffeeResult(g) }
                        coffeeGameArea(g)
                        rosterCard(g)
                        actionArea(g)
                    }
                    .padding(Theme.Space.x4)
                } else {
                    Text("모임을 찾을 수 없어요.").foregroundStyle(Theme.Palette.muted).padding()
                }
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("모임 · 번개").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } }
                ToolbarItem(placement: .primaryAction) {
                    if let g {
                        ModerationToolbarMenu(
                            target: ReportTarget(kind: .gathering, targetId: g.id, author: g.host),
                            onReport: { reporting = $0 },
                            onDelete: { confirmingCancel = true })
                    }
                }
            }
            .sheet(item: $reporting) { ReportSheet(target: $0) }
            .confirmationDialog("이 모임을 취소할까요?", isPresented: $confirmingCancel) {
                Button("모임 취소", role: .destructive) {
                    store.cancel(gatheringId, host: myName); Haptics.success(); dismiss()
                }
                Button("돌아가기", role: .cancel) {}
            } message: { Text("신청한 사람들에게도 취소로 표시됩니다.") }
            .onChange(of: hiddenNow) { _, now in if now { dismiss() } }
        }
        .presentationDetents([.medium, .large])
        // 상세가 열려 있는 동안만 폴링한다 — 게임이 시작되면 참가자 폰에도 곧바로 뜬다.
        .task {
            await coffeeGames.loadPhotosIfNeeded()
            coffeeGames.startPolling(gatheringId)
        }
        .onDisappear { coffeeGames.stopPolling() }
        // 다른 사람이 게임을 시작하면 관전 화면을 자동으로 띄운다.
        .onChange(of: liveGame?.phase) { _, phase in
            if phase == .spinning, !showCoffeeGame { showCoffeeGame = true }
        }
        .sheet(isPresented: $showCoffeeGame) {
            if let g {
                CoffeeGameSheet(gatheringId: gatheringId,
                                isHost: g.host == myName,
                                hostName: g.host,
                                participants: coffeeGames.participants(
                                    names: store.coffeeCandidates(g).map(\.name)),
                                onWinner: { store.setCoffeePick(g.id, name: $0) })
            }
        }
    }

    /// 커피 내기 게임 진입 — 주최자에겐 시작 버튼, 참가자에겐 관전 버튼.
    @ViewBuilder
    private func coffeeGameArea(_ g: Gathering) -> some View {
        let isHost = g.host == myName
        let joined = store.mySeat(g, name: myName) != nil
        if let live = liveGame, live.phase != .done {
            // 진행 중 — 누구나 들어가서 같이 볼 수 있다.
            Button { showCoffeeGame = true; Haptics.light() } label: {
                Label(live.phase == .spinning ? "지금 돌아가는 중 — 같이 보기"
                                              : "\(live.startedBy)님이 \(live.kind.rawValue) 준비 중",
                      systemImage: live.kind.systemImage)
                    .font(.subheadline.bold()).frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Space.x3)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.heart)
        } else if store.canDrawCoffee(g) {
            if isHost {
                Button { showCoffeeGame = true; Haptics.light() } label: {
                    Label("커피 내기 게임 시작", systemImage: "gamecontroller.fill")
                        .font(.headline).frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x3)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.heart)
            } else if joined {
                Text("주최자가 게임을 시작하면 여기에서 같이 볼 수 있어요.")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else if g.kind == .coffee, g.coffeePick.isEmpty, store.status(g) == .open {
            Text("신청 마감 뒤에 커피 내기를 돌립니다 — 그때까지 참여자를 받아요.")
                .font(.caption).foregroundStyle(Theme.Palette.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func header(_ g: Gathering) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(g.title).font(.title3.bold()).foregroundStyle(Theme.Palette.ink)
                Text("\(g.host) · \(g.kind.rawValue)").font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
            let s = store.status(g)
            StatusBadge(text: s.rawValue, tint: s.tint, ink: s.ink)
        }
    }

    private func infoCard(_ g: Gathering) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            if let cap = g.capacity {
                row("정원", "\(store.confirmedCount(g))/\(cap)명")
                if let left = store.spotsLeft(g) { row("남은 자리", left > 0 ? "\(left)자리" : "정원 마감") }
            } else {
                row("정원", "제한 없음 · \(store.confirmedCount(g))명 신청")
            }
            if !g.place.isEmpty { row("장소", g.place) }
            if store.status(g) == .open || store.status(g) == .closed {
                row("시작", store.timeUntil(g))
            }
            if let seat = store.mySeat(g, name: myName) { row("내 신청", seat) }
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    private func coffeeResult(_ g: Gathering) -> some View {
        HStack(spacing: Theme.Space.x2) {
            Image(systemName: "cup.and.saucer.fill").foregroundStyle(Theme.Palette.danger)
            Text("오늘 커피 담당은 \(g.coffeePick)님! ☕").font(.subheadline.bold())
                .foregroundStyle(Theme.Palette.ink)
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintDanger, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }

    private func rosterCard(_ g: Gathering) -> some View {
        let r = store.roster(g)
        return VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text("확정 \(r.confirmed.count)명").font(.subheadline.bold()).foregroundStyle(Theme.Palette.tintSuccessInk)
            if r.confirmed.isEmpty {
                Text("아직 신청자가 없어요.").font(.caption).foregroundStyle(Theme.Palette.muted)
            } else {
                WrapNames(names: r.confirmed.map(\.name), tint: Theme.Palette.tintSuccess, ink: Theme.Palette.tintSuccessInk)
            }
            if !r.waiting.isEmpty {
                Text("대기 \(r.waiting.count)명").font(.subheadline.bold()).foregroundStyle(Theme.Palette.muted)
                    .padding(.top, Theme.Space.x1)
                WrapNames(names: r.waiting.map(\.name), tint: Theme.Palette.tintNeutral, ink: Theme.Palette.muted)
            }
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    @ViewBuilder
    private func actionArea(_ g: Gathering) -> some View {
        let isHost = g.host == myName
        let joined = store.mySeat(g, name: myName) != nil
        VStack(spacing: Theme.Space.x2) {
            // 주최자: 모임 취소 (커피 담당 뽑기는 위 coffeeGameArea 의 게임으로 옮겼다)
            if isHost {
                if store.status(g) == .open || store.status(g) == .closed {
                    Button(role: .destructive) { store.cancel(g.id, host: myName); Haptics.success(); dismiss() } label: {
                        Label("모임 취소", systemImage: "xmark.circle").font(.subheadline)
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.bordered).tint(Theme.Palette.danger)
                }
            }
            // 참여자: 신청/취소
            if joined {
                Button(role: .destructive) { store.leave(g, name: myName); Haptics.selection() } label: {
                    Label("신청 취소", systemImage: "person.badge.minus").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.bordered).tint(Theme.Palette.muted)
            } else if !isHost {
                let waitlist = store.canJoinWaitlist(g)
                if store.status(g) == .open || waitlist {
                    Button { store.join(g, name: myName); Haptics.success() } label: {
                        Label(waitlist ? "대기 신청" : "신청하기", systemImage: "person.badge.plus").font(.headline)
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                    if waitlist {
                        Text("정원이 찼지만 대기로 신청할 수 있어요. 앞사람이 취소하면 자동 승계돼요.")
                            .font(.caption).foregroundStyle(Theme.Palette.muted)
                    }
                } else {
                    Label(store.status(g).rawValue + "된 모임이에요.", systemImage: "info.circle")
                        .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                        .background(Theme.Palette.tintNeutral, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                }
            }
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundStyle(Theme.Palette.muted)
            Spacer()
            Text(value).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
        }
    }
}

/// 이름들을 칩으로 줄바꿈 배치.
private struct WrapNames: View {
    let names: [String]
    let tint: Color
    let ink: Color
    var body: some View {
        FlowLayout(spacing: Theme.Space.x2) {
            ForEach(names, id: \.self) { name in
                Text(name).font(.caption.weight(.semibold)).foregroundStyle(ink)
                    .padding(.horizontal, Theme.Space.x2).padding(.vertical, 4)
                    .background(tint, in: Capsule())
            }
        }
    }
}

/// 간단한 흐름 레이아웃 — 칩이 줄을 넘치면 다음 줄로.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX { x = bounds.minX; y += rowHeight + spacing; rowHeight = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// 가로 스크롤 필터 칩 줄 — 여러 화면에서 재사용.
struct ChipRow: View {
    let items: [String]
    @Binding var selection: String
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.x2) {
                ForEach(items, id: \.self) { item in
                    let active = item == selection
                    Button { selection = item } label: {
                        Text(item)
                            .font(.subheadline.weight(active ? .bold : .regular))
                            .foregroundStyle(active ? Theme.Palette.cta : Theme.Palette.muted)
                            .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.x2)
                            .background(active ? Theme.Palette.tintPrimary : Theme.Palette.surface, in: Capsule())
                            .overlay(Capsule().stroke(Theme.Palette.border))
                    }
                }
            }
        }
    }
}

/// 그리드 타일 탭 시 뜨는 공용 상세 시트(제목·본문·액션 버튼).
struct DetailSheet: View {
    let title: String
    let heading: String
    let lines: [String]
    let action: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                Text(heading).font(.title2.bold()).foregroundStyle(Theme.Palette.ink)
                ForEach(lines, id: \.self) { Text($0).font(.subheadline).foregroundStyle(Theme.Palette.muted) }
                Button { Haptics.success(); dismiss() } label: {
                    Text(action).font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                Spacer()
            }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.sunken)
            .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }
}
