import Foundation

/// leader_keys 테이블 I/O + 세션 개인키 캐시. 웹 `leaderKeyStore.ts` 이식.
/// 개인키는 패스프레이즈/복구코드로 감싼 암호문만 저장(운영자 불가독).
enum LeaderKeysStore {
    struct Record {
        let accountId: String
        let publicJwk: IssueCrypto.JWK
        let encPrivPassphrase: IssueCrypto.WrappedKey
        let encPrivRecovery: IssueCrypto.WrappedKey
        let alg: String
    }

    private struct Row: Codable {
        let account_id: String
        let public_key: String
        let enc_priv_passphrase: String
        let enc_priv_recovery: String
        let salt_pass: String
        let salt_recovery: String
        let alg: String
    }
    private struct PubRow: Decodable { let account_id: String; let public_key: String }

    /// 여러 리더 공개키 일괄 조회(익명 제출 암호화용).
    static func loadPublicKeys(_ accountIds: [String]) async -> [String: IssueCrypto.JWK] {
        var out: [String: IssueCrypto.JWK] = [:]
        guard Supabase.isConfigured, !accountIds.isEmpty else { return out }
        let inList = accountIds.joined(separator: ",")
        let q = "account_id=in.(\(inList))&select=account_id,public_key"
        guard let rows = try? await Supabase.select("leader_keys", query: q, as: PubRow.self) else { return out }
        for r in rows {
            if let jwk = try? JSONDecoder().decode(IssueCrypto.JWK.self, from: Data(r.public_key.utf8)) {
                out[r.account_id] = jwk
            }
        }
        return out
    }

    /// 한 리더의 전체 레코드(감싼 개인키 포함) — 열람 복호화 시.
    static func loadRecord(_ accountId: String) async -> Record? {
        guard Supabase.isConfigured else { return nil }
        let q = "account_id=eq.\(accountId)&select=*&limit=1"
        guard let rows = try? await Supabase.select("leader_keys", query: q, as: Row.self),
              let row = rows.first else { return nil }
        return decode(row)
    }

    /// 리더 키 등록/재설정(upsert).
    static func save(_ rec: Record) async -> Bool {
        guard Supabase.isConfigured else { return true }
        do { try await Supabase.upsert("leader_keys", encode(rec), onConflict: "account_id"); return true }
        catch { return false }
    }

    private static func encode(_ rec: Record) -> Row {
        let e = JSONEncoder()
        func s<T: Encodable>(_ v: T) -> String { String(data: (try? e.encode(v)) ?? Data(), encoding: .utf8) ?? "" }
        return Row(account_id: rec.accountId, public_key: s(rec.publicJwk),
                   enc_priv_passphrase: s(rec.encPrivPassphrase), enc_priv_recovery: s(rec.encPrivRecovery),
                   salt_pass: rec.encPrivPassphrase.salt, salt_recovery: rec.encPrivRecovery.salt, alg: rec.alg)
    }
    private static func decode(_ row: Row) -> Record? {
        let d = JSONDecoder()
        guard let pub = try? d.decode(IssueCrypto.JWK.self, from: Data(row.public_key.utf8)),
              let ep = try? d.decode(IssueCrypto.WrappedKey.self, from: Data(row.enc_priv_passphrase.utf8)),
              let er = try? d.decode(IssueCrypto.WrappedKey.self, from: Data(row.enc_priv_recovery.utf8))
        else { return nil }
        return Record(accountId: row.account_id, publicJwk: pub, encPrivPassphrase: ep, encPrivRecovery: er, alg: row.alg)
    }

    // 세션 개인키 캐시(메모리만 — 새로고침하면 패스프레이즈 재입력).
    @MainActor private static var cache: [String: IssueCrypto.JWK] = [:]
    @MainActor static func cachePrivateKey(_ accountId: String, _ jwk: IssueCrypto.JWK) { cache[accountId] = jwk }
    @MainActor static func cachedPrivateKey(_ accountId: String) -> IssueCrypto.JWK? { cache[accountId] }
}
