package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** market_items 테이블 행(웹 marketStore.ts 매핑). 이음장터(경매·나눔). */
@Serializable
data class MarketItemRow(
    val id: String,
    val kind: String? = null,
    val title: String? = null,
    val description: String? = null,
    @SerialName("start_price") val startPrice: Int? = null,
    @SerialName("min_step") val minStep: Int? = null,
    @SerialName("close_at") val closeAt: String? = null,
    val place: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    val seller: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    val canceled: Boolean? = null,
)

data class MarketItem(
    val id: String,
    val kind: String,
    val title: String,
    val description: String,
    val startPrice: Int,
    val minStep: Int,
    val place: String,
    val imageUrl: String,
    val seller: String,
    val canceled: Boolean,
)

fun MarketItemRow.toItem() = MarketItem(
    id = id,
    kind = kind ?: "auction",
    title = title ?: "",
    description = description ?: "",
    startPrice = startPrice ?: 0,
    minStep = minStep ?: 1000,
    place = place ?: "",
    imageUrl = imageUrl ?: "",
    seller = seller ?: "",
    canceled = canceled ?: false,
)
