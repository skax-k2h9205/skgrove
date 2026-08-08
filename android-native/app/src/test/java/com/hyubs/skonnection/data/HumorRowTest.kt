package com.hyubs.skonnection.data

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class HumorRowTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test fun decodesHumorPostRow() {
        val payload = """
          [{"id":"H1","author":"김수정","body":"점심 뭐 먹지",
            "media_url":"","created_at":"2026-08-01","liked_by":["김승현","이두민"]}]
        """.trimIndent()
        val rows = json.decodeFromString(ListSerializer(HumorPostRow.serializer()), payload)
        val post = rows.single().toPost()
        assertEquals("김수정", post.author)
        assertEquals("점심 뭐 먹지", post.body)
        assertEquals(2, post.laughs)
    }

    @Test fun handlesNullLikedBy() {
        val payload = """[{"id":"H2","author":"이관국","body":"","created_at":"2026-08-02"}]"""
        val rows = json.decodeFromString(ListSerializer(HumorPostRow.serializer()), payload)
        assertEquals(0, rows.single().toPost().laughs)
    }
}
