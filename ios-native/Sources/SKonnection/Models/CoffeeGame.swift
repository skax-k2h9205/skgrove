import Foundation

// 커피 내기 게임(커피룰렛 · 손가락룰렛) 공유 상태.
//
// 화면을 스트리밍하지 않는다. 주최자가 **seed 와 시작 시각**만 올리고, 각 기기가
// 같은 seed 로 똑같은 애니메이션을 스스로 그린다. 그래서
//   - 실시간 중계(모두 같은 걸 같은 순간에 본다)와
//   - 다시보기(나중에 같은 seed 로 재생)
// 가 같은 데이터 하나로 해결된다. 프레임 전송도, 영상 업로드도 없다.
//
// 저장은 신규 테이블 대신 기존 app_config(key, value jsonb)를 쓴다 —
// 프로덕 스키마를 건드리지 않기 위함. 키는 `coffee_game:<모임id>` 한 건.

/// 어떤 게임인지.
enum CoffeeGameKind: String, Codable, CaseIterable {
    case wheel = "커피룰렛"
    case finger = "손가락룰렛"

    var systemImage: String {
        switch self {
        case .wheel: return "arrow.triangle.2.circlepath"
        case .finger: return "hand.point.up.left.fill"
        }
    }
    var blurb: String {
        switch self {
        case .wheel: return "이름 칸으로 나뉜 원판을 돌립니다"
        case .finger: return "다 같이 한 폰에 손가락을 올립니다"
        }
    }
}

/// 게임 진행 단계. 관전자는 이 값으로 무엇을 보여줄지 정한다.
enum CoffeeGamePhase: String, Codable {
    case ready      // 주최자가 게임을 열었고 아직 안 돌림 — 관전자에겐 "곧 시작합니다"
    case spinning   // 돌아가는 중 — seed·startedAt 으로 각자 렌더
    case done       // 끝. winner 확정
}

struct CoffeeParticipant: Codable, Identifiable, Equatable {
    let name: String
    let photoURL: String
    var id: String { name }
}

struct CoffeeGame: Codable, Equatable {
    let gatheringId: String
    let kind: CoffeeGameKind
    var phase: CoffeeGamePhase
    /// 결정론적 재생용 난수 씨앗. spinning 이 되는 순간 정해진다.
    var seed: UInt64
    /// 돌릴 때 확정된 참가자(손가락룰렛은 그 순간 화면에 손이 올라온 사람만).
    var participants: [CoffeeParticipant]
    var winner: String
    /// spinning 시작 시각(epoch 밀리초). 늦게 들어온 관전자가 애니메이션 중간부터 맞춰 본다.
    ///
    /// MarketClock.iso 는 "yyyy-MM-dd'T'HH:mm" — **분 단위라 초가 없다.** 그걸 쓰면
    /// 기기마다 최대 60초까지 어긋나 동기화가 깨진다. 그래서 여기만 밀리초를 따로 쓴다.
    var startedAtMs: Int64
    var startedBy: String

    /// seed 로 정해지는 당첨자 인덱스. 모든 기기가 같은 답을 낸다.
    var winnerIndex: Int {
        guard !participants.isEmpty else { return 0 }
        var rng = SplitMix64(seed: seed)
        return Int(rng.next() % UInt64(participants.count))
    }
    var winnerName: String {
        participants.indices.contains(winnerIndex) ? participants[winnerIndex].name : ""
    }

    /// spinning 시작 후 흐른 시간(초). 관전자 화면 위치를 맞추는 기준.
    func elapsed(now: Date = Date()) -> Double {
        max(0, now.timeIntervalSince1970 - Double(startedAtMs) / 1000)
    }

    static func nowMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
}

/// 씨앗을 받는 작은 난수기(SplitMix64). Swift 기본 난수기는 씨앗을 못 넣어서
/// 기기마다 결과가 달라진다 — 결정론적 재생에는 쓸 수 없다.
struct SplitMix64: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}

// MARK: - 저장소

@MainActor
final class CoffeeGameStore: ObservableObject {
    /// 모임 id → 현재 게임. 상세 화면이 열려 있는 동안만 폴링한다(배터리).
    @Published private(set) var games: [String: CoffeeGame] = [:]

    /// 이름 → 프로필 사진 URL. accounts 에서 한 번만 당겨 캐시한다.
    /// (사진은 사내 telinfo 서버라 사외망에서는 안 열릴 수 있다 — 그때는 이니셜로 뜬다.)
    @Published private(set) var photos: [String: String] = [:]

    private var pollTask: Task<Void, Never>?

    static func key(_ gatheringId: String) -> String { "coffee_game:\(gatheringId)" }

    func game(for gatheringId: String) -> CoffeeGame? { games[gatheringId] }

    /// 이름 목록을 사진이 붙은 참가자로 만든다.
    func participants(names: [String]) -> [CoffeeParticipant] {
        names.map { CoffeeParticipant(name: $0, photoURL: photos[$0] ?? "") }
    }

    func loadPhotosIfNeeded() async {
        guard photos.isEmpty, Supabase.isConfigured else { return }
        guard let rows = try? await Supabase.select(
            "accounts", query: "select=name,photo_url", as: AccountPhotoRow.self) else { return }
        photos = Dictionary(rows.compactMap { row -> (String, String)? in
            guard let n = row.name, let p = row.photo_url, !p.isEmpty else { return nil }
            return (n, p)
        }, uniquingKeysWith: { a, _ in a })
    }

    // MARK: 폴링(관전)

    /// 상세 화면이 열려 있는 동안 2초마다 서버 상태를 당겨온다.
    func startPolling(_ gatheringId: String) {
        stopPolling()
        pollTask = Task { @MainActor in
            while !Task.isCancelled {
                await refresh(gatheringId)
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh(_ gatheringId: String) async {
        guard Supabase.isConfigured else { return }
        let k = Self.key(gatheringId)
        guard let rows = try? await Supabase.select(
            "app_config", query: "key=eq.\(k)&select=value", as: CoffeeGameRow.self),
              let game = rows.first?.value else { return }
        games[gatheringId] = game
    }

    // MARK: 쓰기(주최자)

    /// 게임 화면을 열었다 — 관전자에게 "곧 시작합니다"를 알린다.
    func open(gatheringId: String, kind: CoffeeGameKind, host: String,
              participants: [CoffeeParticipant]) async {
        let game = CoffeeGame(gatheringId: gatheringId, kind: kind, phase: .ready, seed: 0,
                              participants: participants, winner: "",
                              startedAtMs: CoffeeGame.nowMs(), startedBy: host)
        games[gatheringId] = game
        await push(game)
    }

    /// 돌리기 시작 — 이 순간 seed 와 참가자가 확정된다.
    @discardableResult
    func spin(gatheringId: String, participants: [CoffeeParticipant]) async -> CoffeeGame? {
        guard var game = games[gatheringId] else { return nil }
        game.phase = .spinning
        game.seed = UInt64.random(in: 1...UInt64.max)
        game.participants = participants
        game.startedAtMs = CoffeeGame.nowMs()
        games[gatheringId] = game
        await push(game)
        return game
    }

    /// 연출이 끝났다 — 당첨자를 확정해 남긴다.
    func finish(gatheringId: String) async -> String? {
        guard var game = games[gatheringId], game.phase == .spinning else { return nil }
        game.phase = .done
        game.winner = game.winnerName
        games[gatheringId] = game
        await push(game)
        return game.winner
    }

    /// 다시 돌리기 위해 판을 비운다(아직 커피 담당이 확정되지 않았을 때만).
    func clear(gatheringId: String) async {
        games[gatheringId] = nil
        guard Supabase.isConfigured else { return }
        try? await Supabase.delete("app_config", query: "key=eq.\(Self.key(gatheringId))")
    }

    private func push(_ game: CoffeeGame) async {
        guard Supabase.isConfigured else { return }
        try? await Supabase.upsert("app_config",
                                   CoffeeGameUpsert(key: Self.key(game.gatheringId), value: game),
                                   onConflict: "key")
    }
}

// app_config.value 는 jsonb — 기존 NotifyValue 와 같이 중첩 객체로 그대로 넣고 뺀다.
struct CoffeeGameRow: Decodable { let value: CoffeeGame }
struct CoffeeGameUpsert: Encodable { let key: String; let value: CoffeeGame }
struct AccountPhotoRow: Decodable { let name: String?; let photo_url: String? }
