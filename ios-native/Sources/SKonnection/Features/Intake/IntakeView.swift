import SwiftUI

/// 대나무숲 접수 — 익명/실명으로 의견을 접수하고, 내 접수 상태를 본다(웹 Intake 이식).
struct IntakeView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = IssueStore()

    @State private var identity: Identity = .anonymous
    @State private var category = issueCategories[0]
    @State private var title = ""
    @State private var detail = ""
    @State private var expectedChange = ""
    @State private var target: IssueTarget = .teamLeader
    @State private var urgency: Urgency = .normal
    @State private var visibility: IssueVisibility = .leaderOnly
    @State private var justSubmitted: String?

    var body: some View {
        ScreenScaffold(title: "대나무숲 접수") {
            anonymityBanner
            formCard
            myList
        }
    }

    // 익명성 안내 — 이 화면의 존재 이유라 맨 위에 둔다.
    private var anonymityBanner: some View {
        HStack(alignment: .top, spacing: Theme.Space.x2) {
            Image(systemName: "lock.shield.fill").foregroundStyle(Theme.Palette.primary)
            Text("익명 접수는 작성자를 저장하지 않아요. 접수번호로만 내 글을 다시 볼 수 있습니다.")
                .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            Picker("작성 방식", selection: $identity) {
                ForEach(Identity.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)

            labeled("카테고리") {
                Picker("카테고리", selection: $category) {
                    ForEach(issueCategories, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
                .tint(Theme.Palette.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            labeled("제목") { textField($title, "한 줄로 요약해 주세요") }
            labeled("내용") { textField($detail, "어떤 일이 있었나요?", lines: 3) }
            labeled("기대하는 변화") { textField($expectedChange, "이렇게 바뀌면 좋겠어요", lines: 2) }

            labeled("대상") {
                Picker("대상", selection: $target) {
                    ForEach(IssueTarget.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented)
            }
            labeled("긴급도") {
                Picker("긴급도", selection: $urgency) {
                    ForEach(Urgency.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented)
            }
            labeled("공개 범위") {
                Picker("공개 범위", selection: $visibility) {
                    ForEach(IssueVisibility.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.menu).tint(Theme.Palette.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let code = justSubmitted {
                Text("접수됐어요 · 접수번호 \(code)")
                    .font(.footnote.bold()).foregroundStyle(Theme.Palette.tintSuccessInk)
                    .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Palette.tintSuccess, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            }

            Button(action: submit) {
                Label("접수하기", systemImage: "paperplane.fill")
                    .font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
            .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(Theme.Space.x4)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    @ViewBuilder
    private var myList: some View {
        let mine = store.issues.filter {
            $0.identity == .named && $0.submitterEmail?.lowercased() == session.currentUser?.email.lowercased()
                || $0.id == justSubmitted
        }
        if !mine.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                Text("내 접수").font(.headline).foregroundStyle(Theme.Palette.ink)
                ForEach(mine) { issue in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(issue.title).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                            Spacer()
                            StatusBadge(text: issue.status.rawValue, tint: issue.status.tint, ink: issue.status.ink)
                        }
                        Text("\(issue.id) · \(issue.category) · \(issue.identity.rawValue)")
                            .font(.caption).foregroundStyle(Theme.Palette.muted)
                    }
                    .padding(Theme.Space.x3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
                }
            }
        }
    }

    private func labeled(_ title: String, @ViewBuilder _ control: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            control()
        }
    }

    private func textField(_ text: Binding<String>, _ placeholder: String, lines: Int = 1) -> some View {
        TextField(placeholder, text: text, axis: lines > 1 ? .vertical : .horizontal)
            .lineLimit(lines > 1 ? lines...(lines + 3) : 1...1)
            .padding(Theme.Space.x3)
            .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }

    private func submit() {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        let named = identity == .named
        let issue = Issue(
            id: store.nextId(), title: trimmed, category: category, identity: identity,
            target: target, body: detail, expectedChange: expectedChange, urgency: urgency,
            visibility: visibility, status: .received, createdAt: "방금",
            submitterEmail: named ? session.currentUser?.email : nil
        )
        store.submit(issue)
        justSubmitted = issue.id
        title = ""; detail = ""; expectedChange = ""
    }
}

/// 상태 뱃지 — 접수/검토중/안건화 등을 색으로 구분.
struct StatusBadge: View {
    let text: String
    let tint: Color
    let ink: Color
    var body: some View {
        Text(text)
            .font(.caption2.weight(.bold)).foregroundStyle(ink)
            .padding(.horizontal, Theme.Space.x2).padding(.vertical, 4)
            .background(tint, in: Capsule())
    }
}
