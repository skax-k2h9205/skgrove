package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

@Serializable
private data class SignupRow(
    @SerialName("gathering_id") val gatheringId: String,
    val name: String,
)

@Serializable
private data class NewSignup(
    val id: String,
    @SerialName("gathering_id") val gatheringId: String,
    val name: String,
    @SerialName("created_at") val createdAt: String,
)

/** 함께하기 그룹(모임·장터) 리포지토리. */
class GatheringRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Gathering> =
        supabase.select(
            table = "gatherings",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(GatheringRow.serializer()),
        ).map { it.toGathering() }

    /** 모임별 신청 인원(gathering_id → 이름 목록). */
    suspend fun loadSignups(): Map<String, List<String>> =
        supabase.select("gathering_signups", "select=gathering_id,name", ListSerializer(SignupRow.serializer()))
            .groupBy({ it.gatheringId }, { it.name })

    suspend fun join(gatheringId: String, name: String) {
        val id = "SGN-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "gathering_signups",
            NewSignup(id, gatheringId, name, java.time.Instant.now().toString()),
            NewSignup.serializer(),
        )
    }

    suspend fun leave(gatheringId: String, name: String) {
        val encodedName = java.net.URLEncoder.encode(name, "UTF-8")
        supabase.delete("gathering_signups", "gathering_id=eq.$gatheringId&name=eq.$encodedName")
    }
}

class MarketRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<MarketItem> =
        supabase.select(
            table = "market_items",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(MarketItemRow.serializer()),
        ).map { it.toItem() }
}
