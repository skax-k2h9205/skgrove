import SwiftUI

// 모임 · 번개 모델(웹 gatheringRules.ts 이식). 확정/대기를 저장하지 않고 신청 순서로 파생한다.
// 앞사람이 취소하면 다음 렌더에서 대기자가 저절로 승계된다(선착순 신뢰).

enum GatheringKind: String, Codable, CaseIterable {
    case flash = "번개", gathering = "모임", coffee = "커피"
    // DB(웹)는 영어로 저장 — 경계에서 매핑.
    static func fromDB(_ s: String) -> GatheringKind {
        switch s { case "flash": return .flash; case "coffee": return .coffee; default: return .gathering }
    }
    var dbValue: String {
        switch self { case .flash: return "flash"; case .coffee: return "coffee"; case .gathering: return "gathering" }
    }
}

enum GatheringStatus: String {
    case open = "모집중", closed = "마감", held = "진행함", ended = "종료", canceled = "취소"
    var tint: Color {
        switch self {
        case .open: return Theme.Palette.tintPrimary
        case .closed: return Theme.Palette.tintNeutral
        case .held: return Theme.Palette.tintSuccess
        case .ended, .canceled: return Theme.Palette.tintNeutral
        }
    }
    var ink: Color {
        switch self {
        case .open: return Theme.Palette.tintPrimaryInk
        case .held: return Theme.Palette.tintSuccessInk
        default: return Theme.Palette.muted
        }
    }
}

struct Gathering: Identifiable, Codable {
    let id: String
    var title: String
    var host: String
    var kind: GatheringKind
    var startAt: String       // ISO — 모임 시작
    var closeAt: String       // ISO — 신청 마감
    var capacity: Int?        // nil = 무제한
    var minPeople: Int?
    var place: String = ""
    var desc: String = ""
    var coffeeDraw: Bool = false   // 번개에서 커피뽑기 켰는지
    var coffeePick: String = ""    // 뽑힌 사람
    var canceled: Bool = false
    var imageURL: String = ""      // 업로드된 사진(Supabase Storage URL). 없으면 아이콘 타일.
}

struct GatheringSignup: Identifiable, Codable {
    let id: String
    let gatheringId: String
    var name: String
    var createdAt: String     // ISO
}

@MainActor
final class GatheringStore: ObservableObject {
    private static let gKey = "skonnection.gatherings.v2"
    private static let sKey = "skonnection.gatheringSignups.v2"

    @Published var gatherings: [Gathering] { didSet { Persist.save(gatherings, Self.gKey) } }
    @Published var signups: [GatheringSignup] { didSet { Persist.save(signups, Self.sKey) } }

    init() {
        gatherings = Persist.load(Self.gKey, as: [Gathering].self) ?? Self.seedGatherings
        signups = Persist.load(Self.sKey, as: [GatheringSignup].self) ?? Self.seedSignups
        Task { await syncFromRemote() }
    }

    /// 웹과 같은 Supabase 에서 모임·신청을 불러온다(실패 시 로컬 캐시 유지).
    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        async let g = try? Supabase.select("gatherings", query: "select=*&order=start_at.asc", as: SupabaseGatheringRow.self)
        async let s = try? Supabase.select("gathering_signups", query: "select=*", as: SupabaseSignupRow.self)
        if let rows = await g { gatherings = rows.map { $0.toGathering() } }
        if let rows = await s { signups = rows.map { $0.toSignup() } }
    }

    // MARK: 파생(웹 gatheringRules 이식)

    private func signupsFor(_ id: String) -> [GatheringSignup] {
        signups.filter { $0.gatheringId == id }
            .sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
    }

    /// 확정/대기 두 줄. capacity 가 nil 이면 전원 확정.
    func roster(_ g: Gathering) -> (confirmed: [GatheringSignup], waiting: [GatheringSignup]) {
        let ordered = signupsFor(g.id)
        guard let cap = g.capacity else { return (ordered, []) }
        return (Array(ordered.prefix(cap)), Array(ordered.dropFirst(cap)))
    }

    func confirmedCount(_ g: Gathering) -> Int { roster(g).confirmed.count }

    /// 남은 자리. 무제한이면 nil.
    func spotsLeft(_ g: Gathering) -> Int? {
        guard let cap = g.capacity else { return nil }
        return max(0, cap - confirmedCount(g))
    }
    func isFull(_ g: Gathering) -> Bool { spotsLeft(g) == 0 }

    func status(_ g: Gathering, now: String = MarketClock.nowString()) -> GatheringStatus {
        if g.canceled { return .canceled }
        if now >= g.startAt {
            let enough = g.minPeople == nil || confirmedCount(g) >= (g.minPeople ?? 0)
            return enough ? .held : .ended
        }
        if now >= g.closeAt { return .closed }
        if isFull(g) { return .closed }
        return .open
    }

    /// 신청했다면 확정/대기 몇 번째인지. 안 했으면 nil.
    func mySeat(_ g: Gathering, name: String) -> String? {
        let r = roster(g)
        if r.confirmed.contains(where: { $0.name == name }) { return "확정" }
        if let i = r.waiting.firstIndex(where: { $0.name == name }) { return "대기 \(i + 1)번" }
        return nil
    }

    func belowMinimum(_ g: Gathering) -> Bool {
        guard let m = g.minPeople else { return false }
        return confirmedCount(g) < m
    }

    /// 정원이 찼어도 마감 시각 전이면 대기 신청은 받는다.
    func canJoinWaitlist(_ g: Gathering, now: String = MarketClock.nowString()) -> Bool {
        status(g) == .closed && now < g.closeAt && !g.canceled
    }

    /// 커피뽑기 후보 = 확정 로스터(대기자 제외).
    func coffeeCandidates(_ g: Gathering) -> [GatheringSignup] { roster(g).confirmed }

    /// 커피 담당을 뽑을 수 있는가 — '커피' 종류 모임 전용·취소 아님·미추첨·확정 2명 이상.
    /// (점심 번개 같은 일반 모임에는 커피뽑기가 뜨지 않는다 — 커피 담당을 정하는 자리에서만.)
    func canDrawCoffee(_ g: Gathering) -> Bool {
        g.kind == .coffee && !g.canceled && g.coffeePick.isEmpty && coffeeCandidates(g).count >= 2
    }

    // MARK: 액션

    func join(_ g: Gathering, name: String) {
        guard !g.canceled else { return }
        guard status(g) == .open || canJoinWaitlist(g) else { return }
        guard !signupsFor(g.id).contains(where: { $0.name == name }) else { return }
        let id = "SGN-\(Int(Date().timeIntervalSince1970))-\(name)"
        let at = MarketClock.nowString()
        signups.append(GatheringSignup(id: id, gatheringId: g.id, name: name, createdAt: at))
        Task { try? await Supabase.insert("gathering_signups",
            ["id": id, "gathering_id": g.id, "name": name, "created_at": at]) }
    }

    func leave(_ g: Gathering, name: String) {
        signups.removeAll { $0.gatheringId == g.id && $0.name == name }
        Task { try? await Supabase.delete("gathering_signups", query: "gathering_id=eq.\(g.id)&name=eq.\(name)") }
    }

    func cancel(_ id: String, host: String) {
        guard let i = gatherings.firstIndex(where: { $0.id == id }), gatherings[i].host == host else { return }
        gatherings[i].canceled = true
        Task { try? await Supabase.patch("gatherings", id: id, ["canceled": true]) }
    }

    /// 확정 로스터에서 커피 담당 한 명을 뽑는다.
    func drawCoffee(_ g: Gathering) {
        guard canDrawCoffee(g), let i = gatherings.firstIndex(where: { $0.id == g.id }) else { return }
        let pool = coffeeCandidates(g)
        guard let pick = pool.randomElement() else { return }
        gatherings[i].coffeePick = pick.name
        Task { try? await Supabase.patch("gatherings", id: g.id, ["coffee_pick": pick.name]) }
    }

    func create(kind: GatheringKind, title: String, host: String, startAt: String, closeAt: String,
                capacity: Int?, place: String, desc: String, coffeeDraw: Bool) {
        let id = "GAT-\(Int(Date().timeIntervalSince1970))"
        gatherings.insert(Gathering(id: id, title: title, host: host, kind: kind,
                                    startAt: startAt, closeAt: closeAt, capacity: capacity, minPeople: nil,
                                    place: place, desc: desc, coffeeDraw: coffeeDraw), at: 0)
        Task { try? await Supabase.insert("gatherings",
            SupabaseGatheringInsert(id: id, kind: kind.dbValue, title: title, start_at: startAt,
                                    close_at: closeAt, capacity: capacity, place: place, description: desc,
                                    host: host, coffee_draw: coffeeDraw)) }
    }

    /// 시작까지 남은 시간 사람말.
    func timeUntil(_ g: Gathering) -> String {
        guard let start = MarketClock.iso.date(from: g.startAt) else { return "" }
        let diff = start.timeIntervalSince(Date())
        if diff <= 0 { return "지났어요" }
        let minutes = Int((diff / 60).rounded())
        if minutes < 60 { return "\(minutes)분 뒤" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)시간 뒤" }
        return "\(hours / 24)일 뒤"
    }

    // MARK: 시드

    private static var soon: String { MarketClock.iso.string(from: Date().addingTimeInterval(4 * 3600)) }
    private static var soonClose: String { MarketClock.iso.string(from: Date().addingTimeInterval(3 * 3600)) }
    private static var later: String { MarketClock.iso.string(from: Date().addingTimeInterval(2 * 24 * 3600)) }
    private static var laterClose: String { MarketClock.iso.string(from: Date().addingTimeInterval(1 * 24 * 3600)) }

    private static let seedGatherings: [Gathering] = [
        .init(id: "GAT-5", title: "오후 커피 내기 ☕", host: "김승현", kind: .coffee,
              startAt: soon, closeAt: soonClose, capacity: 8, minPeople: 2, place: "탕비실",
              coffeeDraw: true),
        .init(id: "GAT-4", title: "오늘 점심 김치찌개 번개 🍲", host: "김승현", kind: .flash,
              startAt: soon, closeAt: soonClose, capacity: 6, minPeople: 2, place: "1층 로비"),
        .init(id: "GAT-3", title: "퇴근 후 클라이밍 번개 🧗", host: "김수정", kind: .flash,
              startAt: soon, closeAt: soonClose, capacity: 4, minPeople: 2, place: "강남 클라이밍짐"),
        .init(id: "GAT-2", title: "금요일 보드게임 모임", host: "이두민", kind: .gathering,
              startAt: later, closeAt: laterClose, capacity: 8, minPeople: 3, place: "회의실 A"),
        .init(id: "GAT-1", title: "주말 등산 모임", host: "이선민", kind: .gathering,
              startAt: later, closeAt: laterClose, capacity: nil, minPeople: nil, place: "북한산"),
    ]
    private static let seedSignups: [GatheringSignup] = [
        // 커피 내기는 3명 확정(뽑기 가능). 클라이밍은 정원 4에 4명 → 마감. 김치찌개는 3명 확정(정원 6).
        .init(id: "SGN-8", gatheringId: "GAT-5", name: "김승현", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-6000))),
        .init(id: "SGN-9", gatheringId: "GAT-5", name: "이두민", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-5000))),
        .init(id: "SGN-10", gatheringId: "GAT-5", name: "김수정", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-4000))),
        .init(id: "SGN-1", gatheringId: "GAT-4", name: "김승현", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-6000))),
        .init(id: "SGN-2", gatheringId: "GAT-4", name: "이두민", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-5000))),
        .init(id: "SGN-3", gatheringId: "GAT-4", name: "이선민", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-4000))),
        .init(id: "SGN-4", gatheringId: "GAT-3", name: "김수정", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-6000))),
        .init(id: "SGN-5", gatheringId: "GAT-3", name: "이두민", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-5500))),
        .init(id: "SGN-6", gatheringId: "GAT-3", name: "이선민", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-5000))),
        .init(id: "SGN-7", gatheringId: "GAT-3", name: "김영석", createdAt: MarketClock.iso.string(from: Date().addingTimeInterval(-4500))),
    ]
}

/// Supabase gatherings / gathering_signups 행 → iOS 매핑.
struct SupabaseGatheringRow: Decodable {
    let id: String
    let kind: String?
    let title: String?
    let start_at: String?
    let close_at: String?
    let capacity: Int?
    let min_people: Int?
    let description: String?
    let place: String?
    let host: String?
    let canceled: Bool?
    let coffee_draw: Bool?
    let coffee_pick: String?
    let image_url: String?
    func toGathering() -> Gathering {
        Gathering(id: id, title: title ?? "", host: host ?? "", kind: GatheringKind.fromDB(kind ?? "gathering"),
                  startAt: start_at ?? "", closeAt: close_at ?? (start_at ?? ""), capacity: capacity,
                  minPeople: min_people, place: place ?? "", desc: description ?? "",
                  coffeeDraw: coffee_draw ?? false, coffeePick: coffee_pick ?? "", canceled: canceled ?? false,
                  imageURL: image_url ?? "")
    }
}
struct SupabaseSignupRow: Decodable {
    let id: String
    let gathering_id: String
    let name: String?
    let created_at: String?
    func toSignup() -> GatheringSignup {
        GatheringSignup(id: id, gatheringId: gathering_id, name: name ?? "", createdAt: created_at ?? "")
    }
}
struct SupabaseGatheringInsert: Encodable {
    let id: String; let kind: String; let title: String; let start_at: String; let close_at: String
    let capacity: Int?; let place: String; let description: String; let host: String; let coffee_draw: Bool
}
