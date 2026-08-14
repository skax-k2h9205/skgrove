import Foundation
import CommonCrypto

/// 계정 비밀번호 해싱(PBKDF2-SHA256) — 웹 `passwordHash.ts` 와 **바이트 단위로 호환**된다.
/// 저장 형식: `pbkdf2$<iterations>$<saltB64>$<hashB64>` (accounts.password_hash 컬럼 하나).
///
/// 서버 인증(api/auth)이 켜지기 전까지 웹과 iOS 는 둘 다 anon key 로 accounts 를 읽어
/// 이 해시를 클라이언트에서 검증한다. 같은 규약이라 웹에서 만든 해시를 앱이 그대로 검증하고,
/// 앱에서 만든 해시도 웹이 그대로 검증한다.
enum PasswordHash {
    private static let algo = "pbkdf2"
    private static let iterations = 100_000
    private static let saltBytes = 16
    private static let keyBytes = 32 // 256 bits — 웹 KEY_BITS 와 동일.

    /// 새 해시 생성. 첫 로그인/초기화 폴백에서 새 비번을 저장할 때 쓴다.
    static func hash(_ password: String) -> String {
        var salt = [UInt8](repeating: 0, count: saltBytes)
        _ = SecRandomCopyBytes(kSecRandomDefault, salt.count, &salt)
        let derived = derive(password, salt: salt, iterations: iterations, keyBytes: keyBytes)
        return "\(algo)$\(iterations)$\(Data(salt).base64EncodedString())$\(Data(derived).base64EncodedString())"
    }

    /// 저장된 해시와 대조. 웹 `verifyPassword` 와 동일한 규약(형식 파싱 → 재유도 → 상수시간 비교).
    static func verify(_ password: String, _ stored: String?) -> Bool {
        guard let stored else { return false }
        // split 은 빈 조각도 남겨야 형식 검증이 정확하다(omittingEmptySubsequences: false).
        let parts = stored.split(separator: "$", omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 4, parts[0] == algo,
              let iter = Int(parts[1]), iter > 0,
              let salt = Data(base64Encoded: parts[2]),
              let want = Data(base64Encoded: parts[3])
        else { return false }
        // 저장된 해시 길이에서 키 길이를 역산한다(웹은 32B 고정이지만 앞으로도 견디게).
        let derived = derive(password, salt: [UInt8](salt), iterations: iter, keyBytes: want.count)
        let got = Data(derived).base64EncodedString()
        // 웹과 똑같이 base64 **문자열** 기준 상수시간 비교.
        let target = parts[3]
        guard got.utf8.count == target.utf8.count else { return false }
        var diff: UInt8 = 0
        for (a, b) in zip(got.utf8, target.utf8) { diff |= a ^ b }
        return diff == 0
    }

    private static func derive(_ password: String, salt: [UInt8], iterations: Int, keyBytes: Int) -> [UInt8] {
        var out = [UInt8](repeating: 0, count: max(keyBytes, 1))
        let pw = Data(password.utf8)
        _ = pw.withUnsafeBytes { pwRaw in
            salt.withUnsafeBufferPointer { saltPtr in
                CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    pwRaw.bindMemory(to: Int8.self).baseAddress, pw.count,
                    saltPtr.baseAddress, salt.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                    UInt32(iterations),
                    &out, out.count
                )
            }
        }
        return out
    }
}
