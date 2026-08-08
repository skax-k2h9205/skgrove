package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.FeedCard
import com.hyubs.skonnection.feature.LoadingBox

/** 더보기 허브에서 고른 섹션을 렌더. 미구현 섹션은 안내 문구. */
@Composable
fun SectionHost(container: AppContainer, section: String, currentEmail: String?, modifier: Modifier = Modifier) {
    when (section) {
        "대나무숲 접수", "리더 관리함" -> IssuesSection(container, modifier)
        "안건 · 투표" -> AgendaSection(container, modifier)
        "액션아이템" -> ActionsSection(container, modifier)
        "알림 · 메시지" -> NotificationsSection(container, currentEmail, modifier)
        "계정 관리" -> AccountsSection(container, modifier)
        "동료 성향" -> ProfilesSection(container, modifier)
        "팀 추억" -> MemoriesSection(container, modifier)
        "캔미팅 · 티미팅" -> MeetingsSection(container, modifier)
        else -> EmptyBox("‘$section’ 화면은 곧 제공됩니다.", modifier)
    }
}

@Composable
private fun IssuesSection(c: AppContainer, modifier: Modifier) {
    val vm = remember { IssuesViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("접수된 내용이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { i ->
                FeedCard(
                    title = i.title.ifBlank { "(제목 없음)" },
                    pill = i.status.ifBlank { null },
                    subtitle = "${i.category} · ${i.target} · ${i.submitter}",
                    body = i.body.ifBlank { null },
                    meta = if (i.urgency.isNotBlank()) "긴급도 ${i.urgency}" else null,
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
    val votedIds by vm.votedIds.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("등록된 안건이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { a ->
                val total = a.approve + a.reject
                val rate = if (total > 0) a.approve * 100 / total else 0
                val voted = votedIds.contains(a.id)
                val open = a.status == "투표중"
                androidx.compose.material3.Card(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                ) {
                    androidx.compose.foundation.layout.Column(Modifier.padding(16.dp)) {
                        androidx.compose.foundation.layout.Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            androidx.compose.material3.Text(
                                a.title.ifBlank { "(제목 없음)" },
                                style = androidx.compose.material3.MaterialTheme.typography.titleSmall,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                                modifier = Modifier.padding(end = 8.dp),
                            )
                            androidx.compose.material3.Text(
                                a.status,
                                style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
                                color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                            )
                        }
                        androidx.compose.material3.Text(
                            "${a.category} · ${a.part}",
                            style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
                            color = androidx.compose.material3.MaterialTheme.colorScheme.outline,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                        if (a.description.isNotBlank()) {
                            androidx.compose.material3.Text(
                                a.description,
                                style = androidx.compose.material3.MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                        }
                        androidx.compose.material3.Text(
                            "찬성 ${a.approve} · 반대 ${a.reject} (찬성률 ${rate}%)",
                            style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                            color = androidx.compose.material3.MaterialTheme.colorScheme.outline,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        if (open && !voted) {
                            androidx.compose.foundation.layout.Row(modifier = Modifier.padding(top = 10.dp)) {
                                androidx.compose.material3.Button(
                                    onClick = { vm.vote(a, true) },
                                    modifier = Modifier.padding(end = 8.dp),
                                ) { androidx.compose.material3.Text("찬성") }
                                androidx.compose.material3.OutlinedButton(onClick = { vm.vote(a, false) }) {
                                    androidx.compose.material3.Text("반대")
                                }
                            }
                        } else if (voted) {
                            androidx.compose.material3.Text(
                                "✓ 투표 완료",
                                style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                                color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(top = 10.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionsSection(c: AppContainer, modifier: Modifier) {
    val vm = remember { ActionsViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("액션아이템이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { a ->
                FeedCard(
                    title = a.title.ifBlank { "(제목 없음)" },
                    pill = a.status.ifBlank { null },
                    subtitle = "담당 ${a.owner}",
                    meta = buildString {
                        if (a.due.isNotBlank()) append("목표일 ${a.due.take(10)}")
                        if (a.sourceLabel.isNotBlank()) { if (isNotEmpty()) append(" · "); append(a.sourceLabel) }
                    }.ifBlank { null },
                )
            }
        }
    }
}

@Composable
private fun AccountsSection(c: AppContainer, modifier: Modifier) {
    val vm = remember { AccountsViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("계정이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { a ->
                FeedCard(
                    title = a.name.ifBlank { a.email },
                    pill = a.role,
                    subtitle = a.email,
                    meta = "${a.part} · ${a.status}",
                )
            }
        }
    }
}

@Composable
private fun NotificationsSection(c: AppContainer, email: String?, modifier: Modifier) {
    val vm = remember(email) { NotificationsViewModel(c, email) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("받은 알림이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { n ->
                FeedCard(
                    title = n.title.ifBlank { n.kind },
                    pill = if (!n.read) "새 알림" else null,
                    subtitle = if (n.from.isNotBlank()) "from ${n.from}" else null,
                    body = n.body.ifBlank { null },
                    meta = n.createdAt.take(16).replace("T", " ").ifBlank { null },
                )
            }
        }
    }
}
