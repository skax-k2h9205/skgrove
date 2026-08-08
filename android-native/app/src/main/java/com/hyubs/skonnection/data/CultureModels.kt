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

data class Profile(
    val key: String, val name: String, val part: String, val role: String,
    val character: String, val trait: String, val style: String,
    val collaboration: String, val mbti: String, val disc: String,
)

fun ProfileRow.toProfile() = Profile(
    key = profileKey, name = name, part = part, role = role, character = character,
    trait = trait, style = style, collaboration = collaboration,
    mbti = mbtiType ?: "", disc = discType ?: "",
)

// ── 팀 추억 (team_memories) ───────────────────────────────────────
@Serializable
data class MemoryRow(
    val id: Int,
    val title: String = "",
    @SerialName("event_date") val eventDate: String = "",
    val place: String = "",
    val host: String = "",
    val summary: String = "",
    val tags: List<String>? = null,
)

data class TeamMemory(
    val id: Int, val title: String, val eventDate: String, val place: String,
    val host: String, val summary: String, val tags: List<String>,
)

fun MemoryRow.toMemory() = TeamMemory(
    id = id, title = title, eventDate = eventDate, place = place,
    host = host, summary = summary, tags = tags ?: emptyList(),
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
)

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
