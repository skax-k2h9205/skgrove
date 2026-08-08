import SwiftUI

/// 홈 통합 피드(웹 Dashboard 이식). 스토리 줄 + 3열 인스타식 타일 그리드.
/// 공유 스토어(유머·장터·모임·안건·액션)에서 실데이터를 모아 섞어 보여준다.
struct HomeView: View {
    /// 피드 타일 탭 시 이동할 탭 인덱스를 상위에 알린다.
    var onOpen: (Int) -> Void = { _ in }

    @EnvironmentObject private var humor: HumorStore
    @EnvironmentObject private var gatherings: GatheringStore
    @EnvironmentObject private var market: MarketStore
    @EnvironmentObject private var agendas: AgendaStore
    @EnvironmentObject private var actions: ActionStore

    /// 각 도메인에서 몇 개씩 뽑아 라운드로빈으로 섞은 통합 피드.
    private var feed: [HomeFeedItem] {
        let h = humor.posts.prefix(8).map {
            HomeFeedItem(id: "h:\($0.id)", kind: .humor, title: $0.body,
                         meta: "빵터짐 \($0.laughs)", imageURL: humor.thumbnail($0), author: $0.author)
        }
        let m = market.sorted.prefix(6).map {
            HomeFeedItem(id: "m:\($0.id)", kind: .market, title: $0.title,
                         meta: market.status($0).rawValue, imageURL: URL(string: $0.imageURL), author: $0.seller)
        }
        let g = gatherings.gatherings.prefix(6).map {
            HomeFeedItem(id: "g:\($0.id)", kind: .gathering, title: $0.title,
                         meta: gatherings.status($0).rawValue, imageURL: URL(string: $0.imageURL), author: $0.host)
        }
        let a = agendas.agendas.prefix(4).map {
            HomeFeedItem(id: "a:\($0.id)", kind: .agenda, title: $0.title, meta: $0.status.rawValue)
        }
        let ac = actions.items.prefix(4).map {
            HomeFeedItem(id: "ac:\($0.id)", kind: .action, title: $0.title, meta: $0.status.rawValue)
        }
        return roundRobin([Array(h), Array(m), Array(g), Array(a), Array(ac)])
    }

    /// 여러 배열을 번갈아 하나로 — 한 종류가 몰리지 않게 섞는다.
    private func roundRobin(_ lists: [[HomeFeedItem]]) -> [HomeFeedItem] {
        var out: [HomeFeedItem] = []
        var idx = 0
        var remaining = true
        while remaining {
            remaining = false
            for list in lists where idx < list.count {
                out.append(list[idx]); remaining = true
            }
            idx += 1
        }
        return out
    }

    var body: some View {
        ScreenScaffold(title: "홈", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            storyRow
            InstaGrid(items: feed) { item in
                Button { Haptics.selection(); onOpen(tabFor(item.kind)) } label: {
                    // 모임·장터·유머는 유머게시판처럼 글쓴이+내용 캡션을 얹는다(author 있는 항목).
                    GridTile(imageURL: item.imageURL, icon: item.kind.icon, title: item.title,
                             meta: item.meta, tint: item.kind.tint, ink: item.kind.ink,
                             caption: item.author.map { (author: $0, text: item.title) })
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

