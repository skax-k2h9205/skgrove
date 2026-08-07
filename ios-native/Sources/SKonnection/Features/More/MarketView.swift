import SwiftUI

private struct MarketItem: Identifiable {
    let id: String
    let title: String
    let owner: String
    let kind: String   // 나눔 / 판매 / 교환
    let price: String
}

/// 이음장터 — 안 쓰는 물건을 나누고 거래한다(웹 Market 이식).
struct MarketView: View {
    @State private var filter = "거래중"
    private let filters = ["거래중", "나눔", "내가 올린 것", "전체"]
    @State private var items: [MarketItem] = [
        .init(id: "M1", title: "안 쓰는 기계식 키보드 나눔", owner: "김승현", kind: "나눔", price: "무료"),
        .init(id: "M2", title: "여분 모니터 받침대 판매", owner: "이두민", kind: "판매", price: "5,000원"),
    ]

    var body: some View {
        ScreenScaffold(title: "이음장터", showUserChip: false) {
            HStack(spacing: Theme.Space.x2) {
                Image(systemName: "trophy.fill").foregroundStyle(Theme.Palette.primary)
                Text("이음장터 명예의 전당 — 첫 거래의 주인공이 되어보세요.")
                    .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
            }
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))

            ChipRow(items: filters, selection: $filter)

            Button {} label: {
                Label("물건 내놓기", systemImage: "plus").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)

            ForEach(items) { item in
                HStack(spacing: Theme.Space.x3) {
                    RoundedRectangle(cornerRadius: Theme.Radius.md).fill(Theme.Palette.tintNeutral)
                        .frame(width: 56, height: 56)
                        .overlay(Image(systemName: "shippingbox").foregroundStyle(Theme.Palette.muted))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                        Text("\(item.owner) · \(item.kind)").font(.caption).foregroundStyle(Theme.Palette.muted)
                    }
                    Spacer()
                    Text(item.price).font(.subheadline.weight(.bold)).foregroundStyle(Theme.Palette.primary)
                }
                .padding(Theme.Space.x3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
            }
        }
    }
}
