package com.hyubs.skonnection.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ── 대나무숲 접수 / 리더 관리함 (issues) ───────────────────────────

/**
 * 리더가 이 일수 안에 응답하지 않으면 '지연'으로 본다.
 * 웹 issueRules.RESPONSE_DUE_DAYS와 동일 — 대나무숲은 첫 몇 건이 이후 사용률을 결정하고,
 * 접수해놓고 아무 반응이 없으면 사람들은 다시 쓰지 않는다.
 */
const val RESPONSE_DUE_DAYS = 7

@Serializable
data class IssueRow(
    val id: String,
    val title: String = "",
    val category: String = "",
    val target: String = "",
    val status: String = "",
    val urgency: String = "",
    val body: String? = null,
    val author: String? = null,
    val visibility: String? = null,
    @SerialName("submitter_name") val submitterName: String? = null,
    @SerialName("expected_change") val expectedChange: String? = null,
    @SerialName("leader_reply") val leaderReply: String? = null,
    @SerialName("one_on_one_note") val oneOnOneNote: String? = null,
    @SerialName("status_reason") val statusReason: String? = null,
    @SerialName("action_item") val actionItem: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

data class Issue(
    val id: String, val title: String, val category: String, val target: String,
    val status: String, val urgency: String, val body: String, val submitter: String,
    val identity: String, val expectedChange: String, val visibility: String,
    val leaderReply: String, val oneOnOneNote: String, val reason: String,
    val actionItem: String, val createdAt: String,
) {
    /**
     * 리더의 응답이 하나도 없는 상태(웹 issueRules.isAwaitingResponse).
     * 회수·종료된 건은 더 기다릴 것이 없으므로 대상이 아니다.
     */
    val isAwaitingResponse: Boolean
        get() = status != "회수" && status != "종료" &&
            leaderReply.isBlank() && oneOnOneNote.isBlank() && actionItem.isBlank()

    /** 접수일로부터 지난 일수. 날짜를 못 읽으면 null — 모르는 것을 0일로 속이지 않는다. */
    fun daysSinceCreated(today: java.time.LocalDate): Int? {
        val created = runCatching { java.time.LocalDate.parse(createdAt.take(10)) }.getOrNull() ?: return null
        return java.time.temporal.ChronoUnit.DAYS.between(created, today).toInt().coerceAtLeast(0)
    }

    /** 응답 없이 기준 일수를 넘긴 건. 날짜를 모르면 지연으로 몰지 않는다. */
    fun isResponseOverdue(today: java.time.LocalDate): Boolean =
        isAwaitingResponse && (daysSinceCreated(today) ?: 0) >= RESPONSE_DUE_DAYS

    /** 안건으로 올릴 때 채워둘 설명 초안. 기대 변화가 있으면 그쪽이 접수 원문보다 안건에 가깝다. */
    val agendaSeed: String get() = expectedChange.ifBlank { body }

    /** '리더만 보기'로 접수된 건은 원문이 그대로 공개되면 안 된다(웹 promoteToAgenda 규칙). */
    val isLeaderOnly: Boolean get() = visibility == "리더만 보기"
}

fun IssueRow.toIssue() = Issue(
    id = id, title = title, category = category, target = target,
    status = status, urgency = urgency, body = body ?: "", submitter = submitterName ?: "익명",
    identity = author ?: "익명", expectedChange = expectedChange ?: "", visibility = visibility ?: "",
    leaderReply = leaderReply ?: "", oneOnOneNote = oneOnOneNote ?: "", reason = statusReason ?: "",
    actionItem = actionItem ?: "", createdAt = createdAt ?: "",
)

/** 미응답 건 중 가장 오래 기다린 일수. 없으면 null(웹 issueRules.oldestWaitingDays). */
fun oldestWaitingDays(issues: List<Issue>, today: java.time.LocalDate): Int? =
    issues.filter { it.isAwaitingResponse }.mapNotNull { it.daysSinceCreated(today) }.maxOrNull()

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
) {
    /**
     * 알림 종류 라벨. DB에는 'deadline' 같은 영문 키가 들어 있어 그대로 쓰면 한글 화면에 영어가 섞인다.
     * 웹 NotificationCenter.KIND_LABEL과 같은 표. 모르는 키는 원값을 그대로 두어 새 종류가 사라지지 않게 한다.
     */
    val kindLabel: String get() = when (kind) {
        "issue" -> "의견"
        "agenda" -> "안건"
        "deadline" -> "마감"
        "action" -> "액션"
        "tea" -> "티미팅"
        "humor" -> "유머"
        "message" -> "메시지"
        "gathering" -> "모임"
        "market" -> "이음장터"
        else -> kind
    }
}

fun NotificationRow.toNotification() = AppNotification(
    id = id, kind = kind, recipient = recipientName, from = fromName ?: "",
    title = title ?: "", body = body ?: "", createdAt = createdAt ?: "", read = read ?: false,
)
