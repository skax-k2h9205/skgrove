import SwiftUI

/// 리더 관리함 — 접수된 의견을 리더가 검토·안건화한다(웹 Leader 이식).
struct LeaderView: View {
    @StateObject private var store = IssueStore()
    @State private var filter: IssueStatus? = nil

    private var filtered: [Issue] {
        guard let filter else { return store.issues }
        return store.issues.filter { $0.status == filter }
    }

    var body: some View {
        ScreenScaffold(title: "리더 관리함", showUserChip: false) {
            summary
            ForEach(filtered) { issue in
                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    HStack {
                        Text("\(issue.category) · \(issue.identity.rawValue)")
                            .font(.caption).foregroundStyle(Theme.Palette.muted)
                        Spacer()
                        StatusBadge(text: issue.status.rawValue, tint: issue.status.tint, ink: issue.status.ink)
                    }
                    Text(issue.title).font(.headline).foregroundStyle(Theme.Palette.ink)
                    if !issue.body.isEmpty {
                        Text(issue.body).font(.subheadline).foregroundStyle(Theme.Palette.muted).lineLimit(2)
                    }
                    HStack(spacing: Theme.Space.x2) {
                        Text("\(issue.id) · \(issue.urgency.rawValue)").font(.caption).foregroundStyle(Theme.Palette.muted)
                        Spacer()
                        Button("안건화") { store.mark(issue.id, .agenda) }
                            .font(.caption.weight(.semibold)).buttonStyle(.bordered).tint(Theme.Palette.cta)
                        Button("보류") { store.mark(issue.id, .held) }
                            .font(.caption.weight(.semibold)).buttonStyle(.bordered).tint(Theme.Palette.muted)
                    }
                }
                .padding(Theme.Space.x4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
            }
        }
    }

    private var summary: some View {
        HStack(spacing: Theme.Space.x2) {
            Image(systemName: "tray.full.fill").foregroundStyle(Theme.Palette.primary)
            Text("접수 \(store.issues.count)건 — 검토하고 안건으로 올려보세요.")
                .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }
}
