import SwiftUI

/// 캔미팅 / 티미팅 — 두 탭. 캔미팅은 단계 흐름, 티미팅은 세션 공유(웹 meetings 이식).
struct MeetingsView: View {
    @StateObject private var store = MeetingStore()
    @State private var tab = "캔미팅"

    var body: some View {
        ScreenScaffold(title: "캔미팅 / 티미팅", showUserChip: false) {
            Picker("보기", selection: $tab) {
                Text("캔미팅").tag("캔미팅"); Text("티미팅").tag("티미팅")
            }
            .pickerStyle(.segmented)

            if tab == "캔미팅" {
                ForEach(store.cans) { CanCard(session: $0) }
            } else {
                ForEach(store.teas) { TeaCard(session: $0) }
            }
        }
    }
}

private struct CanCard: View {
    let session: CanSession
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack {
                Image(systemName: "dot.radiowaves.left.and.right").foregroundStyle(Theme.Palette.primary)
                Text(session.title).font(.headline).foregroundStyle(Theme.Palette.ink)
                Spacer()
                StatusBadge(text: session.stage.rawValue, tint: session.stage.tint, ink: session.stage.ink)
            }
            Text("\(session.part) · \(session.date)").font(.caption).foregroundStyle(Theme.Palette.muted)
            // 단계 진행 표시 — 현재 단계까지 채워진 점.
            HStack(spacing: Theme.Space.x2) {
                ForEach(Array(CanStage.allCases.enumerated()), id: \.offset) { idx, stage in
                    Circle()
                        .fill(idx <= currentIndex ? Theme.Palette.primary : Theme.Palette.border)
                        .frame(width: 8, height: 8)
                    if idx < CanStage.allCases.count - 1 {
                        Rectangle().fill(idx < currentIndex ? Theme.Palette.primary : Theme.Palette.border)
                            .frame(height: 2).frame(maxWidth: .infinity)
                    }
                }
            }
            Text("의견 \(session.opinions) · 선정 \(session.selected)").font(.caption).foregroundStyle(Theme.Palette.muted)
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
    private var currentIndex: Int { CanStage.allCases.firstIndex(of: session.stage) ?? 0 }
}

private struct TeaCard: View {
    let session: TeaSession
    var body: some View {
        HStack(spacing: Theme.Space.x3) {
            RoundedRectangle(cornerRadius: Theme.Radius.md).fill(Theme.Palette.tintPrimary)
                .frame(width: 52, height: 52)
                .overlay(Image(systemName: "cup.and.saucer.fill").foregroundStyle(Theme.Palette.primary))
            VStack(alignment: .leading, spacing: 3) {
                Text(session.title).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                Text("\(session.type) · \(session.presenter)\(session.heldAt.isEmpty ? "" : " · \(session.heldAt)")")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
            StatusBadge(text: session.status.rawValue, tint: session.status.tint, ink: session.status.ink)
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}
