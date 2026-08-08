package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDate

class HumorRepository(private val supabase: SupabaseClient) {
    suspend fun loadPosts(): List<HumorPost> =
        supabase.select(
            table = "humor_posts",
            query = "select=*&order=created_at.desc",
            deserializer = ListSerializer(HumorPostRow.serializer()),
        ).map { it.toPost() }

    /** 좋아요 토글 — liked_by 배열에서 이름을 넣거나 뺀다(웹/iOS와 동일). */
    suspend fun setLikedBy(postId: String, likedBy: List<String>) {
        supabase.patch(
            table = "humor_posts",
            id = postId,
            fields = LikedByPatch(likedBy),
            serializer = LikedByPatch.serializer(),
        )
    }

    /** 특정 글의 댓글(시간순). */
    suspend fun loadComments(postId: String): List<HumorComment> =
        supabase.select(
            table = "humor_comments",
            query = "select=*&post_id=eq.$postId&order=created_at.asc",
            deserializer = ListSerializer(HumorCommentRow.serializer()),
        ).map { it.toComment() }

    /** 댓글 등록. */
    suspend fun addComment(postId: String, author: String, body: String) {
        val id = "HMC-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "humor_comments",
            NewComment(id, postId, author, body, LocalDate.now().toString()),
            NewComment.serializer(),
        )
    }

    /** 글 삭제(admin 전용) — 글 + 딸린 댓글 제거. */
    suspend fun deletePost(postId: String) {
        supabase.delete("humor_comments", "post_id=eq.$postId")
        supabase.delete("humor_posts", "id=eq.$postId")
    }

    /** 새 유머 글 등록. */
    suspend fun createPost(author: String, body: String, mediaUrl: String) {
        val id = "H-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            table = "humor_posts",
            row = NewHumorPost(
                id = id,
                author = author,
                body = body,
                mediaUrl = mediaUrl,
                createdAt = LocalDate.now().toString(),
                likedBy = emptyList(),
            ),
            serializer = NewHumorPost.serializer(),
        )
    }
}

@Serializable
private data class LikedByPatch(@SerialName("liked_by") val likedBy: List<String>)

@Serializable
private data class NewComment(
    val id: String,
    @SerialName("post_id") val postId: String,
    val author: String,
    val body: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
private data class NewHumorPost(
    val id: String,
    val author: String,
    val body: String,
    @SerialName("media_url") val mediaUrl: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("liked_by") val likedBy: List<String>,
)
