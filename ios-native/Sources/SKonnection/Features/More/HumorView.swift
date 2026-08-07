import SwiftUI

private struct HumorPost: Identifiable {
    let id: String
    let author: String
    let date: String
    let body: String
    var laughs: Int
    var comments: Int
    var liked: Bool = false
}

/// 유머 게시판 — 가볍게 웃는 글을 모아 본다(웹 Humor 이식, 피드 리스트).
struct HumorView: View {
    @State private var posts: [HumorPost] = [
        .init(id: "1", author: "김영석", date: "2026-07-29",
              body: "연차 쓴 날 아침에 눈 번쩍 떠지는 사람 손 🙋 (나만 그런 거 아니지?)", laughs: 8, comments: 0),
        .init(id: "2", author: "이두민", date: "2026-07-28",
              body: "월급날 통장: 스쳐 지나가는 인연 👋 (짧고 굵었다)", laughs: 4, comments: 2),
        .init(id: "3", author: "김수정", date: "2026-07-27",
              body: "재택근무 복장 레벨: 상의 셔츠 / 하의 잠옷 🩳", laughs: 2, comments: 1),
    ]

    var body: some View {
        ScreenScaffold(title: "유머 게시판", showUserChip: false) {
            ForEach($posts) { $post in
                VStack(alignment: .leading, spacing: Theme.Space.x3) {
                    HStack(spacing: Theme.Space.x2) {
                        Avatar(name: post.author)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(post.author).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                            Text(post.date).font(.caption).foregroundStyle(Theme.Palette.muted)
                        }
                    }
                    Text(post.body).font(.body).foregroundStyle(Theme.Palette.ink)
                    HStack(spacing: Theme.Space.x4) {
                        Button {
                            post.liked.toggle()
                            post.laughs += post.liked ? 1 : -1
                            Haptics.light()
                        } label: {
                            Label("빵터짐 \(post.laughs)", systemImage: post.liked ? "face.smiling.fill" : "face.smiling")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(post.liked ? Theme.Palette.heart : Theme.Palette.muted)
                        }
                        Label("댓글 \(post.comments)", systemImage: "bubble.right")
                            .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                    }
                }
                .padding(Theme.Space.x4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
            }
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
