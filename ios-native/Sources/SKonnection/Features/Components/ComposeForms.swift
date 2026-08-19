import SwiftUI

// 유머·모임·장터의 작성 폼 — 웹 폼과 같은 필드 구성으로 맞춘다.

/// 라벨 + 컨트롤 한 줄.
struct FormRow<Content: View>: View {
    let label: String
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            content()
        }
    }
}

/// 폼 공용 텍스트 입력(한 줄 또는 여러 줄).
struct FormField: View {
    @Binding var text: String
    let placeholder: String
    var lines: Int = 1
    var keyboard: UIKeyboardType = .default
    var body: some View {
        TextField(placeholder, text: $text, axis: lines > 1 ? .vertical : .horizontal)
            .lineLimit(lines > 1 ? lines...(lines + 4) : 1...1)
            .keyboardType(keyboard)
            .padding(Theme.Space.x3)
            .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }
}

/// 폼 시트 뼈대 — 스크롤 + 등록/닫기 툴바.
///
/// 금칙어 검사도 여기서 한다. 폼마다 따로 걸면 새 폼이 생길 때마다 빠뜨리고,
/// 심사 지침 1.2 의 '콘텐츠 필터링'은 **사용자가 글을 쓰는 모든 경로**에 있어야 한다.
/// `moderated` 로 검사할 텍스트를 넘기면 위반 시 등록을 막고 이유를 보여준다.
struct FormSheet<Content: View>: View {
    let title: String
    let action: String
    let canSubmit: Bool
    let onSubmit: () -> Void
    /// 검사 대상 텍스트(제목·본문 등을 이어붙여 넘긴다). 비우면 검사하지 않는다.
    var moderated: () -> String = { "" }
    @ViewBuilder var content: () -> Content
    @Environment(\.dismiss) private var dismiss
    @State private var warning: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    if let warning { FilterWarning(message: warning) }
                    content()
                }
                .padding(Theme.Space.x4)
            }
            .background(Theme.Palette.sunken)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action) { submit() }.disabled(!canSubmit)
                }
            }
        }
    }

    private func submit() {
        if let reason = ContentFilter.violation(in: moderated()) {
            withAnimation(.snappy) { warning = reason }
            Haptics.warning()
            return
        }
        warning = nil
        onSubmit()
        dismiss()
    }
}

// MARK: - 유머 글쓰기 (내용 + 이미지·영상 링크)

struct HumorComposeSheet: View {
    let onCreate: (_ body: String, _ mediaLink: String) -> Void
    @State private var body_ = ""
    @State private var media = ""

    var body: some View {
        FormSheet(title: "유머 글쓰기", action: "등록",
                  canSubmit: !body_.trimmingCharacters(in: .whitespaces).isEmpty,
                  onSubmit: { onCreate(body_, media) },
                  moderated: { body_ }) {
            FormRow(label: "내용") { FormField(text: $body_, placeholder: "웃긴 이야기를 남겨보세요", lines: 4) }
            FormRow(label: "이미지 · 영상 링크 (선택)") {
                FormField(text: $media, placeholder: "이미지 주소나 유튜브 링크", keyboard: .URL)
            }
        }
    }
}

// MARK: - 모임 열기 (종류: 모임/번개/커피 — 종류별 입력이 다르다)

struct GatheringComposeSheet: View {
    /// 커피는 제목·시각을 자동으로 채우므로 nil 로 넘긴다(호출부가 기본값 적용).
    let onCreate: (_ kind: String, _ title: String, _ startAt: Date, _ place: String, _ capacity: Int, _ desc: String) -> Void
    @State private var kind = "번개"
    @State private var title = ""
    @State private var startAt = Date().addingTimeInterval(3600)
    @State private var place = ""
    @State private var capacity = 6
    @State private var desc = ""

    private var isCoffee: Bool { kind == "커피" }

    // 커피는 제목이 자동이라 항상 제출 가능. 나머지는 제목 필요.
    private var canSubmit: Bool { isCoffee || !title.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        FormSheet(title: "모임 열기", action: "열기", canSubmit: canSubmit, onSubmit: submit,
                  moderated: { "\(title) \(desc)" }) {
            FormRow(label: "종류") {
                Picker("종류", selection: $kind) {
                    Text("모임").tag("모임"); Text("번개").tag("번개"); Text("커피").tag("커피")
                }
                .pickerStyle(.segmented)
            }

            if isCoffee {
                // 커피 내기 — 제목·시각 없이 바로 연다. 뽑기로 커피 담당을 정하는 자리.
                HStack(spacing: Theme.Space.x2) {
                    Image(systemName: "cup.and.saucer.fill").foregroundStyle(Theme.Palette.primary)
                    Text("제목·시각은 자동이에요. 참여자 중에서 커피 담당을 뽑아요.")
                        .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
                }
                .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                FormRow(label: "정원") { Stepper("\(capacity)명", value: $capacity, in: 2...50) }
            } else {
                FormRow(label: "제목") {
                    FormField(text: $title, placeholder: kind == "번개" ? "오늘 뭐하고 놀까요?" : "무엇을 하는 자리인가요?")
                }
                FormRow(label: "일시") {
                    DatePicker("", selection: $startAt, displayedComponents: [.date, .hourAndMinute])
                        .labelsHidden().frame(maxWidth: .infinity, alignment: .leading)
                }
                FormRow(label: "장소") { FormField(text: $place, placeholder: "장소 (온라인이면 링크)") }
                FormRow(label: "정원") { Stepper("\(capacity)명", value: $capacity, in: 2...50) }
                FormRow(label: "설명 (선택)") { FormField(text: $desc, placeholder: "어떤 자리인지 소개해 주세요", lines: 3) }
            }
        }
    }

    /// 커피 내기 모집 시간. 지금으로 열면 만들자마자 '시작됨'이 되어 아무도 신청하지 못하고
    /// (join 가드) 뽑기 후보도 안 모여 뽑기가 영영 불가능했다. 모집 창을 줘야 흐름이 산다.
    private static let coffeeWindow: TimeInterval = 10 * 60

    private func submit() {
        if isCoffee {
            onCreate("커피", "커피 내기 ☕", Date().addingTimeInterval(Self.coffeeWindow), "탕비실", capacity, "")
        } else {
            onCreate(kind, title, startAt, place, capacity, desc)
        }
    }
}

// MARK: - 물건 내놓기 (종류·제목·설명·장소·시작가·마감)

struct MarketComposeSheet: View {
    let onCreate: (_ kind: String, _ title: String, _ desc: String, _ place: String,
                   _ startPrice: Int, _ minStep: Int, _ closeAt: Date) -> Void
    @State private var kind = "나눔"
    @State private var title = ""
    @State private var desc = ""
    @State private var place = ""
    @State private var priceText = ""
    @State private var minStep = 1000       // 입찰 단위(웹처럼 등록 시 선택)
    @State private var closeAt = Date().addingTimeInterval(3 * 24 * 3600)

    private var isAuction: Bool { kind == "경매" }
    private let steps = [1000, 5000, 10000, 50000]

    var body: some View {
        FormSheet(title: "물건 내놓기", action: "올리기",
                  canSubmit: !title.trimmingCharacters(in: .whitespaces).isEmpty,
                  onSubmit: {
                      let price = Int(priceText.filter(\.isNumber)) ?? 0
                      onCreate(kind, title, desc, place, isAuction ? price : 0, minStep, closeAt)
                  },
                  moderated: { "\(title) \(desc)" }) {
            FormRow(label: "종류") {
                Picker("종류", selection: $kind) { Text("나눔").tag("나눔"); Text("경매").tag("경매") }
                    .pickerStyle(.segmented)
            }
            FormRow(label: "제목") { FormField(text: $title, placeholder: "무엇을 내놓나요?") }
            FormRow(label: "설명 (선택)") { FormField(text: $desc, placeholder: "상태·사용 기간 등을 적어 주세요", lines: 3) }
            FormRow(label: "거래 장소") { FormField(text: $place, placeholder: "예: 3층 탕비실") }
            if isAuction {
                FormRow(label: "시작가") { FormField(text: $priceText, placeholder: "숫자만 (원)", keyboard: .numberPad) }
                FormRow(label: "입찰 단위") {
                    Picker("입찰 단위", selection: $minStep) {
                        ForEach(steps, id: \.self) { Text("\($0.formatted())원").tag($0) }
                    }.pickerStyle(.segmented)
                }
            }
            FormRow(label: "마감") {
                DatePicker("", selection: $closeAt, displayedComponents: [.date, .hourAndMinute])
                    .labelsHidden().frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
