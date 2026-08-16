import Foundation

/// 접수 본문을 수신자 공개키로 E2E 암호화. 웹 `App.submitIssue` + `issueEncryptionPolicy` 이식.
/// - 익명: 대상 리더만 수신자(운영자·작성자 불명 모두 불가독).
/// - 실명 '리더만 보기': 대상 리더 + 작성자 본인 수신자(작성자는 '내 접수'에서 재열람).
/// 수신자 공개키가 하나도 없으면 평문 폴백(비반적). 그 외(실명 공개 가능)는 원본 반환.
enum AnonEncrypt {
    /// payload 는 웹과 동일하게 {body, expectedChange} JSON.
    private struct Payload: Codable { let body: String; let expectedChange: String }

    /// 암호화 여부와 작성자 포함 여부. 웹 issueEncryptionPolicy 와 동일.
    static func plan(identity: Identity, visibility: IssueVisibility) -> (encrypt: Bool, includeAuthor: Bool) {
        if identity == .anonymous { return (true, false) }
        if identity == .named && visibility == .leaderOnly { return (true, true) }
        return (false, false)
    }

    /// 정책에 따라 암호화한다. authorAccountId 는 실명 '리더만 보기'에서 작성자를 수신자에 넣기 위해 필요.
    static func encryptIfNeeded(_ issue: Issue, authorAccountId: String?) async -> Issue {
        let p = plan(identity: issue.identity, visibility: issue.visibility)
        guard p.encrypt else { return issue }

        let roster = await AuthLink.fetchRoster()
        let targetRole = (issue.target == .teamLeader) ? "팀리더" : "파트리더"
        // 운영자(커넥셔너)는 수신자에서 제외 — 그래야 "운영자도 못 봄"이 성립.
        var recipientIds = roster.filter { $0.role == targetRole && $0.isConnectioner != true }.map { $0.id }
        if p.includeAuthor, let aid = authorAccountId { recipientIds.append(aid) }
        // 작성자가 대상 리더를 겸할 수 있으니 중복 제거(순서 보존).
        var seen = Set<String>()
        let uniqueIds = recipientIds.filter { seen.insert($0).inserted }

        let pubKeys = await LeaderKeysStore.loadPublicKeys(uniqueIds)
        let recipients: [(accountId: String, publicJwk: IssueCrypto.JWK)] = uniqueIds.compactMap { id in
            guard let jwk = pubKeys[id] else { return nil }
            return (id, jwk)
        }
        guard !recipients.isEmpty else { return issue } // 평문 폴백

        let payload = Payload(body: issue.body, expectedChange: issue.expectedChange)
        guard let data = try? JSONEncoder().encode(payload),
              let text = String(data: data, encoding: .utf8),
              let enc = try? IssueCrypto.encryptForRecipients(text, recipients: recipients)
        else { return issue }

        var out = issue
        out.body = ""
        out.expectedChange = ""
        out.encrypted = true
        out.encPayload = enc.payload
        out.encKeys = enc.keys
        out.encAlg = enc.alg
        return out
    }

    /// 복호화된 payload → (본문, 기대변화). 실패 시 nil.
    static func decodePayload(_ text: String) -> (body: String, expectedChange: String)? {
        guard let data = text.data(using: .utf8),
              let p = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
        return (p.body, p.expectedChange)
    }
}
