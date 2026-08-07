import SwiftUI

/// AI 상담 챗봇(팀 마음상담) — 네이티브 채팅 시트. 실제 /api/chat 을 호출한다.
struct ChatView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var turns: [ChatTurn] = [
        .init(role: .assistant, content: "안녕하세요, 팀 마음상담이에요. 요즘 어떤 일로 마음이 무거운가요? 편하게 적어 주세요.")
    ]
    @State private var draft = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                messages
                inputBar
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("팀 마음상담")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
            }
        }
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
            TextField("고민을 편하게 적어보세요…", text: $draft, axis: .vertical)
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

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        turns.append(.init(role: .user, content: text))
        draft = ""
        error = nil
        sending = true
        Task {
            do {
                let reply = try await ChatService.reply(to: turns)
                turns.append(.init(role: .assistant, content: reply))
            } catch {
                self.error = "답변을 받지 못했어요 — \(error.localizedDescription)"
            }
            sending = false
        }
    }
}
