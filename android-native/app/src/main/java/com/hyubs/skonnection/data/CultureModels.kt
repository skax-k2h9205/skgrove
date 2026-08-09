package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ── 동료 성향 (profiles) ──────────────────────────────────────────
@Serializable
data class ProfileRow(
    @SerialName("profile_key") val profileKey: String,
    val name: String = "",
    val part: String = "",
    val role: String = "",
    val character: String = "",
    val trait: String = "",
    val style: String = "",
    val collaboration: String = "",
    @SerialName("mbti_type") val mbtiType: String? = null,
    @SerialName("disc_type") val discType: String? = null,
)

/**
 * 4대 기질 — MBTI 16유형을 팀 협업 관점의 4갈래로 묶는다(Keirsey 기반, iOS Temperament 이식).
 * 16개를 그대로 나열하면 분포가 흩어져 팀 성향이 읽히지 않는다.
 */
enum class Temperament(val label: String, val hint: String) {
    Relational("관계형", "공감·조율 (NF)"),
    Executive("실행형", "행동·해결 (SP)"),
    Standard("기준형", "체계·정리 (SJ)"),
    Contextual("맥락형", "전략·통찰 (NT)");

    companion object {
        /** MBTI 4글자에서 기질을 뽑는다. 형식이 어긋나면 null — 미작성으로 둔다. */
        fun of(mbti: String): Temperament? {
            val m = mbti.uppercase()
            if (m.length != 4) return null
            if (m.contains("N")) return if (m.contains("F")) Relational else Contextual
            return if (m.contains("P")) Executive else Standard
        }
    }
}

data class Profile(
    val key: String, val name: String, val part: String, val role: String,
    val character: String, val trait: String, val style: String,
    val collaboration: String, val mbti: String, val disc: String,
) {
    val temperament: Temperament? get() = Temperament.of(mbti)
    val temperamentLabel: String get() = temperament?.label ?: "미작성"

    /** 협업 힌트로 쓸 한 줄. 협업 가이드가 없으면 성격·특징에서 대신 고른다. */
    val guide: String get() = listOf(collaboration, character, trait, style).firstOrNull { it.isNotBlank() } ?: ""
}

fun ProfileRow.toProfile() = Profile(
    key = profileKey, name = name, part = part, role = role, character = character,
    trait = trait, style = style, collaboration = collaboration,
    mbti = mbtiType ?: "", disc = discType ?: "",
)

// ── 팀 추억 (team_memories) ───────────────────────────────────────
@Serializable
data class MemoryRow(
    // 웹이 Date.now() 값을 id로 쓴다(1786008965572). Int로 받으면 역직렬화가 통째로 실패하고
    // runCatching이 그것을 '추억 없음'으로 삼켜 화면이 조용히 비어 있었다.
    val id: Long,
    val title: String = "",
    @SerialName("event_date") val eventDate: String = "",
    val place: String = "",
    val host: String = "",
    val summary: String = "",
    val tags: List<String>? = null,
)

/**
 * 앨범 안의 사진·영상 한 장(team_memory_assets).
 * 원본은 Supabase Storage에 있고, preview_url이 공개 URL이다.
 */
@Serializable
data class MemoryAssetRow(
    val id: Long,
    @SerialName("memory_id") val memoryId: Long,
    val type: String = "photo",
    val title: String = "",
    val uploader: String = "",
    @SerialName("preview_url") val previewUrl: String? = null,
)

data class MemoryAsset(
    val id: Long, val memoryId: Long, val type: String,
    val title: String, val uploader: String, val previewUrl: String,
) {
    val isVideo: Boolean get() = type == "video"
}

fun MemoryAssetRow.toAsset() = MemoryAsset(
    id = id, memoryId = memoryId, type = type, title = title,
    uploader = uploader, previewUrl = previewUrl ?: "",
)

data class TeamMemory(
    val id: Long, val title: String, val eventDate: String, val place: String,
    val host: String, val summary: String, val tags: List<String>,
    val assets: List<MemoryAsset> = emptyList(),
) {
    /** 목록에서 쓸 표지. 미리보기 URL이 있는 첫 장 — 없으면 null이고 화면은 날짜 칩만 보여준다. */
    val cover: MemoryAsset? get() = assets.firstOrNull { it.previewUrl.isNotBlank() }
}

fun MemoryRow.toMemory(assets: List<MemoryAsset> = emptyList()) = TeamMemory(
    id = id, title = title, eventDate = eventDate, place = place,
    host = host, summary = summary, tags = tags ?: emptyList(), assets = assets,
)

// ── 캔미팅 (can_sessions) ─────────────────────────────────────────
@Serializable
data class CanSessionRow(
    val id: String,
    val topic: String? = null,
    @SerialName("team_name") val teamName: String? = null,
    @SerialName("held_at") val heldAt: String? = null,
    val method: String? = null,
    val stage: String? = null,
    @SerialName("result_summary") val resultSummary: String? = null,
)

data class CanSession(
    val id: String, val topic: String, val teamName: String, val heldAt: String,
    val method: String, val stage: String, val resultSummary: String,
) {
    /**
     * 단계 라벨. DB에는 'setup'·'summary' 같은 영문 enum이 들어 있어 그대로 쓰면
     * 한글 화면에 영어가 튀어나온다. 웹 Meetings.stageLabelOf와 같은 표를 쓴다.
     * 결과 요약까지 채워진 'summary'는 진행 단계가 아니라 '완료'다.
     */
    val stageLabel: String
        get() = if (stage == "summary" && resultSummary.isNotBlank()) "완료" else when (stage) {
            "setup" -> "세션 준비"
            "collect" -> "의견 수집"
            "share" -> "의견 공유"
            "select" -> "선정"
            "summary" -> "결과"
            else -> "진행 중"
        }
}

fun CanSessionRow.toCanSession() = CanSession(
    id = id, topic = topic ?: "", teamName = teamName ?: "", heldAt = heldAt ?: "",
    method = method ?: "", stage = stage ?: "", resultSummary = resultSummary ?: "",
)

// ── 티미팅 (tea_sessions) ─────────────────────────────────────────
@Serializable
data class TeaSessionRow(
    val id: String,
    val title: String? = null,
    val type: String? = null,
    val presenter: String? = null,
    val part: String = "",
    val description: String? = null,
    val status: String? = null,
    @SerialName("held_at") val heldAt: String? = null,
)

data class TeaSession(
    val id: String, val title: String, val type: String, val presenter: String,
    val part: String, val description: String, val status: String, val heldAt: String,
)

fun TeaSessionRow.toTeaSession() = TeaSession(
    id = id, title = title ?: "", type = type ?: "", presenter = presenter ?: "",
    part = part, description = description ?: "", status = status ?: "", heldAt = heldAt ?: "",
)
