package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import com.hyubs.skonnection.data.CanSession
import com.hyubs.skonnection.data.Profile
import com.hyubs.skonnection.data.TeaSession
import com.hyubs.skonnection.data.TeamMemory
import com.hyubs.skonnection.data.Temperament
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.SkCard
import com.hyubs.skonnection.ui.theme.Sk
import com.hyubs.skonnection.feature.ErrorBox
import com.hyubs.skonnection.feature.LoadingBox

// 브랜드 토큰만 쓴다(웹 styles.css → iOS Theme.Palette 동일 값).
private val Blue = Sk.Cta
private val Green = Sk.Success

// ── 파트지수 · 리포트 ──────────────────────────────────────────────

@Composable
fun MetricsSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MetricsViewModel(c) }
    val m by vm.metrics.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    if (loading) { LoadingBox(modifier); return }
    // 지표는 세 소스를 다 읽어야 비율이 맞다. 하나라도 실패하면 틀린 숫자 대신 실패를 말한다.
    error?.let { ErrorBox(it, vm::retry, modifier); return }
    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
        item {
            Surface(
                color = MaterialTheme.colorScheme.primary,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text("CULTURE HEALTH REPORT", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f))
                    Text("팀 문화 건강도 ${m.cultureHealth}", style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimary)
                    Text("접수·안건·액션 흐름을 실데이터로 집계합니다.", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                        modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        item { StatCard("접수 반영률", m.reflectionRate, "총 ${m.issueCount}건의 접수 중 리더가 처리(답변·1on1·안건·액션·종료)한 비율") }
        item { StatCard("안건 성사율", m.agendaPassRate, "총 ${m.agendaCount}건의 안건 중 통과·결정된 비율") }
        item {
            StatCard(
                "액션 완료율", m.actionDoneRate,
                "총 ${m.actionCount}건의 액션 중 완료된 비율" + if (m.overdueCount > 0) " · 지연 ${m.overdueCount}건" else "",
            )
        }
    }
    }
}

/** 지표 카드 — 숫자만 크게 두지 않고 막대를 함께 둬서 "얼마나 찼는지"가 먼저 읽히게 한다. */
@Composable
private fun StatCard(title: String, percent: Int, desc: String) {
    SkCard(Modifier.padding(top = 10.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text("$percent%", style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            Bar(percent / 100f, MaterialTheme.colorScheme.primary, Modifier.padding(top = 10.dp))
            Text(desc, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
    }
}

/** 공용 진행 막대. fraction은 0~1로 잘라 넣는다. */
@Composable
private fun Bar(fraction: Float, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(8.dp)
            .clip(RoundedCornerShape(50)).background(color))
    }
}

// ── 동료 성향 ─────────────────────────────────────────────────────

@Composable
fun ProfilesSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { ProfilesViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }

    if (loading && items.isEmpty()) { LoadingBox(modifier); return }
    if (items.isEmpty()) {
        error?.let { ErrorBox(it, vm::retry, modifier) } ?: EmptyBox("등록된 동료 성향이 없어요.", modifier)
        return
    }

    val matched = remember(items, query) {
        val q = query.trim()
        if (q.isBlank()) items
        else items.filter {
            it.name.contains(q, true) || it.part.contains(q, true) ||
                it.mbti.contains(q, true) || it.temperamentLabel.contains(q)
        }
    }

    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
        item { TemperamentCard(items) }
        item {
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                placeholder = { Text("이름·성향·MBTI·파트로 찾기") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
        }
        if (matched.isEmpty()) {
            item {
                Text("찾는 동료가 없어요.", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(24.dp))
            }
        } else {
            items(matched, key = { it.key }) { ProfileRowCard(it) }
        }
    }
    }
}

/** 팀 성향 분포 — MBTI를 4대 기질로 묶어 어느 쪽으로 기울어 있는지 한눈에 본다. */
@Composable
private fun TemperamentCard(profiles: List<Profile>) {
    val written = profiles.count { it.mbti.isNotBlank() }
    val counts = Temperament.entries.map { t -> t to profiles.count { it.temperament == t } }
    val max = (counts.maxOfOrNull { it.second } ?: 1).coerceAtLeast(1)
    SkCard {
        Column(Modifier.padding(16.dp)) {
            Text("팀 성향 분포", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text("작성한 ${written}명의 MBTI를 4대 기질로 묶었어요.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            counts.forEach { (t, count) ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                ) {
                    Column(Modifier.width(96.dp)) {
                        Text(t.label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        Text(t.hint, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    // 0명은 채우지 않는다. 얇은 자국을 남기면 "한 명은 있다"로 잘못 읽힌다.
                    Bar(if (count == 0) 0f else count.toFloat() / max, Blue, Modifier.weight(1f).padding(horizontal = 10.dp))
                    Text("$count", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun ProfileRowCard(p: Profile) {
    SkCard(Modifier.padding(top = 10.dp)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MiniAvatar(p.name, size = 40)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(p.name.ifBlank { "(이름 없음)" }, style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold)
                    Text(listOf(p.part, p.temperamentLabel).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (p.mbti.isNotBlank()) StatusBadge(p.mbti, Blue)
                    if (p.disc.isNotBlank()) StatusBadge(p.disc, Green)
                }
            }
            if (p.guide.isNotBlank()) {
                Text("💡 ${p.guide}", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 52.dp, top = 6.dp))
            }
        }
    }
}

// ── 팀 추억 ───────────────────────────────────────────────────────

@Composable
fun MemoriesSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MemoriesViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
      when {
        loading && items.isEmpty() -> LoadingBox()
        error != null && items.isEmpty() -> ErrorBox(error!!, vm::retry)
        items.isEmpty() -> EmptyBox("기록된 팀 추억이 없어요.")
        else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { MemoryCard(it) }
        }
      }
    }
}

/** 추억 카드 — 날짜를 좌측 칩으로 세워 시간 순서가 스크롤에서 먼저 잡히게 한다. */
@Composable
private fun MemoryCard(m: TeamMemory) {
    SkCard(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
        Row(Modifier.padding(16.dp)) {
            DateChip(m.eventDate)
            Column(Modifier.weight(1f).padding(start = 14.dp)) {
                Text(m.title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold)
                Text(listOf(m.host, m.place).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (m.summary.isNotBlank()) {
                    Text(m.summary, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 6.dp))
                }
                if (m.tags.isNotEmpty()) {
                    Text(m.tags.joinToString(" ") { "#$it" }, style = MaterialTheme.typography.labelSmall,
                        color = Blue, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
    }
}

/** 날짜 칩 — "8월 / 14" 두 줄. 날짜를 못 읽으면 칩 대신 아무것도 두지 않는다. */
@Composable
private fun DateChip(raw: String) {
    val date = remember(raw) { runCatching { java.time.LocalDate.parse(raw.take(10)) }.getOrNull() }
    Column(
        Modifier.width(52.dp).clip(RoundedCornerShape(10.dp))
            .background(Blue.copy(alpha = 0.10f)).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (date == null) {
            Text("—", style = MaterialTheme.typography.labelSmall, color = Blue)
        } else {
            Text("${date.monthValue}월", style = MaterialTheme.typography.labelSmall, color = Blue)
            Text("${date.dayOfMonth}", style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold, color = Blue)
        }
    }
}

// ── 캔미팅 · 티미팅 ────────────────────────────────────────────────

@Composable
fun MeetingsSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MeetingsViewModel(c) }
    val can by vm.can.collectAsStateWithLifecycle()
    val tea by vm.tea.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    // 두 종류를 한 목록에 이어 붙이면 어느 쪽을 보는 중인지 흐려진다. 탭으로 나눈다.
    var tab by remember { mutableStateOf(0) }

    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
      when {
        loading && can.isEmpty() && tea.isEmpty() -> LoadingBox()
        error != null && can.isEmpty() && tea.isEmpty() -> ErrorBox(error!!, vm::retry)
        can.isEmpty() && tea.isEmpty() -> EmptyBox("등록된 미팅이 없어요.")
        else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 16.dp)) {
            item {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FilterChip(tab == 0, { tab = 0 }, { Text("캔미팅 ${can.size}") })
                    FilterChip(tab == 1, { tab = 1 }, { Text("티미팅 ${tea.size}") })
                }
            }
            if (tab == 0) {
                if (can.isEmpty()) item { SectionNote("등록된 캔미팅이 없어요.") }
                items(can, key = { "can-${it.id}" }) { CanCard(it) }
            } else {
                if (tea.isEmpty()) item { SectionNote("등록된 티미팅이 없어요.") }
                items(tea, key = { "tea-${it.id}" }) { TeaCard(it) }
            }
        }
      }
    }
}

@Composable
private fun CanCard(s: CanSession) {
    MeetingCard(
        title = s.topic.ifBlank { "(주제 없음)" },
        badge = s.stageLabel,
        meta = listOf(s.teamName, s.method).filter { it.isNotBlank() }.joinToString(" · "),
        body = s.resultSummary,
        heldAt = s.heldAt,
    )
}

@Composable
private fun TeaCard(s: TeaSession) {
    MeetingCard(
        title = s.title.ifBlank { "(제목 없음)" },
        badge = s.status.ifBlank { s.type },
        meta = listOf(s.presenter, s.part).filter { it.isNotBlank() }.joinToString(" · "),
        body = s.description,
        heldAt = s.heldAt,
    )
}

@Composable
private fun MeetingCard(title: String, badge: String, meta: String, body: String, heldAt: String) {
    SkCard(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(meta, style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                if (badge.isNotBlank()) StatusBadge(badge)
            }
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 4.dp))
            if (body.isNotBlank()) {
                Text(body, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3,
                    modifier = Modifier.padding(top = 6.dp))
            }
            if (heldAt.isNotBlank()) {
                Text(heldAt.take(16).replace("T", " "), style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp))
            }
        }
    }
}

@Composable
private fun SectionNote(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth().padding(32.dp))
}
