package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

@Serializable
private data class NewIssue(
    val id: String,
    val title: String,
    val category: String,
    val author: String,
    val target: String,
    val status: String,
    val urgency: String,
    val body: String,
    @SerialName("expected_change") val expectedChange: String,
    val visibility: String,
    @SerialName("submitter_name") val submitterName: String?,
    @SerialName("submitter_email") val submitterEmail: String?,
    @SerialName("submitter_part") val submitterPart: String?,
    @SerialName("created_at") val createdAt: String,
)

class IssueRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Issue> =
        supabase.select("issues", "select=*&order=created_at.desc", ListSerializer(IssueRow.serializer()))
            .map { it.toIssue() }

    /** 대나무숲 접수 제출(웹 submitIssue 규칙: status '접수'). */
    suspend fun create(
        title: String, category: String, target: String, urgency: String,
        body: String, expectedChange: String, visibility: String, anonymous: Boolean,
        submitterName: String?, submitterEmail: String?, submitterPart: String?,
    ) {
        val id = "SOOP-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "issues",
            NewIssue(
                id = id, title = title, category = category,
                author = if (anonymous) "익명" else "실명",
                target = target, status = "접수", urgency = urgency,
                body = body, expectedChange = expectedChange, visibility = visibility,
                submitterName = if (anonymous) null else submitterName,
                submitterEmail = if (anonymous) null else submitterEmail,
                submitterPart = if (anonymous) null else submitterPart,
                createdAt = java.time.Instant.now().toString(),
            ),
            NewIssue.serializer(),
        )
    }
}

@Serializable
private data class BallotRow(
    @SerialName("agenda_id") val agendaId: String,
    @SerialName("voter_key") val voterKey: String,
)

@Serializable
private data class NewBallot(
    @SerialName("agenda_id") val agendaId: String,
    @SerialName("voter_key") val voterKey: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
private data class VotePatch(val approve: Int, val reject: Int)

class AgendaRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Agenda> =
        supabase.select("agendas", "select=*&order=created_at.desc", ListSerializer(AgendaRow.serializer()))
            .map { it.toAgenda() }

    /** 이미 투표한 (agendaId, voterKey) 쌍 집합. 중복 투표 방지 판정에 쓴다. */
    suspend fun loadBallotKeys(): Set<Pair<String, String>> =
        supabase.select("agenda_ballots", "select=agenda_id,voter_key", ListSerializer(BallotRow.serializer()))
            .map { it.agendaId to it.voterKey }.toSet()

    /** 투표: 찬반 카운트 증가 후 투표용지 기록(중복 방지). 실패해도 개별적으로 무시. */
    suspend fun vote(agendaId: String, approveVote: Boolean, voterKey: String, currentApprove: Int, currentReject: Int) {
        val next = VotePatch(
            approve = currentApprove + if (approveVote) 1 else 0,
            reject = currentReject + if (approveVote) 0 else 1,
        )
        supabase.patch("agendas", agendaId, next, VotePatch.serializer())
        supabase.insert(
            "agenda_ballots",
            NewBallot(agendaId, voterKey, java.time.Instant.now().toString()),
            NewBallot.serializer(),
        )
    }
}

@Serializable
private data class NewAction(
    val id: String,
    val title: String,
    val owner: String,
    val due: String?,
    val status: String,
    @SerialName("source_kind") val sourceKind: String,
    @SerialName("created_at") val createdAt: String,
)

class ActionRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<ActionItem> =
        supabase.select("action_items", "select=*&order=created_at.desc", ListSerializer(ActionRow.serializer()))
            .map { it.toActionItem() }

    suspend fun create(title: String, owner: String, due: String) {
        val id = "ACT-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "action_items",
            NewAction(id, title, owner, due.ifBlank { null }, "대기", "직접", java.time.Instant.now().toString()),
            NewAction.serializer(),
        )
    }

    suspend fun delete(id: String) = supabase.delete("action_items", "id=eq.$id")
}

class NotificationRepository(private val supabase: SupabaseClient) {
    suspend fun loadFor(recipientName: String): List<AppNotification> =
        supabase.select(
            "notifications",
            "select=*&recipient_name=eq.$recipientName&order=created_at.desc",
            ListSerializer(NotificationRow.serializer()),
        ).map { it.toNotification() }
}
