import SwiftUI

/// 유머 게시판 — 명예의 전당 + 인스타 3열 그리드. 타일 탭 시 상세(좋아요·댓글). 웹 humor 이식.
struct HumorView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var store: HumorStore
    @State private var composing = false
    @State private var selected: HumorPost?

    private var myName: String { session.currentUser?.name ?? "익명" }

    var body: some View {
        ScreenScaffold(title: "유머 게시판", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            hallOfFame
            Button { composing = true } label: {
                Label("글쓰기", systemImage: "square.and.pencil").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)

            InstaGrid(items: store.posts) { post in
                Button { Haptics.selection(); selected = post } label: {
                    GridTile(imageURL: store.thumbnail(post), icon: "face.smiling", title: post.body,
                             meta: "빵터짐 \(post.laughs) · 댓글 \(store.commentCount(post.id))",
                             tint: Theme.Palette.tintDanger, ink: Theme.Palette.danger)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    ShareLink(item: "[\(post.author)] \(post.body)") { Label("공유", systemImage: "square.and.arrow.up") }
                    if post.author == myName {
                        Button(role: .destructive) {
                            withAnimation(.snappy) { store.deletePost(post.id) }
                        } label: { Label("삭제", systemImage: "trash") }
                    }
                }
            }
        }
        .sheet(item: $selected) { post in
            HumorDetail(postId: post.id)
        }
        .sheet(isPresented: $composing) {
            HumorComposeSheet { body, media in store.addPost(author: myName, body: body, mediaURL: media); Haptics.success() }
        }
    }

    /// 명예의 전당 — 글쓰기왕·댓글왕·빵터짐왕(월간). 세로 3줄로 한눈에(가로 스크롤 없음).
    private var hallOfFame: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Label("명예의 전당 · \(store.rankingMonth)", systemImage: "trophy.fill")
                .font(.subheadline.bold()).foregroundStyle(Theme.Palette.tintPrimaryInk)
            fameRow("글쓰기왕", "square.and.pencil", store.topPosters)
            fameRow("댓글왕", "text.bubble.fill", store.topCommenters)
            fameRow("빵터짐왕", "face.smiling.fill", store.topLiked)
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
    }

    /// 한 줄 = 카테고리 라벨 + 상위 3명(메달·이름). 수치는 생략해 한눈에 읽히게.
    private func fameRow(_ title: String, _ icon: String, _ rankers: [HumorRanker]) -> some View {
        HStack(alignment: .center, spacing: Theme.Space.x2) {
            Label(title, systemImage: icon)
                .font(.caption.bold()).foregroundStyle(Theme.Palette.primary)
                .frame(width: 88, alignment: .leading)
            if rankers.isEmpty {
                Text("아직 없어요").font(.caption2).foregroundStyle(Theme.Palette.muted)
            } else {
                HStack(spacing: Theme.Space.x3) {
                    ForEach(Array(rankers.enumerated()), id: \.element.id) { idx, r in
                        HStack(spacing: 3) {
                            Text(medal(idx)).font(.caption2)
                            Text(r.name).font(.caption.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                                .lineLimit(1)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, Theme.Space.x1)
        .padding(.horizontal, Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }

    private func medal(_ idx: Int) -> String {
        switch idx { case 0: return "🥇"; case 1: return "🥈"; default: return "🥉" }
    }
}

/// 유머 상세 — 본문·좋아요·댓글 목록·댓글 작성.
private struct HumorDetail: View {
    let postId: String
    @EnvironmentObject private var store: HumorStore
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""

    private var myName: String { session.currentUser?.name ?? "익명" }
    private var post: HumorPost? { store.posts.first { $0.id == postId } }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let post {
                    VStack(alignment: .leading, spacing: Theme.Space.x4) {
                        HStack(spacing: Theme.Space.x2) {
                            Avatar(name: post.author)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(post.author).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                                Text(post.createdAt).font(.caption).foregroundStyle(Theme.Palette.muted)
                            }
                        }
                        if let url = store.thumbnail(post) {
                            AsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { Theme.Palette.sunken }
                                .frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
                        }
                        Text(post.body).font(.title3).foregroundStyle(Theme.Palette.ink)
                        HStack(spacing: Theme.Space.x4) {
                            Button { store.toggleLike(post.id, by: myName); Haptics.light() } label: {
                                let liked = store.liked(post, by: myName)
                                Label("빵터짐 \(post.laughs)", systemImage: liked ? "face.smiling.fill" : "face.smiling")
                                    .foregroundStyle(liked ? Theme.Palette.heart : Theme.Palette.muted)
                            }
                            ShareLink(item: "[\(post.author)] \(post.body)") {
                                Label("공유", systemImage: "square.and.arrow.up").foregroundStyle(Theme.Palette.muted)
                            }
                        }
                        .font(.subheadline.weight(.semibold))

                        Divider().overlay(Theme.Palette.border)
                        commentsSection(post)
                    }
                    .padding(Theme.Space.x4)
                } else {
                    Text("글을 찾을 수 없어요.").foregroundStyle(Theme.Palette.muted).padding()
                }
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("유머").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
            .safeAreaInset(edge: .bottom) { commentBar }
        }
    }

    private func commentsSection(_ post: HumorPost) -> some View {
        let list = store.comments(for: post.id)
        return VStack(alignment: .leading, spacing: Theme.Space.x3) {
            Text("댓글 \(list.count)").font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
            if list.isEmpty {
                Text("첫 댓글을 남겨보세요.").font(.caption).foregroundStyle(Theme.Palette.muted)
            } else {
                ForEach(list) { c in
                    HStack(alignment: .top, spacing: Theme.Space.x2) {
                        Avatar(name: c.author, size: 28)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(c.author).font(.caption.bold()).foregroundStyle(Theme.Palette.ink)
                            Text(c.content).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                        }
                        Spacer()
                    }
                }
            }
        }
    }

    private var commentBar: some View {
        HStack(spacing: Theme.Space.x2) {
            TextField("댓글 달기…", text: $draft)
                .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.x2)
                .background(Theme.Palette.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.Palette.border))
            Button {
                store.addComment(postId: postId, author: myName, content: draft)
                draft = ""; Haptics.success()
            } label: {
                Image(systemName: "paperplane.fill").foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(Theme.Palette.cta, in: Circle())
            }
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(Theme.Space.x3)
        .background(.ultraThinMaterial)
    }
}

/// 이름 첫 글자를 담은 원형 아바타.
struct Avatar: View {
    let name: String
    var size: CGFloat = 36
    var body: some View {
        Circle().fill(Theme.Palette.primary)
            .frame(width: size, height: size)
            .overlay(Text(String(name.prefix(1))).font(.system(size: size * 0.42, weight: .bold)).foregroundStyle(.white))
    }
}
