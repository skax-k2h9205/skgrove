import SwiftUI

// 캔미팅/티미팅 모델(웹 meetings 이식).

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
}

struct CanSession: Identifiable {
    let id: String
    var title: String
    var part: String
    var date: String
    var stage: CanStage
    var opinions: Int
    var selected: Int
}

/// 티미팅 세션 상태.
enum TeaStatus: String, Codable {
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
}

struct TeaSession: Identifiable {
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
    @Published var cans: [CanSession] = [
        .init(id: "CAN-2", title: "Being AX 달성을 위한 실천 아이디어", part: "AI ITS혁신팀",
              date: "2026-07-10", stage: .share, opinions: 7, selected: 3),
        .init(id: "CAN-1", title: "불필요한 회의를 줄여 집중 시간 확보", part: "AI ITS혁신팀",
              date: "2026-04-15", stage: .summary, opinions: 2, selected: 2),
    ]
    @Published var teas: [TeaSession] = [
        .init(id: "TEA-3", title: "제주도 워케이션 여행기", type: "여행기", presenter: "김수정",
              part: "PM혁신파트", heldAt: "2026-08-20", status: .scheduled),
        .init(id: "TEA-2", title: "SwiftUI 실전 팁 세미나", type: "기술세미나", presenter: "김승현",
              part: "ITS혁신파트", heldAt: "2026-07-30", status: .done),
        .init(id: "TEA-1", title: "3분기 팀워크샵 회고", type: "팀워크샵", presenter: "이선민",
              part: "전체", heldAt: "", status: .proposed),
    ]
}
