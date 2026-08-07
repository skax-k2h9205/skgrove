import SwiftUI

/// 이음장터 — 인스타 3열 그리드. 타일 탭 시 상세 시트에서 입찰(경매)·받기(나눔). 웹 marketRules 이식.
struct MarketView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var store: MarketStore
    @State private var filter = "거래중"
    @State private var composing = false
    private let filters = ["거래중", "나눔", "내가 올린 것", "전체"]
    @State private var selected: MarketItem?

    private var myName: String { session.currentUser?.name ?? "나" }

    private var visible: [MarketItem] {
        store.sorted.filter { item in
            switch filter {
            case "거래중": return store.status(item) == .open
            case "나눔": return item.kind == .giveaway
            case "내가 올린 것": return item.seller == myName
            default: return true
            }
        }
    }

    var body: some View {
        ScreenScaffold(title: "이음장터", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            HStack(spacing: Theme.Space.x2) {
                Image(systemName: "trophy.fill").foregroundStyle(Theme.Palette.primary)
                Text("이음장터 명예의 전당 — 첫 거래의 주인공이 되어보세요.")
                    .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
            }
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))

            ChipRow(items: filters, selection: $filter)
            Button { composing = true } label: {
                Label("물건 내놓기", systemImage: "plus").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)

            if visible.isEmpty {
                EmptyState(icon: "shippingbox", title: "해당 물건이 없어요",
                           message: "다른 필터를 골라보거나 물건을 내놓아 보세요.")
            } else {
                InstaGrid(items: visible) { item in
                    Button { Haptics.selection(); selected = item } label: {
                        GridTile(icon: item.kind == .giveaway ? "gift.fill" : "hammer.fill",
                                 title: item.title, meta: metaFor(item),
                                 tint: store.status(item).tint, ink: store.status(item).ink)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .sheet(item: $selected) { item in
            MarketDetailSheet(itemId: item.id)
        }
        .sheet(isPresented: $composing) {
            MarketComposeSheet { kind, title, desc, place, startPrice, closeAt in
                store.list(kind: kind == "경매" ? .auction : .giveaway, title: title, seller: myName,
                           startPrice: startPrice, closeAt: MarketClock.isoString(closeAt),
                           desc: desc, place: place)
                Haptics.success()
            }
        }
    }

    /// 타일 하단 메타 — 거래중이면 현재가/남은시간, 끝났으면 상태.
    private func metaFor(_ item: MarketItem) -> String {
        let status = store.status(item)
        if item.kind == .giveaway {
            return status == .open ? store.timeLeft(item) : status.rawValue
        }
        if status == .open {
            return "\(store.currentPrice(item).formatted())원 · \(store.timeLeft(item))"
        }
        return status.rawValue
    }
}

/// 장터 상세 — 현재가·남은시간·입찰 현황 + 입찰(경매)/받기(나눔). 막는 이유를 문장으로 알린다.
private struct MarketDetailSheet: View {
    let itemId: String
    @EnvironmentObject private var store: MarketStore
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var bidAmount: Int = 0

    private var myName: String { session.currentUser?.name ?? "나" }
    private var item: MarketItem? { store.items.first { $0.id == itemId } }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let item {
                    VStack(alignment: .leading, spacing: Theme.Space.x4) {
                        header(item)
                        if !item.desc.isEmpty {
                            Text(item.desc).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                        }
                        infoCard(item)
                        actionArea(item)
                    }
                    .padding(Theme.Space.x4)
                } else {
                    Text("물건을 찾을 수 없어요.").foregroundStyle(Theme.Palette.muted).padding()
                }
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("이음장터").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .onAppear { if let item { bidAmount = store.minNextBid(item) } }
    }

    private func header(_ item: MarketItem) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title).font(.title3.bold()).foregroundStyle(Theme.Palette.ink)
                Text("\(item.seller) · \(item.kind.rawValue)").font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
            let s = store.status(item)
            StatusBadge(text: s.rawValue, tint: s.tint, ink: s.ink)
        }
    }

    private func infoCard(_ item: MarketItem) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            if item.kind == .auction {
                row("현재가", "\(store.currentPrice(item).formatted())원")
                row("입찰", "\(store.bidCount(item))건")
                if let lead = store.leadingBid(item) {
                    row("최고 입찰자", lead.name)
                }
            } else {
                row("가격", "무료 나눔")
            }
            if !item.place.isEmpty { row("거래 장소", item.place) }
            if store.status(item) == .open {
                row("마감", store.timeLeft(item))
            }
            if let win = store.winner(item) {
                row("낙찰", item.kind == .auction ? "\(win.name) · \(win.amount.formatted())원" : win.name)
            }
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    @ViewBuilder
    private func actionArea(_ item: MarketItem) -> some View {
        if let reason = store.blockedReason(item, name: myName) {
            // 판매자 본인이고 거래중이면 취소 버튼을 준다.
            if item.seller == myName && store.status(item) == .open {
                Button(role: .destructive) { store.cancel(item.id, seller: myName); Haptics.success(); dismiss() } label: {
                    Label("거래 취소", systemImage: "xmark.circle").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.bordered).tint(Theme.Palette.danger)
            } else {
                Label(reason, systemImage: "info.circle")
                    .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    .background(Theme.Palette.tintNeutral, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            }
        } else if item.kind == .giveaway {
            Button { store.claim(item, name: myName); Haptics.success(); dismiss() } label: {
                Label("받기", systemImage: "gift.fill").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
        } else {
            // 경매 입찰 — 최소가에서 minStep 단위로 올려 부른다(시뮬 한글입력 이슈 회피 겸 UX).
            VStack(spacing: Theme.Space.x2) {
                Stepper(value: $bidAmount, in: store.minNextBid(item)...(store.minNextBid(item) + item.minStep * 20),
                        step: item.minStep) {
                    HStack {
                        Text("입찰가").font(.subheadline).foregroundStyle(Theme.Palette.muted)
                        Spacer()
                        Text("\(bidAmount.formatted())원").font(.headline).foregroundStyle(Theme.Palette.ink)
                    }
                }
                Text("최소 입찰가 \(store.minNextBid(item).formatted())원")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button { store.placeBid(item, name: myName, amount: bidAmount); Haptics.success(); dismiss() } label: {
                    Label("\(bidAmount.formatted())원 입찰", systemImage: "hammer.fill").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                .disabled(bidAmount < store.minNextBid(item))
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
