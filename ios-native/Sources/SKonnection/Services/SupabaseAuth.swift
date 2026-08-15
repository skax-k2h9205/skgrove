import Foundation
import Supabase

/// Slack(OIDC) 로그인 — 웹 `App.tsx` startSlackLogin 규약 이식.
/// supabase-swift 의 signInWithOAuth 가 ASWebAuthenticationSession·PKCE·세션 저장을 자동 처리한다.
/// 웹과 **같은 Supabase 프로젝트/anon 키**를 쓴다(로컬 `Supabase` 설정 enum 재사용 — 모듈명과
/// 같은 이름이지만 타입이 모듈을 가려 `Supabase.url`/`Supabase.anonKey` 는 그 enum 을 가리킨다).
enum SupabaseAuth {
    /// Phase 0 단일 워크스페이스 — team 힌트를 박아 "워크스페이스 URL 입력" 단계를 건너뛴다.
    /// (비밀 아님 — authorize URL 에 노출되는 값. 웹 VITE_SLACK_TEAM_ID 기본값과 동일.)
    private static let slackTeamId = "T07BDCWME6M"
    /// Supabase Auth 의 Redirect URLs 허용목록 + Info.plist CFBundleURLSchemes 와 같아야 한다.
    private static let redirectURL = URL(string: "skonnection://login-callback")!

    static let client = SupabaseClient(
        supabaseURL: URL(string: Supabase.url)!,
        supabaseKey: Supabase.anonKey
    )

    /// "Slack으로 로그인" — OAuth 창을 띄우고 성공 세션에서 신원을 뽑는다.
    /// 사용자가 창을 닫으면 throw(호출부에서 조용히 처리). 워크스페이스 비멤버는 Slack 이 막는다.
    @MainActor
    static func signInWithSlack() async throws -> SlackIdentity {
        let session = try await client.auth.signInWithOAuth(
            provider: .slackOIDC,
            redirectTo: redirectURL,
            queryParams: [("team", slackTeamId)]
        ) { authSession in
            // 비-임시 세션: Slack 로그인 쿠키를 남겨 재로그인 마찰을 줄인다(웹과 유사).
            authSession.prefersEphemeralWebBrowserSession = false
        }
        return SlackIdentity(from: session.user)
    }

    /// 로그아웃 시 Supabase 세션도 무효화(웹 signOut 과 동일). 실패는 무시.
    static func signOut() async {
        try? await client.auth.signOut()
    }
}

extension SlackIdentity {
    /// Supabase 유저 → 우리 신원. slack_oidc user_metadata 형태에 방어적으로 접근한다(웹 extractSlackIdentity).
    init(from user: User) {
        let meta = user.userMetadata
        func str(_ key: String) -> String? {
            guard let v = meta[key]?.stringValue, !v.isEmpty else { return nil }
            return v
        }
        let email = (user.email ?? str("email") ?? "")
            .trimmingCharacters(in: .whitespaces).lowercased()
        let name = str("full_name")
            ?? str("name")
            ?? str("preferred_username")
            ?? (email.isEmpty ? "팀원" : String(email.prefix(while: { $0 != "@" })))
        let slackUserId = str("provider_id") ?? str("sub") ?? user.identities?.first?.id
        // auth_uid 는 웹과 같은 소문자 UUID 로 맞춘다(DB 매칭 일관성).
        self.init(uid: user.id.uuidString.lowercased(), email: email, name: name,
                  slackUserId: slackUserId, part: str("part"))
    }
}

// MARK: - 이메일 인증(웹 blind-email-auth 와 동일: Supabase Auth 이메일+비번+6자리 OTP)
extension SupabaseAuth {
    enum EmailError: Error { case alreadyRegistered, noSession }

    /// 이메일+비밀번호 로그인. 성공 세션에서 신원을 뽑는다.
    static func signInEmail(_ email: String, _ password: String) async throws -> SlackIdentity {
        let session = try await client.auth.signIn(email: email, password: password)
        return SlackIdentity(from: session.user)
    }

    /// 가입 — 6자리 확인 코드를 메일로 발송. 반환 true = OTP 확인 필요, false = 바로 세션(확인 off).
    static func signUpEmail(_ email: String, _ password: String, name: String, part: String) async throws -> Bool {
        let res = try await client.auth.signUp(
            email: email, password: password,
            data: ["full_name": .string(name), "part": .string(part)])
        // 이미 가입된 이메일이면 identities 가 빈 배열로 온다(웹과 동일 판정).
        if let identities = res.user.identities, identities.isEmpty { throw EmailError.alreadyRegistered }
        return res.session == nil
    }

    /// 가입 확인 코드 검증 → 세션 생성.
    static func verifySignupOTP(_ email: String, _ code: String) async throws -> SlackIdentity {
        let res = try await client.auth.verifyOTP(email: email, token: code, type: .signup)
        guard let user = res.user ?? res.session?.user else { throw EmailError.noSession }
        return SlackIdentity(from: user)
    }

    /// 비밀번호 재설정 코드 발송(recovery OTP).
    static func requestReset(_ email: String) async throws {
        try await client.auth.resetPasswordForEmail(email)
    }

    /// 재설정 코드 검증 후 새 비밀번호로 갱신.
    static func confirmReset(_ email: String, _ code: String, newPassword: String) async throws {
        _ = try await client.auth.verifyOTP(email: email, token: code, type: .recovery)
        _ = try await client.auth.update(user: UserAttributes(password: newPassword))
        // 재설정 직후 세션이 남으므로, 로그인 화면으로 되돌리려 로그아웃한다(웹과 동일 흐름).
        try? await client.auth.signOut()
    }
}
