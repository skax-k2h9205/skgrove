import SwiftUI

private struct TraitBar: Identifiable { let id = UUID(); let label: String; let value: Int; let max: Int }
private struct Colleague: Identifiable { let id = UUID(); let name: String; let part: String; let trait: String }

/// 동료 성향 — 팀 성향 분포 + 동료 프로필(웹 Profiles 이식).
struct ProfilesView: View {
    private let dist: [TraitBar] = [
        .init(label: "관계형", value: 1, max: 4), .init(label: "실행형", value: 1, max: 4),
        .init(label: "기준형", value: 1, max: 4), .init(label: "맥락형", value: 1, max: 4),
    ]
    private let colleagues: [Colleague] = [
        .init(name: "김승현", part: "ITS혁신파트", trait: "실행형 문제 해결가"),
        .init(name: "이선민", part: "TEST혁신파트", trait: "맥락형 조율가"),
        .init(name: "김수정", part: "PM혁신파트", trait: "기준형 정리가"),
    ]
    @State private var query = ""

    var body: some View {
        ScreenScaffold(title: "동료 성향", showUserChip: false) {
            card {
                Label("팀 성향 분포", systemImage: "chart.bar").font(.headline).foregroundStyle(Theme.Palette.ink)
                Text("작성한 사람만 분포에 반영됩니다.").font(.caption).foregroundStyle(Theme.Palette.muted)
                ForEach(dist) { bar in
                    HStack(spacing: Theme.Space.x3) {
                        Text(bar.label).font(.subheadline).foregroundStyle(Theme.Palette.ink).frame(width: 60, alignment: .leading)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Theme.Palette.sunken)
                                Capsule().fill(Theme.Palette.primary)
                                    .frame(width: geo.size.width * CGFloat(bar.value) / CGFloat(bar.max))
                            }
                        }.frame(height: 10)
                        Text("\(bar.value)").font(.caption).foregroundStyle(Theme.Palette.muted)
                    }
                }
            }

            card {
                Label("동료 프로필 찾기", systemImage: "person.2").font(.headline).foregroundStyle(Theme.Palette.ink)
                TextField("이름, 성향, 역할로 찾기", text: $query)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                ForEach(colleagues.filter { query.isEmpty || $0.name.contains(query) || $0.trait.contains(query) }) { c in
                    HStack(spacing: Theme.Space.x3) {
                        Avatar(name: c.name)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(c.name).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                            Text("\(c.part) · \(c.trait)").font(.caption).foregroundStyle(Theme.Palette.muted)
                        }
                        Spacer()
                    }
                    .padding(.vertical, Theme.Space.x1)
                }
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
