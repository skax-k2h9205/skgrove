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
        // 셀 크기를 '열 너비 × (16/9 높이)'로 먼저 확정(Color.clear + fit)한 뒤 콘텐츠를 채운다.
        // 이렇게 해야 이미지가 열 너비를 넘어 옆 칸으로 흘러넘치지 않는다.
        Color.clear
            .aspectRatio(9.0 / 16.0, contentMode: .fit)
            .overlay { content }
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.sm))
    }

    @ViewBuilder private var content: some View {
        if let imageURL { imageTile(imageURL) } else { plainTile }
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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

/// 홈 스토리 서클과 같은 상단 "+" 작성 버튼(유머·모임·장터·미팅 공용).
/// 큰 풀폭 버튼 대신 인스타처럼 원형 + 아이콘 + 라벨로 통일한다.
struct ComposeStoryButton: View {
    var icon: String = "plus"
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Theme.Space.x1) {
                Circle()
                    .fill(Theme.Palette.tintPrimary)
                    .frame(width: 58, height: 58)
                    .overlay(Circle().stroke(Theme.Palette.cta.opacity(0.35), lineWidth: 1.5))
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(Theme.Palette.cta)
                    )
                Text(label).font(.caption).foregroundStyle(Theme.Palette.ink)
            }
        }
        .buttonStyle(.plain)
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
