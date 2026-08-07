import SwiftUI

/// 액션아이템 — 필터 + 지연 경고 + 카드(담당·목표일·상태 전환). 웹 Actions 이식.
struct ActionsView: View {
    @StateObject private var store = ActionStore()
    @State private var filter: ActionStatus? = nil

    private var filtered: [ActionItem] {
        guard let filter else { return store.items }
        return store.items.filter { $0.status == filter }
    }

    var body: some View {
        ScreenScaffold(title: "액션아이템", showUserChip: false) {
            filterTabs
            if store.overdueCount > 0 {
                HStack(spacing: Theme.Space.x2) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.Palette.danger)
                    Text("목표일이 지난 액션아이템이 \(store.overdueCount)건 있습니다.")
                        .font(.footnote.weight(.semibold)).foregroundStyle(Theme.Palette.danger)
                }
                .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.tintDanger, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            }
            if filtered.isEmpty {
                EmptyState(icon: "bolt.slash", title: "해당 액션아이템이 없어요",
                           message: "다른 상태를 골라보세요.")
            } else {
                ForEach(filtered) { item in
                    ActionCard(item: item) { store.setStatus(item.id, $0) }
                }
            }
        }
    }

    private var filterTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.x2) {
                chip("전체", active: filter == nil) { filter = nil }
                ForEach(ActionStatus.allCases, id: \.self) { s in
                    chip(s.rawValue, active: filter == s) { filter = s }
                }
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
}

private struct ActionCard: View {
    let item: ActionItem
    let onStatus: (ActionStatus) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack {
                Label(item.status.rawValue, systemImage: item.status.icon)
                    .font(.caption.weight(.bold)).foregroundStyle(item.status.ink)
                    .padding(.horizontal, Theme.Space.x2).padding(.vertical, 4)
                    .background(item.status.tint, in: Capsule())
                Spacer()
                Text(item.sourceLabel).font(.caption).foregroundStyle(Theme.Palette.muted)
                    .lineLimit(1)
            }
            Text(item.title).font(.headline).foregroundStyle(Theme.Palette.ink)

            HStack(spacing: Theme.Space.x2) {
                Text("담당 \(item.owner)").font(.subheadline).foregroundStyle(Theme.Palette.muted)
                Text("·").foregroundStyle(Theme.Palette.border)
                if let over = item.overdueDays {
                    Text("목표일 \(item.due) (\(over)일 지남)")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.danger)
                } else {
                    Text("목표일 \(item.due.isEmpty ? "미정" : item.due)")
                        .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                }
            }

            HStack(spacing: Theme.Space.x2) {
                ForEach([ActionStatus.waiting, .inProgress, .done], id: \.self) { s in
                    Button { onStatus(s) } label: {
                        Text(s.rawValue).font(.caption.weight(.semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.bordered)
                    .tint(item.status == s ? Theme.Palette.cta : Theme.Palette.muted)
                }
            }
            .padding(.top, Theme.Space.x1)
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.lg)
                .stroke(item.overdueDays != nil ? Theme.Palette.danger.opacity(0.4) : Theme.Palette.border)
        )
    }
}
