package com.hyubs.skonnection.feature.coffee

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.CoffeeGame
import com.hyubs.skonnection.data.CoffeeGameKind
import com.hyubs.skonnection.data.CoffeeGamePhase
import com.hyubs.skonnection.data.CoffeeParticipant
import com.hyubs.skonnection.data.CoffeeSpin
import com.hyubs.skonnection.ui.theme.Sk
import kotlin.random.Random
import kotlinx.coroutines.launch

/**
 * 커피 내기 게임 화면(iOS CoffeeGameSheet 이식). 주최자는 진행자, 나머지는 관전자 —
 * 같은 화면을 역할만 달리 쓴다. seed·시작시각만 공유하고 각 기기가 같은 연출을 그린다.
 */
@Composable
fun CoffeeGameSheet(
    container: AppContainer,
    gatheringId: String,
    isHost: Boolean,
    hostName: String,
    participantNames: List<String>,
    onWinner: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val repo = container.coffeeGameRepository
    var game by remember { mutableStateOf<CoffeeGame?>(null) }
    var photos by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var nowMs by remember { mutableStateOf(System.currentTimeMillis()) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    val participants = participantNames.map { CoffeeParticipant(it, photos[it] ?: "") }

    // 사진 로드 + 2초 폴링(관전 동기화).
    LaunchedEffect(gatheringId) {
        photos = runCatching { repo.loadPhotos() }.getOrDefault(emptyMap())
        while (true) {
            runCatching { repo.load(gatheringId) }.getOrNull()?.let { game = it }
            kotlinx.coroutines.delay(2000)
        }
    }
    // 프레임 클록 — spinning 동안 매 프레임 벽시계 갱신(관전자도 같은 순간 같은 그림).
    LaunchedEffect(game?.phase) {
        while (true) { withFrameNanos { }; nowMs = System.currentTimeMillis() }
    }

    fun push(g: CoffeeGame) { game = g; scope.launch { runCatching { repo.push(g) } } }
    fun open(kind: CoffeeGameKind) =
        push(CoffeeGame(gatheringId, kind, CoffeeGamePhase.READY, participants = participants, startedAtMs = System.currentTimeMillis(), startedBy = hostName))
    fun spin(people: List<CoffeeParticipant>) {
        val g = game ?: return
        val s = Random.nextLong().toULong().let { if (it == 0uL) 1uL else it }
        push(g.copy(phase = CoffeeGamePhase.SPINNING, seed = s, participants = people, startedAtMs = System.currentTimeMillis()))
    }
    fun finish() {
        val g = game ?: return
        if (g.phase != CoffeeGamePhase.SPINNING) return
        val done = g.copy(phase = CoffeeGamePhase.DONE, winner = g.winnerName)
        push(done)
        if (done.winner.isNotBlank()) onWinner(done.winner)
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState())) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("커피 내기", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Sk.Ink, modifier = Modifier.weight(1f))
                TextButton(onClick = onDismiss) { Text("닫기") }
            }
            Spacer(Modifier.height(8.dp))

            val g = game
            when {
                g != null -> Stage(g, isHost, nowMs, participants, onSpin = { spin(it) }, onFinish = { finish() })
                isHost -> Picker(participants.size) { open(it) }
                else -> Waiting()
            }

            if (g?.phase == CoffeeGamePhase.DONE) {
                Spacer(Modifier.height(16.dp))
                Text("${g.kind.label} · 참가 ${g.participants.size}명", fontSize = 12.sp, color = Sk.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                if (isHost) {
                    OutlinedButton(onClick = { scope.launch { runCatching { repo.clear(gatheringId) }; game = null } }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                        Text("다시 뽑기")
                    }
                }
            }
        }
    }
}

@Composable
private fun Stage(
    g: CoffeeGame, isHost: Boolean, nowMs: Long, participants: List<CoffeeParticipant>,
    onSpin: (List<CoffeeParticipant>) -> Unit, onFinish: () -> Unit,
) {
    when (g.kind) {
        CoffeeGameKind.WHEEL -> {
            val t = when (g.phase) {
                CoffeeGamePhase.SPINNING -> g.elapsed(nowMs)
                CoffeeGamePhase.DONE -> CoffeeSpin.wheelTotalDuration
                else -> 0.0
            }
            val rot = CoffeeSpin.wheelRotation(t, g.winnerIndex, g.participants.size)
            val ended = t >= CoffeeSpin.wheelTotalDuration
            LaunchedEffect(ended) { if (ended && isHost && g.phase == CoffeeGamePhase.SPINNING) onFinish() }

            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Headline(g)
                Spacer(Modifier.height(20.dp))
                CoffeeWheel(g.participants, rot)
                Spacer(Modifier.height(20.dp))
                if (g.phase == CoffeeGamePhase.READY) {
                    if (isHost) Button(onClick = { onSpin(participants) }, colors = ButtonDefaults.buttonColors(containerColor = Sk.Heart), modifier = Modifier.fillMaxWidth()) { Text("돌리기") }
                    else CircularProgressIndicator()
                }
            }
        }
        CoffeeGameKind.FINGER -> {
            if (isHost && g.phase == CoffeeGamePhase.READY) {
                Column(Modifier.fillMaxWidth()) {
                    Headline(g)
                    Spacer(Modifier.height(12.dp))
                    FingerRouletteHost(g.participants) { picked -> onSpin(picked) }
                }
            } else {
                val t = when (g.phase) {
                    CoffeeGamePhase.SPINNING -> g.elapsed(nowMs)
                    CoffeeGamePhase.DONE -> CoffeeSpin.FINGER_DURATION
                    else -> 0.0
                }
                val ended = t >= CoffeeSpin.FINGER_DURATION
                val focus = if (ended) g.winnerIndex else CoffeeSpin.fingerFocus(t, g.winnerIndex, g.participants.size)
                LaunchedEffect(ended) { if (ended && isHost && g.phase == CoffeeGamePhase.SPINNING) onFinish() }

                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    val txt = when {
                        g.phase == CoffeeGamePhase.READY -> "${g.startedBy}님이 준비 중입니다"
                        ended -> "${g.winnerName}님이 커피! ☕"
                        else -> "두구두구…"
                    }
                    Text(txt, fontSize = if (ended) 22.sp else 16.sp, fontWeight = FontWeight.Bold, color = if (ended) Sk.Heart else Sk.Ink)
                    Spacer(Modifier.height(20.dp))
                    FingerRouletteRing(g.participants, focus, settled = ended)
                }
            }
        }
    }
}

@Composable
private fun Headline(g: CoffeeGame) {
    when (g.phase) {
        CoffeeGamePhase.READY -> Text("돌려서 커피 쏠 사람을 정하세요", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
        CoffeeGamePhase.SPINNING -> Text("두구두구…", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Sk.Primary)
        CoffeeGamePhase.DONE -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("☕ 오늘 커피는", fontSize = 13.sp, color = Sk.Muted)
            Text("${g.winnerName}님!", fontSize = 30.sp, fontWeight = FontWeight.Black, color = Sk.Heart)
        }
    }
}

@Composable
private fun Picker(count: Int, onPick: (CoffeeGameKind) -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("어떤 걸로 정할까요?", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Sk.Ink)
        Text("확정 ${count}명이 대상입니다", fontSize = 12.sp, color = Sk.Muted)
        CoffeeGameKind.values().forEach { kind ->
            Card(
                onClick = { onPick(kind) },
                colors = CardDefaults.cardColors(containerColor = Sk.Surface),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(kind.label, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                    Text(kind.blurb, fontSize = 12.sp, color = Sk.Muted)
                }
            }
        }
    }
}

@Composable
private fun Waiting() {
    Column(Modifier.fillMaxWidth().padding(vertical = 60.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        CircularProgressIndicator()
        Text("아직 시작 전이에요", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
        Text("주최자가 게임을 시작하면 여기에서 같이 볼 수 있어요.", fontSize = 12.sp, color = Sk.Muted, textAlign = TextAlign.Center)
    }
}
