package com.hyubs.skonnection.data

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
data class ChatTurn(val role: String, val content: String)

/**
 * 상담에 실어 보내는 성향 요약(웹 aiChat.briefOf 대응).
 * 서버 페르소나가 "나와 상대의 성향을 상대의 언어로 번역"하는 데 쓴다.
 */
@Serializable
data class ProfileBrief(
    val name: String,
    val part: String = "",
    val role: String = "",
    val character: String = "",
    val trait: String = "",
    val style: String = "",
    val collaboration: String = "",
    val mbti: String = "",
    val disc: String = "",
)

// self·partner 는 기본값 null 이고 encodeDefaults 가 꺼져 있어, 없으면 아예 보내지 않는다.
@Serializable
private data class ChatBody(
    val mode: String,
    val messages: List<ChatTurn>,
    val self: ProfileBrief? = null,
    val partner: ProfileBrief? = null,
)

@Serializable
private data class ChatResponse(val ok: Boolean = false, val text: String? = null, val reason: String? = null)

/**
 * AI 상담 챗봇 — 웹과 같은 서버리스 프록시(/api/chat)를 재사용한다.
 * 프로덕션 웹(connectioner.vercel.app)이 OPENROUTER_API_KEY를 서버에 보관하므로
 * 앱은 키 없이 이 엔드포인트만 호출한다([[skgrove-vercel-llm-integration]]).
 * mode: "counsel"(마음 상담) | "rule"(팀지식).
 *
 * 상담 모드에서는 나와 상대의 성향을 함께 보낸다. 성향이 없으면 답이 일반론에 머문다.
 */
class ChatRepository(
    private val http: HttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
    private val baseUrl: String = "https://connectioner.vercel.app",
) {
    /** 성공 시 답변 텍스트, 실패 시 예외 메시지를 담은 Result. */
    suspend fun send(
        mode: String,
        messages: List<ChatTurn>,
        self: ProfileBrief? = null,
        partner: ProfileBrief? = null,
    ): Result<String> = runCatching {
        val resp = http.post("$baseUrl/api/chat") {
            contentType(ContentType.Application.Json)
            header("Accept", "application/json")
            setBody(json.encodeToString(ChatBody.serializer(), ChatBody(mode, messages, self, partner)))
        }
        val parsed = json.decodeFromString(ChatResponse.serializer(), resp.bodyAsText())
        if (parsed.ok && !parsed.text.isNullOrBlank()) parsed.text
        else throw IllegalStateException(parsed.reason ?: "빈 응답")
    }
}
