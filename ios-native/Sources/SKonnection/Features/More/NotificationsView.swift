import SwiftUI

private struct Notice: Identifiable { let id = UUID(); let from: String; let date: String; let text: String; var unread: Bool }

/// 알림 / 메시지 — 받은 알림 + 메시지 보내기(웹 Notifications 이식).
struct NotificationsView: View {
    @State private var tab = "전체"
    @State private var draft = ""
    @State private var notices: [Notice] = [
        .init(from: "이선민", date: "2026-07-27", text: "이번 주 액션아이템 진행 상황 공유 부탁드려요.", unread: true),
    ]

    var body: some View {
        ScreenScaffold(title: "알림 / 메시지", showUserChip: false) {
            card {
                HStack {
                    Label("받은 알림", systemImage: "bell.fill").font(.headline).foregroundStyle(Theme.Palette.ink)
                    Spacer()
                    Button("모두 읽음") { for i in notices.indices { notices[i].unread = false } }
                        .font(.caption).tint(Theme.Palette.cta)
                }
                ForEach(notices) { n in
                    HStack(spacing: Theme.Space.x3) {
                        Avatar(name: n.from)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(n.from) · \(n.date)").font(.caption).foregroundStyle(Theme.Palette.muted)
                            Text(n.text).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                        }
                        Spacer()
                        if n.unread { Circle().fill(Theme.Palette.cta).frame(width: 8, height: 8) }
                    }
                    .padding(.vertical, Theme.Space.x1)
                }
            }

            card {
                Label("메시지 보내기", systemImage: "envelope.fill").font(.headline).foregroundStyle(Theme.Palette.ink)
                Text("받는 사람 · 이선민 · 팀리더").font(.caption).foregroundStyle(Theme.Palette.muted)
                TextField("메시지를 입력하세요", text: $draft, axis: .vertical)
                    .lineLimit(3...6)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
                Button {} label: {
                    Label("보내기", systemImage: "paperplane.fill").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) { content() }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}
