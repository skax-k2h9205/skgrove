import SwiftUI

// 안건/투표 모델(웹 types.ts Agenda 이식, 객관식 투표 중심).

enum AgendaStatus: String, CaseIterable, Codable {
    case voting = "투표중", passed = "통과", rejected = "부결", decided = "결정됨"

    var tint: Color {
        switch self {
        case .voting: return Theme.Palette.tintPrimary
        case .passed, .decided: return Theme.Palette.tintSuccess
        case .rejected: return Theme.Palette.tintNeutral
        }
    }
    var ink: Color {
        switch self {
        case .voting: return Theme.Palette.tintPrimaryInk
        case .passed, .decided: return Theme.Palette.tintSuccessInk
        case .rejected: return Theme.Palette.muted
        }
    }
}

struct AgendaOption: Identifiable, Codable {
    let id: String
    let label: String
    var count: Int
}

struct Agenda: Identifiable, Codable {
    let id: String
    var title: String
    var description: String
    var category: String
    var status: AgendaStatus
    var options: [AgendaOption]
    var voterCount: Int
    var eligibleCount: Int
    var deadline: String        // "5일 남음" 등 표시용
    var votedOptionId: String?  // 내가 고른 선택지(로컬)

    var totalVotes: Int { options.reduce(0) { $0 + $1.count } }
    func percent(_ option: AgendaOption) -> Int {
        totalVotes == 0 ? 0 : Int((Double(option.count) / Double(totalVotes) * 100).rounded())
    }

    // 웹 agendaRules.ts 이식 — 정족수·참여율. 두세 명의 표로 팀 규칙이 바뀌는 것을 막는다.
    /// 대상 인원의 1/3 이상이 투표해야 안건이 성립한다.
    static let quorumRatio = 1.0 / 3.0
    var quorum: Int { eligibleCount > 0 ? Int(ceil(Double(eligibleCount) * Self.quorumRatio)) : 0 }
    /// 참여율(%). 대상보다 참여자가 많아도 100%를 넘지 않게 자른다.
    var participationRate: Int {
        eligibleCount <= 0 ? 0 : min(100, Int((Double(voterCount) / Double(eligibleCount) * 100).rounded()))
    }
    /// 정족수까지 더 필요한 표. 이미 채웠으면 0.
    var votesShortOfQuorum: Int { max(0, quorum - voterCount) }
    var quorumMet: Bool { voterCount >= quorum }
    /// 최다 득표 선택지(동점이면 여러 개, 표 없으면 빈 배열).
    var winningOptions: [AgendaOption] {
        let top = options.map(\.count).max() ?? 0
        return top == 0 ? [] : options.filter { $0.count == top }
    }
}

@MainActor
final class AgendaStore: ObservableObject {
    private static let key = "skonnection.agendas"
    @Published var agendas: [Agenda] { didSet { Persist.save(agendas, Self.key) } }

    init() {
        agendas = Persist.load(Self.key, as: [Agenda].self) ?? Self.seed
    }

    private static let seed: [Agenda] = [
        Agenda(id: "AGD-0004", title: "팀 워크숍 장소 정하기",
               description: "9월 워크숍 장소를 정합니다. 이동 시간과 예산을 고려한 후보 세 곳을 올렸어요.",
               category: "복지/분위기", status: .voting,
               options: [
                   AgendaOption(id: "a", label: "양평 세미나하우스", count: 9),
                   AgendaOption(id: "b", label: "강화도 워크숍센터", count: 4),
                   AgendaOption(id: "c", label: "사내 대회의실 + 저녁 회식", count: 6),
               ],
               voterCount: 19, eligibleCount: 30, deadline: "5일 남음"),
        Agenda(id: "AGD-0003", title: "팀 티미팅 간소화",
               description: "티미팅을 15분 스탠딩으로 줄이자는 제안이 통과됐어요.",
               category: "회의문화", status: .passed,
               options: [
                   AgendaOption(id: "y", label: "찬성", count: 22),
                   AgendaOption(id: "n", label: "반대", count: 3),
               ],
               voterCount: 25, eligibleCount: 30, deadline: "마감됨"),
        Agenda(id: "AGD-0001", title: "회의 없는 금요일 오후 시범 운영",
               description: "금요일 오후를 회의 프리로 두자는 안건은 부결됐어요.",
               category: "업무방식", status: .rejected,
               options: [
                   AgendaOption(id: "y", label: "찬성", count: 8),
                   AgendaOption(id: "n", label: "반대", count: 17),
               ],
               voterCount: 25, eligibleCount: 30, deadline: "마감됨"),
    ]

    func vote(agendaId: String, optionId: String) {
        guard let ai = agendas.firstIndex(where: { $0.id == agendaId }) else { return }
        guard agendas[ai].status == .voting, agendas[ai].votedOptionId == nil else { return }
        guard let oi = agendas[ai].options.firstIndex(where: { $0.id == optionId }) else { return }
        agendas[ai].options[oi].count += 1
        agendas[ai].voterCount += 1
        agendas[ai].votedOptionId = optionId
    }

    /// 리더가 안건을 지금 마감한다. 정족수 미달이면 부결, 채웠으면 결정됨으로 확정한다.
    /// (웹 finalStatus 이식: 표를 다 받고도 '투표중'으로 남는 안건은 없어야 한다.)
    func close(agendaId: String) {
        guard let ai = agendas.firstIndex(where: { $0.id == agendaId }) else { return }
        guard agendas[ai].status == .voting else { return }
        agendas[ai].status = agendas[ai].quorumMet ? .decided : .rejected
    }

    /// 리더가 접수 의견을 안건으로 올린다(찬반 투표). 접수→리더→안건 파이프라인의 연결점.
    /// 같은 접수가 두 번 올라오지 않도록 호출부에서 상태를 확인한다.
    func createFromIssue(_ issue: Issue, eligibleCount: Int = 30) {
        let maxNum = agendas.compactMap { Int($0.id.split(separator: "-").last ?? "") }.max() ?? 0
        let id = String(format: "AGD-%04d", maxNum + 1)
        let desc = issue.expectedChange.isEmpty ? issue.body : issue.expectedChange
        agendas.insert(Agenda(id: id, title: issue.title, description: desc,
                              category: issue.category, status: .voting,
                              options: [AgendaOption(id: "y", label: "찬성", count: 0),
                                        AgendaOption(id: "n", label: "반대", count: 0)],
                              voterCount: 0, eligibleCount: eligibleCount, deadline: "7일 남음"), at: 0)
    }
}
