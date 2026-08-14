import Foundation

/// 소속 파트 목록 — 웹 `auth.ts` teamParts 와 동일. 신규 슬랙 로그인 파트 선택에 쓴다.
let teamParts: [String] = ["TEST혁신파트", "ITS혁신파트", "PM혁신파트"]

/// Slack(OIDC) 신원 — Supabase 세션 유저에서 뽑은 이메일·이름·slack id.
/// 웹 `authLink.ts` 의 SlackIdentity 와 같은 규약. 권한(역할·파트)은 앱 accounts 가 단일 소스다.
struct SlackIdentity: Identifiable, Equatable {
    let uid: String          // Supabase auth.users.id (auth_uid) — 소문자 UUID
    let email: String        // Slack 계정 이메일(소문자)
    let name: String         // 표시 이름
    let slackUserId: String? // Slack 사용자 id(Uxxxx)
    var id: String { uid }
}

/// Slack 로그인 → 앱 계정 매칭/생성/차단 판정 + accounts 쓰기.
///
/// 접근 통제는 **Slack 워크스페이스 멤버십**이 한다(이 Slack 앱은 팀 워크스페이스 전용) —
/// 그래서 이메일 도메인(@sk.com)으로 거르지 않는다. 매칭 실패(신규)면 자동 활성 팀원으로 만든다.
enum AuthLink {
    enum Resolution {
        case login(account: AuthApi.Account, user: CurrentUser)
        case newUser(SlackIdentity)
        case blocked(String)
    }

    /// 전체 계정 로드(매칭용). 실패하면 빈 배열 — 호출부가 blocked 로 처리.
    static func fetchRoster() async -> [AuthApi.Account] {
        guard Supabase.isConfigured else { return [] }
        let rows = try? await Supabase.select(
            "accounts", query: "select=*&order=role.asc", as: AuthApi.Account.self)
        return rows ?? []
    }

    /// 신원 → 계정. 이메일(또는 slackEmail) 매칭이면 상태 확인 후 로그인, 없으면 신규.
    static func resolve(_ identity: SlackIdentity, _ accounts: [AuthApi.Account]) -> Resolution {
        let email = identity.email
        guard !email.isEmpty else {
            return .blocked("슬랙 계정에 이메일이 없어 로그인할 수 없어요.")
        }
        // 로그인 이메일 또는 슬랙 DM 이메일(slackEmail) 어느 쪽과 일치해도 같은 사람으로 본다.
        let match = accounts.first { a in
            a.email.lowercased() == email || (a.slackEmail?.lowercased() == email)
        }
        guard let account = match else {
            // 매칭 없음 = 신규. 워크스페이스 멤버만 여기 오므로 도메인 검사 없이 자동가입.
            return .newUser(identity)
        }
        if account.status == "비활성" {
            return .blocked("비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요.")
        }
        if account.status == "승인 대기" {
            return .blocked("아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요.")
        }
        return .login(account: account, user: account.currentUser)
    }

    /// 매칭 계정에 Slack 연결값(auth_uid·slack_user_id)을 한 번만 박아둔다(이미 같으면 skip).
    static func link(_ account: AuthApi.Account, _ identity: SlackIdentity) async {
        let nextSlackUserId = identity.slackUserId ?? account.slackUserId
        if account.authUid == identity.uid && account.slackUserId == nextSlackUserId { return }
        try? await Supabase.patch("accounts", id: account.id,
                                  SlackLinkPatch(auth_uid: identity.uid, slack_user_id: nextSlackUserId))
    }

    /// 첫 슬랙 로그인(신규) — 파트 1회 선택 후 자동 활성 팀원으로 생성하고 CurrentUser 반환.
    static func createAccount(_ identity: SlackIdentity, part: String) async -> CurrentUser {
        let row = NewAccountRow(
            id: makeAccountId(),
            name: identity.name,
            email: identity.email,
            role: Role.member.rawValue,
            part: part,
            status: "활성",
            joined_at: todayString(),
            is_connectioner: false,
            auth_uid: identity.uid,
            slack_user_id: identity.slackUserId)
        try? await Supabase.insert("accounts", row)
        return CurrentUser(name: identity.name, email: identity.email, part: part, role: .member)
    }

    // 웹 makeAccountId: `USR-${Date.now().toString(36).toUpperCase()}`.
    private static func makeAccountId() -> String {
        let ms = Int(Date().timeIntervalSince1970 * 1000)
        return "USR-" + String(ms, radix: 36, uppercase: true)
    }

    // 웹 new Date().toISOString().slice(0,10) — "yyyy-MM-dd"(UTC).
    private static func todayString() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private struct SlackLinkPatch: Encodable {
        let auth_uid: String
        let slack_user_id: String?
    }

    // 계정 편집 PATCH 에 비번 컬럼을 섞으면 403 — 여기선 쓰기 허용 컬럼만 내보낸다(웹 ACCOUNT_WRITE_KEYS 대응).
    private struct NewAccountRow: Encodable {
        let id: String
        let name: String
        let email: String
        let role: String
        let part: String
        let status: String
        let joined_at: String
        let is_connectioner: Bool
        let auth_uid: String
        let slack_user_id: String?
    }
}
