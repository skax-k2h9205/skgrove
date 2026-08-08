import SwiftUI

/// 모임 · 번개 — 인스타 3열 그리드. 타일 탭 시 상세에서 신청/취소·대기·커피뽑기. 웹 gatheringRules 이식.
struct GatheringsView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var store: GatheringStore
    @State private var filter = "모집중"
    @State private var composing = false
    @State private var selected: Gathering?
    private let filters = ["모집중", "내가 신청", "내가 연 것", "전체"]

    private var myName: String { session.currentUser?.name ?? "나" }

    private var visible: [Gathering] {
        store.gatherings.filter { g in
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
                                 tint: store.status(g).tint, ink: store.status(g).ink)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .sheet(item: $selected) { g in GatheringDetailSheet(gatheringId: g.id) }
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
private struct GatheringDetailSheet: View {
    let gatheringId: String
    @EnvironmentObject private var store: GatheringStore
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    private var myName: String { session.currentUser?.name ?? "나" }
    private var g: Gathering? { store.gatherings.first { $0.id == gatheringId } }

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
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
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
            // 주최자: 커피뽑기 + 취소
            if isHost {
                if store.canDrawCoffee(g) {
                    Button { store.drawCoffee(g); Haptics.success() } label: {
                        Label("커피 담당 뽑기", systemImage: "cup.and.saucer.fill").font(.headline)
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.borderedProminent).tint(Theme.Palette.danger)
                }
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
