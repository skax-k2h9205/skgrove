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
        let id = "H-\(posts.count + 1)-\(author)"
        posts.insert(HumorPost(id: id, author: author, createdAt: Self.today(), body: text, mediaURL: mediaURL), at: 0)
    }

    func toggleLike(_ postId: String, by name: String) {
        guard let i = posts.firstIndex(where: { $0.id == postId }) else { return }
        if let j = posts[i].likedBy.firstIndex(of: name) { posts[i].likedBy.remove(at: j) }
        else { posts[i].likedBy.append(name) }
    }

    func addComment(postId: String, author: String, content: String) {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let id = "HC-\(comments.count + 1)"
        comments.append(HumorComment(id: id, postId: postId, author: author, content: text, createdAt: Self.today()))
    }

    func deletePost(_ postId: String) {
        posts.removeAll { $0.id == postId }
        comments.removeAll { $0.postId == postId }
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

    func thumbnail(_ post: HumorPost) -> URL? {
        let s = post.mediaURL.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return nil }
        if let id = Self.youtubeID(s) { return URL(string: "https://img.youtube.com/vi/\(id)/hqdefault.jpg") }
        let lower = s.lowercased()
        if lower.hasSuffix(".jpg") || lower.hasSuffix(".jpeg") || lower.hasSuffix(".png") || lower.hasSuffix(".webp") {
            return URL(string: s)
        }
        return nil
    }

    private static func youtubeID(_ url: String) -> String? {
        for marker in ["v=", "youtu.be/", "/shorts/", "/embed/"] {
            if let r = url.range(of: marker) {
                let id = url[r.upperBound...].prefix { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
                if id.count >= 6 { return String(id) }
            }
        }
        return nil
    }

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
