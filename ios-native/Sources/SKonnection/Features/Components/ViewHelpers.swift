import SwiftUI

extension View {
    /// action 이 있으면 pull-to-refresh 를 붙이고, 없으면 그대로 둔다.
    @ViewBuilder
    func refreshableIf(_ action: (() async -> Void)?) -> some View {
        if let action {
            self.refreshable { await action() }
        } else {
            self
        }
    }
}
