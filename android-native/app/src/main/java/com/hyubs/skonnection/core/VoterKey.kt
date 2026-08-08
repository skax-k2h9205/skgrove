package com.hyubs.skonnection.core

import java.security.MessageDigest

/**
 * 투표자 식별용 단방향 키(웹 ballotStore.makeVoterKey 와 동일).
 * SHA-256("<agendaId>:<email 소문자·trim>") 의 hex. 안건마다 다른 키가 나와
 * 저장된 투표용지만으로는 개인의 투표 이력을 이을 수 없다.
 */
object VoterKey {
    fun make(email: String, agendaId: String): String {
        val source = "$agendaId:${email.trim().lowercase()}"
        val digest = MessageDigest.getInstance("SHA-256").digest(source.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
