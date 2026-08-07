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

struct AgendaOption: Identifiable {
    let id: String
    let label: String
    var count: Int
}

struct Agenda: Identifiable {
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
}

@MainActor
final class AgendaStore: ObservableObject {
    @Published var agendas: [Agenda] = [
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
}
