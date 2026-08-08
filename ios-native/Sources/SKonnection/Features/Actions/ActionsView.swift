import SwiftUI

/// 액션아이템 — 필터 + 지연 경고 + 카드(담당·목표일·상태 전환). 웹 Actions 이식.
/// 상태 전이는 규칙(완료→대기 불가)을 따르고, 완료·재검토는 근거를 남긴 뒤 확정한다.
struct ActionsView: View {
    @EnvironmentObject private var store: ActionStore
    @State private var filter: ActionStatus? = nil
    @State private var noteTarget: NoteTarget?

    private var filtered: [ActionItem] {
        let all = store.sorted
        guard let filter else { return all }
        return all.filter { $0.status == filter }
    }

    var body: some View {
        ScreenScaffold(title: "액션아이템", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
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
                    ActionCard(item: item) { target in requestTransition(item, target) }
                }
            }
        }
        .sheet(item: $noteTarget) { target in
            NoteEditor(target: target) { note in
                store.setStatus(target.id, target.status, note: note)
                Haptics.success()
            }
        }
    }

    /// 근거가 필요한 전이(완료·재검토)면 입력 시트를 띄우고, 아니면 바로 반영한다.
    private func requestTransition(_ item: ActionItem, _ target: ActionStatus) {
        if target.needsNote {
            let existing = target == .done ? item.outcome : item.reviewReason
            noteTarget = NoteTarget(id: item.id, title: item.title, status: target, draft: existing)
        } else {
            store.setStatus(item.id, target)
            Haptics.selection()
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

/// 근거 입력 대상 — 어떤 액션을 어느 상태로 옮기는지.
private struct NoteTarget: Identifiable {
    let id: String
    let title: String
    let status: ActionStatus
    var draft: String
}

/// 완료(적용 결과)·재검토(사유) 근거를 받는 시트. 비어 있으면 확정할 수 없다.
private struct NoteEditor: View {
    let target: NoteTarget
    let onCommit: (String) -> Void
    @State private var text: String
    @Environment(\.dismiss) private var dismiss

    init(target: NoteTarget, onCommit: @escaping (String) -> Void) {
        self.target = target
        self.onCommit = onCommit
        _text = State(initialValue: target.draft)
    }

    private var isDone: Bool { target.status == .done }
    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                Text(target.title).font(.headline).foregroundStyle(Theme.Palette.ink)
                Text(isDone ? "무엇이 어떻게 바뀌었나요? 적용 결과를 남겨주세요."
                            : "왜 다시 봐야 하나요? 재검토 사유를 남겨주세요.")
                    .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                TextField(isDone ? "적용 결과" : "재검토 사유", text: $text, axis: .vertical)
                    .lineLimit(3...6)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
                Button {
                    onCommit(trimmed); dismiss()
                } label: {
                    Label(isDone ? "완료로 기록" : "재검토로 보내기", systemImage: "checkmark")
                        .font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                .disabled(trimmed.isEmpty)
                Spacer()
            }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.sunken)
            .navigationTitle(isDone ? "적용 결과" : "재검토 사유")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } } }
        }
        .presentationDetents([.medium])
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

            // 완료 결과·재검토 사유는 카드에 그대로 남겨 이력이 된다.
            if !item.outcome.isEmpty {
                noteLine(icon: "checkmark.seal.fill", label: "적용 결과", text: item.outcome,
                         tint: Theme.Palette.tintSuccess, ink: Theme.Palette.tintSuccessInk)
            }
            if !item.reviewReason.isEmpty {
                noteLine(icon: "exclamationmark.triangle.fill", label: "재검토 사유", text: item.reviewReason,
                         tint: Theme.Palette.tintDanger, ink: Theme.Palette.danger)
            }

            // 전이 규칙상 갈 수 있는 상태만 버튼으로 노출한다.
            HStack(spacing: Theme.Space.x2) {
                ForEach(item.status.nextStatuses, id: \.self) { s in
                    Button { onStatus(s) } label: {
                        Text(s.rawValue).font(.caption.weight(.semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.bordered)
                    .tint(s == .done ? Theme.Palette.success
                          : s == .review ? Theme.Palette.danger : Theme.Palette.cta)
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

    private func noteLine(icon: String, label: String, text: String, tint: Color, ink: Color) -> some View {
        HStack(alignment: .top, spacing: Theme.Space.x2) {
            Image(systemName: icon).font(.caption).foregroundStyle(ink)
            Text("\(label): \(text)").font(.caption).foregroundStyle(Theme.Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Theme.Space.x2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
    }
}
