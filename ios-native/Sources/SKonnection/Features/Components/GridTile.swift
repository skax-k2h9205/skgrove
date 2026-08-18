import SwiftUI

/// 인스타식 정사각 타일 — 이미지가 있으면 사진 타일(+코너 글리프),
/// 없으면 색 타일(아이콘·제목·메타). 홈 피드와 유머/모임/장터/추억이 공유한다.
struct GridTile: View {
    var imageURL: URL? = nil
    let icon: String
    let title: String
    var meta: String? = nil
    var tint: Color = Theme.Palette.tintNeutral
    var ink: Color = Theme.Palette.ink
    /// 사진 타일 하단에 글쓴이+제목 캡션을 그라데이션으로 얹을지(시안 A · 유머 게시판용).
    var caption: (author: String, text: String)? = nil

    var body: some View {
        // GeometryReader 로 타일의 실제 크기를 잡아 이미지·캡션을 정확히 그 안에 가둔다.
        // (scaledToFill 이미지가 타일보다 커져 캡션이 밖으로 새는 문제 방지.)
        GeometryReader { geo in
            ZStack(alignment: .bottomLeading) {
                if let imageURL {
                    AsyncImage(url: imageURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Theme.Palette.surfaceDark
                    }
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                    .overlay(alignment: .topTrailing) { cornerIcon }
                } else {
                    plainTile.frame(width: geo.size.width, height: geo.size.height)
                }
                if let caption, imageURL != nil {
                    captionOverlay(caption).frame(width: geo.size.width)
                }
            }
        }
        .aspectRatio(9.0 / 16.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.sm))
        // 히트 영역을 타일 사각형으로 고정한다. scaledToFill 사진은 타일보다 옆으로 넓게 퍼지는데
        // clipShape 는 '그리기'만 자르고 터치는 그대로 둔다 — 그래서 넘친 부분이 옆 칸을 덮어
        // 옆 게시물이 열렸다. contentShape 가 없으면 이 그리드 전부에서 같은 증상이 난다.
        .contentShape(RoundedRectangle(cornerRadius: Theme.Radius.sm))
    }

    private var cornerIcon: some View {
        Image(systemName: icon)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .shadow(color: Theme.Palette.surfaceDark.opacity(0.6), radius: 2, y: 1)
            .padding(6)
    }

    /// 시안 A — 하단 그라데이션 위에 글쓴이(이니셜 원)·제목.
    private func captionOverlay(_ c: (author: String, text: String)) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                Circle().fill(Theme.Palette.primary)
                    .frame(width: 16, height: 16)
                    .overlay(Text(String(c.author.prefix(1)))
                        .font(.system(size: 9, weight: .bold)).foregroundStyle(.white))
                Text(c.author).font(.system(size: 11)).foregroundStyle(.white.opacity(0.9)).lineLimit(1)
                Spacer(minLength: 0)
            }
            Text(c.text)
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                .lineLimit(2).multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 8).padding(.bottom, 8).padding(.top, 28)
        .background(
            LinearGradient(colors: [.black.opacity(0), .black.opacity(0.55), .black.opacity(0.9)],
                           startPoint: .top, endPoint: .bottom)
        )
    }

    private var plainTile: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .regular))
                .foregroundStyle(ink)
            Text(title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(ink)
                .multilineTextAlignment(.center)
                .lineLimit(3)
            if let meta {
                Text(meta).font(.system(size: 10)).foregroundStyle(Theme.Palette.muted)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(tint)
    }
}

/// 3열 인스타 그리드 레이아웃(간격 3pt) — 여러 화면에서 재사용.
struct InstaGrid<Item: Identifiable, Tile: View>: View {
    let items: [Item]
    @ViewBuilder let tile: (Item) -> Tile
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 3) {
            ForEach(items) { tile($0) }
        }
    }
}
