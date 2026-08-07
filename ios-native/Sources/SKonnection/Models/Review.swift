import Foundation

/// 대나무숲 접수 AI 검토 — 웹 intakeReview.ts / api/review.ts 계약 이식.
/// POST /api/review { title, body, expectedChange }
///   → { ok, findings:[{field, kind, reason, rewritten}] } | { ok:false, reason }.
/// 욕설·인신공격을 걸러 건설적 문장으로 재작성 제안. findings 가 비면 통과.

enum ReviewField: String, Decodable { case title, body, expectedChange }
enum ReviewKind: String, Decodable { case profanity, personalAttack = "personal-attack" }

struct ReviewFinding: Identifiable, Decodable {
    var id = UUID()
    let field: ReviewField
    let kind: ReviewKind
    let reason: String
    let rewritten: String

    private enum CodingKeys: String, CodingKey { case field, kind, reason, rewritten }
}

private struct ReviewRequest: Encodable {
    let title: String
    let body: String
    let expectedChange: String
}

private struct ReviewResponse: Decodable {
    let ok: Bool
    let findings: [ReviewFinding]?
    let reason: String?
}

enum ReviewService {
    /// 접수 검토. 지적할 게 없거나 검토가 꺼져 있으면 빈 배열. 네트워크 실패는 던진다.
    static func review(title: String, body: String, expectedChange: String) async throws -> [ReviewFinding] {
        let req = ReviewRequest(title: title, body: body, expectedChange: expectedChange)
        let res: ReviewResponse = try await APIClient().post("api/review", body: req)
        // ok:false 여도 reason=='disabled' 등은 "통과"로 취급(웹과 동일).
        return res.findings ?? []
    }
}
