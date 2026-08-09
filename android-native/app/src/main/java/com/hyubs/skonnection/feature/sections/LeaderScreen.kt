package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.Issue
import com.hyubs.skonnection.data.oldestWaitingDays
import com.hyubs.skonnection.data.RESPONSE_DUE_DAYS
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.FormLabel
import com.hyubs.skonnection.feature.FullScreenForm
import com.hyubs.skonnection.feature.LoadingBox

private val Blue = Color(0xFF2563EB)
private val Green = Color(0xFF059669)
private val Red = Color(0xFFDC2626)

/** 필터 칩. '전체'는 null. */
private val FILTERS = listOf<Pair<String, String?>>(
    "전체" to null, "접수" to "접수", "검토중" to "검토중",
    "답변완료" to "답변완료", "안건화" to "안건화", "보류" to "보류",
)

/** 리더가 접수 한 건에 취할 수 있는 처리. 사유가 필요한 것은 needsReason. */
private enum class LeaderAction(
    val label: String, val prompt: String, val commitLabel: String,
    val destructive: Boolean = false,
) {
    Reply("답변하기", "접수자에게 전할 답변을 남겨주세요.", "답변 남기기"),
    OneOnOne("1:1 제안", "어떤 1:1을 제안할지 메모를 남겨주세요.", "1:1 제안하기"),
    Hold("보류 사유", "왜 보류하는지 사유를 남겨주세요. 근거 없이 보류되면 다시 쓰지 않아요.", "보류로 처리", destructive = true),
    Close("종료 사유", "왜 종료하는지 사유를 남겨주세요.", "종료로 처리", destructive = true),
}

/**
 * 리더 관리함 — 접수를 답변·1:1·안건화·보류/종료로 처리한다(웹 LeaderInbox / iOS LeaderView 이식).
 *
 * 대나무숲 접수 화면과 목록은 같지만, 여기서는 읽고 끝나지 않고 상태를 바꾼다.
 * 방치된 건이 눈에 띄도록 응답 지연을 카드와 상단 배너 양쪽에서 알린다.
 */
@Composable
fun LeaderSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { LeaderViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()
    val promoted by vm.promoted.collectAsStateWithLifecycle()

    // 화면이 살아있는 동안 '오늘'은 고정한다. 매 recomposition마다 다시 물으면 지연 계산이 흔들린다.
    val today = remember { java.time.LocalDate.now() }
    val filtered = remember(items, filter) { filter?.let { f -> items.filter { it.status == f } } ?: items }
    val waiting = remember(items) { items.count { it.isAwaitingResponse } }
    val oldest = remember(items, today) { oldestWaitingDays(items, today) }

    var actionTarget by remember { mutableStateOf<Pair<Issue, LeaderAction>?>(null) }
    var promoteTarget by remember { mutableStateOf<Issue?>(null) }

    if (loading && items.isEmpty()) { LoadingBox(modifier); return }

    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 16.dp)) {
        item { SummaryBanner(items.size, waiting) }
        if (oldest != null && oldest >= RESPONSE_DUE_DAYS) {
            item { OverdueBanner(oldest) }
        }
        promoted?.let { message ->
            item { NoticeBanner(message, Green) { vm.clearPromoted() } }
        }
        item {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FILTERS.forEach { (label, status) ->
                    FilterChip(
                        selected = filter == status,
                        onClick = { vm.setFilter(status) },
                        label = { Text(label) },
                    )
                }
            }
        }
        if (filtered.isEmpty()) {
            item {
                Text(
                    "해당 상태의 접수가 없어요. 다른 상태를 골라보세요.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.fillMaxWidth().padding(32.dp),
                )
            }
        } else {
            items(filtered, key = { it.id }) { issue ->
                LeaderIssueCard(
                    issue = issue,
                    overdueDays = if (issue.isResponseOverdue(today)) issue.daysSinceCreated(today) else null,
                    onAction = { action -> actionTarget = issue to action },
                    onPromote = { promoteTarget = issue },
                )
            }
        }
    }

    actionTarget?.let { (issue, action) ->
        LeaderActionForm(
            issue = issue,
            action = action,
            onClose = { actionTarget = null },
            onCommit = { text ->
                when (action) {
                    LeaderAction.Reply -> vm.reply(issue, text)
                    LeaderAction.OneOnOne -> vm.proposeOneOnOne(issue, text)
                    LeaderAction.Hold -> vm.hold(issue, text)
                    LeaderAction.Close -> vm.close(issue, text)
                }
                actionTarget = null
            },
        )
    }

    promoteTarget?.let { issue ->
        PromoteForm(
            issue = issue,
            onClose = { promoteTarget = null },
            onSubmit = { title, description, deadline ->
                vm.promote(issue, title, description, "전체", deadline) { promoteTarget = null }
            },
        )
    }
}

@Composable
private fun SummaryBanner(total: Int, waiting: Int) {
    Banner(Blue) {
        Text(
            "접수 ${total}건 · 처리 대기 ${waiting}건 — 검토하고 안건으로 올려보세요.",
            style = MaterialTheme.typography.bodySmall, color = Blue,
        )
    }
}

@Composable
private fun OverdueBanner(days: Int) {
    Banner(Red) {
        Text(
            "${days}일째 답변을 기다리는 접수가 있어요. 방치되면 사람들이 다시 쓰지 않아요.",
            style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = Red,
        )
    }
}

@Composable
private fun NoticeBanner(message: String, color: Color, onDismiss: () -> Unit) {
    Banner(color) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(message, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold,
                color = color, modifier = Modifier.weight(1f))
            androidx.compose.material3.TextButton(onClick = onDismiss) { Text("확인") }
        }
    }
}

@Composable
private fun Banner(color: Color, content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp)).background(color.copy(alpha = 0.10f))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) { content() }
}

/** 접수 카드 + 처리 이력 + 처리 메뉴. 지연 건은 테두리를 빨갛게 해 목록에서 먼저 눈에 띈다. */
@Composable
private fun LeaderIssueCard(
    issue: Issue,
    overdueDays: Int?,
    onAction: (LeaderAction) -> Unit,
    onPromote: () -> Unit,
) {
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        border = if (overdueDays != null) androidx.compose.foundation.BorderStroke(1.dp, Red.copy(alpha = 0.4f)) else null,
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${issue.category} · ${issue.identity}", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline, modifier = Modifier.weight(1f))
                StatusBadge(issue.status)
            }
            Text(issue.title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
            if (issue.body.isNotBlank()) {
                Text(issue.body, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2,
                    modifier = Modifier.padding(top = 4.dp))
            }

            // 처리 이력 — 접수자에게 근거로 남는 부분이라 카드에서 바로 보이게 둔다.
            if (issue.leaderReply.isNotBlank()) NoteLine("답변", issue.leaderReply, Green)
            if (issue.oneOnOneNote.isNotBlank()) NoteLine("1:1 제안", issue.oneOnOneNote, Blue)
            if (issue.reason.isNotBlank()) {
                NoteLine(if (issue.status == "종료") "종료 사유" else "보류 사유", issue.reason, MaterialTheme.colorScheme.outline)
            }

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(
                        listOf(issue.id, issue.urgency, issue.createdAt.take(10))
                            .filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline,
                    )
                    if (overdueDays != null) {
                        Text("응답 지연 ${overdueDays}일", style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold, color = Red)
                    }
                }
                ProcessMenu(issue, onAction, onPromote)
            }
        }
    }
}

/** 처리 메뉴 — 이미 끝난 건은 항목이 줄어든다. */
@Composable
private fun ProcessMenu(issue: Issue, onAction: (LeaderAction) -> Unit, onPromote: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("처리", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = Blue)
        IconButton(onClick = { open = true }) {
            Icon(Icons.Filled.MoreVert, contentDescription = "처리 메뉴", tint = Blue)
        }
    }
    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
        DropdownMenuItem(text = { Text("답변하기") }, onClick = { open = false; onAction(LeaderAction.Reply) })
        DropdownMenuItem(text = { Text("1:1 제안") }, onClick = { open = false; onAction(LeaderAction.OneOnOne) })
        if (issue.status != "안건화" && issue.status != "종료") {
            DropdownMenuItem(text = { Text("안건화") }, onClick = { open = false; onPromote() })
        }
        if (issue.status != "보류") {
            DropdownMenuItem(text = { Text("보류") }, onClick = { open = false; onAction(LeaderAction.Hold) })
        }
        if (issue.status != "종료") {
            DropdownMenuItem(
                text = { Text("종료", color = MaterialTheme.colorScheme.error) },
                onClick = { open = false; onAction(LeaderAction.Close) },
            )
        }
    }
}

@Composable
private fun NoteLine(label: String, text: String, tint: Color) {
    Column(
        Modifier.fillMaxWidth().padding(top = 8.dp)
            .clip(RoundedCornerShape(8.dp)).background(tint.copy(alpha = 0.08f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = tint)
        Text(text, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 2.dp))
    }
}

/** 답변·1:1·보류·종료 근거를 받는 폼. 비어 있으면 확정할 수 없다. */
@Composable
private fun LeaderActionForm(
    issue: Issue,
    action: LeaderAction,
    onClose: () -> Unit,
    onCommit: (String) -> Unit,
) {
    var text by remember(issue.id, action) {
        // 보류/종료는 기존 사유를, 답변·1:1은 빈 칸에서 시작한다 — 이력은 덮어쓰지 않고 이어 붙기 때문.
        mutableStateOf(if (action == LeaderAction.Hold || action == LeaderAction.Close) issue.reason else "")
    }
    val trimmed = text.trim()
    FullScreenForm(
        title = action.label,
        submitLabel = action.commitLabel,
        canSubmit = trimmed.isNotEmpty(),
        onSubmit = { if (trimmed.isNotEmpty()) onCommit(trimmed) },
        onClose = onClose,
    ) {
        Text(issue.title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold)
        Text(action.prompt, style = MaterialTheme.typography.bodySmall,
            color = if (action.destructive) Red else MaterialTheme.colorScheme.outline)
        OutlinedTextField(
            value = text, onValueChange = { text = it },
            placeholder = { Text(action.label) },
            modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp),
        )
    }
}

/**
 * 안건화 폼.
 *
 * 접수 원문을 그대로 안건에 싣지 않는다 — 리더가 정제한 제목·설명만 올라간다.
 * '리더만 보기'로 접수된 건은 안건에서 작성자가 익명으로 고정된다(저장 단계에서 처리).
 */
@Composable
private fun PromoteForm(
    issue: Issue,
    onClose: () -> Unit,
    onSubmit: (title: String, description: String, deadline: String) -> Unit,
) {
    var title by remember(issue.id) { mutableStateOf(issue.title) }
    var description by remember(issue.id) { mutableStateOf(issue.agendaSeed) }
    var deadline by remember(issue.id) { mutableStateOf(LeaderViewModel.defaultDeadline()) }
    FullScreenForm(
        title = "안건으로 올리기",
        submitLabel = "안건 등록",
        canSubmit = title.isNotBlank(),
        onSubmit = { if (title.isNotBlank()) onSubmit(title, description, deadline) },
        onClose = onClose,
    ) {
        Text(
            "접수 원문은 그대로 공개되지 않아요. 아래 내용만 안건으로 올라갑니다.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline,
        )
        FormLabel("안건 제목", required = true)
        OutlinedTextField(title, { title = it }, singleLine = true, modifier = Modifier.fillMaxWidth())
        FormLabel("설명")
        OutlinedTextField(
            description, { description = it },
            placeholder = { Text("무엇을 정하려는지 팀이 읽을 수 있게 정리해주세요") },
            modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
        )
        FormLabel("마감일")
        OutlinedTextField(
            deadline, { deadline = it },
            placeholder = { Text("YYYY-MM-DD") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.padding(top = 4.dp))
    }
}
