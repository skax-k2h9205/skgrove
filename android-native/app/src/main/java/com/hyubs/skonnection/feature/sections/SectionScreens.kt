package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.Account
import com.hyubs.skonnection.data.sortedForManagement
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.ErrorBox
import com.hyubs.skonnection.feature.FeedCard
import com.hyubs.skonnection.feature.LoadingBox

/**
 * 더보기 허브에서 고른 섹션을 렌더. 미구현 섹션은 안내 문구.
 *
 * 배경은 여기서 한 번만 깐다 — 섹션마다 따로 칠하면 열 개가 조금씩 다른 흰색이 된다.
 */
@Composable
fun SectionHost(
    container: AppContainer,
    section: String,
    currentEmail: String?,
    composing: Boolean = false,
    onComposingChange: (Boolean) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val page = modifier.fillMaxSize()
        .background(androidx.compose.material3.MaterialTheme.colorScheme.background)
    SectionBody(container, section, currentEmail, composing, onComposingChange, page)
}

/** 등록(작성)이 있는 섹션. 상단 + 버튼을 띄울지 판단하는 데 쓴다. */
fun sectionSupportsCompose(section: String): Boolean =
    section == "대나무숲 접수" || section == "액션아이템"

@Composable
private fun SectionBody(
    container: AppContainer,
    section: String,
    currentEmail: String?,
    composing: Boolean,
    onComposingChange: (Boolean) -> Unit,
    modifier: Modifier,
) {
    when (section) {
        "대나무숲 접수" -> IssuesSection(container, composing, onComposingChange, modifier)
        "리더 관리함" -> LeaderSection(container, modifier)
        "안건 · 투표" -> AgendaSection(container, modifier)
        "액션아이템" -> ActionsSection(container, composing, onComposingChange, modifier)
        "알림 · 메시지" -> NotificationsSection(container, currentEmail, modifier)
        "계정 관리" -> AccountsSection(container, modifier)
        "동료 성향" -> ProfilesSection(container, modifier)
        "팀 추억" -> MemoriesSection(container, modifier)
        "캔미팅 · 티미팅" -> MeetingsSection(container, modifier)
        "파트지수 · 리포트" -> MetricsSection(container, modifier)
        else -> EmptyBox("‘$section’ 화면은 곧 제공됩니다.", modifier)
    }
}

@Composable
private fun IssuesSection(
    c: AppContainer,
    composing: Boolean,
    onComposingChange: (Boolean) -> Unit,
    modifier: Modifier,
) {
    val vm = remember { IssuesViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()

    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
      androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
        when {
            loading && items.isEmpty() -> LoadingBox()
            error != null && items.isEmpty() -> ErrorBox(error!!, vm::retry)
            items.isEmpty() -> EmptyBox("접수된 내용이 없어요. 첫 의견을 남겨보세요.")
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(top = 8.dp, bottom = 88.dp)) {
                items(items, key = { it.id }) { i ->
                    IssueCard(
                        title = i.title, status = i.status, urgency = i.urgency,
                        category = i.category, target = i.target, submitter = i.submitter, body = i.body,
                    )
                }
            }
        }
      }
    }

    if (composing) {
        IssueComposeDialog(
            onDismiss = { onComposingChange(false) },
            onSubmit = { t, cat, tgt, urg, body, exp, vis, anon ->
                vm.submit(t, cat, tgt, urg, body, exp, vis, anon) { onComposingChange(false) }
            },
        )
    }
}

private val ISSUE_CATEGORIES = listOf("회의문화", "협업", "업무방식", "갈등", "성장/피드백", "복지/분위기", "기타")
private val ISSUE_TARGETS = listOf("팀리더", "리더 전체")
private val ISSUE_URGENCY = listOf("낮음", "보통", "높음")
private val ISSUE_VISIBILITY = listOf("리더만 보기", "안건 후보로 공개 가능")

@Composable
private fun IssueComposeDialog(
    onDismiss: () -> Unit,
    onSubmit: (title: String, category: String, target: String, urgency: String, body: String, expected: String, visibility: String, anonymous: Boolean) -> Unit,
) {
    var title by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    var body by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    var expected by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    var category by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(ISSUE_CATEGORIES[0]) }
    var target by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(ISSUE_TARGETS[0]) }
    var urgency by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("보통") }
    var visibility by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(ISSUE_VISIBILITY[0]) }
    var anonymous by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }

    com.hyubs.skonnection.feature.FullScreenForm(
        title = "대나무숲 접수", submitLabel = "접수",
        canSubmit = title.isNotBlank() && body.isNotBlank(),
        onSubmit = { if (title.isNotBlank() && body.isNotBlank()) onSubmit(title, category, target, urgency, body, expected, visibility, anonymous) },
        onClose = onDismiss,
    ) {
        com.hyubs.skonnection.feature.FormLabel("제목", required = true)
        androidx.compose.material3.OutlinedTextField(
            value = title, onValueChange = { title = it },
            placeholder = { androidx.compose.material3.Text("한 줄로 요약해주세요") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        ChipRow("분류", ISSUE_CATEGORIES, category) { category = it }
        ChipRow("대상", ISSUE_TARGETS, target) { target = it }
        ChipRow("긴급도", ISSUE_URGENCY, urgency) { urgency = it }
        ChipRow("공개 범위", ISSUE_VISIBILITY, visibility) { visibility = it }
        com.hyubs.skonnection.feature.FormLabel("내용", required = true)
        androidx.compose.material3.OutlinedTextField(
            value = body, onValueChange = { body = it },
            placeholder = { androidx.compose.material3.Text("어떤 점이 불편하거나 개선되면 좋을지 적어주세요") },
            modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
        )
        com.hyubs.skonnection.feature.FormLabel("기대하는 변화")
        androidx.compose.material3.OutlinedTextField(
            value = expected, onValueChange = { expected = it },
            placeholder = { androidx.compose.material3.Text("이렇게 바뀌면 좋겠어요") },
            modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp),
        )
        androidx.compose.foundation.layout.Row(
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        ) {
            androidx.compose.material3.Switch(checked = anonymous, onCheckedChange = { anonymous = it })
            androidx.compose.material3.Text("익명으로 접수", modifier = Modifier.padding(start = 8.dp))
        }
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun ChipRow(label: String, options: List<String>, selected: String, onSelect: (String) -> Unit) {
    androidx.compose.foundation.layout.Column(Modifier.padding(top = 8.dp)) {
        androidx.compose.material3.Text(label, style = androidx.compose.material3.MaterialTheme.typography.labelMedium, color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)) {
            options.forEach { opt ->
                androidx.compose.material3.FilterChip(
                    selected = selected == opt,
                    onClick = { onSelect(opt) },
                    label = { androidx.compose.material3.Text(opt) },
                )
            }
        }
    }
}

@Composable
private fun AgendaSection(c: AppContainer, modifier: Modifier) {
    val vm = remember { AgendaViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    val votedIds by vm.votedIds.collectAsStateWithLifecycle()
    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
      when {
        loading && items.isEmpty() -> LoadingBox()
        error != null && items.isEmpty() -> ErrorBox(error!!, vm::retry)
        items.isEmpty() -> EmptyBox("등록된 안건이 없어요.")
        else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { a ->
                AgendaCard(
                    title = a.title, status = a.status, category = a.category, part = a.part,
                    description = a.description, approve = a.approve, reject = a.reject,
                    eligible = a.eligibleCount, deadline = a.deadline, quorum = a.quorum,
                    voted = votedIds.contains(a.id), open = a.status == "투표중",
                    onApprove = { vm.vote(a, true) }, onReject = { vm.vote(a, false) },
                )
            }
        }
      }
    }
}

@Composable
private fun ActionsSection(
    c: AppContainer,
    composing: Boolean,
    onComposingChange: (Boolean) -> Unit,
    modifier: Modifier,
) {
    val vm = remember { ActionsViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var deleteTarget by remember { mutableStateOf<com.hyubs.skonnection.data.ActionItem?>(null) }

    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
      androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
        when {
            loading && items.isEmpty() -> LoadingBox()
            error != null && items.isEmpty() -> ErrorBox(error!!, vm::retry)
            items.isEmpty() -> EmptyBox("액션아이템이 없어요. 새 액션을 추가해보세요.")
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(top = 8.dp, bottom = 88.dp)) {
                val today = java.time.LocalDate.now().toString()
                items(items, key = { it.id }) { a ->
                    ActionCard(
                        title = a.title, status = a.status, owner = a.owner, due = a.due, sourceLabel = a.sourceLabel,
                        overdue = a.status != "완료" && a.due.isNotBlank() && a.due.take(10) < today,
                        onDelete = if (vm.isAdmin) ({ deleteTarget = a }) else null,
                    )
                }
            }
        }
      }
    }

    if (composing) {
        var title by remember { mutableStateOf("") }
        var owner by remember { mutableStateOf("") }
        var due by remember { mutableStateOf("") }
        com.hyubs.skonnection.feature.FullScreenForm(
            title = "액션아이템 추가", submitLabel = "추가", canSubmit = title.isNotBlank(),
            onSubmit = { if (title.isNotBlank()) vm.create(title, owner, due) { onComposingChange(false) } },
            onClose = { onComposingChange(false) },
        ) {
            com.hyubs.skonnection.feature.FormLabel("할 일", required = true)
            androidx.compose.material3.OutlinedTextField(title, { title = it }, placeholder = { androidx.compose.material3.Text("무엇을 해야 하나요?") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            com.hyubs.skonnection.feature.FormLabel("담당자")
            androidx.compose.material3.OutlinedTextField(owner, { owner = it }, placeholder = { androidx.compose.material3.Text("이름") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            com.hyubs.skonnection.feature.FormLabel("목표일 (선택)")
            androidx.compose.material3.OutlinedTextField(due, { due = it }, placeholder = { androidx.compose.material3.Text("YYYY-MM-DD") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
    }
    deleteTarget?.let { t ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { androidx.compose.material3.Text("액션 삭제") },
            text = { androidx.compose.material3.Text("이 액션아이템을 삭제할까요?") },
            confirmButton = { androidx.compose.material3.TextButton(onClick = { vm.delete(t); deleteTarget = null }) { androidx.compose.material3.Text("삭제", color = androidx.compose.material3.MaterialTheme.colorScheme.error) } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { deleteTarget = null }) { androidx.compose.material3.Text("취소") } },
        )
    }
}

@Composable
private fun AccountsSection(c: AppContainer, modifier: Modifier) {
    val vm = remember { AccountsViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
      when {
        loading && items.isEmpty() -> LoadingBox()
        error != null && items.isEmpty() -> ErrorBox(error!!, vm::retry)
        items.isEmpty() -> EmptyBox("계정이 없어요.")
        else -> {
            val sorted = androidx.compose.runtime.remember(items) { items.sortedForManagement() }
            val active = androidx.compose.runtime.remember(items) { items.count { it.status == "활성" } }
            val pending = androidx.compose.runtime.remember(items) { items.count { it.status == "승인 대기" } }
            var editing by remember { mutableStateOf<Account?>(null) }

            LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 16.dp)) {
                item {
                    InfoBanner(
                        buildString {
                            append("계정 ${items.size}명 · 활성 ${active}명")
                            if (pending > 0) append(" · 승인 대기 ${pending}명")
                            append(if (vm.canEdit) " — 카드를 눌러 권한·상태를 바꿉니다." else " — 권한 변경은 리더만 할 수 있어요.")
                        },
                    )
                }
                items(sorted, key = { it.id }) { a ->
                    AccountCard(a, onClick = if (vm.canEdit) ({ editing = a }) else null)
                }
            }

            editing?.let { target ->
                AccountEditForm(
                    account = target,
                    onClose = { editing = null },
                    onSave = { updated -> vm.save(updated) { editing = null } },
                )
            }
        }
      }
    }
}

@Composable
private fun NotificationsSection(c: AppContainer, email: String?, modifier: Modifier) {
    val vm = remember(email) { NotificationsViewModel(c, email) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
      when {
        loading && items.isEmpty() -> LoadingBox()
        error != null && items.isEmpty() -> ErrorBox(error!!, vm::retry)
        items.isEmpty() -> EmptyBox("받은 알림이 없어요. 챙길 일이 생기면 여기에 모아드릴게요.")
        else -> {
            val unread = androidx.compose.runtime.remember(items) { items.count { !it.read } }
            LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 16.dp)) {
                item {
                    InfoBanner(
                        if (unread > 0) "안 읽은 알림 ${unread}건 · 전체 ${items.size}건"
                        else "새로 온 알림은 없어요 👍 · 전체 ${items.size}건",
                    )
                }
                if (unread > 0) {
                    item {
                        androidx.compose.material3.OutlinedButton(
                            onClick = { vm.markAllRead() },
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        ) { androidx.compose.material3.Text("모두 읽음 ($unread)") }
                    }
                }
                // 알림을 누르면 읽음 처리한다. 읽음 여부를 바꾸는 별도 버튼을 두면 손이 한 번 더 간다.
                items(items, key = { it.id }) { n -> NotificationCard(n, onClick = { vm.markRead(n) }) }
            }
        }
      }
    }
}
