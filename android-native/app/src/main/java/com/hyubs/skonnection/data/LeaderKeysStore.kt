package com.hyubs.skonnection.data

import com.hyubs.skonnection.core.IssueCrypto
import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * leader_keys 테이블 I/O — 웹 `leaderKeyStore.ts` / iOS `LeaderKeysStore.swift`와 **저장 포맷 호환**.
 * public_key·enc_priv_* 컬럼은 JSON 문자열(JWK / WrappedKey)을 담는다. 공개키는 누구나 읽고,
 * 감싼 개인키는 암호문이라 노출돼도 무의미하다. 계정 범용(리더뿐 아니라 실명글 작성자 키도 저장).
 */
data class LeaderKeyRecord(
    val accountId: String,
    val publicJwk: IssueCrypto.Jwk,
    val encPrivPassphrase: IssueCrypto.WrappedKey,
    val encPrivRecovery: IssueCrypto.WrappedKey,
    val alg: String,
)

@Serializable
private data class PubRow(
    @SerialName("account_id") val accountId: String,
    @SerialName("public_key") val publicKey: String,
)

@Serializable
private data class LeaderKeyRow(
    @SerialName("account_id") val accountId: String,
    @SerialName("public_key") val publicKey: String,
    @SerialName("enc_priv_passphrase") val encPrivPassphrase: String,
    @SerialName("enc_priv_recovery") val encPrivRecovery: String,
    @SerialName("salt_pass") val saltPass: String,
    @SerialName("salt_recovery") val saltRecovery: String,
    val alg: String,
)

class LeaderKeysStore(private val supabase: SupabaseClient) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** 여러 계정의 공개키를 한 번에 로드(제출 시 대상 수신자 공개키 조회용). */
    suspend fun loadPublicKeys(accountIds: List<String>): Map<String, IssueCrypto.Jwk> {
        if (accountIds.isEmpty()) return emptyMap()
        val inList = accountIds.joinToString(",")
        val rows = runCatching {
            supabase.select(
                "leader_keys",
                "select=account_id,public_key&account_id=in.($inList)",
                ListSerializer(PubRow.serializer()),
            )
        }.getOrDefault(emptyList())
        return rows.mapNotNull { r ->
            runCatching { r.accountId to json.decodeFromString(IssueCrypto.Jwk.serializer(), r.publicKey) }.getOrNull()
        }.toMap()
    }

    /** 한 계정의 키 레코드(감싼 개인키 포함). 없으면 null. */
    suspend fun loadRecord(accountId: String): LeaderKeyRecord? {
        val rows = runCatching {
            supabase.select(
                "leader_keys",
                "select=*&account_id=eq.$accountId&limit=1",
                ListSerializer(LeaderKeyRow.serializer()),
            )
        }.getOrDefault(emptyList())
        val row = rows.firstOrNull() ?: return null
        return runCatching {
            LeaderKeyRecord(
                accountId = row.accountId,
                publicJwk = json.decodeFromString(IssueCrypto.Jwk.serializer(), row.publicKey),
                encPrivPassphrase = json.decodeFromString(IssueCrypto.WrappedKey.serializer(), row.encPrivPassphrase),
                encPrivRecovery = json.decodeFromString(IssueCrypto.WrappedKey.serializer(), row.encPrivRecovery),
                alg = row.alg.ifBlank { IssueCrypto.ALG },
            )
        }.getOrNull()
    }

    /** 키 레코드 저장(최초 1회, upsert). salt 컬럼은 조회 편의로 WrappedKey.salt를 복제. */
    suspend fun save(rec: LeaderKeyRecord): Boolean = runCatching {
        supabase.upsert(
            "leader_keys",
            LeaderKeyRow(
                accountId = rec.accountId,
                publicKey = json.encodeToString(IssueCrypto.Jwk.serializer(), rec.publicJwk),
                encPrivPassphrase = json.encodeToString(IssueCrypto.WrappedKey.serializer(), rec.encPrivPassphrase),
                encPrivRecovery = json.encodeToString(IssueCrypto.WrappedKey.serializer(), rec.encPrivRecovery),
                saltPass = rec.encPrivPassphrase.salt,
                saltRecovery = rec.encPrivRecovery.salt,
                alg = rec.alg,
            ),
            LeaderKeyRow.serializer(),
            onConflict = "account_id",
        )
        true
    }.getOrDefault(false)
}
