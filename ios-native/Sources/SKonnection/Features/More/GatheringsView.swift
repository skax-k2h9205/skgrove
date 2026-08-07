import SwiftUI

private struct Gathering: Identifiable {
    let id: String
    let title: String
    let host: String
    let when: String
    let kind: String     // 번개 / 공모
    var joined: Int
    var capacity: Int
}

/// 모임 · 번개 — 점심·워크숍 등 자리를 열고 신청한다(웹 Gatherings 이식).
struct GatheringsView: View {
    @State private var filter = "모집중"
    private let filters = ["모집중", "내가 신청", "내가 연 것", "전체"]
    @State private var gatherings: [Gathering] = [
        .init(id: "GAT-1", title: "오늘 점심 김치찌개 번개 🍲", host: "김승현", when: "오늘 12:00", kind: "번개", joined: 3, capacity: 6),
        .init(id: "GAT-2", title: "금요일 보드게임 모임", host: "이두민", when: "8/9 (금) 19:00", kind: "공모", joined: 5, capacity: 8),
    ]

    var body: some View {
        ScreenScaffold(title: "모임 · 번개", showUserChip: false) {
            ChipRow(items: filters, selection: $filter)

            Button {} label: {
                Label("모임 열기", systemImage: "plus").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)

            ForEach(gatherings) { g in
                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    HStack {
                        Text(g.kind).font(.caption.weight(.bold)).foregroundStyle(Theme.Palette.tintPrimaryInk)
                            .padding(.horizontal, Theme.Space.x2).padding(.vertical, 4)
                            .background(Theme.Palette.tintPrimary, in: Capsule())
                        Spacer()
                        Text("\(g.joined)/\(g.capacity)명").font(.caption).foregroundStyle(Theme.Palette.muted)
                    }
                    Text(g.title).font(.headline).foregroundStyle(Theme.Palette.ink)
                    Text("\(g.host) · \(g.when)").font(.subheadline).foregroundStyle(Theme.Palette.muted)
                    Button {} label: {
                        Text("신청하기").font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.bordered).tint(Theme.Palette.cta)
                }
                .padding(Theme.Space.x4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
            }
        }
    }
}

/// 가로 스크롤 필터 칩 줄 — 여러 화면에서 재사용.
struct ChipRow: View {
    let items: [String]
    @Binding var selection: String
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.x2) {
                ForEach(items, id: \.self) { item in
                    let active = item == selection
                    Button { selection = item } label: {
                        Text(item)
                            .font(.subheadline.weight(active ? .bold : .regular))
                            .foregroundStyle(active ? Theme.Palette.cta : Theme.Palette.muted)
                            .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.x2)
                            .background(active ? Theme.Palette.tintPrimary : Theme.Palette.surface, in: Capsule())
                            .overlay(Capsule().stroke(Theme.Palette.border))
                    }
                }
            }
        }
    }
}
