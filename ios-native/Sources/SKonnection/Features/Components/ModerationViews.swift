import SwiftUI

// 신고·차단 UI 묶음(App Store 심사 지침 1.2).
//
// 심사자는 이 기능을 **찾을 수 있어야** 한다. 길게 누르는 컨텍스트 메뉴만 두면
// 못 찾고 다시 반려된다. 그래서 목록에는 컨텍스트 메뉴를, 상세에는 눈에 보이는
// ⋯ 버튼을 함께 둔다.

/// 신고 시트에 넘길 대상. sheet(item:) 이 Identifiable 을 요구한다.
struct ReportTarget: Identifiable {
    let kind: ReportKind
    let targetId: String
    let author: String
    var id: String { "\(kind.rawValue):\(targetId)" }
}

/// 목록 타일·댓글에 붙이는 신고/차단 메뉴 항목.
/// 이미 있는 `.contextMenu { }` 안에 그대로 끼워 쓴다.
struct ModerationMenuItems: View {
    let target: ReportTarget
    let onReport: (ReportTarget) -> Void

    @EnvironmentObject private var moderation: ModerationStore
    @EnvironmentObject private var session: SessionStore

    private var myName: String { session.currentUser?.name ?? "" }

    var body: some View {
        // 내 글은 신고·차단 대상이 아니다. 삭제는 각 화면이 따로 제공한다.
        if !target.author.isEmpty, target.author != myName {
            Button { onReport(target) } label: { Label("신고", systemImage: "flag") }
            Button(role: .destructive) {
                moderation.block(target.author, reporter: myName)
                Haptics.success()
            } label: { Label("\(target.author) 차단", systemImage: "hand.raised.slash") }
        }
    }
}

/// 상세 화면 툴바에 놓는 눈에 보이는 신고 버튼.
struct ModerationToolbarMenu: View {
    let target: ReportTarget
    let onReport: (ReportTarget) -> Void

    @EnvironmentObject private var moderation: ModerationStore
    @EnvironmentObject private var session: SessionStore

    private var myName: String { session.currentUser?.name ?? "" }

    var body: some View {
        if !target.author.isEmpty, target.author != myName {
            Menu {
                ModerationMenuItems(target: target, onReport: onReport)
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
    }
}

/// 신고 입력 — 사유를 고르게 한다. 자유 서술만 받으면 분류가 안 돼
/// 24시간 안에 처리하겠다는 약속을 지키기 어렵다.
struct ReportSheet: View {
    let target: ReportTarget
    @EnvironmentObject private var moderation: ModerationStore
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    @State private var reason: ReportReason = .abuse
    @State private var note = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("\(target.author) 님의 \(target.kind.label)을 신고합니다.")
                        .font(.subheadline).foregroundStyle(Theme.Palette.ink)
                } footer: {
                    Text("신고하면 이 콘텐츠는 내 화면에서 바로 사라집니다. 운영자가 24시간 안에 확인해 삭제·이용 중단 등 필요한 조치를 합니다.")
                }

                Section("신고 사유") {
                    Picker("사유", selection: $reason) {
                        ForEach(ReportReason.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.inline).labelsHidden()
                }

                Section("자세한 내용(선택)") {
                    TextField("어떤 점이 문제인지 알려주세요.", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section {
                    Button(role: .destructive) {
                        moderation.report(kind: target.kind, targetId: target.targetId,
                                          author: target.author, reason: reason, note: note,
                                          reporter: session.currentUser?.name ?? "익명")
                        Haptics.success()
                        dismiss()
                    } label: {
                        Text("신고하고 숨기기").frame(maxWidth: .infinity)
                    }
                }
            }
            .navigationTitle("신고").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } } }
        }
    }
}

/// 차단한 사람 목록 — 차단은 되돌릴 수 있어야 하고, 그 자리가 어디인지 분명해야 한다.
struct BlockedAuthorsView: View {
    @EnvironmentObject private var moderation: ModerationStore

    var body: some View {
        ScreenScaffold(title: "차단한 사람", showUserChip: false) {
            if moderation.blockedAuthors.isEmpty {
                EmptyState(icon: "hand.raised", title: "차단한 사람이 없어요",
                           message: "글이나 댓글을 길게 눌러 차단할 수 있어요.")
            } else {
                VStack(spacing: 0) {
                    ForEach(moderation.blockedAuthors, id: \.self) { name in
                        HStack(spacing: Theme.Space.x3) {
                            Avatar(name: name)
                            Text(name).font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.Palette.ink)
                            Spacer()
                            Button("차단 해제") { moderation.unblock(name) }
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.Palette.primary)
                        }
                        .padding(Theme.Space.x3)
                        if name != moderation.blockedAuthors.last {
                            Divider().overlay(Theme.Palette.border).padding(.leading, Theme.Space.x3)
                        }
                    }
                }
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))

                Text("차단하면 그 사람의 글과 댓글이 내 화면에서 즉시 사라집니다.")
                    .font(.footnote).foregroundStyle(Theme.Palette.muted)
                    .padding(.horizontal, Theme.Space.x2)
            }
        }
    }
}

/// 등록 전 금칙어 검사 결과를 보여주는 배너. 각 작성 폼이 공유한다.
struct FilterWarning: View {
    let message: String
    var body: some View {
        Label(message, systemImage: "exclamationmark.triangle.fill")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Theme.Palette.danger)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Space.x3)
            .background(Theme.Palette.tintDanger, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }
}
