package com.hyubs.skonnection.feature.connect

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.ConnectDraw
import com.hyubs.skonnection.data.ConnectResultRow
import com.hyubs.skonnection.data.DrawMember
import com.hyubs.skonnection.data.toDrawMember
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.sections.SectionScaffold
import com.hyubs.skonnection.ui.theme.Sk
import kotlinx.coroutines.launch

/** 조 뽑기 — 파트를 골고루 섞어 조를 짠다(iOS ConnectView 이식). 공유 profiles 를 대상으로. */
@Composable
fun ConnectSection(container: AppContainer, modifier: Modifier = Modifier) {
    var people by remember { mutableStateOf<List<DrawMember>>(emptyList()) }
    var mixBalanced by remember { mutableStateOf(true) }
    var groupCount by remember { mutableStateOf(2) }
    var result by remember { mutableStateOf<List<List<DrawMember>>>(emptyList()) }
    var savedToast by remember { mutableStateOf<String?>(null) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    LaunchedEffect(Unit) {
        people = runCatching { container.profileRepository.loadAll() }.getOrDefault(emptyList())
            .map { it.toDrawMember() }
            .filter { it.name.isNotBlank() }
    }

    fun draw() {
        if (people.size < 2) return
        val shuffled = people.shuffled()
        val ordered = if (mixBalanced) ConnectDraw.interleaveByPart(shuffled) else shuffled
        result = ConnectDraw.snake(ordered, groupCount.coerceIn(2, people.size))
        savedToast = null
    }

    fun saveResult() {
        val mode = if (mixBalanced) "balanced" else "random"
        val title = "${groupCount}개 조 · ${people.size}명 (${if (mixBalanced) "파트 골고루" else "완전 랜덤"})"
        val id = "CR-" + System.currentTimeMillis().toString(36).uppercase()
        val row = ConnectResultRow(
            id = id, mode = mode, title = title,
            created_at = java.time.Instant.now().toString(),
            summary = title, share_text = ConnectDraw.shareText(result),
        )
        scope.launch { runCatching { container.connectRepository.save(row) } }
        savedToast = "결과를 저장했어요 — 팀과 공유됩니다."
    }

    SectionScaffold(onRefresh = {}, modifier = modifier) {
        LazyColumn(
            Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                CardBox {
                    Text("${people.size}명 참여", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Sk.Ink)
                    Text("파트를 골고루 섞어 같은 파트원이 여러 조로 흩어지게 짜요.", fontSize = 12.sp, color = Sk.Muted)
                }
            }
            item {
                CardBox {
                    Text("섞기 조건", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = mixBalanced, onClick = { mixBalanced = true }, label = { Text("파트 골고루") })
                        FilterChip(selected = !mixBalanced, onClick = { mixBalanced = false }, label = { Text("완전 랜덤") })
                    }
                    Spacer(Modifier.height(4.dp))
                    Text("조 개수", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        IconButton(onClick = { if (groupCount > 2) groupCount-- }) { Icon(Icons.Filled.Remove, "감소") }
                        Text("${groupCount}개 조", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Sk.Ink)
                        IconButton(onClick = { if (groupCount < people.size.coerceAtLeast(2)) groupCount++ }) { Icon(Icons.Filled.Add, "증가") }
                    }
                    Button(onClick = { draw() }, enabled = people.size >= 2, modifier = Modifier.fillMaxWidth()) {
                        Text("조 뽑기")
                    }
                }
            }
            if (people.size < 2) item { EmptyBox("동료 성향에 등록된 팀원이 있어야 조를 뽑을 수 있어요.") }

            savedToast?.let { toast ->
                item {
                    Text(
                        toast, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Sk.TintSuccessInk,
                        modifier = Modifier.fillMaxWidth()
                            .padding(vertical = 2.dp),
                    )
                }
            }
            if (result.isNotEmpty()) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { saveResult() }, modifier = Modifier.weight(1f)) { Text("결과 저장") }
                        OutlinedButton(onClick = { draw() }, modifier = Modifier.weight(1f)) { Text("다시 뽑기") }
                    }
                }
                itemsIndexed(result) { idx, group ->
                    CardBox {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text("${idx + 1}조", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Sk.Primary, modifier = Modifier.weight(1f))
                            Text("${group.size}명", fontSize = 12.sp, color = Sk.Muted)
                        }
                        group.forEach { p -> MemberRow(p) }
                    }
                }
            }
        }
    }
}

@Composable
private fun MemberRow(p: DrawMember) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        androidx.compose.foundation.layout.Box(
            Modifier.size(28.dp).background(Sk.TintPrimary, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(p.name.take(1), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Sk.TintPrimaryInk)
        }
        Text(p.name, fontSize = 14.sp, color = Sk.Ink)
        Text(p.part, fontSize = 12.sp, color = Sk.Muted)
    }
}

@Composable
private fun CardBox(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Sk.Surface), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}
