import Foundation
import CryptoKit

/// 클라이언트 인증(웹 LoginScreen 규약 이식): 이메일로 계정을 찾고,
/// 첫 로그인이면 비밀번호를 설정, 이후엔 검증한다. 비밀번호는 해시만 저장한다.
enum AuthService {
    enum AuthResult: Equatable {
        case success(Account)
        case needsPassword          // 첫 로그인 — 비밀번호를 설정해야 함
        case wrongPassword
        case unknownEmail
        case tooShort
    }

    private static let store = UserDefaults.standard
    private static func key(_ email: String) -> String {
        "skonnection.pw.\(email.lowercased())"
    }

    static func hasPassword(email: String) -> Bool {
        store.string(forKey: key(email)) != nil
    }

    private static func hash(_ password: String) -> String {
        let digest = SHA256.hash(data: Data(password.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /// 로그인 시도. 첫 로그인이면 입력한 비밀번호를 그대로 등록한다(웹과 동일).
    static func authenticate(email: String, password: String) -> AuthResult {
        guard let account = Account.find(email: email) else { return .unknownEmail }
        guard password.count >= 6 else { return .tooShort }

        let storedKey = key(email)
        if let existing = store.string(forKey: storedKey) {
            return existing == hash(password) ? .success(account) : .wrongPassword
        } else {
            // 첫 로그인 — 이 비밀번호를 등록.
            store.set(hash(password), forKey: storedKey)
            return .success(account)
        }
    }
}
