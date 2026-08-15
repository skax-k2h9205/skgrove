import SwiftUI

/// 리더 관리함 — 접수된 의견을 리더가 답변·안건화·보류/종료한다(웹 Leader 이식).
/// 보류·종료는 사유를 반드시 남기고, 응답 없이 오래된 건은 '지연'으로 눈에 띄게 표시한다.
struct LeaderView: View {
    @EnvironmentObject private var store: IssueStore
    @EnvironmentObject private var agendas: AgendaStore
    @EnvironmentObject private var session: SessionStore
    @State private var filter: IssueStatus? = nil
    @State private var promoted: String?      // 방금 안건화한 접수 안내
    @State private var action: LeaderAction?  // 답변·1on1·보류·종료 입력 대상
    // 암호화 접수 복호화용 내 계정 id(CurrentUser엔 id가 없어 roster에서 이메일로 찾는다).
    @State private var leaderAccountId = ""

    private var filtered: [Issue] {
        guard let filter else { return store.issues }
        return store.issues.filter { $0.status == filter }
    }

    private let openStatuses: [IssueStatus] = [.received, .reviewing]

    var body: some View {
        ScreenScaffold(title: "리더 관리함", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            summary
            overdueBanner
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
        .sheet(item: $action) { act in
            LeaderActionSheet(action: act) { text in commit(act, text) }
        }
        .task {
            // 내 계정 id를 이메일로 1회 해석(암호화 접수 복호화에 필요).
            guard leaderAccountId.isEmpty, let email = session.currentUser?.email else { return }
            let roster = await AuthLink.fetchRoster()
            leaderAccountId = roster.first { $0.email.lowercased() == email.lowercased() }?.id ?? ""
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
            if issue.encrypted == true {
                // 암호화 익명 접수 — 대상 리더만 자기 기기에서 복호화해 본다.
                EncryptedIssueBody(issue: issue, accountId: leaderAccountId)
            } else if !issue.body.isEmpty {
                Text(issue.body).font(.subheadline).foregroundStyle(Theme.Palette.muted).lineLimit(2)
            }

            // 처리 이력 — 답변·1on1·사유를 카드에 남겨 접수자에게 근거가 된다.
            if !issue.leaderReply.isEmpty {
                noteLine("답변", issue.leaderReply, "text.bubble.fill",
                         Theme.Palette.tintSuccess, Theme.Palette.tintSuccessInk)
            }
            if !issue.oneOnOneNote.isEmpty {
                noteLine("1:1 제안", issue.oneOnOneNote, "person.line.dotted.person.fill",
                         Theme.Palette.tintPrimary, Theme.Palette.tintPrimaryInk)
            }
            if !issue.reason.isEmpty {
                noteLine(issue.status == .closed ? "종료 사유" : "보류 사유", issue.reason,
                         "pause.circle.fill", Theme.Palette.tintNeutral, Theme.Palette.muted)
            }

            HStack(spacing: Theme.Space.x2) {
                Text("\(issue.id) · \(issue.urgency.rawValue) · \(issue.createdAt)")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
                if issue.isResponseOverdue(today: Date()) {
                    Label("응답 지연 \(issue.daysSinceCreated(today: Date()))일", systemImage: "clock.badge.exclamationmark.fill")
                        .font(.caption2.weight(.bold)).foregroundStyle(Theme.Palette.danger)
                }
                Spacer()
                processMenu(issue)
            }
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.lg)
                .stroke(issue.isResponseOverdue(today: Date()) ? Theme.Palette.danger.opacity(0.4) : Theme.Palette.border)
        )
    }

    /// 처리 메뉴 — 답변·1:1·안건화·보류·종료. 이미 끝난 건은 항목이 줄어든다.
    private func processMenu(_ issue: Issue) -> some View {
        Menu {
            Button { action = .init(issueId: issue.id, kind: .reply, draft: issue.leaderReply) } label: {
                Label("답변하기", systemImage: "text.bubble")
            }
            Button { action = .init(issueId: issue.id, kind: .oneOnOne, draft: issue.oneOnOneNote) } label: {
                Label("1:1 제안", systemImage: "person.line.dotted.person")
            }
            if issue.status != .agenda && issue.status != .closed {
                Button { promote(issue) } label: { Label("안건화", systemImage: "checkmark.square") }
            }
            if issue.status != .held {
                Button { action = .init(issueId: issue.id, kind: .hold, draft: issue.reason) } label: {
                    Label("보류", systemImage: "pause.circle")
                }
            }
            if issue.status != .closed {
                Button(role: .destructive) { action = .init(issueId: issue.id, kind: .close, draft: issue.reason) } label: {
                    Label("종료", systemImage: "xmark.circle")
                }
            }
        } label: {
            Label("처리", systemImage: "ellipsis.circle")
                .font(.caption.weight(.semibold))
        }
        .tint(Theme.Palette.cta)
    }

    private func noteLine(_ label: String, _ text: String, _ icon: String, _ tint: Color, _ ink: Color) -> some View {
        HStack(alignment: .top, spacing: Theme.Space.x2) {
            Image(systemName: icon).font(.caption).foregroundStyle(ink)
            Text("\(label): \(text)").font(.caption).foregroundStyle(Theme.Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Theme.Space.x2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
    }

    private func commit(_ act: LeaderAction, _ text: String) {
        switch act.kind {
        case .reply: store.reply(act.issueId, text)
        case .oneOnOne: store.proposeOneOnOne(act.issueId, text)
        case .hold: store.decide(act.issueId, .held, reason: text)
        case .close: store.decide(act.issueId, .closed, reason: text)
        }
        Haptics.success()
    }

    private func promote(_ issue: Issue) {
        agendas.createFromIssue(issue)
        store.mark(issue.id, .agenda)
        promoted = "\"\(issue.title)\" 안건으로 올렸어요 — 안건/투표 화면에서 볼 수 있어요."
        Haptics.success()
    }

    @ViewBuilder
    private var overdueBanner: some View {
        if let days = store.oldestWaitingDays(today: Date()), days >= Issue.responseDueDays {
            HStack(spacing: Theme.Space.x2) {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.Palette.danger)
                Text("\(days)일째 답변을 기다리는 접수가 있어요. 방치되면 사람들이 다시 쓰지 않아요.")
                    .font(.footnote.weight(.semibold)).foregroundStyle(Theme.Palette.danger)
            }
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintDanger, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        }
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

/// 리더 처리 입력 대상.
struct LeaderAction: Identifiable {
    enum Kind { case reply, oneOnOne, hold, close }
    var id: String { "\(issueId)-\(kind)" }
    let issueId: String
    let kind: Kind
    var draft: String

    var title: String {
        switch kind {
        case .reply: return "답변하기"
        case .oneOnOne: return "1:1 제안"
        case .hold: return "보류 사유"
        case .close: return "종료 사유"
        }
    }
    var prompt: String {
        switch kind {
        case .reply: return "접수자에게 전할 답변을 남겨주세요."
        case .oneOnOne: return "어떤 1:1을 제안할지 메모를 남겨주세요."
        case .hold: return "왜 보류하는지 사유를 남겨주세요. 근거 없이 보류되면 다시 쓰지 않아요."
        case .close: return "왜 종료하는지 사유를 남겨주세요."
        }
    }
    var commitLabel: String {
        switch kind {
        case .reply: return "답변 남기기"
        case .oneOnOne: return "1:1 제안하기"
        case .hold: return "보류로 처리"
        case .close: return "종료로 처리"
        }
    }
    var isDestructive: Bool { kind == .hold || kind == .close }
}

/// 답변·1on1·보류·종료 근거를 받는 시트. 비어 있으면 확정할 수 없다.
private struct LeaderActionSheet: View {
    let action: LeaderAction
    let onCommit: (String) -> Void
    @State private var text: String
    @Environment(\.dismiss) private var dismiss

    init(action: LeaderAction, onCommit: @escaping (String) -> Void) {
        self.action = action
        self.onCommit = onCommit
        _text = State(initialValue: action.draft)
    }

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                Text(action.prompt).font(.subheadline).foregroundStyle(Theme.Palette.muted)
                TextField(action.title, text: $text, axis: .vertical)
                    .lineLimit(3...6)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
                Button {
                    onCommit(trimmed); dismiss()
                } label: {
                    Text(action.commitLabel).font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent)
                .tint(action.isDestructive ? Theme.Palette.danger : Theme.Palette.cta)
                .disabled(trimmed.isEmpty)
                Spacer()
            }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.sunken)
            .navigationTitle(action.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }
}
