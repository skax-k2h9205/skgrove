import UIKit

/// 주요 동작에 촉각 피드백을 준다 — 네이티브 앱다운 손맛.
enum Haptics {
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func selection() { UISelectionFeedbackGenerator().selectionChanged() }
    /// 막힌 동작(금칙어로 등록이 거절되는 등) — 성공과 다른 감촉이어야 알아챈다.
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
}
