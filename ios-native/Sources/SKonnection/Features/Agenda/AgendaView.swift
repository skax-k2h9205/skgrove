import SwiftUI
import CryptoKit

/// 안건 / 투표 — 필터 탭 + 안건 카드(투표 진행바). 웹 Agenda 이식.
/// 투표는 되돌릴 수 없으므로 확정 전 확인 다이얼로그를 거친다. 정족수·참여율을 함께 보여준다.
struct AgendaView: View {
    @EnvironmentObject private var store: AgendaStore
    @EnvironmentObject private var actions: ActionStore
    @EnvironmentObject private var session: SessionStore
    @State private var filter: AgendaStatus? = nil   // nil = 전체
    @State private var pending: PendingVote?          // 확정 대기 중인 투표
    @State private var createdToast: String?          // 액션아이템 생성 안내

    private var isLeader: Bool { session.currentUser?.role.isLeader == true }

    private var filtered: [Agenda] {
        guard let filter else { return store.agendas }
        return store.agendas.filter { $0.status == filter }
    }

    var body: some View {
        ScreenScaffold(title: "안건 / 투표", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            filterTabs
            if let createdToast {
                Label(createdToast, systemImage: "checkmark.circle.fill")
                    .font(.footnote.weight(.semibold)).foregroundStyle(Theme.Palette.tintSuccessInk)
                    .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Palette.tintSuccess, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            }
            if filtered.isEmpty {
                EmptyState(icon: "checkmark.square.dashed", title: "해당 안건이 없어요",
                           message: "다른 상태를 골라보거나 새 안건을 등록해 보세요.")
            } else {
                ForEach(filtered) { agenda in
                    AgendaCard(agenda: agenda, isLeader: isLeader,
                               onVote: { optionId, label in
                                   pending = PendingVote(agendaId: agenda.id, optionId: optionId,
                                                         optionLabel: label, agendaTitle: agenda.title)
                               },
                               onClose: { close(agenda) },
                               onMakeAction: { makeAction(agenda) })
                }
            }
        }
        .confirmationDialog(pending.map { "\"\($0.optionLabel)\"(으)로 투표할까요?" } ?? "",
                            isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }),
                            titleVisibility: .visible) {
            Button("확정하기", role: .destructive) { commitPending() }
            Button("취소", role: .cancel) { pending = nil }
        } message: {
            Text("확정 후에는 선택을 바꿀 수 없어요.")
        }
    }

    private func commitPending() {
        guard let p = pending else { return }
        // 중복 투표 방지용 voter_key — 투표자 이메일의 SHA256(웹 ballot 스킴과 동형).
        let key = SHA256.hash(data: Data((session.currentUser?.email ?? "").utf8))
            .map { String(format: "%02x", $0) }.joined()
        store.vote(agendaId: p.agendaId, optionId: p.optionId, voterKey: key)
        pending = nil
        Haptics.success()
    }

    private func close(_ agenda: Agenda) {
        store.close(agendaId: agenda.id)
        Haptics.success()
    }

    /// 통과/결정된 안건에서 후속 액션아이템을 생성한다(리더 전용).
    private func makeAction(_ agenda: Agenda) {
        actions.createFromAgenda(title: "\(agenda.title) 후속 조치", sourceLabel: "안건 · \(agenda.title)")
        createdToast = "액션아이템을 만들었어요 — 액션아이템 화면에서 담당·기한을 정하세요."
        Haptics.success()
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

/// 확정 대기 중인 투표 한 건.
private struct PendingVote {
    let agendaId: String
    let optionId: String
    let optionLabel: String
    let agendaTitle: String
}

private struct AgendaCard: View {
    let agenda: Agenda
    let isLeader: Bool
    let onVote: (String, String) -> Void
    let onClose: () -> Void
    let onMakeAction: () -> Void

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
                    ) { onVote(option.id, option.label) }
                }
            }

            quorumLine

            Text("\(agenda.voterCount)명 참여 · 대상 \(agenda.eligibleCount)명 · \(agenda.deadline)")
                .font(.caption).foregroundStyle(Theme.Palette.muted)

            if isLeader { leaderActions }
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    /// 정족수·참여율 — 두세 명의 표로 규칙이 바뀌지 않도록 성립 여부를 보여준다.
    private var quorumLine: some View {
        HStack(spacing: Theme.Space.x2) {
            ProgressView(value: Double(agenda.participationRate), total: 100)
                .tint(agenda.quorumMet ? Theme.Palette.success : Theme.Palette.primary)
            if agenda.quorumMet {
                Label("정족수 충족", systemImage: "checkmark.seal.fill")
                    .font(.caption2.weight(.bold)).foregroundStyle(Theme.Palette.tintSuccessInk)
            } else {
                Text("성립까지 \(agenda.votesShortOfQuorum)표")
                    .font(.caption2.weight(.bold)).foregroundStyle(Theme.Palette.muted)
            }
        }
    }

    @ViewBuilder
    private var leaderActions: some View {
        Divider().overlay(Theme.Palette.border)
        if agenda.status == .voting {
            Button { onClose() } label: {
                Label("지금 마감", systemImage: "flag.checkered")
                    .font(.caption.weight(.semibold)).frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Space.x1)
            }
            .buttonStyle(.bordered).tint(Theme.Palette.cta)
        } else if agenda.status == .passed || agenda.status == .decided {
            Button { onMakeAction() } label: {
                Label("액션아이템 만들기", systemImage: "bolt.badge.a.fill")
                    .font(.caption.weight(.semibold)).frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Space.x1)
            }
            .buttonStyle(.bordered).tint(Theme.Palette.success)
        }
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
