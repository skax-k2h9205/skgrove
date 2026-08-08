package com.hyubs.skonnection.net

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupabaseUrlTest {
    private val client = SupabaseClient(http = io.ktor.client.HttpClient())

    @Test fun buildsRestUrlWithQuery() {
        val url = client.restUrl("humor_posts", "select=*&order=created_at.desc")
        assertEquals(
            "https://sjymcpjbmsqapsptvlml.supabase.co/rest/v1/humor_posts?select=*&order=created_at.desc",
            url,
        )
    }

    @Test fun headersCarryAnonKeyBothPlaces() {
        val h = client.headers()
        assertEquals(SupabaseConfig.ANON_KEY, h["apikey"])
        assertEquals("Bearer ${SupabaseConfig.ANON_KEY}", h["Authorization"])
        assertTrue(SupabaseConfig.ANON_KEY.startsWith("eyJ"))
    }
}
