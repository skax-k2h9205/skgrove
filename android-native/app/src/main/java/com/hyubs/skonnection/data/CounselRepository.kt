package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * AI 상담 대화 영속화 — 웹 `counselStore.ts` · iOS `Counsel.swift` 와 **같은 테이블**을 쓴다.
 * 웹에서 한 상담이 앱에도, 앱에서 한 상담이 웹에도 이어진다.
 *
 * 프라이버시 주의: 이 앱은 실제 인증(Supabase Auth)이 없고 anon 키 + prototype RLS다.
 * author 필터는 "소프트 스코핑"이며 DB 가 남의 상담 열람을 강제로 막지는 못한다
 * (대나무숲·안건과 같은 신뢰 모델).
 */
@Serializable
data class CounselMessage(
    val id: String,
    @SerialName("session_id") val sessionId: String = "",
    val author: String = "",
    val mode: String = "counsel",
    val role: String = "user",
    val content: String = "",
    @SerialName("partner_name") val partnerName: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

class CounselRepository(private val supabase: SupabaseClient) {
    companion object {
        private const val TABLE = "counsel_messages"

        /**
         * 밀리초까지 남긴다. 같은 초에 질문과 답이 겹치면 정렬이 뒤집혀
         * 질문 아래에 답이 아니라 답 아래에 질문이 붙는다.
         * 서버에서 `created_at.asc` 로 정렬하므로 문자열 정렬이 곧 시간 정렬이어야 한다.
         */
        private val ISO: SimpleDateFormat
            get() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }

        /** 테스트에서 형식을 값으로 못박기 위해 노출한다. SimpleDateFormat 은 스레드 안전하지 않아 매번 새로 만든다. */
        val ISO_FOR_TEST: SimpleDateFormat get() = ISO
    }

    fun now(): String = ISO.format(Date())

    /** 한 사람의 상담 기록을 시간순으로. */
    suspend fun loadFor(author: String): List<CounselMessage> {
        if (author.isBlank()) return emptyList()
        val escaped = URLEncoder.encode(author, "UTF-8")
        return supabase.select(
            TABLE,
            "select=*&author=eq.$escaped&order=created_at.asc",
            ListSerializer(CounselMessage.serializer()),
        )
    }

    suspend fun add(message: CounselMessage) {
        supabase.insert(TABLE, message, CounselMessage.serializer())
    }

    /**
     * 지정한 메시지들을 지운다.
     *
     * author 를 필터로 쓰지 않는다 — 이메일에 든 점·플러스가 PostgREST 필터 문법과
     * 부딪힐 수 있다. 지울 대상은 이미 화면에 있으므로 id 목록이면 충분하고 안전하다.
     */
    suspend fun deleteAll(ids: List<String>) {
        if (ids.isEmpty()) return
        supabase.delete(TABLE, "id=in.(${ids.joinToString(",")})")
    }
}
