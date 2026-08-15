import Foundation
import CryptoKit
import CommonCrypto

/// 익명 대나무숲 글 E2E 암호화 — 웹 `src/crypto/issueCrypto.ts`(Web Crypto)와 **바이트 호환**.
/// 대상 리더 공개키로만 복호화되는 하이브리드 암호화(ECDH P-256 + AES-256-GCM + HKDF-SHA256).
/// 개인키는 패스프레이즈/복구코드로 감싸(PBKDF2 210k → AES-GCM) 서버엔 암호문만 저장.
///
/// interop 핵심:
///  - JWK 필드(x/y/d)는 base64url, payload/wrappedCK/iv/salt/ciphertext는 표준 base64(웹 btoa).
///  - Web Crypto AES-GCM 출력 = iv || ciphertext || tag  ==  CryptoKit SealedBox.combined.
///  - ECDH 공유비밀(P-256 X좌표 32B)을 HKDF(salt=빈값, info=alg)로 AES-256 키 유도.
enum IssueCrypto {
    static let alg = "v1:ecdh-p256+aesgcm256+hkdf-sha256+pbkdf2-210k"

    // MARK: - 타입 (웹 wire 포맷과 동일 키 이름)
    struct JWK: Codable {
        var kty: String
        var crv: String
        var x: String
        var y: String
        var d: String?
    }
    struct WrappedKey: Codable { var salt: String; var iv: String; var ciphertext: String }
    struct RecipientKey: Codable { var accountId: String; var ephemeralPub: JWK; var wrappedCK: String; var iv: String }
    struct EncryptedIssue: Codable { var alg: String; var payload: String; var keys: [RecipientKey] }

    enum CryptoError: Error { case badKey, decryptFailed, notRecipient }

    // MARK: - 리더 키페어
    static func generateRecipientKeypair() -> (publicJwk: JWK, privateJwk: JWK) {
        let priv = P256.KeyAgreement.PrivateKey()
        return (publicJWK(priv.publicKey), privateJWK(priv))
    }

    // MARK: - 개인키 감싸기 (PBKDF2 → AES-GCM). 웹 wrapPrivateKey 와 동일.
    static func wrapPrivateKey(_ privateJwk: JWK, secret: String) throws -> WrappedKey {
        let salt = randomBytes(16)
        let key = SymmetricKey(data: pbkdf2(secret, salt: salt))
        let plain = try JSONEncoder().encode(minimal(privateJwk)) // {kty,crv,x,y,d}
        let sealed = try AES.GCM.seal(plain, using: key)
        // 웹은 iv 와 (ciphertext||tag)를 분리 저장한다.
        return WrappedKey(
            salt: b64(salt),
            iv: b64(Data(sealed.nonce)),
            ciphertext: b64(sealed.ciphertext + sealed.tag))
    }

    static func unwrapPrivateKey(_ wrapped: WrappedKey, secret: String) throws -> JWK {
        guard let salt = deB64(wrapped.salt), let iv = deB64(wrapped.iv), let ct = deB64(wrapped.ciphertext)
        else { throw CryptoError.decryptFailed }
        let key = SymmetricKey(data: pbkdf2(secret, salt: [UInt8](salt)))
        let box = try AES.GCM.SealedBox(combined: iv + ct)
        let plain: Data
        do { plain = try AES.GCM.open(box, using: key) } catch { throw CryptoError.decryptFailed }
        return try JSONDecoder().decode(JWK.self, from: plain)
    }

    // MARK: - 글 암호화 (하이브리드)
    static func encryptForRecipients(_ plaintext: String,
                                     recipients: [(accountId: String, publicJwk: JWK)]) throws -> EncryptedIssue {
        guard !recipients.isEmpty else { throw CryptoError.badKey }
        let ck = SymmetricKey(size: .bits256)
        let sealed = try AES.GCM.seal(Data(plaintext.utf8), using: ck)
        // payload = iv || ciphertext || tag = SealedBox.combined
        guard let payload = sealed.combined else { throw CryptoError.decryptFailed }
        let rawCK = ck.withUnsafeBytes { Data($0) }

        var keys: [RecipientKey] = []
        for r in recipients {
            let recipientPub = try importPublic(r.publicJwk)
            let eph = P256.KeyAgreement.PrivateKey()
            let wrapKey = try sharedAesKey(privateKey: eph, publicKey: recipientPub)
            let wrapped = try AES.GCM.seal(rawCK, using: wrapKey)
            keys.append(RecipientKey(
                accountId: r.accountId,
                ephemeralPub: publicJWK(eph.publicKey),
                wrappedCK: b64(wrapped.ciphertext + wrapped.tag),
                iv: b64(Data(wrapped.nonce))))
        }
        return EncryptedIssue(alg: alg, payload: b64(payload), keys: keys)
    }

    static func decryptAsRecipient(_ enc: EncryptedIssue, accountId: String, privateJwk: JWK) throws -> String {
        guard let entry = enc.keys.first(where: { $0.accountId == accountId }) else { throw CryptoError.notRecipient }
        let priv = try importPrivate(privateJwk)
        let ephPub = try importPublic(entry.ephemeralPub)
        let wrapKey = try sharedAesKey(privateKey: priv, publicKey: ephPub)
        guard let iv = deB64(entry.iv), let wct = deB64(entry.wrappedCK), let payload = deB64(enc.payload)
        else { throw CryptoError.decryptFailed }
        let ckData: Data
        do { ckData = try AES.GCM.open(try AES.GCM.SealedBox(combined: iv + wct), using: wrapKey) }
        catch { throw CryptoError.decryptFailed }
        let ck = SymmetricKey(data: ckData)
        let plain: Data
        do { plain = try AES.GCM.open(try AES.GCM.SealedBox(combined: payload), using: ck) }
        catch { throw CryptoError.decryptFailed }
        return String(decoding: plain, as: UTF8.self)
    }

    // MARK: - 복구코드 (Crockford base32, 4자 그룹) — 웹과 같은 형식
    static func generateRecoveryCode() -> String {
        let base32 = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
        let bytes = randomBytes(16)
        var out = ""
        for b in bytes { out.append(base32[Int(b & 31)]); out.append(base32[Int((b >> 3) & 31)]) }
        return stride(from: 0, to: out.count, by: 4).map {
            let s = out.index(out.startIndex, offsetBy: $0)
            let e = out.index(s, offsetBy: min(4, out.count - $0))
            return String(out[s..<e])
        }.joined(separator: "-")
    }

    // MARK: - ECDH → HKDF → AES-256 키
    private static func sharedAesKey(privateKey: P256.KeyAgreement.PrivateKey,
                                     publicKey: P256.KeyAgreement.PublicKey) throws -> SymmetricKey {
        let shared = try privateKey.sharedSecretFromKeyAgreement(with: publicKey)
        return shared.hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: Data(), sharedInfo: Data(alg.utf8), outputByteCount: 32)
    }

    // MARK: - JWK <-> CryptoKit
    private static func publicJWK(_ pub: P256.KeyAgreement.PublicKey) -> JWK {
        let raw = pub.rawRepresentation // 64B = x(32) || y(32)
        return JWK(kty: "EC", crv: "P-256", x: b64url(raw.prefix(32)), y: b64url(raw.suffix(32)), d: nil)
    }
    private static func privateJWK(_ priv: P256.KeyAgreement.PrivateKey) -> JWK {
        var jwk = publicJWK(priv.publicKey)
        jwk.d = b64url(priv.rawRepresentation) // 32B scalar
        return jwk
    }
    private static func importPublic(_ jwk: JWK) throws -> P256.KeyAgreement.PublicKey {
        guard let x = deB64url(jwk.x), let y = deB64url(jwk.y) else { throw CryptoError.badKey }
        return try P256.KeyAgreement.PublicKey(rawRepresentation: x + y)
    }
    private static func importPrivate(_ jwk: JWK) throws -> P256.KeyAgreement.PrivateKey {
        guard let d = jwk.d, let scalar = deB64url(d) else { throw CryptoError.badKey }
        return try P256.KeyAgreement.PrivateKey(rawRepresentation: scalar)
    }
    private static func minimal(_ jwk: JWK) -> JWK {
        JWK(kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d)
    }

    // MARK: - PBKDF2-SHA256 (CommonCrypto, PasswordHash.swift 와 같은 방식)
    private static func pbkdf2(_ password: String, salt: [UInt8]) -> Data {
        var out = [UInt8](repeating: 0, count: 32)
        let pw = [UInt8](password.utf8)
        _ = pw.withUnsafeBufferPointer { pwPtr in
            salt.withUnsafeBufferPointer { saltPtr in
                CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    pwPtr.baseAddress?.withMemoryRebound(to: CChar.self, capacity: pw.count) { $0 }, pw.count,
                    saltPtr.baseAddress, salt.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), 210_000,
                    &out, out.count)
            }
        }
        return Data(out)
    }

    // MARK: - base64 helpers (표준 / url)
    private static func randomBytes(_ n: Int) -> [UInt8] {
        var b = [UInt8](repeating: 0, count: n); _ = SecRandomCopyBytes(kSecRandomDefault, n, &b); return b
    }
    private static func b64(_ d: Data) -> String { d.base64EncodedString() }
    private static func b64(_ b: [UInt8]) -> String { Data(b).base64EncodedString() }
    private static func deB64(_ s: String) -> Data? { Data(base64Encoded: s) }
    private static func b64url<S: Sequence>(_ bytes: S) -> String where S.Element == UInt8 {
        Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
    private static func deB64url(_ s: String) -> Data? {
        var t = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while t.count % 4 != 0 { t += "=" }
        return Data(base64Encoded: t)
    }
}
