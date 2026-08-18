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

    /// 스토리를 탭하면 탭 전환 없이 이 모임 상세를 바로 띄운다.
    @State private var storyGathering: Gathering?
    /// 인스타처럼 '본 스토리'를 기록한다 — 본 것은 트레이 뒤로 밀리고 링이 회색이 된다.
    /// 웹(localStorage skgrove:viewedStories)과 같은 규칙.
    @State private var viewedStoryIds: [String] = Persist.load(Self.viewedKey, as: [String].self) ?? []

    private static let viewedKey = "skonnection.viewedStories" 

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
        // 번개·커피는 스토리 줄에서 다루니 피드에는 넣지 않는다 — 같은 걸 위아래로 두 번 보여주는 꼴이 된다.
        // 일반 모임은 지나고 나서도 기록으로 남아야 해서 피드에 그대로 둔다.
        let g = gatherings.gatherings
            .filter { $0.kind == .gathering }
            .prefix(6)
            .map {
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
        .sheet(item: $storyGathering) { g in GatheringDetailSheet(gatheringId: g.id) }
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

    /// 모집중인 모임 — 시작이 임박한 순. 스토리는 "지금 참여할 수 있는 것"만 담아야 의미가 있다.
    private var openGatherings: [Gathering] {
        let viewed = Set(viewedStoryIds)
        return gatherings.gatherings
            .filter { gatherings.status($0) == .open }
            .sorted { a, b in
                // 안 본 스토리 먼저(인스타). 같은 그룹 안에서는 시작이 임박한 순.
                let av = viewed.contains(a.id), bv = viewed.contains(b.id)
                if av != bv { return !av }
                return a.startAt < b.startAt
            }
    }

    /// 스토리를 열면 '봤음'으로 기록한다. 저장이 실패해도 이번 세션 정렬·링은 유지된다.
    private func markViewed(_ id: String) {
        guard !viewedStoryIds.contains(id) else { return }
        viewedStoryIds.append(id)
        Persist.save(viewedStoryIds, Self.viewedKey)
    }

    /// 고정 진입 2개 + 모집중 모임들. 개수가 늘 수 있어 가로 스크롤로 둔다.
    private var storyRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: Theme.Space.x4) {
                StoryCircle(icon: "plus", label: "말하기", ringed: false)
                StoryCircle(icon: "bolt.fill", label: "커피 내기", ringed: true)
                ForEach(openGatherings) { g in
                    Button {
                        Haptics.selection()
                        markViewed(g.id)
                        storyGathering = g
                    } label: {
                        StoryCircle(icon: storyIcon(g.kind), label: g.title,
                                    ringed: !viewedStoryIds.contains(g.id),
                                    imageURL: URL(string: g.imageURL))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func storyIcon(_ kind: GatheringKind) -> String {
        switch kind {
        case .flash: return "bolt.fill"
        case .coffee: return "cup.and.saucer.fill"
        case .gathering: return "calendar"
        }
    }
}

/// 인스타 스토리식 원형 버튼. ringed 면 그라데이션 링을 두른다.
private struct StoryCircle: View {
    let icon: String
    let label: String
    let ringed: Bool
    /// 모임 썸네일(AI 생성 또는 첨부). 없으면 아이콘으로 떨어진다.
    var imageURL: URL? = nil

    var body: some View {
        VStack(spacing: Theme.Space.x1) {
            ZStack {
                // 안 본 것은 무지개 링, 본 것은 회색 링 — 인스타와 같은 신호.
                Circle()
                    .strokeBorder(
                        ringed
                            ? AnyShapeStyle(AngularGradient(colors: [.purple, .pink, .orange, .yellow, .purple], center: .center))
                            : AnyShapeStyle(Theme.Palette.borderStrong),
                        lineWidth: 2.5
                    )
                    .frame(width: 68, height: 68)
                Circle()
                    .fill(Theme.Palette.tintNeutral)
                    .frame(width: 58, height: 58)
                    .overlay {
                        if let imageURL {
                            AsyncImage(url: imageURL) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Image(systemName: icon).font(.system(size: 22)).foregroundStyle(Theme.Palette.ink)
                            }
                            .frame(width: 58, height: 58)
                            .clipShape(Circle())
                        } else {
                            Image(systemName: icon).font(.system(size: 22)).foregroundStyle(Theme.Palette.ink)
                        }
                    }
            }
            Text(label).font(.caption).foregroundStyle(Theme.Palette.ink)
                .lineLimit(1).truncationMode(.tail).frame(width: 68)
        }
    }
}

