package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** humor_posts 테이블 행(웹 humorStore.ts / iOS Humor.swift 매핑). */
@Serializable
data class HumorPostRow(
    val id: String,
    val author: String = "",
    val body: String? = null,
    @SerialName("media_url") val mediaUrl: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("liked_by") val likedBy: List<String>? = null,
)

data class HumorPost(
    val id: String,
    val author: String,
    val body: String,
    val createdAt: String,
    val mediaUrl: String,
    val likedBy: List<String>,
) {
    val laughs: Int get() = likedBy.size
    fun likedBy(name: String?) = name != null && likedBy.contains(name)
}

fun HumorPostRow.toPost() = HumorPost(
    id = id,
    author = author,
    body = body ?: "",
    createdAt = createdAt ?: "",
    mediaUrl = mediaUrl ?: imageUrl ?: "",
    likedBy = likedBy ?: emptyList(),
)
