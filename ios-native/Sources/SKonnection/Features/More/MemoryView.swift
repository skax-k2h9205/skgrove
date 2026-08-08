import SwiftUI

/// 팀 추억 — 인스타 프로필 + 3열 사진 그리드 + 월별 캘린더(웹 Memory 이식, 실데이터).
struct MemoryView: View {
    @EnvironmentObject private var store: MemoryStore
    @State private var tab = "게시물"
    @State private var selected: TeamMemory?

    var body: some View {
        ScreenScaffold(title: "팀 추억", showUserChip: false,
                       onRefresh: { await store.syncFromRemote() }) {
            profileHeader
            Picker("보기", selection: $tab) {
                Text("게시물").tag("게시물"); Text("캘린더").tag("캘린더")
            }
            .pickerStyle(.segmented)

            if store.memories.isEmpty {
                EmptyState(icon: "photo.stack", title: "아직 추억이 없어요",
                           message: "행사를 만들면 여기에 사진과 함께 쌓여요.")
            } else if tab == "게시물" {
                InstaGrid(items: store.memories) { m in
                    Button { Haptics.selection(); selected = m } label: {
                        GridTile(icon: "photo.stack.fill", title: m.title,
                                 meta: store.count(m.id) > 0 ? "사진 \(store.count(m.id))" : m.eventDate,
                                 tint: Theme.Palette.tintPrimary, ink: Theme.Palette.tintPrimaryInk)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                calendar
            }
        }
        .sheet(item: $selected) { m in
            DetailSheet(title: "행사", heading: m.title, lines: detailLines(m), action: "앨범 열기")
        }
    }

    private var calendar: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) {
            ForEach(store.byMonth, id: \.month) { group in
                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    Text(monthLabel(group.month)).font(.subheadline.bold()).foregroundStyle(Theme.Palette.primary)
                    ForEach(group.items) { m in
                        Button { Haptics.selection(); selected = m } label: {
                            HStack(spacing: Theme.Space.x3) {
                                Text(String(m.eventDate.suffix(2))).font(.headline.bold())
                                    .foregroundStyle(Theme.Palette.primary).frame(width: 32)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(m.title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                                    Text([m.place, m.host].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.caption).foregroundStyle(Theme.Palette.muted)
                                }
                                Spacer()
                                if store.count(m.id) > 0 {
                                    Label("\(store.count(m.id))", systemImage: "photo")
                                        .font(.caption2).foregroundStyle(Theme.Palette.muted)
                                }
                            }
                            .padding(Theme.Space.x3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func detailLines(_ m: TeamMemory) -> [String] {
        var lines: [String] = []
        if !m.summary.isEmpty { lines.append(m.summary) }
        lines.append([m.eventDate, m.place].filter { !$0.isEmpty }.joined(separator: " · "))
        if !m.host.isEmpty { lines.append("주최 \(m.host)") }
        if store.count(m.id) > 0 { lines.append("사진·영상 \(store.count(m.id))개") }
        return lines
    }

    private func monthLabel(_ ym: String) -> String {
        let parts = ym.split(separator: "-")
        guard parts.count == 2 else { return ym }
        return "\(parts[0])년 \(Int(parts[1]) ?? 0)월"
    }

    private var profileHeader: some View {
        HStack(spacing: Theme.Space.x4) {
            Circle().fill(Theme.Palette.tintNeutral).frame(width: 64, height: 64)
                .overlay(Image(systemName: "party.popper.fill").foregroundStyle(Theme.Palette.primary))
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                Text("우리 팀 추억").font(.headline).foregroundStyle(Theme.Palette.ink)
                HStack(spacing: Theme.Space.x4) {
                    stat("행사", "\(store.memories.count)")
                    stat("기록", "\(store.totalAssets)")
                    stat("함께한 사람", "\(store.hostCount)")
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
