package com.hyubs.skonnection.feature.growth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.Account
import com.hyubs.skonnection.data.CompetencyLevel
import com.hyubs.skonnection.data.CompetencyLogEntry
import com.hyubs.skonnection.data.GrowthGoal
import com.hyubs.skonnection.data.GrowthRules
import com.hyubs.skonnection.data.growthCompetencies
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.LoadingBox
import com.hyubs.skonnection.feature.sections.SectionScaffold
import com.hyubs.skonnection.ui.theme.Sk

/**
 * 성장 · 커리어 — iOS GrowthView 이식.
 * 내 성장: 목표 + 역량 자기평가(1~5) + 근거 + 리더 레벨 추이.
 * 팀 성장: 리더 전용 — 팀원 선택 → 목표 코멘트 · 역량 리더 레벨 정렬.
 */
@Composable
fun GrowthSection(container: AppContainer, currentEmail: String?, modifier: Modifier = Modifier) {
    val vm = remember { GrowthViewModel(container) }
    val goals by vm.goals.collectAsStateWithLifecycle()
    val levels by vm.levels.collectAsStateWithLifecycle()
    val log by vm.log.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()

    val isLeader = container.isLeader
    var tab by remember { mutableStateOf(0) }
    val myEmail = currentEmail ?: container.currentUser?.email ?: ""

    SectionScaffold(onRefresh = { vm.refresh() }, modifier = modifier) {
        if (loading && goals.isEmpty() && levels.isEmpty()) {
            LoadingBox(); return@SectionScaffold
        }
        Column(Modifier.fillMaxWidth()) {
            if (isLeader) {
                TabRow(selectedTabIndex = tab) {
                    Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("내 성장") })
                    Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("팀 성장") })
                }
            }
            if (tab == 0 || !isLeader) {
                MyGrowth(vm, myEmail, goals, levels, log)
            } else {
                TeamGrowth(vm, container, goals, levels, log)
            }
        }
    }
}

// ────────────────────────────── 내 성장 ──────────────────────────────
@Composable
private fun MyGrowth(
    vm: GrowthViewModel,
    myEmail: String,
    goals: List<GrowthGoal>,
    levels: List<CompetencyLevel>,
    log: List<CompetencyLogEntry>,
) {
    val mine = goals.filter { it.ownerEmail.equals(myEmail, true) }
    LazyColumn(
        Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { SectionTitle("성장 목표") }
        item { GoalForm(onAdd = { t, d, due -> if (t.isNotBlank()) vm.addGoal(myEmail, t, d, due) }) }
        if (mine.isEmpty()) item { EmptyBox("아직 목표가 없어요. 첫 목표를 세워보세요.") }
        items(mine, key = { it.id }) { g ->
            GoalCard(g, editable = true, onProgress = { vm.setProgress(g.id, it) })
        }

        item { Spacer(Modifier.height(8.dp)); SectionTitle("역량 레벨 (자기평가)") }
        items(growthCompetencies) { comp ->
            val lvl = levels.firstOrNull { it.ownerEmail.equals(myEmail, true) && it.competency == comp }
            CompetencyCard(
                competency = comp,
                lvl = lvl,
                leaderCurve = GrowthRules.curve(log, comp, "leader"),
                selfCurve = GrowthRules.curve(log, comp, "self"),
                editableSelf = true,
                editableLeader = false,
                onSelf = { vm.setSelfLevel(myEmail, comp, it) },
                onEvidence = { vm.setEvidence(myEmail, comp, it) },
                onLeader = {},
            )
        }
    }
}

// ────────────────────────────── 팀 성장 (리더) ──────────────────────────────
@Composable
private fun TeamGrowth(
    vm: GrowthViewModel,
    container: AppContainer,
    goals: List<GrowthGoal>,
    levels: List<CompetencyLevel>,
    log: List<CompetencyLogEntry>,
) {
    var roster by remember { mutableStateOf<List<Account>>(emptyList()) }
    var selected by remember { mutableStateOf<Account?>(null) }
    LaunchedEffect(Unit) {
        roster = runCatching { container.accountRepository.loadAll() }.getOrDefault(emptyList())
            .filter { it.status == "활성" }
            .sortedBy { it.name }
    }

    LazyColumn(
        Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { SectionTitle("팀원 선택") }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // 가로 스크롤 대신 간단 랩: 한 줄에 다 못 담으면 Column 나열
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                roster.chunked(2).forEach { pair ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pair.forEach { acc ->
                            val on = selected?.id == acc.id
                            if (on) Button(onClick = { selected = acc }, modifier = Modifier.width(160.dp)) { Text(acc.name) }
                            else OutlinedButton(onClick = { selected = acc }, modifier = Modifier.width(160.dp)) { Text(acc.name) }
                        }
                    }
                }
            }
        }

        val who = selected
        if (who == null) {
            item { EmptyBox("팀원을 선택하면 목표·역량을 볼 수 있어요.") }
        } else {
            item { Spacer(Modifier.height(4.dp)); SectionTitle("${who.name} 님의 목표") }
            val theirGoals = goals.filter { it.ownerEmail.equals(who.email, true) }
            if (theirGoals.isEmpty()) item { EmptyBox("등록된 목표가 없어요.") }
            items(theirGoals, key = { it.id }) { g ->
                GoalCard(g, editable = false, onProgress = {}, leaderComment = g.leaderComment, onLeaderComment = { vm.setLeaderComment(g.id, it) })
            }

            item { Spacer(Modifier.height(4.dp)); SectionTitle("역량 정렬 (리더 평가)") }
            items(growthCompetencies) { comp ->
                val lvl = levels.firstOrNull { it.ownerEmail.equals(who.email, true) && it.competency == comp }
                    ?: CompetencyLevel(id = "", ownerEmail = who.email, competency = comp)
                CompetencyCard(
                    competency = comp,
                    lvl = lvl,
                    leaderCurve = GrowthRules.curve(log, comp, "leader"),
                    selfCurve = GrowthRules.curve(log, comp, "self"),
                    editableSelf = false,
                    editableLeader = true,
                    onSelf = {},
                    onEvidence = {},
                    onLeader = { vm.setLeaderLevel(lvl, it) },
                )
            }
        }
    }
}

// ────────────────────────────── 공통 카드 ──────────────────────────────
@Composable
private fun SectionTitle(text: String) {
    Text(text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
}

@Composable
private fun GoalForm(onAdd: (title: String, detail: String, due: String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var detail by remember { mutableStateOf("") }
    var due by remember { mutableStateOf("") }
    Card(colors = CardDefaults.cardColors(containerColor = Sk.Surface), shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(title, { title = it }, label = { Text("목표") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(detail, { detail = it }, label = { Text("상세 (선택)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(due, { due = it }, label = { Text("목표일 (예: 2026-12)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(
                onClick = { onAdd(title, detail, due); title = ""; detail = ""; due = "" },
                enabled = title.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("목표 추가") }
        }
    }
}

@Composable
private fun GoalCard(
    g: GrowthGoal,
    editable: Boolean,
    onProgress: (Int) -> Unit,
    leaderComment: String? = null,
    onLeaderComment: ((String) -> Unit)? = null,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Sk.Surface), shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(g.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink, modifier = Modifier.weight(1f))
                StatusBadge(g.status)
            }
            if (g.detail.isNotBlank()) Text(g.detail, fontSize = 13.sp, color = Sk.Muted)
            if (g.due.isNotBlank()) Text("목표일 ${g.due}", fontSize = 12.sp, color = Sk.Muted)
            Text("진척 ${g.progress}%", fontSize = 12.sp, color = Sk.Primary, fontWeight = FontWeight.Medium)
            if (editable) {
                Slider(
                    value = g.progress.toFloat(),
                    onValueChange = { onProgress(it.toInt()) },
                    valueRange = 0f..100f,
                    steps = 9,
                )
            }
            if (g.leaderComment.isNotBlank() && onLeaderComment == null) {
                Text("리더 코멘트: ${g.leaderComment}", fontSize = 12.sp, color = Sk.TintPrimaryInk)
            }
            if (onLeaderComment != null) {
                var c by remember(g.id) { mutableStateOf(leaderComment ?: g.leaderComment) }
                OutlinedTextField(c, { c = it }, label = { Text("리더 코멘트") }, modifier = Modifier.fillMaxWidth())
                FilledTonalButton(onClick = { onLeaderComment(c) }, modifier = Modifier.align(Alignment.End)) { Text("코멘트 저장") }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val done = status == "완료"
    Text(
        status,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = if (done) Sk.TintSuccessInk else Sk.TintPrimaryInk,
        modifier = Modifier
            .background(if (done) Sk.TintSuccess else Sk.TintPrimary, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@Composable
private fun CompetencyCard(
    competency: String,
    lvl: CompetencyLevel?,
    leaderCurve: List<Int>,
    selfCurve: List<Int>,
    editableSelf: Boolean,
    editableLeader: Boolean,
    onSelf: (Int) -> Unit,
    onEvidence: (String) -> Unit,
    onLeader: (Int) -> Unit,
) {
    val self = lvl?.selfLevel ?: 1
    val leader = lvl?.leaderLevel
    Card(colors = CardDefaults.cardColors(containerColor = Sk.Surface), shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(competency, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink, modifier = Modifier.weight(1f))
                if (leader != null) Text("리더 $leader", fontSize = 12.sp, color = Sk.Purple, fontWeight = FontWeight.Medium)
            }
            LevelPicker(label = "자기평가", value = self, enabled = editableSelf, onPick = onSelf)
            if (editableLeader) LevelPicker(label = "리더평가", value = leader ?: self, enabled = true, onPick = onLeader)

            if (leaderCurve.size >= 2 || selfCurve.size >= 2) Sparkline(selfCurve, leaderCurve)

            if (editableSelf) {
                var ev by remember(lvl?.id) { mutableStateOf(lvl?.evidence ?: "") }
                OutlinedTextField(ev, { ev = it }, label = { Text("근거 · 성과") }, modifier = Modifier.fillMaxWidth())
                FilledTonalButton(onClick = { onEvidence(ev) }, modifier = Modifier.align(Alignment.End)) { Text("근거 저장") }
            } else if (!lvl?.evidence.isNullOrBlank()) {
                Text("근거: ${lvl?.evidence}", fontSize = 12.sp, color = Sk.Muted)
            }
        }
    }
}

@Composable
private fun LevelPicker(label: String, value: Int, enabled: Boolean, onPick: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontSize = 12.sp, color = Sk.Muted, modifier = Modifier.width(56.dp))
        (1..5).forEach { n ->
            val on = n <= value
            OutlinedButton(
                onClick = { if (enabled) onPick(n) },
                enabled = enabled,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                modifier = Modifier.size(34.dp),
            ) {
                Text("$n", fontSize = 13.sp, color = if (on) Sk.Primary else Sk.Muted, fontWeight = if (on) FontWeight.Bold else FontWeight.Normal)
            }
        }
    }
}

/** 레벨 추이 스파크라인 — self(파랑)·leader(보라). */
@Composable
private fun Sparkline(self: List<Int>, leader: List<Int>) {
    androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().height(40.dp)) {
        fun draw(points: List<Int>, color: androidx.compose.ui.graphics.Color) {
            if (points.size < 2) return
            val w = size.width; val h = size.height
            val stepX = w / (points.size - 1)
            val path = Path()
            points.forEachIndexed { i, v ->
                val x = stepX * i
                val y = h - (v.coerceIn(1, 5) - 1) / 4f * h
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, color, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
            points.forEachIndexed { i, v ->
                val x = stepX * i
                val y = h - (v.coerceIn(1, 5) - 1) / 4f * h
                drawCircle(color, radius = 3.5f, center = Offset(x, y))
            }
        }
        draw(self, Sk.Primary)
        draw(leader, Sk.Purple)
    }
}
