import SwiftUI

/// 빈 상태 — 목록/필터 결과가 없을 때 빈 화면 대신 안내를 보여준다(네이티브 앱 기본기).
struct EmptyState: View {
    let icon: String
    let title: String
    var message: String? = nil

    var body: some View {
        VStack(spacing: Theme.Space.x3) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(Theme.Palette.borderStrong)
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.Palette.ink)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(Theme.Palette.muted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Space.x8)
    }
}
