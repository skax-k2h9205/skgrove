import SwiftUI

/// 조 뽑기 — 파트·세대를 골고루 섞어 조를 짠다(웹 Connect 이식).
struct ConnectView: View {
    private let names = ["김승현", "이선민", "김수정", "이두민", "김영석"]
    @State private var mix = "파트 + 연령대 골고루"
    @State private var groupCount = 2
    @State private var result: [[String]] = []

    var body: some View {
        ScreenScaffold(title: "조 뽑기", showUserChip: false) {
            card {
                Label("\(names.count)명 참여", systemImage: "person.3.fill").font(.headline).foregroundStyle(Theme.Palette.ink)
                Text("파트·세대를 골고루 섞어 조를 짜요.").font(.caption).foregroundStyle(Theme.Palette.muted)
            }

            card {
                labeled("섞기 조건") {
                    Picker("섞기 조건", selection: $mix) {
                        ForEach(["파트 + 연령대 골고루", "파트만 골고루", "완전 랜덤"], id: \.self) { Text($0).tag($0) }
                    }.pickerStyle(.menu).tint(Theme.Palette.primary).frame(maxWidth: .infinity, alignment: .leading)
                }
                labeled("조 개수") {
                    Stepper("\(groupCount)개 조", value: $groupCount, in: 2...names.count)
                }
                Button(action: draw) {
                    Label("조 뽑기", systemImage: "shuffle").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }.buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
            }

            if !result.isEmpty {
                ForEach(Array(result.enumerated()), id: \.offset) { idx, group in
                    card {
                        Text("\(idx + 1)조").font(.subheadline.bold()).foregroundStyle(Theme.Palette.primary)
                        Text(group.joined(separator: ", ")).font(.body).foregroundStyle(Theme.Palette.ink)
                    }
                }
            }
        }
    }

    private func draw() {
        // 이름을 인덱스 기반으로 라운드로빈 배분(데모용 결정적 셔플).
        var groups = Array(repeating: [String](), count: groupCount)
        for (i, name) in names.enumerated() { groups[i % groupCount].append(name) }
        result = groups
    }

    private func labeled(_ title: String, @ViewBuilder _ control: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            control()
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
