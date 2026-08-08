package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class HumorRepository(private val supabase: SupabaseClient) {
    suspend fun loadPosts(): List<HumorPost> =
        supabase.select(
            table = "humor_posts",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(HumorPostRow.serializer()),
        ).map { it.toPost() }
}
