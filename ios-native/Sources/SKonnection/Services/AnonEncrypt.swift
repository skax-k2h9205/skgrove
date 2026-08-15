import Foundation

/// 익명 접수 본문을 대상 리더 공개키로 E2E 암호화. 웹 `App.submitIssue` 이식.
/// 대상 리더가 아직 키 미설정(공개키 없음)이면 평문 폴백(비반적). 실명/오류는 원본 반환.
enum AnonEncrypt {
    /// payload 는 웹과 동일하게 {body, expectedChange} JSON.
    private struct Payload: Codable { let body: String; let expectedChange: String }

    static func encryptIfAnonymous(_ issue: Issue) async -> Issue {
        guard issue.identity == .anonymous else { return issue }
        let roster = await AuthLink.fetchRoster()
        let targetRole = (issue.target == .teamLeader) ? "팀리더" : "파트리더"
        // 운영자(커넥셔너)는 수신자에서 제외 — 그래야 "운영자도 못 봄"이 성립.
        let leaders = roster.filter { $0.role == targetRole && $0.isConnectioner != true }
        let pubKeys = await LeaderKeysStore.loadPublicKeys(leaders.map { $0.id })
        let recipients: [(accountId: String, publicJwk: IssueCrypto.JWK)] = leaders.compactMap { acc in
            guard let jwk = pubKeys[acc.id] else { return nil }
            return (acc.id, jwk)
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
