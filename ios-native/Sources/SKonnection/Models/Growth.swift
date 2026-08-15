import Foundation

// 커리어 관리(성장 카드) — 웹 growthStore/growthRules 이식. 같은 Supabase 3테이블 공유.

let growthCompetencies = ["문제정의·기획", "실행·개발", "협업·소통", "도메인 전문성", "AI 활용", "학습·성장"]

struct GrowthGoal: Identifiable, Codable, Equatable {
    let id: String
    var ownerEmail: String
    var title: String
    var detail: String
    var due: String          // 'YYYY-MM-DD' 또는 빈 문자열
    var progress: Int        // 0–100
    var status: String       // 진행중/완료/보류
    var leaderComment: String
    var createdAt: String
    var updatedAt: String
}

struct CompetencyLevel: Identifiable, Codable, Equatable {
    let id: String
    var ownerEmail: String
    var competency: String
    var selfLevel: Int        // 1–5
    var leaderLevel: Int?     // 리더 합의 전 nil
    var evidence: String
    var updatedAt: String
}

struct CompetencyLogEntry: Identifiable, Codable, Equatable {
    let id: String
    var ownerEmail: String
    var competency: String
    var level: Int
    var by: String            // self / leader
    var at: String
}

// 순수 규칙(웹 growthRules 이식).
enum GrowthRules {
    static func clampProgress(_ n: Int) -> Int { max(0, min(100, n)) }
    static func clampLevel(_ n: Int) -> Int { max(1, min(5, n)) }
    static func nextStatus(_ progress: Int) -> String { clampProgress(progress) >= 100 ? "완료" : "진행중" }
    /// 특정 역량·주체(self/leader)의 레벨 추이(시간순).
    static func curve(_ log: [CompetencyLogEntry], _ competency: String, by: String) -> [Int] {
        log.filter { $0.competency == competency && $0.by == by }
            .sorted { $0.at < $1.at }
            .map { $0.level }
    }
}

// ── Supabase row (snake_case) ──
private struct GoalRow: Codable {
    let id, owner_email, title: String
    let detail: String?; let due: String?; let progress: Int?; let status: String?
    let leader_comment: String?; let created_at: String?; let updated_at: String?
    init(_ g: GrowthGoal) {
        id = g.id; owner_email = g.ownerEmail; title = g.title; detail = g.detail
        due = g.due.isEmpty ? nil : g.due; progress = g.progress; status = g.status
        leader_comment = g.leaderComment; created_at = g.createdAt.isEmpty ? nil : g.createdAt
        updated_at = g.updatedAt.isEmpty ? nil : g.updatedAt
    }
    func toModel() -> GrowthGoal {
        GrowthGoal(id: id, ownerEmail: owner_email, title: title, detail: detail ?? "",
                   due: due ?? "", progress: progress ?? 0, status: status ?? "진행중",
                   leaderComment: leader_comment ?? "", createdAt: created_at ?? "", updatedAt: updated_at ?? "")
    }
}
private struct LevelRow: Codable {
    let id, owner_email, competency: String
    let self_level: Int?; let leader_level: Int?; let evidence: String?; let updated_at: String?
    init(_ l: CompetencyLevel) {
        id = l.id; owner_email = l.ownerEmail; competency = l.competency
        self_level = l.selfLevel; leader_level = l.leaderLevel; evidence = l.evidence
        updated_at = l.updatedAt.isEmpty ? nil : l.updatedAt
    }
    func toModel() -> CompetencyLevel {
        CompetencyLevel(id: id, ownerEmail: owner_email, competency: competency,
                        selfLevel: self_level ?? 1, leaderLevel: leader_level, evidence: evidence ?? "",
                        updatedAt: updated_at ?? "")
    }
}
private struct LogRow: Codable {
    let id, owner_email, competency: String
    let level: Int; let by: String; let at: String?
    init(_ e: CompetencyLogEntry) {
        id = e.id; owner_email = e.ownerEmail; competency = e.competency
        level = e.level; by = e.by; at = e.at.isEmpty ? nil : e.at
    }
    func toModel() -> CompetencyLogEntry {
        CompetencyLogEntry(id: id, ownerEmail: owner_email, competency: competency, level: level, by: by, at: at ?? "")
    }
}

/// 성장 데이터 스토어 — 웹과 공유하는 Supabase 3테이블. 로컬 캐시(Persist)로 즉시 표시.
@MainActor
final class GrowthStore: ObservableObject {
    @Published var goals: [GrowthGoal] { didSet { Persist.save(goals, "skonnection.growthGoals") } }
    @Published var levels: [CompetencyLevel] { didSet { Persist.save(levels, "skonnection.growthLevels") } }
    @Published var log: [CompetencyLogEntry] { didSet { Persist.save(log, "skonnection.growthLog") } }

    init() {
        goals = Persist.load("skonnection.growthGoals", as: [GrowthGoal].self) ?? []
        levels = Persist.load("skonnection.growthLevels", as: [CompetencyLevel].self) ?? []
        log = Persist.load("skonnection.growthLog", as: [CompetencyLogEntry].self) ?? []
        Task { await syncFromRemote() }
    }

    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        if let g = try? await Supabase.select("growth_goals", query: "select=*", as: GoalRow.self) {
            goals = g.map { $0.toModel() }
        }
        if let l = try? await Supabase.select("growth_competencies", query: "select=*", as: LevelRow.self) {
            levels = l.map { $0.toModel() }
        }
        if let lg = try? await Supabase.select("growth_competency_log", query: "select=*&order=at.asc", as: LogRow.self) {
            log = lg.map { $0.toModel() }
        }
    }

    static func makeId(_ prefix: String) -> String {
        "\(prefix)-" + String(Int(Date().timeIntervalSince1970 * 1000), radix: 36, uppercase: true)
    }

    // ── 목표 ──
    func addGoal(ownerEmail: String, title: String, detail: String, due: String) {
        let today = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        let g = GrowthGoal(id: Self.makeId("GRW"), ownerEmail: ownerEmail, title: title, detail: detail,
                           due: due, progress: 0, status: "진행중", leaderComment: "", createdAt: today, updatedAt: today)
        goals.insert(g, at: 0)
        Task { try? await Supabase.upsert("growth_goals", GoalRow(g), onConflict: "id") }
    }
    func updateGoal(_ id: String, mutate: (inout GrowthGoal) -> Void) {
        guard let i = goals.firstIndex(where: { $0.id == id }) else { return }
        mutate(&goals[i])
        goals[i].updatedAt = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        let row = GoalRow(goals[i])
        Task { try? await Supabase.upsert("growth_goals", row, onConflict: "id") }
    }

    // ── 역량 레벨 ──
    private func today() -> String { String(ISO8601DateFormatter().string(from: Date()).prefix(10)) }
    func levelFor(_ ownerEmail: String, _ competency: String) -> CompetencyLevel? {
        levels.first { $0.ownerEmail.lowercased() == ownerEmail.lowercased() && $0.competency == competency }
    }
    func setSelfLevel(ownerEmail: String, competency: String, level: Int) {
        let lv = GrowthRules.clampLevel(level)
        upsertLevel(ownerEmail: ownerEmail, competency: competency) { $0.selfLevel = lv }
        appendLog(ownerEmail: ownerEmail, competency: competency, level: lv, by: "self")
    }
    func setEvidence(ownerEmail: String, competency: String, evidence: String) {
        upsertLevel(ownerEmail: ownerEmail, competency: competency) { $0.evidence = evidence }
    }
    func setLeaderLevel(_ lvl: CompetencyLevel, level: Int) {
        let v = GrowthRules.clampLevel(level)
        if let i = levels.firstIndex(where: { $0.id == lvl.id }) {
            levels[i].leaderLevel = v; levels[i].updatedAt = today()
            let row = LevelRow(levels[i]); Task { try? await Supabase.upsert("growth_competencies", row, onConflict: "id") }
        }
        appendLog(ownerEmail: lvl.ownerEmail, competency: lvl.competency, level: v, by: "leader")
    }
    private func upsertLevel(ownerEmail: String, competency: String, mutate: (inout CompetencyLevel) -> Void) {
        if let i = levels.firstIndex(where: { $0.ownerEmail.lowercased() == ownerEmail.lowercased() && $0.competency == competency }) {
            mutate(&levels[i]); levels[i].updatedAt = today()
            let row = LevelRow(levels[i]); Task { try? await Supabase.upsert("growth_competencies", row, onConflict: "id") }
        } else {
            var l = CompetencyLevel(id: Self.makeId("GRC"), ownerEmail: ownerEmail, competency: competency,
                                    selfLevel: 1, leaderLevel: nil, evidence: "", updatedAt: today())
            mutate(&l); levels.append(l)
            let row = LevelRow(l); Task { try? await Supabase.upsert("growth_competencies", row, onConflict: "id") }
        }
    }
    private func appendLog(ownerEmail: String, competency: String, level: Int, by: String) {
        let e = CompetencyLogEntry(id: Self.makeId("GLG"), ownerEmail: ownerEmail, competency: competency,
                                   level: level, by: by, at: ISO8601DateFormatter().string(from: Date()))
        log.append(e)
        Task { try? await Supabase.insert("growth_competency_log", LogRow(e)) }
    }
}
