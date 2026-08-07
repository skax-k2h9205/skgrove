import SwiftUI

private struct PartScore: Identifiable { let id = UUID(); let name: String; let members: Int; let reflect: Int; let score: Int }

/// 파트지수 / 리포트 — 파트별 회의·반영 흐름을 운영 관점에서 본다(웹 Metrics 이식).
struct MetricsView: View {
    private let ranking: [PartScore] = [
        .init(name: "ITS혁신파트", members: 12, reflect: 50, score: 28),
        .init(name: "PM혁신파트", members: 10, reflect: 75, score: 11),
        .init(name: "TEST혁신파트", members: 10, reflect: 50, score: 3),
    ]

    var body: some View {
        ScreenScaffold(title: "파트지수 / 리포트", showUserChip: false) {
            hero
            summary
            card {
                Label("파트지수 랭킹", systemImage: "chart.bar").font(.headline).foregroundStyle(Theme.Palette.ink)
                ForEach(ranking) { p in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                            Text("\(p.members)명 · 반영률 \(p.reflect)%").font(.caption).foregroundStyle(Theme.Palette.muted)
                        }
                        Spacer()
                        Text("\(p.score)").font(.title3.bold()).foregroundStyle(.white)
                            .frame(width: 48, height: 48)
                            .background(Theme.Palette.primaryStrong, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    }
                    .padding(.vertical, Theme.Space.x1)
                }
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text("CULTURE HEALTH REPORT").font(.caption.weight(.bold)).foregroundStyle(Theme.Palette.primarySoft)
            Text("팀리더 운영 콘솔").font(.title.bold()).foregroundStyle(.white)
            Text("전체 파트의 회의 리스크·보상 기준·문화 흐름을 운영 관점에서 봅니다.")
                .font(.subheadline).foregroundStyle(Theme.Palette.primarySoft)
        }
        .padding(Theme.Space.x5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surfaceDark, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
    }

    private var summary: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.Space.x3) {
            stat("의견 제출", "12", "chart.bar.doc.horizontal")
            stat("반영률", "58%", "checkmark.seal")
            stat("회의 건강도", "42", "gauge.medium")
            stat("보상 후보", "0", "sparkles")
        }
    }

    private func stat(_ label: String, _ value: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Image(systemName: icon).foregroundStyle(Theme.Palette.primary)
            Text(label).font(.caption).foregroundStyle(Theme.Palette.muted)
            Text(value).font(.title2.bold()).foregroundStyle(Theme.Palette.ink)
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) { content() }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}
