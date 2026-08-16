package com.hyubs.skonnection.data

import com.hyubs.skonnection.core.IssueCrypto
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * 접수 본문을 수신자 공개키로 E2E 암호화 — 웹 `App.submitIssue`+`issueEncryptionPolicy` /
 * iOS `AnonEncrypt.swift` 이식.
 *  - 익명: 대상 리더만 수신자(운영자·작성자 불명 모두 불가독).
 *  - 실명 '리더만 보기': 대상 리더 + 작성자 본인 수신자(작성자는 '내 접수'에서 재열람).
 * 수신자 공개키가 하나도 없으면 null(평문 폴백). 그 외(실명 공개가능)도 null.
 */
object AnonEncrypt {
    @Serializable
    private data class Payload(val body: String, val expectedChange: String)

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    data class Plan(val encrypt: Boolean, val includeAuthor: Boolean)

    /** 암호화 여부와 작성자 포함 여부. 웹 issueEncryptionPolicy 와 동일. */
    fun plan(identity: String, visibility: String): Plan = when {
        identity == "익명" -> Plan(encrypt = true, includeAuthor = false)
        identity == "실명" && visibility == "리더만 보기" -> Plan(encrypt = true, includeAuthor = true)
        else -> Plan(encrypt = false, includeAuthor = false)
    }

    /**
     * 정책에 따라 암호화. 평문 유지(암호화 안 함/수신자 없음)면 null 반환 → 호출부는 원본을 그대로 저장.
     * 운영자(커넥셔너)는 role 이 팀리더/파트리더가 아니므로 자연히 수신자에서 제외된다.
     */
    suspend fun encryptIfNeeded(
        store: LeaderKeysStore,
        accounts: List<Account>,
        identity: String,
        visibility: String,
        target: String,
        body: String,
        expectedChange: String,
        authorAccountId: String?,
    ): IssueCrypto.EncryptedIssue? {
        val p = plan(identity, visibility)
        if (!p.encrypt) return null
        val targetRole = if (target == "팀리더") "팀리더" else "파트리더"
        val leaderIds = accounts.filter { it.role == targetRole }.map { it.id }
        val authorId = if (p.includeAuthor) authorAccountId else null
        val ids = (leaderIds + listOfNotNull(authorId)).distinct()
        val pubKeys = store.loadPublicKeys(ids)
        val recipients = ids.mapNotNull { id -> pubKeys[id]?.let { id to it } }
        if (recipients.isEmpty()) return null // 평문 폴백
        val text = json.encodeToString(Payload.serializer(), Payload(body, expectedChange))
        return runCatching { IssueCrypto.encryptForRecipients(text, recipients) }.getOrNull()
    }

    /** 복호화된 payload → (본문, 기대변화). 실패 시 null. */
    fun decodePayload(text: String): Pair<String, String>? = runCatching {
        val p = json.decodeFromString(Payload.serializer(), text)
        p.body to p.expectedChange
    }.getOrNull()
}
