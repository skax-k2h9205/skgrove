import Foundation

/// AI 상담 챗봇 — 웹 aiChat.ts / api/chat.ts 계약 이식.
/// POST /api/chat { mode, messages } → { ok, text } | { ok:false, reason }.
/// 서버측 키(OPENROUTER)를 쓰므로 클라이언트 키는 필요 없다.

struct ChatTurn: Codable, Identifiable {
    enum Role: String, Codable { case user, assistant }
    var id = UUID()
    let role: Role
    let content: String

    private enum CodingKeys: String, CodingKey { case role, content }  // id 는 전송 안 함
}

private struct ChatRequest: Encodable {
    let mode: String            // "counsel" | "rule"
    let messages: [Wire]
    struct Wire: Encodable { let role: String; let content: String }
}

private struct ChatResponse: Decodable {
    let ok: Bool
    let text: String?
    let reason: String?
}

enum ChatService {
    /// 대화 이력을 보내고 어시스턴트 답을 받는다. 실패 시 사람이 읽을 사유를 던진다.
    static func reply(to history: [ChatTurn], mode: String = "counsel") async throws -> String {
        let req = ChatRequest(mode: mode, messages: history.map { .init(role: $0.role.rawValue, content: $0.content) })
        let res: ChatResponse = try await APIClient().post("api/chat", body: req)
        guard res.ok, let text = res.text, !text.isEmpty else {
            throw NSError(domain: "chat", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: res.reason ?? "응답을 받지 못했어요."])
        }
        return text
    }
}
