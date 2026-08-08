package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

/** 함께하기 그룹(모임·장터) 읽기 리포지토리. */
class GatheringRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Gathering> =
        supabase.select(
            table = "gatherings",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(GatheringRow.serializer()),
        ).map { it.toGathering() }
}

class MarketRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<MarketItem> =
        supabase.select(
            table = "market_items",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(MarketItemRow.serializer()),
        ).map { it.toItem() }
}
