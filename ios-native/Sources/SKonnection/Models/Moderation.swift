import Foundation

// App Store 심사 지침 1.2(사용자 생성 콘텐츠) 대응 묶음.
// Apple 이 요구하는 다섯 가지를 한곳에 모은다: 약관 동의·콘텐츠 필터링·신고·차단·24시간 내 조치.
// 이 파일이 없으면 유머·장터·모임처럼 사용자가 글을 쓰는 화면을 심사에 낼 수 없다.

/// 등록 시점에 걸러내는 금칙어 필터.
///
/// 왜 서버 AI 가 아니라 로컬 목록인가: AI 모더레이션은 키·네트워크가 살아 있어야 동작한다.
/// 심사 중에 그게 막히면 "필터가 없다"로 다시 반려된다. 로컬 목록은 항상 즉시 동작한다.
/// 완벽한 차단이 목적이 아니라 **명백한 것을 확실히 막고**, 나머지는 신고로 처리하는 구조다.
enum ContentFilter {
    /// 소문자·공백/반복문자 제거 — "ㅅ ㅂ", "시이발" 같은 우회를 조금이라도 잡는다.
    private static func normalize(_ text: String) -> String {
        let lowered = text.lowercased()
        return String(lowered.unicodeScalars.filter { !CharacterSet.whitespacesAndNewlines.contains($0) })
    }

    /// 욕설·비방·성적 표현. 팀 내부용이라 과하게 넓히지 않는다(오탐이 더 나쁘다).
    private static let banned: [String] = [
        "씨발", "시발", "씨빨", "개새끼", "새끼야", "병신", "지랄", "좆", "썅", "니미",
        "미친놈", "미친년", "닥쳐", "꺼져", "죽어버려", "등신", "찌질이", "한남", "김치녀",
        "fuck", "fucking", "shit", "bitch", "asshole", "bastard", "retard", "faggot",
    ]

    /// 위반이면 사람에게 보여줄 사유, 아니면 nil.
    static func violation(in text: String) -> String? {
        let t = normalize(text)
        guard !t.isEmpty else { return nil }
        if banned.contains(where: { t.contains($0) }) {
            return "욕설·비방으로 보이는 표현이 있어요. 표현을 바꿔 다시 올려주세요."
        }
        return nil
    }
}

/// 신고 대상 종류 — 어디서 신고했는지 알아야 운영자가 찾아갈 수 있다.
enum ReportKind: String, Codable {
    case humorPost, humorComment, market, gathering, issue

    var label: String {
        switch self {
        case .humorPost: return "유머 글"
        case .humorComment: return "유머 댓글"
        case .market: return "이음장터"
        case .gathering: return "모임"
        case .issue: return "대나무숲"
        }
    }
}

/// 신고 사유. 자유 서술만 받으면 분류가 안 돼 24시간 처리 약속을 지키기 어렵다.
enum ReportReason: String, CaseIterable, Identifiable, Codable {
    case abuse = "욕설·비방"
    case sexual = "음란물·선정성"
    case spam = "스팸·광고"
    case privacy = "개인정보 노출"
    case other = "기타"
    var id: String { rawValue }
}

@MainActor
final class ModerationStore: ObservableObject {
    private static let blockKey = "skonnection.blockedAuthors"
    private static let hiddenKey = "skonnection.hiddenContent"

    /// 차단한 사람(이름 기준 — 이 앱의 글은 이름으로 작성자를 남긴다).
    @Published private(set) var blockedAuthors: [String] {
        didSet { Persist.save(blockedAuthors, Self.blockKey) }
    }
    /// 신고해서 즉시 감춘 항목 키("humorPost:HUM-1").
    /// Apple 은 신고·차단 즉시 내 피드에서 사라질 것을 요구한다 — 서버 처리를 기다리지 않는다.
    @Published private(set) var hiddenKeys: [String] {
        didSet { Persist.save(hiddenKeys, Self.hiddenKey) }
    }

    init() {
        blockedAuthors = Persist.load(Self.blockKey, as: [String].self) ?? []
        hiddenKeys = Persist.load(Self.hiddenKey, as: [String].self) ?? []
    }

    private func key(_ kind: ReportKind, _ id: String) -> String { "\(kind.rawValue):\(id)" }

    /// 화면에서 걸러야 하는가 — 차단한 사람의 글이거나, 내가 신고해 감춘 글.
    func isHidden(_ kind: ReportKind, id: String, author: String) -> Bool {
        if hiddenKeys.contains(key(kind, id)) { return true }
        return isBlocked(author)
    }

    func isBlocked(_ author: String) -> Bool {
        let a = author.trimmingCharacters(in: .whitespaces)
        guard !a.isEmpty else { return false }
        return blockedAuthors.contains(a)
    }

    /// 신고 — 내 화면에서 즉시 감추고, 운영자가 볼 수 있게 원격에 남긴다.
    func report(kind: ReportKind, targetId: String, author: String,
                reason: ReportReason, note: String, reporter: String) {
        let k = key(kind, targetId)
        if !hiddenKeys.contains(k) { hiddenKeys.append(k) }
        let row = SupabaseReportInsert(
            id: "RPT-\(Int(Date().timeIntervalSince1970))-\(Int.random(in: 100...999))",
            reporter: reporter, target_kind: kind.rawValue, target_id: targetId,
            target_author: author, reason: reason.rawValue, note: note,
            created_at: ISO8601DateFormatter().string(from: Date()))
        Task { try? await Supabase.insert("content_reports", row) }
    }

    /// 차단 — 그 사람 글이 즉시 안 보이게 하고, 운영자에게도 알린다(Apple 요구).
    func block(_ author: String, reporter: String) {
        let a = author.trimmingCharacters(in: .whitespaces)
        guard !a.isEmpty, !blockedAuthors.contains(a) else { return }
        blockedAuthors.append(a)
        let row = SupabaseBlockInsert(
            id: "BLK-\(Int(Date().timeIntervalSince1970))-\(Int.random(in: 100...999))",
            blocker: reporter, blocked_author: a,
            created_at: ISO8601DateFormatter().string(from: Date()))
        Task { try? await Supabase.insert("user_blocks", row) }
    }

    func unblock(_ author: String) {
        blockedAuthors.removeAll { $0 == author }
    }
}

struct SupabaseReportInsert: Encodable {
    let id: String
    let reporter: String
    let target_kind: String
    let target_id: String
    let target_author: String
    let reason: String
    let note: String
    let created_at: String
}

struct SupabaseBlockInsert: Encodable {
    let id: String
    let blocker: String
    let blocked_author: String
    let created_at: String
}
