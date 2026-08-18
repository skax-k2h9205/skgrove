package com.hyubs.skonnection.data

import android.util.Base64
import com.hyubs.skonnection.net.SupabaseClient
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class ImageFields(
    val kind: String,
    val title: String,
    val startAt: String = "",
    val place: String = "",
    val capacity: Int? = null,
    val desc: String = "",
)

@Serializable
private data class ImageBody(val gathering: ImageFields)

@Serializable
private data class ImageResponse(val ok: Boolean = false, val dataUri: String? = null, val reason: String? = null)

/**
 * 모임 썸네일 생성 — 웹 `gatheringImage.ts`·iOS `GatheringImage.swift` 와 **같은 서버 함수**를 쓴다.
 * 프롬프트·화풍·키는 전부 서버에 있고 앱은 등록값만 넘긴다.
 *
 * 앱 작성 폼에는 사진 첨부가 없어 등록한 모임은 늘 아이콘 타일이었다. 이제 등록 직후
 * 백그라운드로 그려 올리고 image_url 만 갱신한다 — 실패해도 모임 자체는 멀쩡해야 한다.
 */
class GatheringImageRepository(
    private val http: HttpClient,
    private val supabase: SupabaseClient,
    private val json: Json = Json { ignoreUnknownKeys = true; encodeDefaults = true },
    private val baseUrl: String = "https://connectioner.vercel.app",
) {
    /** 웹 gatheringStore POSTER_BUCKET·iOS GatheringImage.bucket 과 동일. */
    private val bucket = "gathering-images"

    /** 그려 받아 Storage 에 올리고 공개 URL 을 돌려준다. 어느 단계든 실패하면 null. */
    suspend fun makeAndUpload(
        id: String, kind: String, title: String, startAt: String, place: String, capacity: Int?, desc: String,
    ): String? = runCatching {
        val resp = http.post("$baseUrl/api/gathering-image") {
            contentType(ContentType.Application.Json)
            header("Accept", "application/json")
            setBody(json.encodeToString(ImageBody.serializer(),
                ImageBody(ImageFields(kind, title, startAt, place, capacity, desc))))
        }
        val parsed = json.decodeFromString(ImageResponse.serializer(), resp.bodyAsText())
        val uri = parsed.dataUri
        if (!parsed.ok || uri.isNullOrBlank()) return null
        val image = decodeDataUri(uri) ?: return null
        supabase.uploadImage(bucket, "$id.${image.ext}", image.bytes, image.mime)
    }.getOrNull()

    data class DecodedImage(val bytes: ByteArray, val mime: String, val ext: String)

    /**
     * `data:image/png;base64,...` → (바이트, MIME, 확장자).
     * 확장자를 MIME 에서 만드는 이유: 모델이 png 가 아니라 jpeg 를 주는 일이 실제로 있었다.
     */
    fun decodeDataUri(dataUri: String): DecodedImage? {
        if (!dataUri.startsWith("data:")) return null
        val comma = dataUri.indexOf(',').takeIf { it > 0 } ?: return null
        val header = dataUri.substring(5, comma)          // image/png;base64
        val mime = header.substringBefore(';').ifBlank { "image/png" }
        val bytes = runCatching { Base64.decode(dataUri.substring(comma + 1), Base64.DEFAULT) }.getOrNull() ?: return null
        return DecodedImage(bytes, mime, mime.substringAfterLast('/', "png"))
    }
}
