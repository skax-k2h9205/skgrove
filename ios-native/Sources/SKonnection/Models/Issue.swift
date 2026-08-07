import SwiftUI

// 대나무숲 접수 모델(웹 types.ts Issue 이식). 팀원이 익명/실명으로 의견을 접수하고
// 리더가 안건화하는 흐름의 출발점.

enum Identity: String, CaseIterable, Codable { case anonymous = "익명", named = "실명" }
enum Urgency: String, CaseIterable, Codable { case low = "낮음", normal = "보통", high = "높음" }
enum IssueTarget: String, CaseIterable, Codable { case teamLeader = "팀리더", partLeader = "파트리더" }
enum IssueVisibility: String, CaseIterable, Codable {
    case leaderOnly = "리더만 보기"
    case agendaCandidate = "안건 후보로 공개 가능"
}

enum IssueStatus: String, Codable {
    case received = "접수", reviewing = "검토중", answered = "답변완료"
    case oneOnOne = "1on1 제안", action = "액션아이템", agenda = "안건화"
    case held = "보류", withdrawn = "회수", closed = "종료"

    var tint: Color {
        switch self {
        case .received, .reviewing: return Theme.Palette.tintPrimary
        case .answered, .action, .agenda: return Theme.Palette.tintSuccess
        case .held, .withdrawn, .closed: return Theme.Palette.tintNeutral
        case .oneOnOne: return Theme.Palette.tintPrimary
        }
    }
    var ink: Color {
        switch self {
        case .answered, .action, .agenda: return Theme.Palette.tintSuccessInk
        case .held, .withdrawn, .closed: return Theme.Palette.muted
        default: return Theme.Palette.tintPrimaryInk
        }
    }
}

let issueCategories = ["회의문화", "협업", "업무방식", "갈등", "성장/피드백", "복지/분위기", "기타"]

struct Issue: Identifiable {
    let id: String
    var title: String
    var category: String
    var identity: Identity
    var target: IssueTarget
    var body: String
    var expectedChange: String
    var urgency: Urgency
    var visibility: IssueVisibility
    var status: IssueStatus
    var createdAt: String
    var submitterEmail: String?
}

/// 접수 목록 보관·추가. Phase 1 은 시드 + 로컬 추가(Supabase 연동은 이후).
@MainActor
final class IssueStore: ObservableObject {
    @Published var issues: [Issue]

    init() {
        issues = [
            Issue(id: "SUP-0007", title: "티미팅 시작 5분 전 아젠다 공유 정착", category: "회의문화",
                  identity: .named, target: .teamLeader, body: "아젠다 없이 시작해 논점이 흩어져요.",
                  expectedChange: "회의 전 3줄 아젠다 공유를 규칙으로.", urgency: .normal,
                  visibility: .agendaCandidate, status: .reviewing, createdAt: "2026-08-05",
                  submitterEmail: "k2h9205@sk.com"),
            Issue(id: "SUP-0006", title: "집중 근무 시간대 회의 자제", category: "업무방식",
                  identity: .anonymous, target: .teamLeader, body: "오전 집중 시간에 회의가 잡혀 흐름이 끊겨요.",
                  expectedChange: "10~12시 회의 프리 존.", urgency: .high,
                  visibility: .agendaCandidate, status: .agenda, createdAt: "2026-08-02"),
        ]
    }

    func submit(_ issue: Issue) {
        issues.insert(issue, at: 0)
    }

    func nextId() -> String {
        String(format: "SUP-%04d", issues.count + 8)
    }
}
