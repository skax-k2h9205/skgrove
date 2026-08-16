package com.hyubs.skonnection.feature.coffee

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hyubs.skonnection.data.CoffeeParticipant
import com.hyubs.skonnection.ui.theme.Sk
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/** 참가자 얼굴 원. 사진 없거나 못 불러오면 이니셜 폴백(사외망 대비). */
@Composable
fun CoffeeFace(p: CoffeeParticipant, size: Int, highlighted: Boolean = false, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(size.dp)
            .background(Sk.TintPrimary, CircleShape)
            .border(if (highlighted) 5.dp else 3.dp, if (highlighted) Sk.Heart else Sk.Surface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.Text(
            p.name.take(1), fontSize = (size * 0.4).sp, fontWeight = FontWeight.Bold, color = Sk.PrimaryStrong,
        )
        if (p.photoURL.isNotBlank()) {
            AsyncImage(
                model = p.photoURL, contentDescription = p.name, contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().clip(CircleShape),
            )
        }
    }
}

/**
 * 손가락룰렛 주최자 화면 — 진짜 멀티터치. 손가락 닿는 순서대로 확정 명단이 배정되고,
 * 2명 이상 유지되면 카운트다운 후 그 순간 사람들로 onSpin.
 */
@Composable
fun FingerRouletteHost(roster: List<CoffeeParticipant>, onSpin: (List<CoffeeParticipant>) -> Unit) {
    val order = remember { mutableStateListOf<PointerId>() }
    val positions = remember { mutableStateMapOf<PointerId, Offset>() }
    var countdown by remember { mutableStateOf<Int?>(null) }
    val density = LocalDensity.current

    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 440.dp)
            .padding(4.dp)
            .background(Sk.Sunken, RoundedCornerShape(16.dp))
            .border(1.dp, Sk.Border, RoundedCornerShape(16.dp))
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        val pressedIds = event.changes.filter { it.pressed }.map { it.id }.toSet()
                        // 손 뗀 포인터 제거
                        order.removeAll { it !in pressedIds }
                        positions.keys.retainAll(pressedIds)
                        // 새 포인터를 닿은 순서대로 append + 위치 갱신
                        for (c in event.changes) {
                            if (c.pressed) {
                                if (c.id !in order) order.add(c.id)
                                positions[c.id] = c.position
                            }
                        }
                    }
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        val assigned = order.take(roster.size).mapIndexedNotNull { idx, id ->
            val pos = positions[id] ?: return@mapIndexedNotNull null
            roster[idx] to pos
        }

        // 손가락 위 얼굴
        assigned.forEach { (p, pos) ->
            Box(
                Modifier.offset { IntOffset((pos.x - with(density) { 39.dp.toPx() }).roundToInt(), (pos.y - with(density) { 39.dp.toPx() }).roundToInt()) },
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CoffeeFace(p, size = 78)
                    androidx.compose.material3.Text(
                        p.name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Sk.Surface,
                        modifier = Modifier.background(Sk.Ink.copy(alpha = 0.75f), CircleShape).padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
        }

        // 가운데 안내/카운트다운
        val cd = countdown
        when {
            cd != null -> androidx.compose.material3.Text("$cd", fontSize = 96.sp, fontWeight = FontWeight.Black, color = Sk.Heart)
            assigned.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                androidx.compose.material3.Text("👆", fontSize = 44.sp)
                androidx.compose.material3.Text("다 같이 손가락을 올려주세요", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                androidx.compose.material3.Text("확정 ${roster.size}명 · 닿는 순서대로 이름이 붙습니다", fontSize = 12.sp, color = Sk.Muted)
            }
            assigned.size < 2 -> androidx.compose.material3.Text("2명 이상 올려주세요", fontSize = 14.sp, color = Sk.Muted)
        }
    }

    // 손 구성이 안정되면(2명 이상 900ms 유지) 3·2·1 카운트다운 후 spin.
    LaunchedEffect(Unit) {
        snapshotFlow { order.take(roster.size).count { positions.containsKey(it) } }
            .collect { count ->
                if (count >= 2) {
                    kotlinx.coroutines.delay(900)
                    val stable = order.take(roster.size).count { positions.containsKey(it) }
                    if (stable == count && stable >= 2) {
                        for (n in 3 downTo 1) {
                            countdown = n
                            kotlinx.coroutines.delay(800)
                            if (order.take(roster.size).count { positions.containsKey(it) } != count) { countdown = null; return@collect }
                        }
                        countdown = null
                        onSpin(order.take(count).mapIndexedNotNull { i, id -> if (positions.containsKey(id)) roster.getOrNull(i) else null }.filterNotNull())
                    } else countdown = null
                } else countdown = null
            }
    }
}

/** 관전(그리고 주최자의 돌리는 중·결과) — 참가자를 원형으로 늘어놓고 seed 로 정해진 포커스를 비춘다. */
@Composable
fun FingerRouletteRing(people: List<CoffeeParticipant>, focus: Int, settled: Boolean, modifier: Modifier = Modifier) {
    var box by remember { mutableStateOf(Offset.Zero) }
    val n = maxOf(people.size, 1)
    Box(modifier.fillMaxWidth().heightIn(min = 320.dp).onSizeChanged { box = Offset(it.width.toFloat(), it.height.toFloat()) }) {
        if (box != Offset.Zero) {
            val radius = min(box.x, box.y) / 2 - 150
            val cx = box.x / 2
            val cy = box.y / 2
            val density = LocalDensity.current
            people.forEachIndexed { i, p ->
                val a = (i.toDouble() / n) * 2 * Math.PI - Math.PI / 2
                val hit = i == focus
                val faceSize = if (hit) 88 else 66
                val px = cx + radius * cos(a).toFloat()
                val py = cy + radius * sin(a).toFloat()
                Column(
                    Modifier.offset { IntOffset((px - with(density) { (faceSize / 2).dp.toPx() }).roundToInt(), (py - with(density) { (faceSize / 2).dp.toPx() }).roundToInt()) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CoffeeFace(p, size = faceSize, highlighted = hit, modifier = if (settled && !hit) Modifier.alpha(0.3f) else Modifier)
                    androidx.compose.material3.Text(p.name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Sk.Ink)
                }
            }
        }
    }
}
