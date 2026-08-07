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
}

struct ActionItem: Identifiable, Codable {
    let id: String
    var title: String
    var owner: String          // '미정' 가능
    var due: String            // "YYYY-MM-DD", 빈 문자열이면 미정
    var status: ActionStatus
    var sourceLabel: String

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

    func setStatus(_ id: String, _ status: ActionStatus) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        items[i].status = status
    }

    /// 통과된 안건에서 액션아이템을 만든다(리더가 안건 마감 후 후속 조치를 생성).
    func createFromAgenda(title: String, sourceLabel: String) {
        let maxNum = items.compactMap { Int($0.id.split(separator: "-").last ?? "") }.max() ?? 0
        let id = String(format: "ACT-%04d", maxNum + 1)
        items.insert(ActionItem(id: id, title: title, owner: "미정", due: "",
                                status: .waiting, sourceLabel: sourceLabel), at: 0)
    }
}
