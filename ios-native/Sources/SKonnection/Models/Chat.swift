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

/// 프록시에 넘기는 성향 요약(웹 FaceBrief 이식). 민감정보는 뺀다.
struct FaceBrief: Encodable {
    let name: String
    var part: String?
    var mbti: String?
    var disc: String?
    var collabGuide: String?
}

/// 상담에 참고할 팀 유사 사례(대나무숲·안건).
struct CaseBrief: Encodable {
    let source: String
    let id: String
    let title: String
    let status: String
    let snippet: String
}

private struct ChatRequest: Encodable {
    let mode: String            // "counsel" | "rule"
    let messages: [Wire]
    let selfBrief: FaceBrief?   // 나의 성향(상담 모드)
    let partner: FaceBrief?     // 갈등 상대의 성향
    let cases: [CaseBrief]?     // 팀 유사 사례
    struct Wire: Encodable { let role: String; let content: String }
    // 'self' 는 Swift 예약어라 프로퍼티명은 selfBrief, JSON 키는 self 로 매핑.
    enum CodingKeys: String, CodingKey {
        case mode, messages, partner, cases
        case selfBrief = "self"
    }
}

private struct ChatResponse: Decodable {
    let ok: Bool
    let text: String?
    let reason: String?
}

enum ChatService {
    /// 대화 이력을 보내고 어시스턴트 답을 받는다. 상담 모드는 성향·유사사례를 함께 주입한다.
    static func reply(to history: [ChatTurn], mode: String = "counsel",
                      selfBrief: FaceBrief? = nil, partner: FaceBrief? = nil,
                      cases: [CaseBrief]? = nil) async throws -> String {
        let counsel = mode == "counsel"
        let req = ChatRequest(
            mode: mode,
            messages: history.map { .init(role: $0.role.rawValue, content: $0.content) },
            selfBrief: counsel ? selfBrief : nil,
            partner: counsel ? partner : nil,
            cases: counsel ? cases : nil
        )
        let res: ChatResponse = try await APIClient().post("api/chat", body: req)
        guard res.ok, let text = res.text, !text.isEmpty else {
            throw NSError(domain: "chat", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: res.reason ?? "응답을 받지 못했어요."])
        }
        return text
    }
}
