import SwiftUI

/// 홈 통합 피드(웹 Dashboard 이식). 스토리 줄 + 3열 인스타식 타일 그리드.
/// 공유 스토어(유머·장터·모임·안건·액션)에서 실데이터를 모아 섞어 보여준다.
struct HomeView: View {
    /// 피드 타일 탭 시 이동할 탭 인덱스를 상위에 알린다(상세가 없는 안건·액션용).
    var onOpen: (Int) -> Void = { _ in }
    /// '말하기'에서 고른 작성 대상을 상위에 알린다.
    var onCompose: (ComposeTarget) -> Void = { _ in }

    @EnvironmentObject private var humor: HumorStore
    @EnvironmentObject private var gatherings: GatheringStore
    @EnvironmentObject private var market: MarketStore
    @EnvironmentObject private var agendas: AgendaStore
    @EnvironmentObject private var actions: ActionStore
    @EnvironmentObject private var moderation: ModerationStore

    /// 스토리를 탭하면 탭 전환 없이 이 모임 상세를 바로 띄운다.
    @State private var storyGathering: Gathering?
    /// 인스타처럼 '본 스토리'를 기록한다 — 본 것은 트레이 뒤로 밀리고 링이 회색이 된다.
    /// 웹(localStorage skgrove:viewedStories)과 같은 규칙.
    @State private var viewedStoryIds: [String] = Persist.load(Self.viewedKey, as: [String].self) ?? []
    /// 피드에서 연 상세. 탭 전환 없이 그 글로 바로 들어간다.
    @State private var openHumorId: FeedTarget?
    @State private var openMarketId: FeedTarget?
    @State private var openGatheringId: FeedTarget?
    @State private var openAgendaId: FeedTarget?
    @State private var openActionId: FeedTarget?
    /// '말하기' 선택지 표시.
    @State private var pickingCompose = false

    private static let viewedKey = "skonnection.viewedStories" 

    /// 각 도메인에서 몇 개씩 뽑아 라운드로빈으로 섞은 통합 피드.
    ///
    /// 차단·신고 필터는 반드시 prefix **앞**에 건다. 뒤에 걸면 차단한 사람 글이
    /// 자리만 차지하고 사라져 피드가 텅 빈 것처럼 보인다.
    private var feed: [HomeFeedItem] {
        let h = humor.posts
            .filter { !moderation.isHidden(.humorPost, id: $0.id, author: $0.author) }
            .prefix(8).map {
            HomeFeedItem(id: "h:\($0.id)", refId: $0.id, kind: .humor, title: $0.body,
                         meta: "빵터짐 \($0.laughs)", imageURL: humor.thumbnail($0), author: $0.author)
        }
        let m = market.sorted
            .filter { !moderation.isHidden(.market, id: $0.id, author: $0.seller) }
            .prefix(6).map {
            HomeFeedItem(id: "m:\($0.id)", refId: $0.id, kind: .market, title: $0.title,
                         meta: market.status($0).rawValue, imageURL: URL(string: $0.imageURL), author: $0.seller)
        }
        // 번개·커피는 스토리 줄에서 다루니 피드에는 넣지 않는다 — 같은 걸 위아래로 두 번 보여주는 꼴이 된다.
        // 일반 모임은 지나고 나서도 기록으로 남아야 해서 피드에 그대로 둔다.
        let g = gatherings.gatherings
            .filter { $0.kind == .gathering }
            .filter { !moderation.isHidden(.gathering, id: $0.id, author: $0.host) }
            .prefix(6)
            .map {
                HomeFeedItem(id: "g:\($0.id)", refId: $0.id, kind: .gathering, title: $0.title,
                             meta: gatherings.status($0).rawValue, imageURL: URL(string: $0.imageURL), author: $0.host)
            }
        let a = agendas.agendas.prefix(4).map {
            HomeFeedItem(id: "a:\($0.id)", refId: $0.id, kind: .agenda, title: $0.title, meta: $0.status.rawValue)
        }
        let ac = actions.items.prefix(4).map {
            HomeFeedItem(id: "ac:\($0.id)", refId: $0.id, kind: .action, title: $0.title, meta: $0.status.rawValue)
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
                Button { Haptics.selection(); openFeedItem(item) } label: {
                    // 모임·장터·유머는 유머게시판처럼 글쓴이+내용 캡션을 얹는다(author 있는 항목).
                    GridTile(imageURL: item.imageURL, icon: item.kind.icon, title: item.title,
                             meta: item.meta, tint: item.kind.tint, ink: item.kind.ink,
                             caption: item.author.map { (author: $0, text: item.title) })
                }
                .buttonStyle(.plain)
            }
        }
        .sheet(item: $storyGathering) { g in GatheringDetailSheet(gatheringId: g.id) }
        .sheet(item: $openHumorId) { t in HumorDetail(postId: t.id) }
        .sheet(item: $openMarketId) { t in MarketDetailSheet(itemId: t.id) }
        .sheet(item: $openGatheringId) { t in GatheringDetailSheet(gatheringId: t.id) }
        .sheet(item: $openAgendaId) { t in AgendaDetailSheet(agendaId: t.id) }
        .sheet(item: $openActionId) { t in ActionDetailSheet(itemId: t.id) }
        // 확인 다이얼로그(confirmationDialog)는 "정말 하시겠어요?"를 묻는 자리다.
        // 만들기 메뉴로 쓰면 글자만 나열돼 무엇을 쓰는 자리인지 알 수 없다 →
        // 아이콘·설명이 있는 선택 시트로 바꾸고, 내용 높이만큼만 올라오게 한다.
        .sheet(isPresented: $pickingCompose) {
            ComposePicker { target in
                pickingCompose = false
                onCompose(target)
            }
            .presentationDetents([.height(430)])
            .presentationDragIndicator(.visible)
        }
    }

    /// 피드 타일 탭 — 그 글의 상세를 연다. 예전엔 탭만 바꿔 목록으로 떨어뜨렸다.
    private func openFeedItem(_ item: HomeFeedItem) {
        switch item.kind {
        case .humor: openHumorId = FeedTarget(id: item.refId)
        case .market: openMarketId = FeedTarget(id: item.refId)
        case .gathering: openGatheringId = FeedTarget(id: item.refId)
        case .agenda: openAgendaId = FeedTarget(id: item.refId)
        case .action: openActionId = FeedTarget(id: item.refId)
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

    /// 모집중인 모임 — 시작이 임박한 순. 스토리는 "지금 참여할 수 있는 것"만 담아야 의미가 있다.
    private var openGatherings: [Gathering] {
        let viewed = Set(viewedStoryIds)
        return gatherings.gatherings
            .filter { gatherings.status($0) == .open }
            .filter { !moderation.isHidden(.gathering, id: $0.id, author: $0.host) }
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

    /// '말하기'(작성 진입) + 모집중 모임들. 예전엔 고정 "커피 내기" 버튼이 스토리처럼 껴 있어
    /// 실제 커피 모임과 나란히 두 개로 보였다 — 스토리에는 진짜 모임만 둔다.
    private var storyRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: Theme.Space.x4) {
                Button {
                    Haptics.selection()
                    pickingCompose = true
                } label: {
                    StoryCircle(icon: "plus", label: "말하기", ringed: false)
                }
                .buttonStyle(.plain)
                ForEach(openGatherings) { g in
                    Button {
                        Haptics.selection()
                        markViewed(g.id)
                        storyGathering = g
                    } label: {
                        StoryCircle(icon: storyIcon(g.kind), label: storyLabel(g),
                                    ringed: !viewedStoryIds.contains(g.id),
                                    imageURL: URL(string: g.imageURL))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    /// 누가 연 모임인지가 참여 결정을 좌우한다 — 제목만으로는 "커피 내기"가 다 똑같아 보인다.
    private func storyLabel(_ g: Gathering) -> String {
        g.host.isEmpty ? g.title : "\(g.title)(\(g.host))"
    }

    private func storyIcon(_ kind: GatheringKind) -> String {
        switch kind {
        case .flash: return "bolt.fill"
        case .coffee: return "cup.and.saucer.fill"
        case .gathering: return "calendar"
        }
    }
}

/// `.sheet(item:)` 은 Identifiable 을 요구한다 — String 을 전역 확장하는 대신 감싼다.
private struct FeedTarget: Identifiable { let id: String }

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
            // 제목(주최자) 라 한 줄로는 잘린다. 두 줄까지 허용해 주최자가 보이게 한다.
            Text(label).font(.caption).foregroundStyle(Theme.Palette.ink)
                .lineLimit(2).multilineTextAlignment(.center)
                .truncationMode(.tail).frame(width: 76)
        }
    }
}

/// '말하기' 선택 시트 — 어디에 쓸지 고르는 자리.
/// 아이콘·한 줄 설명을 함께 보여줘서 "유머와 대나무숲 접수가 뭐가 다른지"를 눌러보기 전에 안다.
private struct ComposePicker: View {
    let onPick: (ComposeTarget) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            VStack(alignment: .leading, spacing: 4) {
                Text("무엇을 말할까요?").font(.title3.weight(.bold)).foregroundStyle(Theme.Palette.ink)
                Text("고르면 바로 쓸 수 있어요").font(.subheadline).foregroundStyle(Theme.Palette.muted)
            }
            .padding(.top, Theme.Space.x5)

            VStack(spacing: Theme.Space.x2) {
                ForEach(ComposeTarget.allCases) { target in
                    Button { onPick(target) } label: { row(target) }
                        .buttonStyle(.plain)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.sunken)
    }

    private func row(_ target: ComposeTarget) -> some View {
        HStack(spacing: Theme.Space.x3) {
            Image(systemName: target.icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(target.ink)
                .frame(width: 44, height: 44)
                .background(target.tint, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            VStack(alignment: .leading, spacing: 2) {
                Text(target.label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                Text(target.desc).font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                .foregroundStyle(Theme.Palette.muted)
        }
        .padding(Theme.Space.x3)
        // 행 전체가 눌리게 한다 — 글자 옆 빈 곳을 눌러도 반응해야 자연스럽다.
        .contentShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }
}
