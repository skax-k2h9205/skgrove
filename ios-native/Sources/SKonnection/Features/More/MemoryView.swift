import SwiftUI

private struct MemoryEvent: Identifiable {
    let id: String
    let title: String
    let date: String
    let photos: Int
}

/// 팀 추억 — 인스타 프로필 + 3열 사진 그리드(웹 Memory 이식).
struct MemoryView: View {
    @State private var tab = "게시물"
    private let events: [MemoryEvent] = [
        .init(id: "E1", title: "3분기 워크숍", date: "2026-07", photos: 12),
        .init(id: "E2", title: "팀 회식 🍖", date: "2026-06", photos: 8),
        .init(id: "E3", title: "런치 번개", date: "2026-06", photos: 5),
        .init(id: "E4", title: "생일 축하 🎂", date: "2026-05", photos: 6),
        .init(id: "E5", title: "타운홀", date: "2026-05", photos: 9),
        .init(id: "E6", title: "커피챗", date: "2026-04", photos: 3),
    ]
    @State private var selected: MemoryEvent?

    var body: some View {
        ScreenScaffold(title: "팀 추억", showUserChip: false) {
            profileHeader
            Picker("보기", selection: $tab) {
                Text("게시물").tag("게시물"); Text("캘린더").tag("캘린더")
            }
            .pickerStyle(.segmented)

            if tab == "게시물" {
                InstaGrid(items: events) { e in
                    Button { Haptics.selection(); selected = e } label: {
                        GridTile(icon: "photo.stack.fill", title: e.title, meta: "사진 \(e.photos)",
                                 tint: Theme.Palette.tintPrimary, ink: Theme.Palette.tintPrimaryInk)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                VStack(spacing: Theme.Space.x3) {
                    Image(systemName: "calendar").font(.system(size: 36)).foregroundStyle(Theme.Palette.primary)
                    Text("행사를 만들면 여기 캘린더에 쌓여요.")
                        .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                }
                .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x8)
                .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            }
        }
        .sheet(item: $selected) { e in
            DetailSheet(title: "행사", heading: e.title,
                        lines: ["\(e.date) · 사진 \(e.photos)장", "행사별 사진과 반응을 모아 봐요."],
                        action: "앨범 열기")
        }
    }

    private var profileHeader: some View {
        HStack(spacing: Theme.Space.x4) {
            Circle().fill(Theme.Palette.tintNeutral).frame(width: 64, height: 64)
                .overlay(Image(systemName: "party.popper.fill").foregroundStyle(Theme.Palette.primary))
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                Text("team_memory").font(.headline).foregroundStyle(Theme.Palette.ink)
                HStack(spacing: Theme.Space.x4) {
                    stat("행사", "\(events.count)"); stat("기록", "43"); stat("함께한 사람", "5")
                }
            }
            Spacer()
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
            Text(label).font(.caption2).foregroundStyle(Theme.Palette.muted)
        }
    }
}
