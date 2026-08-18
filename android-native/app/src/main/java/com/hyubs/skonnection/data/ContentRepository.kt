package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

/** image_url 만 갱신하는 최소 패치 바디. */
@Serializable
private data class ImageUrlPatch(@SerialName("image_url") val imageUrl: String)

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

@Serializable
private data class CoffeePickPatch(@SerialName("coffee_pick") val coffeePick: String)

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

    /** 커피 내기 당첨자 확정 — 웹·iOS와 같은 gatherings.coffee_pick 에 남긴다. */
    suspend fun setCoffeePick(gatheringId: String, name: String) =
        supabase.patch("gatherings", gatheringId, CoffeePickPatch(name), CoffeePickPatch.serializer())

    /** 만든 모임의 id 를 돌려준다 — 호출부가 이어서 주최자 신청·썸네일 생성을 건다. */
    suspend fun create(
        kind: String, title: String, place: String, description: String,
        capacity: Int?, host: String, part: String,
    ): String {
        val id = "GAT-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "gatherings",
            NewGathering(
                id = id, kind = kind, title = title,
                // place·description 은 NOT NULL(기본값 '') — null 대신 빈 문자열로 보낸다.
                place = place, description = description,
                capacity = capacity, host = host, part = part,
                createdAt = java.time.Instant.now().toString(),
            ),
            NewGathering.serializer(),
        )
        return id
    }

    /** 생성된 썸네일 URL 반영. */
    suspend fun setImageUrl(id: String, url: String) =
        supabase.patch("gatherings", id, ImageUrlPatch(url), ImageUrlPatch.serializer())

    /** admin 전용 모임 삭제(신청 기록은 FK on delete cascade 로 함께 정리된다는 가정, 아니면 남을 수 있음). */
    suspend fun delete(id: String) {
        supabase.delete("gathering_signups", "gathering_id=eq.$id")
        supabase.delete("gatherings", "id=eq.$id")
    }
}

@Serializable
private data class NewGathering(
    val id: String,
    val kind: String,
    val title: String,
    val place: String,
    val description: String,
    val capacity: Int?,
    val host: String,
    val part: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
private data class BidRow(
    @SerialName("item_id") val itemId: String,
    val name: String,
    val amount: Int? = null,
)

@Serializable
private data class NewBid(
    val id: String,
    @SerialName("item_id") val itemId: String,
    val name: String,
    val amount: Int,
    @SerialName("created_at") val createdAt: String,
)

data class TopBid(val name: String, val amount: Int)

class MarketRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<MarketItem> =
        supabase.select(
            table = "market_items",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(MarketItemRow.serializer()),
        ).map { it.toItem() }

    /** 물건별 최고 입찰(item_id → TopBid). 없으면 미포함. */
    suspend fun loadTopBids(): Map<String, TopBid> =
        supabase.select("market_bids", "select=item_id,name,amount", ListSerializer(BidRow.serializer()))
            .groupBy { it.itemId }
            .mapValues { (_, bids) ->
                val top = bids.maxByOrNull { it.amount ?: 0 }!!
                TopBid(top.name, top.amount ?: 0)
            }

    suspend fun bid(itemId: String, name: String, amount: Int) {
        val id = "BID-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "market_bids",
            NewBid(id, itemId, name, amount, java.time.Instant.now().toString()),
            NewBid.serializer(),
        )
    }

    suspend fun create(
        kind: String, title: String, description: String,
        startPrice: Int, minStep: Int, seller: String,
    ) {
        val id = "MKT-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "market_items",
            NewMarketItem(
                // description 은 NOT NULL(기본값 '') — 빈 문자열로 보낸다.
                id = id, kind = kind, title = title, description = description,
                startPrice = startPrice, minStep = minStep, seller = seller,
                createdAt = java.time.Instant.now().toString(),
            ),
            NewMarketItem.serializer(),
        )
    }

    suspend fun delete(id: String) {
        supabase.delete("market_bids", "item_id=eq.$id")
        supabase.delete("market_items", "id=eq.$id")
    }
}

@Serializable
private data class NewMarketItem(
    val id: String,
    val kind: String,
    val title: String,
    val description: String,
    @SerialName("start_price") val startPrice: Int,
    @SerialName("min_step") val minStep: Int,
    val seller: String,
    @SerialName("created_at") val createdAt: String,
)
