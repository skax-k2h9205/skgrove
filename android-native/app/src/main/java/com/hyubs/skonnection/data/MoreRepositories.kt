package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

class IssueRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Issue> =
        supabase.select("issues", "select=*&order=created_at.desc", ListSerializer(IssueRow.serializer()))
            .map { it.toIssue() }
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

class ActionRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<ActionItem> =
        supabase.select("action_items", "select=*&order=created_at.desc", ListSerializer(ActionRow.serializer()))
            .map { it.toActionItem() }
}

class NotificationRepository(private val supabase: SupabaseClient) {
    suspend fun loadFor(recipientName: String): List<AppNotification> =
        supabase.select(
            "notifications",
            "select=*&recipient_name=eq.$recipientName&order=created_at.desc",
            ListSerializer(NotificationRow.serializer()),
        ).map { it.toNotification() }
}
