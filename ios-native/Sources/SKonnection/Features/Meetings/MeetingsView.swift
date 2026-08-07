import SwiftUI

/// 캔미팅 / 티미팅 — 두 탭. 캔미팅은 단계별 의견수집·선정 라이프사이클, 티미팅은 세션 공유(웹 meetings 이식).
struct MeetingsView: View {
    @EnvironmentObject private var store: MeetingStore
    @EnvironmentObject private var session: SessionStore
    @State private var tab = "캔미팅"
    @State private var composingCan = false
    @State private var composingTea = false

    var body: some View {
        ScreenScaffold(title: "캔미팅 / 티미팅", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            Picker("보기", selection: $tab) {
                Text("캔미팅").tag("캔미팅"); Text("티미팅").tag("티미팅")
            }
            .pickerStyle(.segmented)

            if tab == "캔미팅" {
                Button { composingCan = true } label: {
                    Label("캔미팅 열기", systemImage: "plus").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                ForEach(store.cans) { can in
                    NavigationLink { CanDetailView(sessionId: can.id) } label: {
                        CanCard(session: can, counts: store.counts(for: can.id))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Button { composingTea = true } label: {
                    Label("티미팅 제안", systemImage: "plus").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                ForEach(store.teas) { tea in
                    TeaCard(session: tea) { store.advanceTea(tea.id); Haptics.success() }
                }
            }
        }
        .sheet(isPresented: $composingCan) {
            CanComposeSheet { title, part in
                store.createCan(title: title, part: part, date: Self.today())
                Haptics.success()
            }
        }
        .sheet(isPresented: $composingTea) {
            TeaComposeSheet(defaultPresenter: session.currentUser?.name ?? "") { title, type, presenter, part, heldAt in
                store.createTea(title: title, type: type, presenter: presenter, part: part, heldAt: heldAt)
                Haptics.success()
            }
        }
    }

    private static func today() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }
}

// MARK: - 캔미팅 상세(라이프사이클)

/// 캔미팅 상세 — 단계 진행 + 3-Step 의견 수집 + 선정 + 결과.
private struct CanDetailView: View {
    let sessionId: String
    @EnvironmentObject private var store: MeetingStore
    @EnvironmentObject private var session: SessionStore
    @State private var composingStep: CanStep?

    private var can: CanSession? { store.cans.first { $0.id == sessionId } }

    var body: some View {
        ScrollView {
            if let can {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    header(can)
                    stageBar(can)
                    stageAction(can)
                    ForEach(CanStep.allCases, id: \.self) { step in
                        stepSection(can, step)
                    }
                    if can.stage == .summary { summarySection(can) }
                }
                .padding(Theme.Space.x4)
            } else {
                Text("세션을 찾을 수 없어요.").foregroundStyle(Theme.Palette.muted).padding()
            }
        }
        .background(Theme.Palette.sunken)
        .navigationTitle("캔미팅").navigationBarTitleDisplayMode(.inline)
        .sheet(item: $composingStep) { step in
            OpinionComposeSheet(step: step) { content in
                store.addOpinion(sessionId: sessionId, step: step, content: content,
                                 author: session.currentUser?.name ?? "익명")
                Haptics.success()
            }
        }
    }

    private func header(_ can: CanSession) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x1) {
            Text(can.title).font(.title3.bold()).foregroundStyle(Theme.Palette.ink)
            Text("\(can.part) · \(can.date)").font(.caption).foregroundStyle(Theme.Palette.muted)
        }
    }

    /// 단계 진행 막대 + 현재 단계 뱃지.
    private func stageBar(_ can: CanSession) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack(spacing: Theme.Space.x2) {
                ForEach(Array(CanStage.allCases.enumerated()), id: \.offset) { idx, stage in
                    Circle().fill(idx <= can.stage.index ? Theme.Palette.primary : Theme.Palette.border)
                        .frame(width: 10, height: 10)
                    if idx < CanStage.allCases.count - 1 {
                        Rectangle().fill(idx < can.stage.index ? Theme.Palette.primary : Theme.Palette.border)
                            .frame(height: 2).frame(maxWidth: .infinity)
                    }
                }
            }
            HStack {
                ForEach(CanStage.allCases, id: \.self) { stage in
                    Text(stage.rawValue).font(.caption2)
                        .foregroundStyle(stage == can.stage ? Theme.Palette.primary : Theme.Palette.muted)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(Theme.Space.x3)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    /// 다음 단계로 넘기는 버튼(결과 단계면 완료 안내).
    @ViewBuilder
    private func stageAction(_ can: CanSession) -> some View {
        if let next = can.stage.next {
            Button { store.advance(can.id); Haptics.success() } label: {
                Label("\(next.rawValue) 단계로", systemImage: "arrow.right.circle.fill")
                    .font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
        } else {
            Label("모든 단계를 마쳤어요", systemImage: "checkmark.seal.fill")
                .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.tintSuccessInk)
                .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                .background(Theme.Palette.tintSuccess, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        }
    }

    /// Step별 의견 묶음. 수집 단계에서는 추가, 선정 단계에서는 탭으로 선정.
    private func stepSection(_ can: CanSession, _ step: CanStep) -> some View {
        let items = store.opinions(for: can.id, step: step)
        return VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(step.label).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                    Text(step.hint).font(.caption2).foregroundStyle(Theme.Palette.muted)
                }
                Spacer()
                if can.stage == .collect {
                    Button { composingStep = step } label: { Image(systemName: "plus.circle.fill") }
                        .tint(Theme.Palette.cta)
                }
            }
            if items.isEmpty {
                Text("아직 의견이 없어요.").font(.caption).foregroundStyle(Theme.Palette.muted)
                    .padding(.vertical, Theme.Space.x1)
            } else {
                ForEach(items) { op in opinionRow(can, op) }
            }
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    private func opinionRow(_ can: CanSession, _ op: CanOpinion) -> some View {
        let selectable = can.stage == .select
        return Button {
            if selectable { store.toggleSelect(op.id); Haptics.selection() }
        } label: {
            HStack(alignment: .top, spacing: Theme.Space.x2) {
                Image(systemName: op.selected ? "checkmark.circle.fill" : (selectable ? "circle" : "circle.fill"))
                    .font(op.selected || selectable ? .body : .caption2)
                    .foregroundStyle(op.selected ? Theme.Palette.success : (selectable ? Theme.Palette.muted : Theme.Palette.border))
                VStack(alignment: .leading, spacing: 1) {
                    Text(op.content).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(op.author).font(.caption2).foregroundStyle(Theme.Palette.muted)
                }
            }
            .padding(Theme.Space.x2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(op.selected ? Theme.Palette.tintSuccess : Theme.Palette.sunken,
                        in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        }
        .buttonStyle(.plain)
        .disabled(!selectable)
    }

    /// 결과 단계 — 선정된 의견만 모아 보여준다.
    private func summarySection(_ can: CanSession) -> some View {
        let picked = store.opinions(for: can.id).filter { $0.selected }
        return VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Label("선정된 실천 과제 \(picked.count)건", systemImage: "star.fill")
                .font(.subheadline.bold()).foregroundStyle(Theme.Palette.tintSuccessInk)
            if picked.isEmpty {
                Text("선정된 의견이 없어요. 선정 단계에서 골라주세요.")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
            } else {
                ForEach(picked) { op in
                    HStack(spacing: Theme.Space.x2) {
                        Image(systemName: "checkmark.seal.fill").foregroundStyle(Theme.Palette.success)
                        Text(op.content).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                        Spacer()
                        Text(op.step.rawValue).font(.caption2).foregroundStyle(Theme.Palette.muted)
                    }
                }
            }
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintSuccess.opacity(0.5), in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
    }
}

// MARK: - 카드

private struct CanCard: View {
    let session: CanSession
    let counts: (opinions: Int, selected: Int)
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack {
                Image(systemName: "dot.radiowaves.left.and.right").foregroundStyle(Theme.Palette.primary)
                Text(session.title).font(.headline).foregroundStyle(Theme.Palette.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                StatusBadge(text: session.stage.rawValue, tint: session.stage.tint, ink: session.stage.ink)
            }
            Text("\(session.part) · \(session.date)").font(.caption).foregroundStyle(Theme.Palette.muted)
            HStack(spacing: Theme.Space.x2) {
                ForEach(Array(CanStage.allCases.enumerated()), id: \.offset) { idx, _ in
                    Circle()
                        .fill(idx <= session.stage.index ? Theme.Palette.primary : Theme.Palette.border)
                        .frame(width: 8, height: 8)
                    if idx < CanStage.allCases.count - 1 {
                        Rectangle().fill(idx < session.stage.index ? Theme.Palette.primary : Theme.Palette.border)
                            .frame(height: 2).frame(maxWidth: .infinity)
                    }
                }
            }
            HStack {
                Text("의견 \(counts.opinions) · 선정 \(counts.selected)").font(.caption).foregroundStyle(Theme.Palette.muted)
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.Palette.border)
            }
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}

private struct TeaCard: View {
    let session: TeaSession
    let onAdvance: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack(spacing: Theme.Space.x3) {
                RoundedRectangle(cornerRadius: Theme.Radius.md).fill(Theme.Palette.tintPrimary)
                    .frame(width: 52, height: 52)
                    .overlay(Image(systemName: "cup.and.saucer.fill").foregroundStyle(Theme.Palette.primary))
                VStack(alignment: .leading, spacing: 3) {
                    Text(session.title).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                    Text("\(session.type) · \(session.presenter)\(session.heldAt.isEmpty ? "" : " · \(session.heldAt)")")
                        .font(.caption).foregroundStyle(Theme.Palette.muted)
                }
                Spacer()
                StatusBadge(text: session.status.rawValue, tint: session.status.tint, ink: session.status.ink)
            }
            if let next = session.status.next {
                Button(action: onAdvance) {
                    Label("\(next.rawValue)(으)로", systemImage: "arrow.right.circle")
                        .font(.caption.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x1)
                }
                .buttonStyle(.bordered).tint(Theme.Palette.cta)
            }
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}

// MARK: - 작성 시트

private struct OpinionComposeSheet: View {
    let step: CanStep
    let onSubmit: (String) -> Void
    @State private var text = ""
    @Environment(\.dismiss) private var dismiss
    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(step.label).font(.headline).foregroundStyle(Theme.Palette.ink)
                    Text(step.hint).font(.caption).foregroundStyle(Theme.Palette.muted)
                }
                TextField("의견을 적어주세요", text: $text, axis: .vertical)
                    .lineLimit(3...6).padding(Theme.Space.x3)
                    .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
                Button { onSubmit(trimmed); dismiss() } label: {
                    Text("의견 추가").font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta).disabled(trimmed.isEmpty)
                Spacer()
            }
            .padding(Theme.Space.x4).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.sunken)
            .navigationTitle("의견 수집").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }
}

private struct CanComposeSheet: View {
    let onCreate: (String, String) -> Void
    @State private var title = ""
    @State private var part = ""
    @Environment(\.dismiss) private var dismiss
    private var valid: Bool { !title.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                field("주제", $title, "무엇을 논의하나요?")
                field("파트", $part, "예: AI ITS혁신팀")
                Button {
                    onCreate(title.trimmingCharacters(in: .whitespaces),
                             part.trimmingCharacters(in: .whitespaces)); dismiss()
                } label: {
                    Text("캔미팅 열기").font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta).disabled(!valid)
                Spacer()
            }
            .padding(Theme.Space.x4).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.sunken)
            .navigationTitle("캔미팅 열기").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }

    private func field(_ label: String, _ text: Binding<String>, _ ph: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            TextField(ph, text: text).padding(Theme.Space.x3)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
        }
    }
}

private struct TeaComposeSheet: View {
    let defaultPresenter: String
    let onCreate: (String, String, String, String, String) -> Void
    @State private var title = ""
    @State private var type = "기술세미나"
    @State private var presenter: String
    @State private var part = ""
    @State private var heldAt = ""
    @Environment(\.dismiss) private var dismiss
    private let types = ["기술세미나", "여행기", "팀워크샵", "팀내공유"]
    private var valid: Bool { !title.trimmingCharacters(in: .whitespaces).isEmpty }

    init(defaultPresenter: String, onCreate: @escaping (String, String, String, String, String) -> Void) {
        self.defaultPresenter = defaultPresenter
        self.onCreate = onCreate
        _presenter = State(initialValue: defaultPresenter)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    field("제목", $title, "무엇을 공유하나요?")
                    VStack(alignment: .leading, spacing: Theme.Space.x2) {
                        Text("유형").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                        Picker("유형", selection: $type) {
                            ForEach(types, id: \.self) { Text($0).tag($0) }
                        }.pickerStyle(.menu).tint(Theme.Palette.primary).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    field("발표자", $presenter, "이름")
                    field("파트", $part, "예: ITS혁신파트")
                    field("일정(선택)", $heldAt, "YYYY-MM-DD · 비우면 제안 상태")
                    Button {
                        onCreate(title.trimmingCharacters(in: .whitespaces), type,
                                 presenter.trimmingCharacters(in: .whitespaces),
                                 part.trimmingCharacters(in: .whitespaces),
                                 heldAt.trimmingCharacters(in: .whitespaces)); dismiss()
                    } label: {
                        Text("티미팅 제안").font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.borderedProminent).tint(Theme.Palette.cta).disabled(!valid)
                }
                .padding(Theme.Space.x4)
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("티미팅 제안").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } } }
        }
        .presentationDetents([.large])
    }

    private func field(_ label: String, _ text: Binding<String>, _ ph: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            TextField(ph, text: text).padding(Theme.Space.x3)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
        }
    }
}
