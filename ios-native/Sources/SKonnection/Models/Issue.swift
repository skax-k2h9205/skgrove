import SwiftUI

// 대나무숲 접수 모델(웹 types.ts Issue 이식). 팀원이 익명/실명으로 의견을 접수하고
// 리더가 안건화하는 흐름의 출발점.

enum Identity: String, CaseIterable, Codable { case anonymous = "익명", named = "실명" }
enum Urgency: String, CaseIterable, Codable { case low = "낮음", normal = "보통", high = "높음" }
enum IssueTarget: String, CaseIterable, Codable { case teamLeader = "팀리더", partLeader = "파트리더" }
enum IssueVisibility: String, CaseIterable, Codable {
    case leaderOnly = "리더만 보기"
    case agendaCandidate = "안건 후보로 공개 가능"
}

enum IssueStatus: String, Codable {
    case received = "접수", reviewing = "검토중", answered = "답변완료"
    case oneOnOne = "1on1 제안", action = "액션아이템", agenda = "안건화"
    case held = "보류", withdrawn = "회수", closed = "종료"

    var tint: Color {
        switch self {
        case .received, .reviewing: return Theme.Palette.tintPrimary
        case .answered, .action, .agenda: return Theme.Palette.tintSuccess
        case .held, .withdrawn, .closed: return Theme.Palette.tintNeutral
        case .oneOnOne: return Theme.Palette.tintPrimary
        }
    }
    var ink: Color {
        switch self {
        case .answered, .action, .agenda: return Theme.Palette.tintSuccessInk
        case .held, .withdrawn, .closed: return Theme.Palette.muted
        default: return Theme.Palette.tintPrimaryInk
        }
    }
}

let issueCategories = ["회의문화", "협업", "업무방식", "갈등", "성장/피드백", "복지/분위기", "기타"]

struct Issue: Identifiable, Codable {
    let id: String
    var title: String
    var category: String
    var identity: Identity
    var target: IssueTarget
    /// 서버에 저장된 대상 원문. 웹은 '리더 전체'나 특정 리더 이름도 대상으로 쓰는데,
    /// IssueTarget 은 두 값뿐이라 그 밖의 값이 전부 .teamLeader 로 접힌다.
    /// 접힌 값으로 열람 권한을 판정하면 남의 접수가 팀리더에게 새므로 원문을 남긴다.
    var targetRaw: String? = nil
    var body: String
    var expectedChange: String
    var urgency: Urgency
    var visibility: IssueVisibility
    var status: IssueStatus
    var createdAt: String
    var submitterEmail: String?
    // 리더 처리 이력. 답변·1on1 메모·보류/종료 사유. 접수자에게 근거를 남기고 방치를 막는다.
    var leaderReply: String = ""
    var oneOnOneNote: String = ""
    var reason: String = ""       // 보류/종료 사유(웹 statusNeedsReason)
    // ── E2E 암호화(익명 전용, 웹과 호환) ── encrypted면 body/expectedChange는 빈 문자열,
    // 실제 내용은 encPayload/encKeys에. 대상 리더만 복호화(운영자 불가독). 옛 캐시 호환 위해 optional.
    var encrypted: Bool? = nil
    var encPayload: String? = nil
    var encKeys: [IssueCrypto.RecipientKey]? = nil
    var encAlg: String? = nil

    // 웹 issueRules.ts 이식 — 응답 지연 감지.
    static let responseDueDays = 7

    /// 리더의 응답이 하나도 없는 상태(회수·종료·처리완료 제외).
    var isAwaitingResponse: Bool {
        guard status == .received || status == .reviewing else { return false }
        return leaderReply.isEmpty && oneOnOneNote.isEmpty
    }

    /// 접수일로부터 지난 일수. "방금" 등 파싱 불가한 값은 0으로 본다.
    func daysSinceCreated(today: Date) -> Int {
        guard let created = Self.ymd.date(from: createdAt) else { return 0 }
        return max(0, Calendar.current.dateComponents([.day], from: created, to: today).day ?? 0)
    }

    /// 응답 없이 기준 일수를 넘긴 건.
    func isResponseOverdue(today: Date) -> Bool {
        isAwaitingResponse && daysSinceCreated(today: today) >= Self.responseDueDays
    }

    /// 사유를 반드시 받아야 하는 전환(보류·종료).
    static func statusNeedsReason(_ status: IssueStatus) -> Bool {
        status == .held || status == .closed
    }

    private static let ymd: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX"); return f
    }()
}

/// 접수 목록 보관·추가. 앱 전역에서 하나의 인스턴스를 공유(접수 화면 ↔ 리더 관리함).
/// 변경 시 UserDefaults 에 저장해 재실행 후에도 유지된다(Supabase 연동은 이후).
@MainActor
final class IssueStore: ObservableObject {
    private static let key = "skonnection.issues"
    @Published var issues: [Issue] { didSet { Persist.save(issues, Self.key) } }

    init() {
        issues = Persist.load(Self.key, as: [Issue].self) ?? Self.seed
        // 앱 시작 시 웹과 같은 Supabase 프로젝트에서 최신 접수를 불러온다(로컬은 즉시 표시용 캐시).
        Task { await syncFromRemote() }
    }

    private static let seed: [Issue] = [
        Issue(id: "SUP-0007", title: "티미팅 시작 5분 전 아젠다 공유 정착", category: "회의문화",
              identity: .named, target: .teamLeader, body: "아젠다 없이 시작해 논점이 흩어져요.",
              expectedChange: "회의 전 3줄 아젠다 공유를 규칙으로.", urgency: .normal,
              visibility: .agendaCandidate, status: .reviewing, createdAt: "2026-08-05",
              submitterEmail: "k2h9205@sk.com"),
        Issue(id: "SUP-0006", title: "집중 근무 시간대 회의 자제", category: "업무방식",
              identity: .anonymous, target: .teamLeader, body: "오전 집중 시간에 회의가 잡혀 흐름이 끊겨요.",
              expectedChange: "10~12시 회의 프리 존.", urgency: .high,
              visibility: .agendaCandidate, status: .agenda, createdAt: "2026-08-02"),
    ]

    func submit(_ issue: Issue) {
        issues.insert(issue, at: 0)
        // 웹과 공유하는 Supabase 에도 저장(낙관적: 로컬 먼저, 원격은 비동기).
        Task { try? await Supabase.insert("issues", SupabaseIssueInsert(issue)) }
    }

    func mark(_ id: String, _ status: IssueStatus) {
        guard let i = issues.firstIndex(where: { $0.id == id }) else { return }
        issues[i].status = status
        pushStatus(id, status)
    }

    /// 리더 답변 — 접수자에게 응답을 남기고 답변완료로.
    func reply(_ id: String, _ text: String) {
        guard let i = issues.firstIndex(where: { $0.id == id }) else { return }
        issues[i].leaderReply = text
        issues[i].status = .answered
        Task { try? await Supabase.patch("issues", id: id,
            ["leader_reply": text, "status": IssueStatus.answered.rawValue]) }
    }

    /// 1:1 제안 메모.
    func proposeOneOnOne(_ id: String, _ note: String) {
        guard let i = issues.firstIndex(where: { $0.id == id }) else { return }
        issues[i].oneOnOneNote = note
        issues[i].status = .oneOnOne
        Task { try? await Supabase.patch("issues", id: id,
            ["one_on_one_note": note, "status": IssueStatus.oneOnOne.rawValue]) }
    }

    /// 보류/종료 — 사유를 반드시 함께 남긴다(방치·통보 방지).
    func decide(_ id: String, _ status: IssueStatus, reason: String) {
        guard Issue.statusNeedsReason(status) else { return }
        guard let i = issues.firstIndex(where: { $0.id == id }) else { return }
        issues[i].reason = reason
        issues[i].status = status
        Task { try? await Supabase.patch("issues", id: id,
            ["status_reason": reason, "status": status.rawValue]) }
    }

    private func pushStatus(_ id: String, _ status: IssueStatus) {
        Task { try? await Supabase.patch("issues", id: id, ["status": status.rawValue]) }
    }

    /// 응답 없이 가장 오래 기다린 건의 경과일. 없으면 nil.
    func oldestWaitingDays(today: Date) -> Int? {
        issues.filter { $0.isAwaitingResponse }.map { $0.daysSinceCreated(today: today) }.max()
    }

    /// 기존 접수번호와 겹치지 않는 다음 번호. 삭제/영속 이후에도 안전하게 최대값+1.
    func nextId() -> String {
        let maxNum = issues.compactMap { Int($0.id.split(separator: "-").last ?? "") }.max() ?? 7
        return String(format: "SUP-%04d", maxNum + 1)
    }

    /// 웹과 같은 Supabase 프로젝트에서 접수를 불러와 로컬을 대체한다(원격이 진실 공급원).
    /// 실패하면 로컬 캐시를 그대로 둔다(오프라인 폴백).
    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        do {
            let rows = try await Supabase.select("issues", query: "select=*&order=created_at.desc",
                                                 as: SupabaseIssueRow.self)
            issues = rows.map { $0.toIssue() }
        } catch {
            // 원격 실패 시 로컬 캐시 유지.
        }
    }
}

/// iOS `Issue` → Supabase `issues` insert 페이로드(snake_case 컬럼).
struct SupabaseIssueInsert: Encodable {
    let id: String
    let title: String
    let category: String
    let author: String
    let submitter_name: String?
    let submitter_email: String?
    let submitter_part: String?
    let target: String
    let status: String
    let urgency: String
    let body: String
    let expected_change: String
    let visibility: String
    let encrypted: Bool
    let enc_payload: String?
    let enc_keys: [IssueCrypto.RecipientKey]?
    let enc_alg: String?

    init(_ issue: Issue) {
        let isEnc = issue.encrypted == true
        id = issue.id
        title = issue.title
        category = issue.category
        author = issue.identity.rawValue
        submitter_email = issue.submitterEmail
        submitter_name = nil
        submitter_part = nil
        target = issue.target.rawValue
        status = issue.status.rawValue
        urgency = issue.urgency.rawValue
        // 암호화 글은 평문을 절대 내보내지 않는다.
        body = isEnc ? "" : issue.body
        expected_change = isEnc ? "" : issue.expectedChange
        visibility = issue.visibility.rawValue
        encrypted = isEnc
        enc_payload = issue.encPayload
        enc_keys = issue.encKeys
        enc_alg = issue.encAlg
    }
}

/// Supabase `issues` 테이블 행(snake_case) → iOS `Issue` 매핑 DTO.
struct SupabaseIssueRow: Decodable {
    let id: String
    let title: String?
    let category: String?
    let author: String?
    let target: String?
    let body: String?
    let expected_change: String?
    let urgency: String?
    let visibility: String?
    let status: String?
    let created_at: String?
    let submitter_email: String?
    let leader_reply: String?
    let one_on_one_note: String?
    let status_reason: String?
    let encrypted: Bool?
    let enc_payload: String?
    let enc_keys: [IssueCrypto.RecipientKey]?
    let enc_alg: String?

    func toIssue() -> Issue {
        Issue(
            id: id,
            title: title ?? "",
            category: category ?? issueCategories[0],
            identity: Identity(rawValue: author ?? "") ?? .anonymous,
            target: IssueTarget(rawValue: target ?? "") ?? .teamLeader,
            targetRaw: target,
            body: body ?? "",
            expectedChange: expected_change ?? "",
            urgency: Urgency(rawValue: urgency ?? "") ?? .normal,
            visibility: IssueVisibility(rawValue: visibility ?? "") ?? .leaderOnly,
            status: IssueStatus(rawValue: status ?? "") ?? .received,
            createdAt: String((created_at ?? "").prefix(10)),
            submitterEmail: submitter_email,
            leaderReply: leader_reply ?? "",
            oneOnOneNote: one_on_one_note ?? "",
            reason: status_reason ?? "",
            encrypted: encrypted,
            encPayload: enc_payload,
            encKeys: enc_keys,
            encAlg: enc_alg
        )
    }
}
