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

/// 서버 사례 의미검색(Phase 2)에 넘기는 테넌트. iOS 는 아직 테넌트 개념이 없고
/// 실제 데이터도 전부 기본 테넌트라, 웹 tenantStore.DEFAULT_TENANT_ID 와 같은 값을 쓴다.
/// 이 값을 보내야 서버가 pgvector 사례검색을 하고, 안 보내면 아래 cases(로컬 키워드)로 폴백한다.
private let defaultTenantId = "00000000-0000-0000-0000-000000000001"

private struct ChatRequest: Encodable {
    let mode: String            // "counsel" | "rule"
    let messages: [Wire]
    let selfBrief: FaceBrief?   // 나의 성향(상담 모드)
    let partner: FaceBrief?     // 갈등 상대의 성향
    let cases: [CaseBrief]?     // 팀 유사 사례(서버 검색 실패 시 폴백으로 쓰임)
    let tenantId: String?       // 서버 사례 의미검색 스코프
    struct Wire: Encodable { let role: String; let content: String }
    // 'self' 는 Swift 예약어라 프로퍼티명은 selfBrief, JSON 키는 self 로 매핑.
    enum CodingKeys: String, CodingKey {
        case mode, messages, partner, cases, tenantId
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
            cases: counsel ? cases : nil,
            tenantId: counsel ? defaultTenantId : nil
        )
        let res: ChatResponse = try await APIClient().post("api/chat", body: req)
        guard res.ok, let text = res.text, !text.isEmpty else {
            throw NSError(domain: "chat", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: res.reason ?? "응답을 받지 못했어요."])
        }
        return text
    }
}
