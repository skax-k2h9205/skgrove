import SwiftUI

/// 유머 게시판 — 명예의 전당 + 인스타 3열 그리드. 타일 탭 시 상세(좋아요·댓글). 웹 humor 이식.
struct HumorView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var store: HumorStore
    /// 작성 폼 표시 여부 — 홈 '말하기'에서도 열 수 있게 RootView 가 소유한다.
    @Binding var composing: Bool
    @State private var selected: HumorPost?
    @State private var reporting: ReportTarget?
    /// 삭제 확인 대상. 삭제는 되돌릴 수 없어 한 번 더 묻는다.
    @State private var deletingPost: String?
    @EnvironmentObject private var moderation: ModerationStore

    private var myName: String { session.currentUser?.name ?? "익명" }

    /// 차단한 사람의 글과 내가 신고해 숨긴 글은 즉시 사라진다(심사 지침 1.2).
    private var visiblePosts: [HumorPost] {
        store.posts.filter { !moderation.isHidden(.humorPost, id: $0.id, author: $0.author) }
    }

    var body: some View {
        // 당겨서 새로고침이 예전엔 0.6초 잠자기만 했다 — 웹에서 올라온 글이 앱을 껐다 켜기
        // 전까지 안 보였다(스토어는 init 에서 한 번만 동기화한다).
        ScreenScaffold(title: "유머 게시판", showUserChip: false,
                       onRefresh: { await store.syncFromRemote() },
                       onCompose: { composing = true }) {
            hallOfFame

            InstaGrid(items: visiblePosts) { post in
                Button { Haptics.selection(); selected = post } label: {
                    GridTile(imageURL: store.thumbnail(post), icon: "face.smiling", title: post.body,
                             meta: "빵터짐 \(post.laughs) · 댓글 \(store.commentCount(post.id))",
                             tint: Theme.Palette.tintDanger, ink: Theme.Palette.danger,
                             caption: (author: post.author, text: post.body))
                }
                .buttonStyle(.plain)
                .contextMenu {
                    ShareLink(item: "[\(post.author)] \(post.body)") { Label("공유", systemImage: "square.and.arrow.up") }
                    ModerationMenuItems(
                        target: ReportTarget(kind: .humorPost, targetId: post.id, author: post.author),
                        onReport: { reporting = $0 },
                        onDelete: { deletingPost = post.id })
                }
            }
        }
        .task { await store.syncFromRemote() }
        .sheet(item: $selected) { post in
            HumorDetail(postId: post.id)
        }
        .sheet(item: $reporting) { ReportSheet(target: $0) }
        .sheet(isPresented: $composing) {
            HumorComposeSheet { body, media in store.addPost(author: myName, body: body, mediaURL: media); Haptics.success() }
        }
        .confirmationDialog("이 글을 삭제할까요?",
                            isPresented: Binding(get: { deletingPost != nil },
                                                 set: { if !$0 { deletingPost = nil } }),
                            presenting: deletingPost) { id in
            Button("삭제", role: .destructive) {
                withAnimation(.snappy) { store.deletePost(id, by: myName) }
                Haptics.success()
            }
            Button("취소", role: .cancel) {}
        } message: { _ in
            Text("되돌릴 수 없어요. 이 글에 달린 댓글도 함께 사라집니다.")
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
/// 홈 피드에서도 바로 띄운다(탭 전환 없이 그 글로) — 그래서 private 이 아니다.
struct HumorDetail: View {
    let postId: String
    @EnvironmentObject private var store: HumorStore
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var moderation: ModerationStore
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""
    @State private var reporting: ReportTarget?
    @State private var filterWarning: String?
    /// 삭제 확인 대상(글 / 댓글). 되돌릴 수 없어 한 번 더 묻는다.
    @State private var confirmingPostDelete = false
    @State private var deletingComment: String?

    private var myName: String { session.currentUser?.name ?? "익명" }
    private var post: HumorPost? { store.posts.first { $0.id == postId } }

    /// 방금 신고·차단한 글을 상세에 그대로 띄워두면 "즉시 사라진다"는 약속과 어긋난다.
    private var hiddenNow: Bool {
        guard let post else { return false }
        return moderation.isHidden(.humorPost, id: post.id, author: post.author)
    }

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
                        // 예전엔 유튜브 썸네일 이미지 한 장만 그려서, 영상 글을 열어도 재생이 안 됐다.
                        if let media = store.media(post) { HumorMediaView(media: media) }
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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } }
                // 상세에는 눈에 보이는 신고 버튼을 둔다 — 길게 누르는 메뉴만으로는
                // 심사자가 신고 기능을 찾지 못한다.
                ToolbarItem(placement: .primaryAction) {
                    if let post {
                        ModerationToolbarMenu(
                            target: ReportTarget(kind: .humorPost, targetId: post.id, author: post.author),
                            onReport: { reporting = $0 },
                            onDelete: { confirmingPostDelete = true })
                    }
                }
            }
            .sheet(item: $reporting) { ReportSheet(target: $0) }
            .confirmationDialog("이 글을 삭제할까요?", isPresented: $confirmingPostDelete) {
                Button("삭제", role: .destructive) {
                    store.deletePost(postId, by: myName)
                    Haptics.success()
                    dismiss()   // 지운 글의 상세를 띄워둘 이유가 없다
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("되돌릴 수 없어요. 이 글에 달린 댓글도 함께 사라집니다.")
            }
            .confirmationDialog("이 댓글을 삭제할까요?",
                                isPresented: Binding(get: { deletingComment != nil },
                                                     set: { if !$0 { deletingComment = nil } }),
                                presenting: deletingComment) { id in
                Button("삭제", role: .destructive) {
                    withAnimation(.snappy) { store.deleteComment(id, by: myName) }
                    Haptics.success()
                }
                Button("취소", role: .cancel) {}
            } message: { _ in Text("되돌릴 수 없어요.") }
            .onChange(of: hiddenNow) { _, now in if now { dismiss() } }
            .safeAreaInset(edge: .bottom) { commentBar }
        }
    }

    private func commentsSection(_ post: HumorPost) -> some View {
        let list = store.comments(for: post.id)
            .filter { !moderation.isHidden(.humorComment, id: $0.id, author: $0.author) }
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
                    .contentShape(Rectangle())
                    .contextMenu {
                        ModerationMenuItems(
                            target: ReportTarget(kind: .humorComment, targetId: c.id, author: c.author),
                            onReport: { reporting = $0 },
                            onDelete: { deletingComment = c.id })
                    }
                }
            }
        }
    }

    private var commentBar: some View {
        VStack(spacing: Theme.Space.x2) {
            if let filterWarning { FilterWarning(message: filterWarning) }
            commentField
        }
        .padding(Theme.Space.x3)
        .background(.ultraThinMaterial)
    }

    private var commentField: some View {
        HStack(spacing: Theme.Space.x2) {
            TextField("댓글 달기…", text: $draft)
                .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.x2)
                .background(Theme.Palette.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.Palette.border))
            Button {
                // 명백한 욕설·비방은 등록 자체를 막는다(심사 지침 1.2 '콘텐츠 필터링').
                if let reason = ContentFilter.violation(in: draft) {
                    filterWarning = reason; Haptics.warning(); return
                }
                filterWarning = nil
                store.addComment(postId: postId, author: myName, content: draft)
                draft = ""; Haptics.success()
            } label: {
                Image(systemName: "paperplane.fill").foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(Theme.Palette.cta, in: Circle())
            }
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
        }
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
