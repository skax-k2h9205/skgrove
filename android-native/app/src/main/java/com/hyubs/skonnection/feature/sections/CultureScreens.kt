package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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

@Composable
fun ProfilesSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { ProfilesViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("등록된 동료 성향이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.key }) { p ->
                FeedCard(
                    title = p.name.ifBlank { "(이름 없음)" },
                    pill = listOfNotNull(p.mbti.ifBlank { null }, p.disc.ifBlank { null }).joinToString(" · ").ifBlank { null },
                    subtitle = "${p.part} · ${p.role}",
                    body = listOf(p.character, p.trait, p.style).firstOrNull { it.isNotBlank() },
                    meta = p.collaboration.ifBlank { null },
                )
            }
        }
    }
}

@Composable
fun MemoriesSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MemoriesViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("기록된 팀 추억이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { m ->
                FeedCard(
                    title = m.title.ifBlank { "(제목 없음)" },
                    subtitle = "${m.host} · ${m.place}",
                    body = m.summary.ifBlank { null },
                    meta = buildString {
                        if (m.eventDate.isNotBlank()) append(m.eventDate.take(10))
                        if (m.tags.isNotEmpty()) { if (isNotEmpty()) append(" · "); append(m.tags.joinToString(" ") { "#$it" }) }
                    }.ifBlank { null },
                )
            }
        }
    }
}

@Composable
fun MeetingsSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MeetingsViewModel(c) }
    val can by vm.can.collectAsStateWithLifecycle()
    val tea by vm.tea.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && can.isEmpty() && tea.isEmpty() -> LoadingBox(modifier)
        can.isEmpty() && tea.isEmpty() -> EmptyBox("등록된 미팅이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            if (can.isNotEmpty()) {
                item { SectionLabel("캔미팅") }
                items(can, key = { "can-${it.id}" }) { s ->
                    FeedCard(
                        title = s.topic.ifBlank { "(주제 없음)" },
                        pill = s.stage.ifBlank { null },
                        subtitle = "${s.teamName} · ${s.method}",
                        body = s.resultSummary.ifBlank { null },
                        meta = s.heldAt.take(16).replace("T", " ").ifBlank { null },
                    )
                }
            }
            if (tea.isNotEmpty()) {
                item { SectionLabel("티미팅") }
                items(tea, key = { "tea-${it.id}" }) { s ->
                    FeedCard(
                        title = s.title.ifBlank { "(제목 없음)" },
                        pill = s.status.ifBlank { s.type.ifBlank { null } },
                        subtitle = "${s.presenter} · ${s.part}",
                        body = s.description.ifBlank { null },
                        meta = s.heldAt.take(16).replace("T", " ").ifBlank { null },
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 12.dp, bottom = 4.dp),
    )
}
