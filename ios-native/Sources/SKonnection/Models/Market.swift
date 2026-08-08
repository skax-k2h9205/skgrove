import SwiftUI

// 이음장터 모델(웹 marketRules.ts 이식). 상태는 저장하지 않고 입찰 목록에서 파생한다.
// 나눔=선착순(0원 입찰 1건), 경매=최고가. 정렬 기준만 다르고 마감·취소 규칙은 한 벌.

enum MarketKind: String, Codable, CaseIterable {
    case giveaway = "나눔", auction = "경매"
    static func fromDB(_ s: String) -> MarketKind { s == "auction" ? .auction : .giveaway }
    var dbValue: String { self == .auction ? "auction" : "giveaway" }
}

enum MarketStatus: String {
    case open = "거래중", done = "거래완료", failed = "유찰", canceled = "취소"
    var tint: Color {
        switch self {
        case .open: return Theme.Palette.tintPrimary
        case .done: return Theme.Palette.tintSuccess
        case .failed, .canceled: return Theme.Palette.tintNeutral
        }
    }
    var ink: Color {
        switch self {
        case .open: return Theme.Palette.tintPrimaryInk
        case .done: return Theme.Palette.tintSuccessInk
        case .failed, .canceled: return Theme.Palette.muted
        }
    }
}

struct MarketItem: Identifiable, Codable {
    let id: String
    var title: String
    var seller: String
    var kind: MarketKind
    var startPrice: Int          // 나눔이면 0
    var minStep: Int = 1000
    var closeAt: String          // ISO "yyyy-MM-dd'T'HH:mm" — 사전식 비교로 마감 판정
    var desc: String = ""
    var place: String = ""
    var canceled: Bool = false
    var imageURL: String = ""     // 업로드된 사진(Supabase Storage URL). 없으면 아이콘 타일.
}

struct MarketBid: Identifiable, Codable {
    let id: String
    let itemId: String
    var name: String
    var amount: Int
    var createdAt: String        // ISO
}

/// 장터 날짜 유틸 — 액터 격리 밖(기본 인자에서 호출 가능)에 둔다.
enum MarketClock {
    static let iso: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        f.locale = Locale(identifier: "en_US_POSIX"); return f
    }()
    static func nowString() -> String { iso.string(from: Date()) }
    static func isoString(_ date: Date) -> String { iso.string(from: date) }
}

@MainActor
final class MarketStore: ObservableObject {
    private static let itemsKey = "skonnection.marketItems"
    private static let bidsKey = "skonnection.marketBids"

    @Published var items: [MarketItem] { didSet { Persist.save(items, Self.itemsKey) } }
    @Published var bids: [MarketBid] { didSet { Persist.save(bids, Self.bidsKey) } }

    init() {
        items = Persist.load(Self.itemsKey, as: [MarketItem].self) ?? Self.seedItems
        bids = Persist.load(Self.bidsKey, as: [MarketBid].self) ?? Self.seedBids
        Task { await syncFromRemote() }
    }

    /// 웹과 같은 Supabase 에서 물건·입찰을 불러온다(실패 시 로컬 캐시 유지).
    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        async let i = try? Supabase.select("market_items", query: "select=*&order=created_at.desc", as: SupabaseMarketItemRow.self)
        async let b = try? Supabase.select("market_bids", query: "select=*", as: SupabaseBidRow.self)
        if let rows = await i { items = rows.map { $0.toItem() } }
        if let rows = await b { bids = rows.map { $0.toBid() } }
    }

    // MARK: 파생(웹 marketRules 이식)

    private func bidsFor(_ itemId: String) -> [MarketBid] {
        bids.filter { $0.itemId == itemId }
            .sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
    }

    /// 이 물건을 가져갈 사람. 경매는 최고가(동액이면 먼저 부른 사람), 나눔은 선착순.
    func leadingBid(_ item: MarketItem) -> MarketBid? {
        let ordered = bidsFor(item.id)
        guard let first = ordered.first else { return nil }
        if item.kind == .giveaway { return first }
        return ordered.reduce(first) { $1.amount > $0.amount ? $1 : $0 }
    }

    func currentPrice(_ item: MarketItem) -> Int {
        if item.kind == .giveaway { return 0 }
        return leadingBid(item)?.amount ?? item.startPrice
    }

    /// 다음에 부를 수 있는 최소 금액. 첫 입찰은 시작가부터.
    func minNextBid(_ item: MarketItem) -> Int {
        if item.kind == .giveaway { return 0 }
        if let top = leadingBid(item) { return top.amount + item.minStep }
        return item.startPrice
    }

    func bidCount(_ item: MarketItem) -> Int { bidsFor(item.id).count }

    /// 상태 파생. 취소만 플래그, 나머지는 시각·입찰로 계산.
    func status(_ item: MarketItem, now: String = MarketClock.nowString()) -> MarketStatus {
        if item.canceled { return .canceled }
        if item.kind == .giveaway && leadingBid(item) != nil { return .done }
        if now < item.closeAt { return .open }
        return leadingBid(item) != nil ? .done : .failed
    }

    /// 입찰/받기를 막는 이유(없으면 nil). 버튼을 흐리게만 두면 고장으로 읽힌다.
    func blockedReason(_ item: MarketItem, name: String) -> String? {
        let s = status(item)
        if s == .canceled { return "판매자가 거래를 취소했어요." }
        if item.seller == name { return "내가 올린 물건이에요." }
        if item.kind == .giveaway {
            if bidsFor(item.id).contains(where: { $0.name == name }) { return "이미 받으셨어요." }
            if leadingBid(item) != nil { return "이미 다른 분이 가져갔어요." }
        }
        if s != .open { return "마감된 거래예요." }
        return nil
    }

    /// 낙찰자(거래완료일 때만).
    func winner(_ item: MarketItem) -> MarketBid? {
        status(item) == .done ? leadingBid(item) : nil
    }

    /// 마감까지 남은 시간 사람말.
    func timeLeft(_ item: MarketItem) -> String {
        guard let close = MarketClock.iso.date(from: item.closeAt) else { return "" }
        let diff = close.timeIntervalSince(Date())
        if diff <= 0 { return "마감됨" }
        let minutes = Int((diff / 60).rounded())
        if minutes < 60 { return "\(minutes)분 남음" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)시간 남음" }
        return "\(hours / 24)일 남음"
    }

    /// 거래중이 위, 곧 마감 순. 끝난 것은 아래로.
    var sorted: [MarketItem] {
        items.sorted { a, b in
            let aOpen = status(a) == .open, bOpen = status(b) == .open
            if aOpen != bOpen { return aOpen }
            return aOpen ? a.closeAt < b.closeAt : a.closeAt > b.closeAt
        }
    }

    // MARK: 액션

    func placeBid(_ item: MarketItem, name: String, amount: Int) {
        guard blockedReason(item, name: name) == nil else { return }
        guard amount >= minNextBid(item) else { return }
        let id = "BID-\(Int(Date().timeIntervalSince1970))-\(name)"
        let at = MarketClock.nowString()
        bids.append(MarketBid(id: id, itemId: item.id, name: name, amount: amount, createdAt: at))
        Task { try? await Supabase.insert("market_bids",
            SupabaseBidInsert(id: id, item_id: item.id, name: name, amount: amount, created_at: at)) }
    }

    /// 나눔 받기 = 0원 입찰 한 건.
    func claim(_ item: MarketItem, name: String) {
        placeBid(item, name: name, amount: 0)
    }

    func cancel(_ itemId: String, seller: String) {
        guard let i = items.firstIndex(where: { $0.id == itemId }), items[i].seller == seller else { return }
        items[i].canceled = true
        Task { try? await Supabase.patch("market_items", id: itemId, ["canceled": true]) }
    }

    func list(kind: MarketKind, title: String, seller: String, startPrice: Int, minStep: Int,
              closeAt: String, desc: String, place: String) {
        let id = "MKT-\(Int(Date().timeIntervalSince1970))"
        let price = kind == .auction ? startPrice : 0
        let step = kind == .auction ? max(1, minStep) : 0
        items.insert(MarketItem(id: id, title: title, seller: seller, kind: kind,
                                startPrice: price, minStep: step, closeAt: closeAt, desc: desc, place: place), at: 0)
        Task { try? await Supabase.insert("market_items",
            SupabaseMarketInsert(id: id, kind: kind.dbValue, title: title, description: desc,
                                 start_price: price, min_step: step, close_at: closeAt,
                                 place: place, seller: seller)) }
    }

    // MARK: 시드 — 미래/과거 마감으로 거래중·거래완료·유찰을 보여준다.

    private static var future: String { MarketClock.iso.string(from: Date().addingTimeInterval(3 * 24 * 3600)) }
    private static var soon: String { MarketClock.iso.string(from: Date().addingTimeInterval(6 * 3600)) }
    private static var past: String { MarketClock.iso.string(from: Date().addingTimeInterval(-24 * 3600)) }

    private static let seedItems: [MarketItem] = [
        .init(id: "M4", title: "안 쓰는 기계식 키보드 나눔", seller: "김영석", kind: .giveaway,
              startPrice: 0, closeAt: future, desc: "적축입니다. 필요하신 분 받아가세요.", place: "12층 탕비실"),
        .init(id: "M3", title: "여분 모니터 받침대 경매", seller: "이두민", kind: .auction,
              startPrice: 5000, minStep: 1000, closeAt: soon, desc: "원목 받침대. 상태 좋아요.", place: "10층"),
        .init(id: "M2", title: "커피머신 경매", seller: "김수정", kind: .auction,
              startPrice: 20000, minStep: 2000, closeAt: past, desc: "캡슐머신. 잘 됩니다."),
        .init(id: "M1", title: "책상 정리대 나눔", seller: "이선민", kind: .giveaway,
              startPrice: 0, closeAt: future, desc: "안 써서 나눔해요."),
    ]
    private static let seedBids: [MarketBid] = [
        // 모니터 받침대에 두 건 입찰(진행 중 경매).
        .init(id: "BID-1", itemId: "M3", name: "김승현", amount: 5000, createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-7200))),
        .init(id: "BID-2", itemId: "M3", name: "이선민", amount: 6000, createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-3600))),
        // 커피머신은 마감됐고 낙찰자 있음 → 거래완료.
        .init(id: "BID-3", itemId: "M2", name: "김승현", amount: 22000, createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-90000))),
    ]
}

/// Supabase market_items / market_bids 행 → iOS 매핑 + insert 페이로드.
struct SupabaseMarketItemRow: Decodable {
    let id: String
    let kind: String?
    let title: String?
    let description: String?
    let start_price: Int?
    let min_step: Int?
    let close_at: String?
    let place: String?
    let seller: String?
    let canceled: Bool?
    let image_url: String?
    func toItem() -> MarketItem {
        MarketItem(id: id, title: title ?? "", seller: seller ?? "", kind: MarketKind.fromDB(kind ?? "giveaway"),
                   startPrice: start_price ?? 0, minStep: min_step ?? 1000, closeAt: close_at ?? "",
                   desc: description ?? "", place: place ?? "", canceled: canceled ?? false,
                   imageURL: image_url ?? "")
    }
}
struct SupabaseBidRow: Decodable {
    let id: String
    let item_id: String
    let name: String?
    let amount: Int?
    let created_at: String?
    func toBid() -> MarketBid {
        MarketBid(id: id, itemId: item_id, name: name ?? "", amount: amount ?? 0, createdAt: created_at ?? "")
    }
}
struct SupabaseBidInsert: Encodable {
    let id: String; let item_id: String; let name: String; let amount: Int; let created_at: String
}
struct SupabaseMarketInsert: Encodable {
    let id: String; let kind: String; let title: String; let description: String
    let start_price: Int; let min_step: Int; let close_at: String; let place: String; let seller: String
}
