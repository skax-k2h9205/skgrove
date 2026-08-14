import Foundation

/// 서버 인증(api/auth) 클라이언트 — 웹 `authApi.ts` 를 그대로 이식했다.
///
/// 서버(service_role 키)가 붙으면: 해시가 클라이언트로 나오지 않고 검증·변경·초기화가 전부 서버에서 된다.
/// 서버가 아직 없으면(키 미주입): anon key 로 읽은 accounts 행의 password_hash 를 PBKDF2 로 직접 검증한다.
/// 두 경로 모두 웹과 동일한 규약이라, 웹에서 로그인되는 계정은 앱에서도 같은 비밀번호로 로그인된다.
enum AuthApi {
    // MARK: - accounts 테이블 행

    /// 로그인에 필요한 계정 정보(비번 해시 포함). accounts 를 anon 으로 1건 조회해 채운다.
    struct Account: Decodable {
        let id: String
        let name: String
        let email: String
        let role: String
        let part: String
        let status: String
        let passwordHash: String?
        let mustChangePassword: Bool?
        let isConnectioner: Bool?
        // Slack(OIDC) 연동값 — 슬랙 로그인 매칭(slackEmail)·연결(authUid/slackUserId)에 쓴다.
        let slackEmail: String?
        let authUid: String?
        let slackUserId: String?

        enum CodingKeys: String, CodingKey {
            case id, name, email, role, part, status
            case passwordHash = "password_hash"
            case mustChangePassword = "must_change_password"
            case isConnectioner = "is_connectioner"
            case slackEmail = "slack_email"
            case authUid = "auth_uid"
            case slackUserId = "slack_user_id"
        }

        var currentUser: CurrentUser {
            // CurrentUser 에는 connectioner 플래그가 없다. 커넥셔너는 전권이므로 role 을
            // .connectioner 로 승격해 리더/관리 게이트를 통과시킨다(웹 is_connectioner 취급과 같은 취지).
            let resolved: Role = (isConnectioner == true) ? .connectioner : (Role(rawValue: role) ?? .member)
            return CurrentUser(name: name, email: email, part: part, role: resolved)
        }
    }

    /// 이메일로 계정 1건 조회(anon). 상태 안내·폴백 검증에 쓴다. 미등록/오류면 nil.
    /// must_change_password 컬럼이 아직 없어도 select=* 는 있는 컬럼만 주므로 안전하다.
    static func fetchAccount(email: String) async -> Account? {
        let e = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard Supabase.isConfigured else { return nil }
        let rows = try? await Supabase.select(
            "accounts", query: "email=eq.\(e)&select=*&limit=1", as: Account.self)
        return rows?.first
    }

    // MARK: - 결과 타입

    enum LoginResult {
        case success(user: CurrentUser, mustChange: Bool)
        case failure(String)
    }

    // MARK: - 서버 호출

    /// unavailable = service_role 키 미주입 → 클라이언트 폴백 신호.
    private enum Call {
        case ok([String: Any])
        case fail(String)
        case unavailable
    }

    private static func call(_ body: [String: Any]) async -> Call {
        let url = APIClient.baseURL.appendingPathComponent("api/auth")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return .fail("서버 응답을 읽지 못했어요.")
            }
            let ok = json["ok"] as? Bool ?? false
            let reason = json["reason"] as? String
            // 키 미주입이면 서버가 이 사유를 준다 → 폴백.
            if !ok, reason == "SUPABASE_SERVICE_ROLE_KEY not configured" { return .unavailable }
            if ok { return .ok(json) }
            return .fail(reason ?? "요청에 실패했어요.")
        } catch {
            // 네트워크 오류는 폴백하지 않는다 — 진짜 실패로 알린다(무한 폴백 방지). 웹과 동일.
            return .fail("서버에 연결하지 못했어요.")
        }
    }

    // MARK: - 로그인

    /// 서버가 있으면 서버에서 해시를 검증하고, 없으면 넘겨받은 account 로 클라이언트에서 검증한다.
    /// account 는 폴백 전용 — 서버 경로에서는 쓰지 않는다.
    static func login(email: String, password: String, fallbackAccount: Account?) async -> LoginResult {
        switch await call(["action": "login", "email": email, "password": password]) {
        case .ok(let json):
            guard let u = json["user"] as? [String: Any] else { return .failure("로그인에 실패했어요.") }
            return .success(user: serverUser(u), mustChange: json["mustChange"] as? Bool ?? false)
        case .fail(let reason):
            return .failure(reason)
        case .unavailable:
            // ── 폴백: 클라이언트 검증 ──
            guard let acc = fallbackAccount, acc.passwordHash != nil else {
                // 계정 없음/비번 미설정을 같은 메시지로 — 어느 이메일이 가입돼 있는지 노출하지 않는다.
                return .failure("이메일 또는 비밀번호가 올바르지 않습니다.")
            }
            guard PasswordHash.verify(password, acc.passwordHash) else {
                return .failure("비밀번호가 일치하지 않아요.")
            }
            return .success(user: acc.currentUser, mustChange: acc.mustChangePassword ?? false)
        }
    }

    private static func serverUser(_ u: [String: Any]) -> CurrentUser {
        let role = u["role"] as? String ?? "팀원"
        let conn = u["isConnectioner"] as? Bool ?? false
        let resolved: Role = conn ? .connectioner : (Role(rawValue: role) ?? .member)
        return CurrentUser(name: u["name"] as? String ?? "",
                           email: u["email"] as? String ?? "",
                           part: u["part"] as? String ?? "",
                           role: resolved)
    }

    // MARK: - 비번 변경 / 초기화

    /// 현재 비번 확인 후 새 비번으로. 첫 로그인 강제 변경도 이걸 쓴다.
    static func changePassword(email: String, currentPassword: String, newPassword: String,
                               fallbackAccount: Account?) async -> (ok: Bool, error: String?) {
        switch await call(["action": "set-password", "email": email,
                            "currentPassword": currentPassword, "newPassword": newPassword]) {
        case .ok:
            return (true, nil)
        case .fail(let r):
            return (false, r)
        case .unavailable:
            // 폴백: 현재 비번 확인 후 anon 으로 해시를 직접 저장(REVOKE 적용 전에만 동작).
            guard let acc = fallbackAccount, PasswordHash.verify(currentPassword, acc.passwordHash) else {
                return (false, "현재 비밀번호가 올바르지 않습니다.")
            }
            do {
                try await Supabase.patch("accounts", id: acc.id,
                                         PasswordPatch(password_hash: PasswordHash.hash(newPassword)))
                return (true, nil)
            } catch {
                return (false, "변경에 실패했어요. 잠시 후 다시 시도해 주세요.")
            }
        }
    }

    private struct PasswordPatch: Encodable { let password_hash: String }

    /// 초기화 인증번호 요청(슬랙 DM). 계정 유무를 노출하지 않으려 서버가 항상 성공처럼 응답한다.
    static func requestReset(email: String) async -> (ok: Bool, error: String?) {
        switch await call(["action": "reset-request", "email": email]) {
        case .ok: return (true, nil)
        case .fail(let r): return (false, r)
        case .unavailable: return (false, "초기화 기능이 아직 설정되지 않았어요. 관리자에게 문의해 주세요.")
        }
    }

    /// 인증번호 + 새 비번으로 초기화 확정.
    static func confirmReset(email: String, code: String, newPassword: String) async -> (ok: Bool, error: String?) {
        switch await call(["action": "reset-confirm", "email": email, "code": code, "newPassword": newPassword]) {
        case .ok: return (true, nil)
        case .fail(let r): return (false, r)
        case .unavailable: return (false, "초기화 기능이 아직 설정되지 않았어요.")
        }
    }

    // MARK: - 유틸

    /// 사내메일(@sk.com) 형식 확인 — 웹 isCompanyEmail 과 동일한 정규식.
    static func isCompanyEmail(_ email: String) -> Bool {
        let t = email.trimmingCharacters(in: .whitespaces)
        return t.range(of: #"^[^\s@]+@sk\.com$"#, options: [.regularExpression, .caseInsensitive]) != nil
    }
}
