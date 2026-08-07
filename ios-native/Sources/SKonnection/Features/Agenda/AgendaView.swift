import SwiftUI

/// 안건 / 투표 — 필터 탭 + 안건 카드(투표 진행바). 웹 Agenda 이식.
struct AgendaView: View {
    @StateObject private var store = AgendaStore()
    @State private var filter: AgendaStatus? = nil   // nil = 전체

    private var filtered: [Agenda] {
        guard let filter else { return store.agendas }
        return store.agendas.filter { $0.status == filter }
    }

    var body: some View {
        ScreenScaffold(title: "안건 / 투표", showUserChip: false) {
            filterTabs
            if filtered.isEmpty {
                EmptyState(icon: "checkmark.square.dashed", title: "해당 안건이 없어요",
                           message: "다른 상태를 골라보거나 새 안건을 등록해 보세요.")
            } else {
                ForEach(filtered) { agenda in
                    AgendaCard(agenda: agenda) { optionId in
                        store.vote(agendaId: agenda.id, optionId: optionId)
                        Haptics.success()
                    }
                }
            }
        }
    }

    private var filterTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.x2) {
                chip("전체", active: filter == nil) { filter = nil }
                ForEach(AgendaStatus.allCases, id: \.self) { status in
                    chip(status.rawValue, active: filter == status) { filter = status }
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

private struct AgendaCard: View {
    let agenda: Agenda
    let onVote: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) {
            HStack {
                Text(agenda.category).font(.caption).foregroundStyle(Theme.Palette.muted)
                Spacer()
                StatusBadge(text: agenda.status.rawValue, tint: agenda.status.tint, ink: agenda.status.ink)
            }
            Text(agenda.title).font(.headline).foregroundStyle(Theme.Palette.ink)
            Text(agenda.description).font(.subheadline).foregroundStyle(Theme.Palette.muted)

            VStack(spacing: Theme.Space.x2) {
                ForEach(agenda.options) { option in
                    VoteBar(
                        label: option.label,
                        percent: agenda.percent(option),
                        count: option.count,
                        selected: agenda.votedOptionId == option.id,
                        enabled: agenda.status == .voting && agenda.votedOptionId == nil
                    ) { onVote(option.id) }
                }
            }

            Text("\(agenda.voterCount)명 참여 · 대상 \(agenda.eligibleCount)명 · \(agenda.deadline)")
                .font(.caption).foregroundStyle(Theme.Palette.muted)
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}

/// 투표 선택지 한 줄 — 득표율만큼 배경이 채워지는 진행바. 투표 가능하면 탭으로 투표.
private struct VoteBar: View {
    let label: String
    let percent: Int
    let count: Int
    let selected: Bool
    let enabled: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: Theme.Radius.md).fill(Theme.Palette.sunken)
                    RoundedRectangle(cornerRadius: Theme.Radius.md)
                        .fill(selected ? Theme.Palette.primarySoft : Theme.Palette.tintPrimary)
                        .frame(width: max(0, geo.size.width * CGFloat(percent) / 100))
                    HStack {
                        if selected { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.Palette.primary) }
                        Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                        Spacer()
                        Text("\(count)표 · \(percent)%").font(.subheadline).foregroundStyle(Theme.Palette.muted)
                    }
                    .padding(.horizontal, Theme.Space.x3)
                }
            }
            .frame(height: 44)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }
}
