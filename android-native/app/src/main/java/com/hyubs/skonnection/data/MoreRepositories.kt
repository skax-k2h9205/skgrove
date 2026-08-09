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

/**
 * 리더 처리 PATCH 바디.
 *
 * 액션마다 클래스를 따로 두는 이유: SupabaseClient의 Json이 encodeDefaults=true라
 * "전부 nullable인 큰 patch 클래스" 하나로 만들면 안 보낸 필드까지 null로 직렬화돼
 * 컬럼을 지워버린다(답변 한 번에 1:1 메모가 사라진다). 보낼 것만 담는다.
 */
@Serializable
private data class ReplyPatch(@SerialName("leader_reply") val leaderReply: String, val status: String)

@Serializable
private data class OneOnOnePatch(@SerialName("one_on_one_note") val oneOnOneNote: String, val status: String)

@Serializable
private data class DecisionPatch(val status: String, @SerialName("status_reason") val statusReason: String)

@Serializable
private data class StatusPatch(val status: String)

/** 처리기록은 덮어쓰지 않고 빈 줄로 구분해 이어 붙인다(웹 LeaderInbox.appendEntry). */
private fun appendEntry(existing: String, addition: String) =
    if (existing.isBlank()) addition else "$existing\n\n$addition"

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

    /** 리더 답변. 기존 답변 뒤에 이어 붙이고 상태를 '답변완료'로 옮긴다(웹 LeaderInbox saveAction). */
    suspend fun reply(issue: Issue, entry: String) = supabase.patch(
        "issues", issue.id,
        ReplyPatch(appendEntry(issue.leaderReply, entry), "답변완료"),
        ReplyPatch.serializer(),
    )

    /** 1:1 제안 메모. 기존 메모에 이어 붙이고 상태를 '1on1 제안'으로. */
    suspend fun proposeOneOnOne(issue: Issue, entry: String) = supabase.patch(
        "issues", issue.id,
        OneOnOnePatch(appendEntry(issue.oneOnOneNote, entry), "1on1 제안"),
        OneOnOnePatch.serializer(),
    )

    /**
     * 보류·종료. 사유는 반드시 함께 남긴다(웹 issueRules.statusNeedsReason).
     * 용기 내어 쓴 글이 이유 없이 닫히면 그 사람은 다시 쓰지 않는다.
     */
    suspend fun decide(id: String, status: String, reason: String) = supabase.patch(
        "issues", id, DecisionPatch(status, reason), DecisionPatch.serializer(),
    )

    /** 사유 없이 옮겨도 되는 상태 전환(검토중·안건화). */
    suspend fun mark(id: String, status: String) = supabase.patch(
        "issues", id, StatusPatch(status), StatusPatch.serializer(),
    )
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

@Serializable
private data class NewAgenda(
    val id: String,
    val title: String,
    val description: String,
    val category: String,
    val source: String,
    val part: String,
    val author: String,
    val approve: Int = 0,
    val reject: Int = 0,
    val status: String = "투표중",
    // 날짜 컬럼에 빈 문자열을 넣으면 Postgres가 거부한다. 없으면 null로 보낸다(웹 agendaToRow).
    val deadline: String?,
    @SerialName("eligible_count") val eligibleCount: Int,
    @SerialName("created_at") val createdAt: String,
)

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

    /**
     * 대나무숲 접수를 안건으로 올린다(웹 promoteToAgenda 이식).
     *
     * 접수 원문을 그대로 싣지 않고 리더가 정제한 title/description만 저장한다.
     * '리더만 보기'로 들어온 건은 작성자도 익명으로 못박는다 — 안건은 팀 전체가 본다.
     */
    suspend fun createFromIssue(
        issue: Issue, title: String, description: String, part: String,
        deadline: String, eligibleCount: Int,
    ): String {
        val id = "AGD-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "agendas",
            NewAgenda(
                id = id, title = title, description = description, category = issue.category,
                source = "대나무숲 ${issue.id}", part = part,
                author = if (issue.isLeaderOnly) "익명" else issue.identity,
                deadline = deadline.ifBlank { null }, eligibleCount = eligibleCount,
                createdAt = java.time.Instant.now().toString(),
            ),
            NewAgenda.serializer(),
        )
        return id
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
