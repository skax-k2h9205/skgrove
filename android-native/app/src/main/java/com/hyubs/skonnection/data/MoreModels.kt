package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ── 대나무숲 접수 / 리더 관리함 (issues) ───────────────────────────
@Serializable
data class IssueRow(
    val id: String,
    val title: String = "",
    val category: String = "",
    val target: String = "",
    val status: String = "",
    val urgency: String = "",
    val body: String? = null,
    @SerialName("submitter_name") val submitterName: String? = null,
    @SerialName("expected_change") val expectedChange: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

data class Issue(
    val id: String, val title: String, val category: String, val target: String,
    val status: String, val urgency: String, val body: String, val submitter: String,
)

fun IssueRow.toIssue() = Issue(
    id = id, title = title, category = category, target = target,
    status = status, urgency = urgency, body = body ?: "", submitter = submitterName ?: "익명",
)

// ── 안건 · 투표 (agendas) ─────────────────────────────────────────
@Serializable
data class AgendaRow(
    val id: String,
    val title: String = "",
    val description: String? = null,
    val category: String = "",
    val source: String = "",
    val part: String = "전체",
    val approve: Int = 0,
    val reject: Int = 0,
    val status: String = "",
    val deadline: String? = null,
    @SerialName("eligible_count") val eligibleCount: Int? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

data class Agenda(
    val id: String, val title: String, val description: String, val category: String,
    val part: String, val approve: Int, val reject: Int, val status: String,
    val deadline: String, val eligibleCount: Int,
) {
    val total: Int get() = approve + reject
    /** 정족수 = ceil(대상/3). 웹 agendaRules.QUORUM_RATIO(1/3)와 동일. */
    val quorum: Int get() = if (eligibleCount > 0) Math.ceil(eligibleCount / 3.0).toInt() else 0
    val quorumRemaining: Int get() = (quorum - total).coerceAtLeast(0)
}

fun AgendaRow.toAgenda() = Agenda(
    id = id, title = title, description = description ?: "", category = category,
    part = part, approve = approve, reject = reject, status = status,
    deadline = deadline?.take(10) ?: "", eligibleCount = eligibleCount ?: 0,
)

// ── 액션아이템 (action_items) ─────────────────────────────────────
@Serializable
data class ActionRow(
    val id: String,
    val title: String = "",
    val owner: String = "",
    val due: String? = null,
    val status: String = "",
    @SerialName("source_label") val sourceLabel: String? = null,
)

data class ActionItem(
    val id: String, val title: String, val owner: String, val due: String,
    val status: String, val sourceLabel: String,
)

fun ActionRow.toActionItem() = ActionItem(
    id = id, title = title, owner = owner, due = due ?: "", status = status,
    sourceLabel = sourceLabel ?: "",
)

// ── 알림 · 메시지 (notifications) ─────────────────────────────────
@Serializable
data class NotificationRow(
    val id: String,
    val kind: String = "",
    @SerialName("recipient_name") val recipientName: String = "",
    @SerialName("from_name") val fromName: String? = null,
    val title: String? = null,
    val body: String? = null,
    val section: String = "",
    @SerialName("created_at") val createdAt: String? = null,
    val read: Boolean? = null,
)

data class AppNotification(
    val id: String, val kind: String, val recipient: String, val from: String,
    val title: String, val body: String, val createdAt: String, val read: Boolean,
)

fun NotificationRow.toNotification() = AppNotification(
    id = id, kind = kind, recipient = recipientName, from = fromName ?: "",
    title = title ?: "", body = body ?: "", createdAt = createdAt ?: "", read = read ?: false,
)
