import SwiftUI

/// AI 상담 챗봇(팀 마음상담) — 두 모드(🧭 상담 / 📖 룰 확인).
/// 상담 모드는 나·상대의 성향 브리프 + 팀 유사사례(대나무숲·안건)를 함께 보내 오은영식 중재를 받는다(웹 ChatWidget 이식).
struct ChatView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var profiles: ProfileStore
    @EnvironmentObject private var issues: IssueStore
    @EnvironmentObject private var agendas: AgendaStore

    @State private var mode = "counsel"        // counsel | rule
    @State private var partner = ""            // 갈등 상대 이름(상담 모드)
    @State private var counselTurns: [ChatTurn] = [
        .init(role: .assistant, content: "안녕하세요, 팀 마음상담이에요. 요즘 어떤 일로 마음이 무거운가요? 누구와의 일이라면 아래에서 이름을 골라 주면 서로의 성향을 함께 살펴볼게요.")
    ]
    @State private var ruleTurns: [ChatTurn] = [
        .init(role: .assistant, content: "팀 운영·예산·근태·AI 도구·KPI 규칙이나 출입·보안 절차가 궁금하면 물어보세요. 규정을 근거로 답해 드릴게요.")
    ]
    @State private var draft = ""
    @State private var sending = false
    @State private var error: String?

    private var isCounsel: Bool { mode == "counsel" }
    private var turns: [ChatTurn] { isCounsel ? counselTurns : ruleTurns }
    private var partnerNames: [String] {
        profiles.profiles.map(\.name).filter { $0 != session.currentUser?.name && !$0.isEmpty }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                modeTabs
                if isCounsel { partnerBar }
                messages
                inputBar
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("팀 마음상담")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
    }

    private var modeTabs: some View {
        Picker("모드", selection: $mode) {
            Text("🧭 상담").tag("counsel")
            Text("📖 룰 확인").tag("rule")
        }
        .pickerStyle(.segmented)
        .padding(Theme.Space.x3)
        .background(Theme.Palette.surface)
    }

    /// 갈등 상대 선택 — 고르면 서로의 성향을 함께 살펴본다.
    private var partnerBar: some View {
        HStack(spacing: Theme.Space.x2) {
            Image(systemName: "person.2.fill").font(.caption).foregroundStyle(Theme.Palette.muted)
            Text("고민을 만든 상대").font(.caption).foregroundStyle(Theme.Palette.muted)
            Menu {
                Button("선택 안 함") { partner = "" }
                ForEach(partnerNames, id: \.self) { name in
                    Button(name) { partner = name }
                }
            } label: {
                HStack(spacing: 2) {
                    Text(partner.isEmpty ? "이름 고르기" : partner)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(partner.isEmpty ? Theme.Palette.cta : Theme.Palette.ink)
                    Image(systemName: "chevron.down").font(.caption2).foregroundStyle(Theme.Palette.muted)
                }
                .padding(.horizontal, Theme.Space.x2).padding(.vertical, 4)
                .background(Theme.Palette.tintPrimary, in: Capsule())
            }
            Spacer()
        }
        .padding(.horizontal, Theme.Space.x3).padding(.bottom, Theme.Space.x2)
        .background(Theme.Palette.surface)
    }

    private var messages: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: Theme.Space.x3) {
                    ForEach(turns) { turn in bubble(turn).id(turn.id) }
                    if sending {
                        HStack { ProgressView(); Text("생각 중…").font(.footnote).foregroundStyle(Theme.Palette.muted) }
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Theme.Palette.danger)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(Theme.Space.x4)
            }
            .onChange(of: turns.count) { _, _ in
                if let last = turns.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
            }
        }
    }

    private func bubble(_ turn: ChatTurn) -> some View {
        let isUser = turn.role == .user
        return HStack {
            if isUser { Spacer(minLength: 40) }
            Text(turn.content)
                .font(.body)
                .foregroundStyle(isUser ? .white : Theme.Palette.ink)
                .padding(Theme.Space.x3)
                .background(isUser ? Theme.Palette.cta : Theme.Palette.surface,
                           in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg)
                    .stroke(isUser ? .clear : Theme.Palette.border))
            if !isUser { Spacer(minLength: 40) }
        }
    }

    private var inputBar: some View {
        HStack(spacing: Theme.Space.x2) {
            TextField(isCounsel ? "고민을 편하게 적어보세요…" : "규칙·절차를 물어보세요…", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .padding(Theme.Space.x3)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                    .foregroundStyle(canSend ? Theme.Palette.cta : Theme.Palette.border)
            }
            .disabled(!canSend)
        }
        .padding(Theme.Space.x3)
        .background(Theme.Palette.sunken)
    }

    private var canSend: Bool {
        !sending && !draft.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func append(_ turn: ChatTurn) {
        if isCounsel { counselTurns.append(turn) } else { ruleTurns.append(turn) }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        append(.init(role: .user, content: text))
        draft = ""
        error = nil
        sending = true
        let history = turns
        let counsel = isCounsel
        let selfBrief = counsel ? brief(forName: session.currentUser?.name) : nil
        let partnerBrief = counsel && !partner.isEmpty ? brief(forName: partner) : nil
        let cases = counsel ? similarCases(text) : nil
        Task {
            do {
                let reply = try await ChatService.reply(to: history, mode: counsel ? "counsel" : "rule",
                                                        selfBrief: selfBrief, partner: partnerBrief, cases: cases)
                if counsel { counselTurns.append(.init(role: .assistant, content: reply)) }
                else { ruleTurns.append(.init(role: .assistant, content: reply)) }
            } catch {
                self.error = "답변을 받지 못했어요 — \(error.localizedDescription)"
            }
            sending = false
        }
    }

    /// 이름으로 성향 브리프 구성(민감정보 제외).
    private func brief(forName name: String?) -> FaceBrief? {
        guard let name, let p = profiles.profiles.first(where: { $0.name == name }) else { return nil }
        return FaceBrief(name: p.name, part: p.part.isEmpty ? nil : p.part,
                         mbti: p.mbti.isEmpty ? nil : p.mbti, disc: p.disc.isEmpty ? nil : p.disc,
                         collabGuide: p.collabGuide.isEmpty ? nil : p.collabGuide)
    }

    /// 고민 문장과 겹치는 팀 사례(대나무숲·안건)를 최대 3건 추린다(웹 findSimilarCases의 간이 이식).
    private func similarCases(_ text: String) -> [CaseBrief] {
        let words = Set(text.split { !$0.isLetter && !$0.isNumber }.map(String.init).filter { $0.count >= 2 })
        guard !words.isEmpty else { return [] }
        func score(_ s: String) -> Int { words.reduce(0) { $0 + (s.contains($1) ? 1 : 0) } }

        var scored: [(Int, CaseBrief)] = []
        for i in issues.issues where i.visibility != .leaderOnly {
            let s = score(i.title + " " + i.body)
            if s > 0 {
                scored.append((s, CaseBrief(source: "대나무숲", id: i.id, title: i.title,
                                            status: i.status.rawValue, snippet: String(i.body.prefix(60)))))
            }
        }
        for a in agendas.agendas {
            let s = score(a.title + " " + a.description)
            if s > 0 {
                scored.append((s, CaseBrief(source: "안건", id: a.id, title: a.title,
                                            status: a.status.rawValue, snippet: String(a.description.prefix(60)))))
            }
        }
        return scored.sorted { $0.0 > $1.0 }.prefix(3).map { $0.1 }
    }
}
