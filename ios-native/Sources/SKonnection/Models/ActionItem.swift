import SwiftUI

// 액션아이템 모델(웹 types.ts ActionItem 이식). 핵심 루프의 마지막 단계.

enum ActionStatus: String, CaseIterable, Codable {
    case waiting = "대기", inProgress = "진행중", done = "완료", review = "재검토"

    var tint: Color {
        switch self {
        case .waiting: return Theme.Palette.tintNeutral
        case .inProgress: return Theme.Palette.tintPrimary
        case .done: return Theme.Palette.tintSuccess
        case .review: return Theme.Palette.tintDanger
        }
    }
    var ink: Color {
        switch self {
        case .waiting: return Theme.Palette.muted
        case .inProgress: return Theme.Palette.tintPrimaryInk
        case .done: return Theme.Palette.tintSuccessInk
        case .review: return Theme.Palette.danger
        }
    }
    var icon: String {
        switch self {
        case .waiting: return "clock"
        case .inProgress: return "play.circle"
        case .done: return "checkmark.circle"
        case .review: return "exclamationmark.triangle"
        }
    }

    /// 이 상태에서 넘어갈 수 있는 다음 상태들(웹 actionRules TRANSITIONS 이식).
    /// 완료→대기는 막는다. 되돌리는 것은 '재검토'로 다뤄야 "해봤는데 안 됨"과 "아직 안 함"이 구분된다.
    var nextStatuses: [ActionStatus] {
        switch self {
        case .waiting: return [.inProgress, .done]
        case .inProgress: return [.waiting, .done]
        case .done: return [.review]
        case .review: return [.inProgress, .done]
        }
    }

    /// 완료·재검토로 갈 때는 근거(적용 결과·재검토 사유)를 반드시 남긴다.
    var needsNote: Bool { self == .done || self == .review }
}

struct ActionItem: Identifiable, Codable {
    let id: String
    var title: String
    var owner: String          // '미정' 가능
    var due: String            // "YYYY-MM-DD", 빈 문자열이면 미정
    var status: ActionStatus
    var sourceLabel: String
    // 적용 결과(완료 시 무엇이 어떻게 바뀌었는지)·재검토 사유(왜 다시 봐야 하는지).
    // 없으면 완료가 근거 없이, 재검토가 방치로 끝난다. 웹 SKSOOP-57/58 이식.
    var outcome: String = ""
    var reviewReason: String = ""

    /// 목표일이 지났으면 지난 일수. 앱 기준일(2026-08-07)과 비교한다.
    var overdueDays: Int? {
        guard status != .done, !due.isEmpty,
              let dueDate = Self.formatter.date(from: due),
              let today = Self.formatter.date(from: Self.today)
        else { return nil }
        let days = Calendar.current.dateComponents([.day], from: dueDate, to: today).day ?? 0
        return days > 0 ? days : nil
    }

    private static let today = "2026-08-07"
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
}

@MainActor
final class ActionStore: ObservableObject {
    private static let key = "skonnection.actions"
    @Published var items: [ActionItem] { didSet { Persist.save(items, Self.key) } }

    init() {
        items = Persist.load(Self.key, as: [ActionItem].self) ?? Self.seed
    }

    private static let seed: [ActionItem] = [
        ActionItem(id: "ACT-0007", title: "티미팅 아젠다 3개 제한안 작성", owner: "이상협",
                   due: "2026-07-30", status: .inProgress, sourceLabel: "안건 · 팀 티미팅 간소화"),
        ActionItem(id: "ACT-0006", title: "캔미팅 의견 제출 양식 배포", owner: "미정",
                   due: "2026-08-12", status: .waiting, sourceLabel: "캔미팅 · Being AX"),
        ActionItem(id: "ACT-0005", title: "파트 섞기 커피챗 1차 매칭", owner: "김승현",
                   due: "2026-07-28", status: .done, sourceLabel: "안건 · 파트 섞기 커피챗"),
        ActionItem(id: "ACT-0004", title: "워크숍 예산안 재검토", owner: "이선민",
                   due: "2026-07-25", status: .review, sourceLabel: "안건 · 팀 워크숍"),
    ]

    var overdueCount: Int { items.filter { $0.overdueDays != nil }.count }

    /// 지연된 것 → 나머지 → 완료 순. 완료는 항상 아래로(웹 sortActionItems 이식).
    var sorted: [ActionItem] {
        items.sorted { a, b in
            let aDone = a.status == .done, bDone = b.status == .done
            if aDone != bDone { return !aDone }            // 완료를 뒤로
            let aOver = a.overdueDays != nil, bOver = b.overdueDays != nil
            if aOver != bOver { return aOver }             // 지연을 앞으로
            if a.due.isEmpty != b.due.isEmpty { return !a.due.isEmpty }  // 미정은 뒤로
            if a.due != b.due { return a.due < b.due }     // 임박 순
            return a.id > b.id
        }
    }

    /// 상태 전이. 전이 규칙에 없으면 무시하고, 완료/재검토면 근거(note)를 함께 기록한다.
    func setStatus(_ id: String, _ status: ActionStatus, note: String = "") {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        guard items[i].status.nextStatuses.contains(status) else { return }
        items[i].status = status
        if status == .done { items[i].outcome = note }
        if status == .review { items[i].reviewReason = note }
    }

    /// 통과된 안건에서 액션아이템을 만든다(리더가 안건 마감 후 후속 조치를 생성).
    func createFromAgenda(title: String, sourceLabel: String) {
        let maxNum = items.compactMap { Int($0.id.split(separator: "-").last ?? "") }.max() ?? 0
        let id = String(format: "ACT-%04d", maxNum + 1)
        items.insert(ActionItem(id: id, title: title, owner: "미정", due: "",
                                status: .waiting, sourceLabel: sourceLabel), at: 0)
    }
}
