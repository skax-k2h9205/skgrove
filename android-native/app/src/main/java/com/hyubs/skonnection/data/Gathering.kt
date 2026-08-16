package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** gatherings 테이블 행(웹 gatheringStore.ts 매핑). 모임·번개. */
@Serializable
data class GatheringRow(
    val id: String,
    val kind: String? = null,
    val title: String? = null,
    @SerialName("start_at") val startAt: String? = null,
    val place: String? = null,
    val capacity: Int? = null,
    @SerialName("close_at") val closeAt: String? = null,
    @SerialName("min_people") val minPeople: Int? = null,
    val description: String? = null,
    val part: String? = null,
    val cost: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    val host: String? = null,
    @SerialName("coffee_pick") val coffeePick: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

data class Gathering(
    val id: String,
    val kind: String,
    val title: String,
    val startAt: String,
    val place: String,
    val capacity: Int?,
    val description: String,
    val part: String,
    val cost: String,
    val imageUrl: String,
    val host: String,
    val coffeePick: String = "",
) {
    /** 커피 내기 모임인가(웹·iOS가 kind="커피"로 만든다). */
    val isCoffee: Boolean get() = kind == "커피"
}

fun GatheringRow.toGathering() = Gathering(
    id = id,
    kind = kind ?: "모임",
    title = title ?: "",
    startAt = startAt ?: "",
    place = place ?: "",
    capacity = capacity,
    description = description ?: "",
    part = part ?: "전체",
    cost = cost ?: "",
    imageUrl = imageUrl ?: "",
    host = host ?: "",
    coffeePick = coffeePick ?: "",
)
