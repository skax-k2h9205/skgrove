import SwiftUI

// 캔미팅/티미팅 모델(웹 meetings 이식). 세션↔의견은 정규화(평탄 배열 + sessionId 외래키)해
// 웹 can_opinions 테이블과 1:1로 맞춘다.

/// 캔미팅 단계 흐름: 세션 준비 → 의견 수집 → 의견 공유 → 선정 → 결과.
enum CanStage: String, CaseIterable, Codable {
    case setup = "세션 준비", collect = "의견 수집", share = "의견 공유", select = "선정", summary = "결과"

    var tint: Color {
        switch self {
        case .setup, .collect: return Theme.Palette.tintNeutral
        case .share, .select: return Theme.Palette.tintPrimary
        case .summary: return Theme.Palette.tintSuccess
        }
    }
    var ink: Color {
        switch self {
        case .summary: return Theme.Palette.tintSuccessInk
        case .share, .select: return Theme.Palette.tintPrimaryInk
        default: return Theme.Palette.muted
        }
    }
    /// 다음 단계(결과가 마지막이면 nil).
    var next: CanStage? {
        let all = CanStage.allCases
        guard let i = all.firstIndex(of: self), i + 1 < all.count else { return nil }
        return all[i + 1]
    }
    var index: Int { CanStage.allCases.firstIndex(of: self) ?? 0 }
}

/// 캔미팅 3-Step — 의견을 이 단계로 분류한다(웹 CAN_STEPS 이식).
enum CanStep: String, CaseIterable, Codable, Identifiable {
    case speakout = "Speak-out", ideation = "Ideation", quickwin = "Quick-win"
    var id: String { rawValue }

    var label: String {
        switch self {
        case .speakout: return "Step 1 · Speak-out"
        case .ideation: return "Step 2 · Ideation"
        case .quickwin: return "Step 3 · Quick-win"
        }
    }
    var hint: String {
        switch self {
        case .speakout: return "먼저 해결해야 할 '진짜' 문제 · Bottleneck · 비효율"
        case .ideation: return "우리 팀만이 할 수 있는 해결 / 개선 방안"
        case .quickwin: return "바로 실천할 과제 (역할 · 기한 구체화)"
        }
    }
}

struct CanSession: Identifiable, Codable {
    let id: String
    var title: String
    var part: String
    var date: String
    var stage: CanStage
}

struct CanOpinion: Identifiable, Codable {
    let id: String
    let sessionId: String
    var step: CanStep
    var content: String
    var author: String
    var selected: Bool = false
}

/// 티미팅 세션 상태.
enum TeaStatus: String, CaseIterable, Codable {
    case proposed = "제안", scheduled = "예정", done = "완료"
    var tint: Color {
        switch self {
        case .proposed: return Theme.Palette.tintNeutral
        case .scheduled: return Theme.Palette.tintPrimary
        case .done: return Theme.Palette.tintSuccess
        }
    }
    var ink: Color {
        switch self {
        case .done: return Theme.Palette.tintSuccessInk
        case .scheduled: return Theme.Palette.tintPrimaryInk
        default: return Theme.Palette.muted
        }
    }
    var next: TeaStatus? {
        switch self {
        case .proposed: return .scheduled
        case .scheduled: return .done
        case .done: return nil
        }
    }
}

struct TeaSession: Identifiable, Codable {
    let id: String
    var title: String
    var type: String       // 기술세미나 / 여행기 / 팀워크샵 / 팀내공유
    var presenter: String
    var part: String
    var heldAt: String
    var status: TeaStatus
}

@MainActor
final class MeetingStore: ObservableObject {
    private static let cansKey = "skonnection.cans"
    private static let opinionsKey = "skonnection.canOpinions"
    private static let teasKey = "skonnection.teas"

    @Published var cans: [CanSession] { didSet { Persist.save(cans, Self.cansKey) } }
    @Published var opinions: [CanOpinion] { didSet { Persist.save(opinions, Self.opinionsKey) } }
    @Published var teas: [TeaSession] { didSet { Persist.save(teas, Self.teasKey) } }

    init() {
        cans = Persist.load(Self.cansKey, as: [CanSession].self) ?? Self.seedCans
        opinions = Persist.load(Self.opinionsKey, as: [CanOpinion].self) ?? Self.seedOpinions
        teas = Persist.load(Self.teasKey, as: [TeaSession].self) ?? Self.seedTeas
    }

    // MARK: 캔미팅

    func opinions(for sessionId: String) -> [CanOpinion] {
        opinions.filter { $0.sessionId == sessionId }
    }
    func opinions(for sessionId: String, step: CanStep) -> [CanOpinion] {
        opinions.filter { $0.sessionId == sessionId && $0.step == step }
    }
    func counts(for sessionId: String) -> (opinions: Int, selected: Int) {
        let mine = opinions(for: sessionId)
        return (mine.count, mine.filter { $0.selected }.count)
    }

    /// 세션을 다음 단계로 넘긴다.
    func advance(_ sessionId: String) {
        guard let i = cans.firstIndex(where: { $0.id == sessionId }), let next = cans[i].stage.next else { return }
        cans[i].stage = next
    }

    func addOpinion(sessionId: String, step: CanStep, content: String, author: String) {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let id = "CAN-O-\(opinions.count + 1)-\(step.rawValue)"
        opinions.insert(CanOpinion(id: id, sessionId: sessionId, step: step, content: trimmed, author: author), at: 0)
    }

    func toggleSelect(_ opinionId: String) {
        guard let i = opinions.firstIndex(where: { $0.id == opinionId }) else { return }
        opinions[i].selected.toggle()
    }

    func createCan(title: String, part: String, date: String) {
        let maxNum = cans.compactMap { Int($0.id.split(separator: "-").last ?? "") }.max() ?? 0
        cans.insert(CanSession(id: "CAN-\(maxNum + 1)", title: title, part: part, date: date, stage: .setup), at: 0)
    }

    // MARK: 티미팅

    func advanceTea(_ id: String) {
        guard let i = teas.firstIndex(where: { $0.id == id }), let next = teas[i].status.next else { return }
        teas[i].status = next
    }

    func createTea(title: String, type: String, presenter: String, part: String, heldAt: String) {
        let maxNum = teas.compactMap { Int($0.id.split(separator: "-").last ?? "") }.max() ?? 0
        let status: TeaStatus = heldAt.isEmpty ? .proposed : .scheduled
        teas.insert(TeaSession(id: "TEA-\(maxNum + 1)", title: title, type: type, presenter: presenter,
                               part: part, heldAt: heldAt, status: status), at: 0)
    }

    // MARK: 시드

    private static let seedCans: [CanSession] = [
        .init(id: "CAN-2", title: "Being AX 달성을 위한 실천 아이디어", part: "AI ITS혁신팀",
              date: "2026-07-10", stage: .share),
        .init(id: "CAN-1", title: "불필요한 회의를 줄여 집중 시간 확보", part: "AI ITS혁신팀",
              date: "2026-04-15", stage: .summary),
    ]
    private static let seedOpinions: [CanOpinion] = [
        .init(id: "CAN-O-1", sessionId: "CAN-2", step: .speakout,
              content: "회의가 많아 딥워크 시간이 부족하다", author: "김승현"),
        .init(id: "CAN-O-2", sessionId: "CAN-2", step: .speakout,
              content: "아젠다 없이 시작해 논점이 흩어진다", author: "이두민"),
        .init(id: "CAN-O-3", sessionId: "CAN-2", step: .ideation,
              content: "AI 회의록 자동 요약 도입", author: "김수정", selected: true),
        .init(id: "CAN-O-4", sessionId: "CAN-2", step: .quickwin,
              content: "회의 전 3줄 아젠다 공유 규칙화", author: "이선민"),
        .init(id: "CAN-O-5", sessionId: "CAN-1", step: .quickwin,
              content: "오전 10~12시 회의 프리존 지정", author: "김승현", selected: true),
        .init(id: "CAN-O-6", sessionId: "CAN-1", step: .ideation,
              content: "정기 회의 격주 전환", author: "이두민", selected: true),
    ]
    private static let seedTeas: [TeaSession] = [
        .init(id: "TEA-3", title: "제주도 워케이션 여행기", type: "여행기", presenter: "김수정",
              part: "PM혁신파트", heldAt: "2026-08-20", status: .scheduled),
        .init(id: "TEA-2", title: "SwiftUI 실전 팁 세미나", type: "기술세미나", presenter: "김승현",
              part: "ITS혁신파트", heldAt: "2026-07-30", status: .done),
        .init(id: "TEA-1", title: "3분기 팀워크샵 회고", type: "팀워크샵", presenter: "이선민",
              part: "전체", heldAt: "", status: .proposed),
    ]
}
