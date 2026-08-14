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
        self.init(uid: user.id.uuidString.lowercased(), email: email, name: name, slackUserId: slackUserId)
    }
}
