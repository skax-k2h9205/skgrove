package com.hyubs.skonnection.feature.mypage

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.hyubs.skonnection.data.Assessment
import com.hyubs.skonnection.ui.theme.Sk

/**
 * 성향 진단 플로우 — MBTI 16 + DISC 12 문항을 차례로 물어 결과(mbti, disc, 가이드)를 돌려준다.
 * iOS AssessmentView 이식. 전체화면 다이얼로그.
 */
@Composable
fun AssessmentDialog(
    onDismiss: () -> Unit,
    onComplete: (mbti: String, disc: Char, guide: String) -> Unit,
) {
    var index by remember { mutableStateOf(0) }
    val mbtiAnswers = remember { mutableStateMapOf<String, Boolean>() }
    val discAnswers = remember { mutableStateMapOf<String, Char>() }
    var result by remember { mutableStateOf<Pair<String, Char>?>(null) }
    val total = Assessment.total

    fun advance() {
        if (index + 1 < total) index++
        else result = Assessment.scoreMBTI(mbtiAnswers) to Assessment.scoreDISC(discAnswers)
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxSize().background(Sk.Sunken).padding(20.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(fill = true) {
                Text("성향 진단", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Sk.Ink, modifier = Modifier.weight(1f))
                TextButton(onClick = onDismiss) { Text("닫기") }
            }

            val res = result
            if (res != null) {
                ResultCard(res.first, res.second,
                    onApply = { onComplete(res.first, res.second, Assessment.discGuide[res.second] ?: "") },
                    onRetry = { mbtiAnswers.clear(); discAnswers.clear(); index = 0; result = null })
            } else {
                LinearProgressIndicator(progress = { index.toFloat() / total }, modifier = Modifier.fillMaxWidth())
                Text("${index + 1} / $total", fontSize = 12.sp, color = Sk.Muted)
                Spacer(Modifier.height(4.dp))
                Column(Modifier.animateContentSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (index < Assessment.mbti.size) {
                        val q = Assessment.mbti[index]
                        Text("나에게 더 가까운 쪽은?", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                        Choice(q.a) { mbtiAnswers[q.id] = true; advance() }
                        Choice(q.b) { mbtiAnswers[q.id] = false; advance() }
                    } else {
                        val q = Assessment.disc[index - Assessment.mbti.size]
                        Text(q.prompt, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                        q.options.forEach { opt -> Choice(opt.text) { discAnswers[q.id] = opt.key; advance() } }
                    }
                }
            }
        }
    }
}

@Composable
private fun Row(fill: Boolean, content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) =
    androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, content = content)

@Composable
private fun Choice(text: String, onTap: () -> Unit) {
    OutlinedButton(
        onClick = onTap,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(text, fontSize = 14.sp, color = Sk.Ink, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp))
    }
}

@Composable
private fun ResultCard(mbti: String, disc: Char, onApply: () -> Unit, onRetry: () -> Unit) {
    val label = Assessment.discLabel[disc] ?: ""
    val guide = Assessment.discGuide[disc] ?: ""
    Column(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("✨", fontSize = 40.sp)
        Text("$mbti · $label", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Sk.Ink)
        Text(guide, fontSize = 14.sp, color = Sk.Muted, textAlign = TextAlign.Center)
        Button(onClick = onApply, modifier = Modifier.fillMaxWidth()) { Text("내 프로필에 반영") }
        TextButton(onClick = onRetry) { Text("다시 하기") }
    }
}
