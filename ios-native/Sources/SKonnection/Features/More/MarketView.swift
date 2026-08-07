import SwiftUI

struct MarketItem: Identifiable {
    let id: String
    let title: String
    let owner: String
    let kind: String   // 나눔 / 판매 / 교환
    let price: String
}

/// 이음장터 — 인스타 3열 그리드. 타일 탭 시 상세 시트.
struct MarketView: View {
    @State private var filter = "거래중"
    private let filters = ["거래중", "나눔", "내가 올린 것", "전체"]
    @State private var items: [MarketItem] = [
        .init(id: "M1", title: "안 쓰는 기계식 키보드 나눔", owner: "김승현", kind: "나눔", price: "무료"),
        .init(id: "M2", title: "여분 모니터 받침대 판매", owner: "이두민", kind: "판매", price: "5,000원"),
        .init(id: "M3", title: "커피머신 교환해요", owner: "김수정", kind: "교환", price: "교환"),
        .init(id: "M4", title: "책상 정리대 나눔", owner: "이선민", kind: "나눔", price: "무료"),
    ]
    @State private var selected: MarketItem?

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

            InstaGrid(items: items) { item in
                Button { Haptics.selection(); selected = item } label: {
                    GridTile(icon: "shippingbox.fill", title: item.title, meta: item.price,
                             tint: item.kind == "나눔" ? Theme.Palette.tintSuccess : Theme.Palette.tintNeutral,
                             ink: item.kind == "나눔" ? Theme.Palette.tintSuccessInk : Theme.Palette.ink)
                }
                .buttonStyle(.plain)
            }
        }
        .sheet(item: $selected) { item in
            DetailSheet(title: item.kind, heading: item.title,
                        lines: ["\(item.owner) · \(item.kind)", "가격 \(item.price)"],
                        action: "대화 걸기")
        }
    }
}
