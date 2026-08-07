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

    var body: some View {
        Group {
            if let imageURL {
                imageTile(imageURL)
            } else {
                plainTile
            }
        }
        .aspectRatio(1, contentMode: .fill)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.sm))
    }

    private func imageTile(_ url: URL) -> some View {
        ZStack(alignment: .topTrailing) {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Theme.Palette.surfaceDark
            }
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .shadow(color: Theme.Palette.surfaceDark.opacity(0.6), radius: 2, y: 1)
                .padding(6)
        }
        .clipped()
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
