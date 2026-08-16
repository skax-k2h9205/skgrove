package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// 커리어 관리(성장 카드) — 웹 growthStore/growthRules · iOS Growth 이식. 같은 Supabase 3테이블 공유.

val growthCompetencies = listOf("문제정의·기획", "실행·개발", "협업·소통", "도메인 전문성", "AI 활용", "학습·성장")

data class GrowthGoal(
    val id: String,
    val ownerEmail: String,
    val title: String,
    val detail: String = "",
    val due: String = "",
    val progress: Int = 0,
    val status: String = "진행중",
    val leaderComment: String = "",
    val createdAt: String = "",
    val updatedAt: String = "",
)

data class CompetencyLevel(
    val id: String,
    val ownerEmail: String,
    val competency: String,
    val selfLevel: Int = 1,
    val leaderLevel: Int? = null,
    val evidence: String = "",
    val updatedAt: String = "",
)

data class CompetencyLogEntry(
    val id: String,
    val ownerEmail: String,
    val competency: String,
    val level: Int,
    val by: String,   // self / leader
    val at: String = "",
)

/** 순수 규칙(웹 growthRules 이식) — 단위테스트 대상. */
object GrowthRules {
    fun clampProgress(n: Int) = n.coerceIn(0, 100)
    fun clampLevel(n: Int) = n.coerceIn(1, 5)
    fun nextStatus(progress: Int) = if (clampProgress(progress) >= 100) "완료" else "진행중"

    /** 특정 역량·주체(self/leader)의 레벨 추이(시간순). */
    fun curve(log: List<CompetencyLogEntry>, competency: String, by: String): List<Int> =
        log.filter { it.competency == competency && it.by == by }
            .sortedBy { it.at }
            .map { it.level }
}

// ── Supabase row (snake_case) ──
@Serializable
data class GoalRow(
    val id: String,
    @SerialName("owner_email") val ownerEmail: String,
    val title: String,
    val detail: String? = null,
    val due: String? = null,
    val progress: Int? = null,
    val status: String? = null,
    @SerialName("leader_comment") val leaderComment: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
) {
    fun toModel() = GrowthGoal(
        id, ownerEmail, title, detail ?: "", due ?: "", progress ?: 0, status ?: "진행중",
        leaderComment ?: "", createdAt ?: "", updatedAt ?: "",
    )
    companion object {
        fun of(g: GrowthGoal) = GoalRow(
            g.id, g.ownerEmail, g.title, g.detail.ifBlank { null }, g.due.ifBlank { null }, g.progress, g.status,
            g.leaderComment, g.createdAt.ifBlank { null }, g.updatedAt.ifBlank { null },
        )
    }
}

@Serializable
data class LevelRow(
    val id: String,
    @SerialName("owner_email") val ownerEmail: String,
    val competency: String,
    @SerialName("self_level") val selfLevel: Int? = null,
    @SerialName("leader_level") val leaderLevel: Int? = null,
    val evidence: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
) {
    fun toModel() = CompetencyLevel(id, ownerEmail, competency, selfLevel ?: 1, leaderLevel, evidence ?: "", updatedAt ?: "")
    companion object {
        fun of(l: CompetencyLevel) = LevelRow(l.id, l.ownerEmail, l.competency, l.selfLevel, l.leaderLevel, l.evidence, l.updatedAt.ifBlank { null })
    }
}

@Serializable
data class LogRow(
    val id: String,
    @SerialName("owner_email") val ownerEmail: String,
    val competency: String,
    val level: Int,
    val by: String,
    val at: String? = null,
) {
    fun toModel() = CompetencyLogEntry(id, ownerEmail, competency, level, by, at ?: "")
    companion object {
        fun of(e: CompetencyLogEntry) = LogRow(e.id, e.ownerEmail, e.competency, e.level, e.by, e.at.ifBlank { null })
    }
}
