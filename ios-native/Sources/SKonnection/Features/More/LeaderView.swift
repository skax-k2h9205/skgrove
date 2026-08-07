import SwiftUI

/// 리더 관리함 — 접수된 의견을 리더가 검토·안건화한다(웹 Leader 이식).
struct LeaderView: View {
    @EnvironmentObject private var store: IssueStore
    @EnvironmentObject private var agendas: AgendaStore
    @State private var filter: IssueStatus? = nil
    @State private var promoted: String?   // 방금 안건화한 접수 안내

    private var filtered: [Issue] {
        guard let filter else { return store.issues }
        return store.issues.filter { $0.status == filter }
    }

    // 표시 순서: 접수·검토중을 위로(처리 대기), 나머지는 아래로.
    private let openStatuses: [IssueStatus] = [.received, .reviewing]

    var body: some View {
        ScreenScaffold(title: "리더 관리함", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            summary
            if let promoted {
                Label(promoted, systemImage: "checkmark.circle.fill")
                    .font(.footnote.weight(.semibold)).foregroundStyle(Theme.Palette.tintSuccessInk)
                    .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Palette.tintSuccess, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            }
            filterTabs
            if filtered.isEmpty {
                EmptyState(icon: "tray", title: "해당 접수가 없어요",
                           message: "다른 상태를 골라보세요.")
            } else {
                ForEach(filtered) { issue in card(issue) }
            }
        }
    }

    private func card(_ issue: Issue) -> some View {
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
                // 이미 안건화·종료된 접수는 다시 올리지 않는다.
                if issue.status != .agenda && issue.status != .closed {
                    Button("안건화") { promote(issue) }
                        .font(.caption.weight(.semibold)).buttonStyle(.bordered).tint(Theme.Palette.cta)
                }
                if issue.status != .held {
                    Button("보류") { store.mark(issue.id, .held) }
                        .font(.caption.weight(.semibold)).buttonStyle(.bordered).tint(Theme.Palette.muted)
                }
            }
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    /// 접수를 안건으로 올리고(공유 안건 스토어) 접수 상태를 안건화로 바꾼다.
    private func promote(_ issue: Issue) {
        agendas.createFromIssue(issue)
        store.mark(issue.id, .agenda)
        promoted = "\"\(issue.title)\" 안건으로 올렸어요 — 안건/투표 화면에서 볼 수 있어요."
        Haptics.success()
    }

    private var filterTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.x2) {
                chip("전체", active: filter == nil) { filter = nil }
                chip("접수", active: filter == .received) { filter = .received }
                chip("검토중", active: filter == .reviewing) { filter = .reviewing }
                chip("안건화", active: filter == .agenda) { filter = .agenda }
                chip("보류", active: filter == .held) { filter = .held }
            }
        }
    }

    private func chip(_ label: String, active: Bool, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Text(label)
                .font(.subheadline.weight(active ? .bold : .regular))
                .foregroundStyle(active ? Theme.Palette.cta : Theme.Palette.muted)
                .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.x2)
                .background(active ? Theme.Palette.tintPrimary : Theme.Palette.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.Palette.border))
        }
    }

    private var summary: some View {
        let openCount = store.issues.filter { openStatuses.contains($0.status) }.count
        return HStack(spacing: Theme.Space.x2) {
            Image(systemName: "tray.full.fill").foregroundStyle(Theme.Palette.primary)
            Text("접수 \(store.issues.count)건 · 처리 대기 \(openCount)건 — 검토하고 안건으로 올려보세요.")
                .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }
}
