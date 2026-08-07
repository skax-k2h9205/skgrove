import SwiftUI

struct HumorPost: Identifiable {
    let id: String
    let author: String
    let date: String
    let body: String
    var laughs: Int
    var comments: Int
    var imageURL: URL?
    var liked: Bool = false
}

/// 유머 게시판 — 홈처럼 인스타 3열 그리드. 타일 탭 시 상세 시트. 글쓰기로 등록.
struct HumorView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var composing = false
    @State private var posts: [HumorPost] = [
        .init(id: "1", author: "김영석", date: "2026-07-29",
              body: "연차 쓴 날 아침에 눈 번쩍 떠지는 사람 손 🙋 (나만 그런 거 아니지?)", laughs: 8, comments: 0,
              imageURL: URL(string: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg")),
        .init(id: "2", author: "이두민", date: "2026-07-28", body: "월급날 통장: 스쳐 지나가는 인연 👋 (짧고 굵었다)", laughs: 4, comments: 2),
        .init(id: "3", author: "김수정", date: "2026-07-27", body: "재택근무 복장 레벨: 상의 셔츠 / 하의 잠옷 🩳", laughs: 2, comments: 1),
        .init(id: "4", author: "김승현", date: "2026-07-26", body: "오늘 배포 성공해서 기분 좋아 커피 쏩니다 ☕", laughs: 6, comments: 3),
        .init(id: "5", author: "이선민", date: "2026-07-25", body: "\"이번엔 진짜 일찍 잔다\" 하고 새벽 3시에 유튜브 보는 중", laughs: 1, comments: 0),
        .init(id: "6", author: "이두민", date: "2026-07-24", body: "월요일 아침의 나 vs 금요일 저녁의 나 😵", laughs: 4, comments: 1),
    ]
    @State private var selected: HumorPost?

    var body: some View {
        ScreenScaffold(title: "유머 게시판", showUserChip: false) {
            Button { composing = true } label: {
                Label("글쓰기", systemImage: "square.and.pencil").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)

            InstaGrid(items: posts) { post in
                Button { Haptics.selection(); selected = post } label: {
                    GridTile(imageURL: post.imageURL, icon: "face.smiling", title: post.body,
                             meta: "빵터짐 \(post.laughs)", tint: Theme.Palette.tintDanger, ink: Theme.Palette.danger)
                }
                .buttonStyle(.plain)
            }
        }
        .sheet(item: $selected) { post in
            HumorDetail(post: post) { toggleLike(post) }
        }
        .sheet(isPresented: $composing) {
            HumorComposeSheet { body, media in post(body: body, media: media) }
        }
    }

    private func post(body: String, media: String) {
        let text = body.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        let author = session.currentUser?.name ?? "익명"
        posts.insert(.init(id: UUID().uuidString, author: author, date: "방금", body: text,
                           laughs: 0, comments: 0, imageURL: thumbnail(from: media)), at: 0)
        Haptics.success()
    }

    /// 붙인 링크가 유튜브면 썸네일, 이미지 주소면 그대로. 아니면 없음(색 타일).
    private func thumbnail(from link: String) -> URL? {
        let s = link.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return nil }
        if let id = youtubeID(s) { return URL(string: "https://img.youtube.com/vi/\(id)/hqdefault.jpg") }
        if s.lowercased().hasSuffix(".jpg") || s.lowercased().hasSuffix(".png") || s.lowercased().hasSuffix(".jpeg") {
            return URL(string: s)
        }
        return nil
    }

    private func youtubeID(_ url: String) -> String? {
        for marker in ["v=", "youtu.be/", "/shorts/", "/embed/"] {
            if let r = url.range(of: marker) {
                let rest = url[r.upperBound...]
                let id = rest.prefix { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
                if id.count >= 6 { return String(id) }
            }
        }
        return nil
    }

    private func toggleLike(_ post: HumorPost) {
        guard let i = posts.firstIndex(where: { $0.id == post.id }) else { return }
        posts[i].liked.toggle()
        posts[i].laughs += posts[i].liked ? 1 : -1
        selected = posts[i]
        Haptics.light()
    }
}

private struct HumorDetail: View {
    let post: HumorPost
    let onLike: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    HStack(spacing: Theme.Space.x2) {
                        Avatar(name: post.author)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(post.author).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                            Text(post.date).font(.caption).foregroundStyle(Theme.Palette.muted)
                        }
                    }
                    if let url = post.imageURL {
                        AsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { Theme.Palette.sunken }
                            .frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
                    }
                    Text(post.body).font(.title3).foregroundStyle(Theme.Palette.ink)
                    HStack(spacing: Theme.Space.x4) {
                        Button(action: onLike) {
                            Label("빵터짐 \(post.laughs)", systemImage: post.liked ? "face.smiling.fill" : "face.smiling")
                                .foregroundStyle(post.liked ? Theme.Palette.heart : Theme.Palette.muted)
                        }
                        ShareLink(item: "[\(post.author)] \(post.body)") {
                            Label("공유", systemImage: "square.and.arrow.up").foregroundStyle(Theme.Palette.muted)
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                }
                .padding(Theme.Space.x4)
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("유머").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
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
