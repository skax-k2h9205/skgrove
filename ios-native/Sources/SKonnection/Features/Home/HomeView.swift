import SwiftUI

/// 홈 통합 피드(웹 Dashboard 이식). 스토리 줄 + 3열 인스타식 타일 그리드.
struct HomeView: View {
    /// 피드 타일 탭 시 이동할 탭 인덱스를 상위에 알린다.
    var onOpen: (Int) -> Void = { _ in }

    private let feed = HomeFeedItem.seed

    var body: some View {
        ScreenScaffold(title: "홈", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            storyRow
            InstaGrid(items: feed) { item in
                Button { Haptics.selection(); onOpen(tabFor(item.kind)) } label: {
                    GridTile(imageURL: item.imageURL, icon: item.kind.icon, title: item.title,
                             meta: item.meta, tint: item.kind.tint, ink: item.kind.ink)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// 피드 종류 → 탭 인덱스(유머 1·모임 2·장터 3, 안건·액션은 더보기 4).
    private func tabFor(_ kind: FeedKind) -> Int {
        switch kind {
        case .humor: return 1
        case .gathering: return 2
        case .market: return 3
        case .agenda, .action: return 4
        }
    }

    private var storyRow: some View {
        HStack(alignment: .top, spacing: Theme.Space.x4) {
            StoryCircle(icon: "plus", label: "말하기", ringed: false)
            StoryCircle(icon: "bolt.fill", label: "커피 내기", ringed: true)
            Spacer(minLength: 0)
        }
    }
}

/// 인스타 스토리식 원형 버튼. ringed 면 그라데이션 링을 두른다.
private struct StoryCircle: View {
    let icon: String
    let label: String
    let ringed: Bool

    var body: some View {
        VStack(spacing: Theme.Space.x1) {
            ZStack {
                if ringed {
                    Circle()
                        .strokeBorder(
                            AngularGradient(colors: [.purple, .pink, .orange, .yellow, .purple], center: .center),
                            lineWidth: 2.5
                        )
                        .frame(width: 68, height: 68)
                }
                Circle()
                    .fill(Theme.Palette.tintNeutral)
                    .frame(width: 58, height: 58)
                    .overlay(Image(systemName: icon).font(.system(size: 22)).foregroundStyle(Theme.Palette.ink))
            }
            Text(label).font(.caption).foregroundStyle(Theme.Palette.ink)
        }
    }
}

