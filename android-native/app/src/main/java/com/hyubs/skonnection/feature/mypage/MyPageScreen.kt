package com.hyubs.skonnection.feature.mypage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import com.hyubs.skonnection.data.Assessment
import com.hyubs.skonnection.feature.sections.SectionScaffold
import com.hyubs.skonnection.ui.theme.Sk
import kotlinx.coroutines.launch

/** 마이페이지 — 프로필 + 성향(MBTI·DISC) + '나와 일하는 법'(iOS MyPageView 이식). profiles 테이블 공유. */
@Composable
fun MyPageSection(container: AppContainer, currentEmail: String?, modifier: Modifier = Modifier) {
    val user = container.currentUser
    val email = currentEmail ?: user?.email ?: ""
    var mbti by remember { mutableStateOf("") }
    var disc by remember { mutableStateOf("") }
    var guide by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }
    var assessing by remember { mutableStateOf(false) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    LaunchedEffect(email) {
        val mine = runCatching { container.profileRepository.loadAll() }.getOrDefault(emptyList())
            .firstOrNull { it.key.equals(email, true) || it.name == user?.name }
        if (mine != null) { mbti = mine.mbti; disc = mine.disc; guide = mine.collaboration }
    }

    fun save() {
        saved = true
        scope.launch {
            runCatching {
                container.profileRepository.upsertMine(
                    email = email, name = user?.name ?: "", part = user?.part ?: "",
                    mbti = mbti, disc = disc, collabGuide = guide,
                )
            }
        }
    }

    SectionScaffold(onRefresh = {}, modifier = modifier) {
        LazyColumn(
            Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(Modifier.size(60.dp).background(Sk.TintPrimary, CircleShape), contentAlignment = Alignment.Center) {
                        Text((user?.name ?: "?").take(1), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Sk.TintPrimaryInk)
                    }
                    Column {
                        Text(user?.name ?: "게스트", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Sk.Ink)
                        Text("${user?.role ?: ""} · ${user?.part ?: ""}", fontSize = 13.sp, color = Sk.Muted)
                        if (email.isNotBlank()) Text(email, fontSize = 12.sp, color = Sk.Muted)
                    }
                }
            }

            item {
                Mycard {
                    Text("성향", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                    Text("평소 성향(MBTI)과 업무 성향(DISC)을 골라두면 동료가 협업할 때 참고해요.", fontSize = 12.sp, color = Sk.Muted)
                    OutlinedButton(onClick = { assessing = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("성향 진단하기 (28문항)")
                    }
                    Text("MBTI (평소)", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Sk.Ink)
                    MbtiDropdown(mbti) { mbti = it; saved = false }
                    Text("DISC (업무)", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Sk.Ink)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Assessment.discOptions.forEach { d ->
                            FilterChip(
                                selected = disc == d,
                                onClick = { disc = d; saved = false },
                                label = { Text(if (d.isEmpty()) "없음" else d) },
                            )
                        }
                    }
                }
            }

            item {
                Mycard {
                    Text("나와 일하는 법", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                    Text("동료가 나와 협업할 때 알아두면 좋은 점을 적어두세요.", fontSize = 12.sp, color = Sk.Muted)
                    OutlinedTextField(
                        guide, { guide = it; saved = false },
                        placeholder = { Text("예: 결정 전 배경과 리스크를 함께 보면 빠르게 맞춰갑니다.") },
                        minLines = 3, modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            item {
                Button(
                    onClick = { save() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = if (saved) Sk.Success else Sk.Cta),
                ) { Text(if (saved) "저장됨 · 팀 분포에 반영됨" else "저장") }
            }
        }
    }

    if (assessing) {
        AssessmentDialog(
            onDismiss = { assessing = false },
            onComplete = { resMbti, resDisc, resGuide ->
                mbti = resMbti; disc = resDisc.toString()
                if (guide.isBlank()) guide = resGuide
                assessing = false
                save()
            },
        )
    }
}

@Composable
private fun MbtiDropdown(value: String, onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) {
            Text(if (value.isEmpty()) "선택 안 함" else value, modifier = Modifier.fillMaxWidth())
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Assessment.mbtiOptions.forEach { opt ->
                DropdownMenuItem(text = { Text(if (opt.isEmpty()) "선택 안 함" else opt) }, onClick = { onPick(opt); open = false })
            }
        }
    }
}

@Composable
private fun Mycard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Sk.Surface), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}
