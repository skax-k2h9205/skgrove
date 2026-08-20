import SwiftUI

// 유머게시판 모델(웹 humorRules.ts 이식). 글·댓글·좋아요 + 월간 명예의 전당(글쓰기왕·댓글왕·빵터짐왕).

struct HumorPost: Identifiable, Codable {
    let id: String
    var author: String
    var createdAt: String      // "yyyy-MM-dd"
    var body: String
    var likedBy: [String] = [] // 좋아요 누른 사람들(빵터짐왕 집계 근거)
    var mediaURL: String = ""  // 붙인 원본 링크
    var laughs: Int { likedBy.count }
}

struct HumorComment: Identifiable, Codable {
    let id: String
    let postId: String
    var author: String
    var content: String
    var createdAt: String      // "yyyy-MM-dd"
}

/// 명예의 전당 한 줄(이름·수치).
struct HumorRanker: Identifiable {
    var id: String { name }
    let name: String
    let count: Int
}

@MainActor
final class HumorStore: ObservableObject {
    private static let postsKey = "skonnection.humorPosts"
    private static let commentsKey = "skonnection.humorComments"

    @Published var posts: [HumorPost] { didSet { Persist.save(posts, Self.postsKey) } }
    @Published var comments: [HumorComment] { didSet { Persist.save(comments, Self.commentsKey) } }

    init() {
        posts = Persist.load(Self.postsKey, as: [HumorPost].self) ?? Self.seedPosts
        comments = Persist.load(Self.commentsKey, as: [HumorComment].self) ?? Self.seedComments
        Task { await syncFromRemote() }
    }

    /// 웹과 같은 Supabase 에서 글·댓글을 불러온다(실패 시 로컬 캐시 유지).
    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        async let p = try? Supabase.select("humor_posts", query: "select=*&order=created_at.desc", as: SupabaseHumorPostRow.self)
        async let c = try? Supabase.select("humor_comments", query: "select=*", as: SupabaseHumorCommentRow.self)
        if let rows = await p { posts = rows.map { $0.toPost() } }
        if let rows = await c { comments = rows.map { $0.toComment() } }
    }

    // MARK: 조회

    func comments(for postId: String) -> [HumorComment] {
        comments.filter { $0.postId == postId }.sorted { $0.createdAt < $1.createdAt }
    }
    func commentCount(_ postId: String) -> Int { comments.filter { $0.postId == postId }.count }
    func liked(_ post: HumorPost, by name: String) -> Bool { post.likedBy.contains(name) }

    // MARK: 액션

    func addPost(author: String, body: String, mediaURL: String) {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let id = "H-\(Int(Date().timeIntervalSince1970))-\(author)"
        let post = HumorPost(id: id, author: author, createdAt: Self.today(), body: text, mediaURL: mediaURL)
        posts.insert(post, at: 0)
        Task { try? await Supabase.insert("humor_posts",
            ["id": id, "author": author, "body": text, "media_url": mediaURL, "created_at": Self.today()]) }
    }

    func toggleLike(_ postId: String, by name: String) {
        guard let i = posts.firstIndex(where: { $0.id == postId }) else { return }
        if let j = posts[i].likedBy.firstIndex(of: name) { posts[i].likedBy.remove(at: j) }
        else { posts[i].likedBy.append(name) }
        let liked = posts[i].likedBy
        Task { try? await Supabase.patch("humor_posts", id: postId, ["liked_by": liked]) }
    }

    func addComment(postId: String, author: String, content: String) {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let id = "HC-\(Int(Date().timeIntervalSince1970))-\(comments.count)"
        comments.append(HumorComment(id: id, postId: postId, author: author, content: text, createdAt: Self.today()))
        Task { try? await Supabase.insert("humor_comments",
            ["id": id, "post_id": postId, "author": author, "body": text, "created_at": Self.today()]) }
    }

    /// 내 글 삭제. 예전엔 로컬 배열만 비워서 다음 동기화 때 그대로 되살아났다 —
    /// 지웠다고 믿은 글이 다시 보이는 건 안 지워지는 것보다 나쁘다.
    /// 작성자 본인만 지울 수 있고, 딸린 댓글도 함께 지운다.
    func deletePost(_ postId: String, by name: String) {
        guard let post = posts.first(where: { $0.id == postId }), post.author == name else { return }
        posts.removeAll { $0.id == postId }
        comments.removeAll { $0.postId == postId }
        Task {
            try? await Supabase.delete("humor_comments", query: "post_id=eq.\(postId)")
            try? await Supabase.delete("humor_posts", query: "id=eq.\(postId)")
        }
    }

    /// 내 댓글 삭제.
    func deleteComment(_ commentId: String, by name: String) {
        guard let c = comments.first(where: { $0.id == commentId }), c.author == name else { return }
        comments.removeAll { $0.id == commentId }
        Task { try? await Supabase.delete("humor_comments", query: "id=eq.\(commentId)") }
    }

    // MARK: 명예의 전당(월간, 웹 humorRules 이식)

    /// 데이터가 있는 가장 최근 달을 기준으로 랭킹(현재 달이 비면 지난 달이라도 보여준다).
    var rankingMonth: String {
        let months = Set(posts.map { String($0.createdAt.prefix(7)) })
        return months.max() ?? String(Self.today().prefix(7))
    }

    private func rank(_ counts: [String: Int], limit: Int = 3) -> [HumorRanker] {
        counts.filter { $0.value > 0 }
            .map { HumorRanker(name: $0.key, count: $0.value) }
            .sorted { $0.count != $1.count ? $0.count > $1.count : $0.name < $1.name }
            .prefix(limit).map { $0 }
    }

    /// 글쓰기왕 — 이번 달 글 수.
    var topPosters: [HumorRanker] {
        var c: [String: Int] = [:]
        posts.filter { $0.createdAt.hasPrefix(rankingMonth) }.forEach { c[$0.author, default: 0] += 1 }
        return rank(c)
    }
    /// 댓글왕 — 이번 달 댓글 수.
    var topCommenters: [HumorRanker] {
        var c: [String: Int] = [:]
        comments.filter { $0.createdAt.hasPrefix(rankingMonth) }.forEach { c[$0.author, default: 0] += 1 }
        return rank(c)
    }
    /// 빵터짐왕 — 이번 달 자기 글이 받은 좋아요 합.
    var topLiked: [HumorRanker] {
        var c: [String: Int] = [:]
        posts.filter { $0.createdAt.hasPrefix(rankingMonth) }.forEach { c[$0.author, default: 0] += $0.likedBy.count }
        return rank(c)
    }

    // MARK: 유튜브 썸네일

    /// 붙인 링크의 해석 결과. 판별 규칙은 HumorMedia 한 곳에만 둔다 —
    /// 썸네일용과 재생용 규칙이 갈라지면 "그림은 보이는데 재생은 안 되는" 글이 생긴다.
    func media(_ post: HumorPost) -> HumorMedia? { HumorMedia.resolve(post.mediaURL) }

    func thumbnail(_ post: HumorPost) -> URL? { media(post)?.thumbnail }

    private static func today() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }

    // MARK: 시드 — 현재 달(2026-08) 글로 명예의 전당이 채워지게 한다.

    private static let seedPosts: [HumorPost] = [
        .init(id: "H-1", author: "김영석", createdAt: "2026-08-06",
              body: "연차 쓴 날 아침에 눈 번쩍 떠지는 사람 손 🙋 (나만 그런 거 아니지?)",
              likedBy: ["김승현", "이두민", "김수정", "이선민", "김영석", "김수정2", "손지나", "박하나"],
              mediaURL: "https://youtu.be/dQw4w9WgXcQ"),
        .init(id: "H-2", author: "이두민", createdAt: "2026-08-05",
              body: "월급날 통장: 스쳐 지나가는 인연 👋 (짧고 굵었다)", likedBy: ["김승현", "이선민", "김영석", "손지나"]),
        .init(id: "H-3", author: "김수정", createdAt: "2026-08-04",
              body: "재택근무 복장 레벨: 상의 셔츠 / 하의 잠옷 🩳", likedBy: ["이두민", "김승현"]),
        .init(id: "H-4", author: "김영석", createdAt: "2026-08-03",
              body: "오늘 배포 성공해서 기분 좋아 커피 쏩니다 ☕", likedBy: ["김승현", "이두민", "김수정", "이선민", "손지나", "박하나"]),
        .init(id: "H-5", author: "이선민", createdAt: "2026-08-02",
              body: "\"이번엔 진짜 일찍 잔다\" 하고 새벽 3시에 유튜브 보는 중", likedBy: ["김수정"]),
        .init(id: "H-6", author: "이두민", createdAt: "2026-08-01",
              body: "월요일 아침의 나 vs 금요일 저녁의 나 😵", likedBy: ["김승현", "이선민"]),
    ]
    private static let seedComments: [HumorComment] = [
        .init(id: "HC-1", postId: "H-1", author: "이두민", content: "ㅋㅋㅋ 완전 공감", createdAt: "2026-08-06"),
        .init(id: "HC-2", postId: "H-1", author: "김수정", content: "저요 저요 🙋", createdAt: "2026-08-06"),
        .init(id: "HC-3", postId: "H-4", author: "김승현", content: "잘 먹었습니다!", createdAt: "2026-08-03"),
        .init(id: "HC-4", postId: "H-4", author: "이두민", content: "축하해요 🎉", createdAt: "2026-08-03"),
        .init(id: "HC-5", postId: "H-2", author: "김수정", content: "슬프다 진짜", createdAt: "2026-08-05"),
    ]
}

/// Supabase humor_posts / humor_comments 행 → iOS 매핑.
struct SupabaseHumorPostRow: Decodable {
    let id: String
    let author: String?
    let body: String?
    let media_url: String?
    let created_at: String?
    let liked_by: [String]?
    func toPost() -> HumorPost {
        HumorPost(id: id, author: author ?? "익명", createdAt: String((created_at ?? "").prefix(10)),
                  body: body ?? "", likedBy: liked_by ?? [], mediaURL: media_url ?? "")
    }
}
struct SupabaseHumorCommentRow: Decodable {
    let id: String
    let post_id: String
    let author: String?
    let body: String?
    let created_at: String?
    func toComment() -> HumorComment {
        HumorComment(id: id, postId: post_id, author: author ?? "익명", content: body ?? "",
                     createdAt: String((created_at ?? "").prefix(10)))
    }
}
