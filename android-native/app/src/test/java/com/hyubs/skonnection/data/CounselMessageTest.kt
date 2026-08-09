package com.hyubs.skonnection.data

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 상담 대화는 웹·iOS와 **같은 테이블**을 공유한다. 컬럼 이름이 한 글자만 어긋나도
 * 쓰기는 조용히 성공하고(그 컬럼만 null), 읽을 때 빈 대화로 보인다.
 * 그래서 이름 매핑과 시각 형식을 값으로 못박는다.
 */
class CounselMessageTest {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    @Test fun `웹이 쓴 행을 그대로 읽는다`() {
        val payload = """
          [{"id":"CM-MSIP50O1t1t","session_id":"CS-MSINAJFZqrq","author":"suhyunle@sk.com",
            "mode":"counsel","role":"assistant","content":"그 마음 충분히 이해돼요.",
            "partner_name":"김승현","created_at":"2026-08-07T08:42:16.775+00:00"}]
        """.trimIndent()
        val m = json.decodeFromString(ListSerializer(CounselMessage.serializer()), payload).single()
        assertEquals("CS-MSINAJFZqrq", m.sessionId)
        assertEquals("suhyunle@sk.com", m.author)
        assertEquals("assistant", m.role)
        assertEquals("김승현", m.partnerName)
    }

    @Test fun `우리가 쓰는 행은 snake_case 컬럼명으로 나간다`() {
        val out = json.encodeToString(
            CounselMessage.serializer(),
            CounselMessage(
                id = "CM-A1", sessionId = "CS-A1", author = "me@sk.com", mode = "rule",
                role = "user", content = "연차는 며칠 전에 올리나요?",
                partnerName = null, createdAt = "2026-08-10T08:15:23.456Z",
            ),
        )
        // 컬럼명이 다르면 PostgREST 가 그 필드를 버리고, 나중에 읽을 때 빈칸이 된다.
        assertTrue(out, out.contains("\"session_id\":\"CS-A1\""))
        assertTrue(out, out.contains("\"created_at\":\"2026-08-10T08:15:23.456Z\""))
        assertTrue(out, out.contains("\"partner_name\":null"))
    }

    @Test fun `시각에 밀리초가 들어간다 — 같은 초에 질문과 답이 겹쳐도 순서가 안 뒤집히게`() {
        val now = CounselRepository.ISO_FOR_TEST.format(java.util.Date(1_786_000_000_123L))
        assertEquals("2026-08-06T07:06:40.123Z", now)
        // 문자열 정렬이 곧 시간 정렬이어야 한다 — created_at.asc 로 서버에서 정렬하기 때문이다.
        val earlier = CounselRepository.ISO_FOR_TEST.format(java.util.Date(1_786_000_000_122L))
        assertTrue(earlier < now)
    }
}
