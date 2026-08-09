import Foundation

/// AI 상담 대화 영속화 — 웹 `counselStore.ts` 와 **같은 테이블(counsel_messages)** 을 쓴다.
/// 웹에서 한 상담이 앱에도, 앱에서 한 상담이 웹에도 이어진다.
///
/// 프라이버시 주의: 이 앱은 실제 인증(Supabase Auth)이 없고 anon 키 + prototype RLS다.
/// 따라서 author 필터는 "소프트 스코핑"이며, DB 가 남의 상담 열람을 강제로 막지는 못한다
/// (대나무숲·안건과 같은 신뢰 모델). 로컬 캐시에도 **본인 것만** 남긴다.
struct CounselMessage: Codable, Identifiable, Equatable {
    let id: String
    var sessionId: String
    var author: String
    var mode: String            // "counsel" | "rule"
    var role: String            // "user" | "assistant"
    var content: String
    var partnerName: String?
    var createdAt: String       // ISO8601 (밀리초 포함)
}

/// Supabase 행 ↔ 모델. 컬럼명이 snake_case 라 따로 둔다.
private struct CounselRow: Codable {
    let id: String
    var session_id: String?
    var author: String?
    var mode: String?
    var role: String?
    var content: String?
    var partner_name: String?
    var created_at: String?

    func toMessage() -> CounselMessage {
        CounselMessage(id: id, sessionId: session_id ?? "", author: author ?? "",
                       mode: mode == "rule" ? "rule" : "counsel",
                       role: role == "assistant" ? "assistant" : "user",
                       content: content ?? "", partnerName: partner_name,
                       createdAt: created_at ?? "")
    }
}

@MainActor
final class CounselStore: ObservableObject {
    private static let cacheKey = "skonnection.counselMessages"

    /// 현재 사용자의 상담 기록(시간순).
    @Published private(set) var messages: [CounselMessage] = []
    /// 캐시를 화면에 먼저 깔고 서버를 덧씌운다. 그 사이를 구분해야 "기록 없음"을 성급히 보이지 않는다.
    @Published private(set) var loading = false

    /// 이번에 앱에서 시작한 대화 묶음. 웹의 `newId('CS')` 와 같은 역할이다.
    let sessionId = "CS-\(Int(Date().timeIntervalSince1970 * 1000))"

    private var loadedFor: String?

    /// 밀리초까지 남긴다. 같은 초에 사용자 말과 답이 겹치면 정렬이 뒤집혀
    /// 질문 아래에 답이 아니라 답 아래에 질문이 붙는다.
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    static func now() -> String { iso.string(from: Date()) }

    /// 한 사람의 기록을 불러온다. 같은 사람을 다시 부르면 서버만 새로 확인한다.
    func load(author: String) async {
        guard !author.isEmpty else { return }
        if loadedFor != author {
            loadedFor = author
            // 로컬 캐시는 본인 것만 담기지만, 계정을 바꿔 로그인한 경우를 위해 한 번 더 거른다.
            messages = (Persist.load(Self.cacheKey, as: [CounselMessage].self) ?? [])
                .filter { $0.author == author }
        }
        guard Supabase.isConfigured else { return }
        loading = true
        defer { loading = false }
        let escaped = author.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? author
        guard let rows = try? await Supabase.select(
            "counsel_messages",
            query: "select=*&author=eq.\(escaped)&order=created_at.asc",
            as: CounselRow.self) else { return }
        messages = rows.map { $0.toMessage() }
        Persist.save(messages, Self.cacheKey)
    }

    /// 모드별 대화만 추린다. 상담과 룰 확인은 성격이 달라 한 흐름으로 섞지 않는다.
    func thread(mode: String) -> [CounselMessage] {
        messages.filter { $0.mode == mode }
    }

    /// 한 건 추가. 화면과 캐시는 즉시, 서버는 뒤따른다 —
    /// 네트워크가 느리다고 내가 방금 쓴 말이 늦게 뜨면 안 된다.
    func append(author: String, mode: String, role: String, content: String, partnerName: String?) {
        let message = CounselMessage(
            id: "CM-\(Int(Date().timeIntervalSince1970 * 1000))-\(role.prefix(1))\(messages.count)",
            sessionId: sessionId, author: author, mode: mode, role: role,
            content: content, partnerName: partnerName, createdAt: Self.now())
        messages.append(message)
        Persist.save(messages, Self.cacheKey)
        guard Supabase.isConfigured else { return }
        Task {
            try? await Supabase.insert("counsel_messages", CounselRow(
                id: message.id, session_id: message.sessionId, author: message.author,
                mode: message.mode, role: message.role, content: message.content,
                partner_name: message.partnerName, created_at: message.createdAt))
        }
    }

    /// 한 모드의 기록을 지운다. 상담은 개인적인 이야기라 본인이 지울 수 있어야 한다.
    /// 서버 삭제가 실패해도 화면과 캐시는 지운 상태로 둔다 — 지우겠다는 뜻이 우선이다.
    func clear(author: String, mode: String) {
        let doomed = messages.filter { $0.author == author && $0.mode == mode }
        guard !doomed.isEmpty else { return }
        messages.removeAll { $0.author == author && $0.mode == mode }
        Persist.save(messages, Self.cacheKey)
        guard Supabase.isConfigured else { return }
        Task {
            // id 목록으로 지운다 — author 를 필터로 쓰면 이메일에 든 점·기호가
            // PostgREST 필터 문법과 부딪힐 수 있다.
            let ids = doomed.map(\.id).joined(separator: ",")
            try? await Supabase.delete("counsel_messages", query: "id=in.(\(ids))")
        }
    }
}
