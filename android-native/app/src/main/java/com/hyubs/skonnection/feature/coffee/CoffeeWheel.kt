package com.hyubs.skonnection.feature.coffee

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import com.hyubs.skonnection.data.CoffeeParticipant
import com.hyubs.skonnection.ui.theme.Sk
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

private val wheelPalette = listOf(
    Color(0xFF006BB8), Color(0xFFED4956), Color(0xFF047857), Color(0xFFE8A33D),
    Color(0xFF7C3AED), Color(0xFF0EA5A5), Color(0xFFDB2777), Color(0xFF2563EB),
)

/** 커피룰렛 원판 — rotation(도)만큼 돌아간 상태를 그린다. 섹터는 회전, 라벨은 항상 수평. */
@Composable
fun CoffeeWheel(people: List<CoffeeParticipant>, rotation: Double, modifier: Modifier = Modifier) {
    val n = maxOf(people.size, 1)
    val delta = 360.0 / n
    Canvas(modifier.size(300.dp)) {
        val cx = size.width / 2
        val cy = size.height / 2
        val r = min(size.width, size.height) / 2 - 12

        // 섹터(회전)
        rotate(rotation.toFloat(), pivot = Offset(cx, cy)) {
            for (i in 0 until n) {
                drawSector(
                    color = wheelPalette[i % wheelPalette.size],
                    cx = cx, cy = cy, radius = r,
                    startDeg = -90.0 + i * delta, sweepDeg = delta,
                )
            }
        }
        // 테두리
        drawCircle(Color.White, radius = r, center = Offset(cx, cy), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 8f))

        // 라벨(항상 수평) — 절대각 = 중심각 + rotation
        val labelPaint = android.graphics.Paint().apply {
            color = Color.White.toArgb()
            textAlign = android.graphics.Paint.Align.CENTER
            textSize = if (n > 8) 30f else 36f
            isFakeBoldText = true
            isAntiAlias = true
            setShadowLayer(3f, 0f, 1f, android.graphics.Color.argb(140, 0, 0, 0))
        }
        for (i in 0 until n) {
            val theta = Math.toRadians(-90.0 + (i + 0.5) * delta + rotation)
            val lx = cx + (r * 0.62f) * cos(theta).toFloat()
            val ly = cy + (r * 0.62f) * sin(theta).toFloat() - (labelPaint.ascent() + labelPaint.descent()) / 2
            val name = people.getOrNull(i)?.name ?: "?"
            drawContext.canvas.nativeCanvas.drawText(name.take(6), lx, ly, labelPaint)
        }

        // 허브
        drawCircle(Color.White, radius = 22f, center = Offset(cx, cy))
        drawCircle(Sk.Border, radius = 22f, center = Offset(cx, cy), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))

        // 위쪽 고정 바늘(아래를 가리킴)
        val needle = Path().apply {
            moveTo(cx, cy - r + 4)
            lineTo(cx - 13, cy - r - 18)
            lineTo(cx + 13, cy - r - 18)
            close()
        }
        drawPath(needle, Sk.Heart)
    }
}

private fun DrawScope.drawSector(color: Color, cx: Float, cy: Float, radius: Float, startDeg: Double, sweepDeg: Double) {
    val path = Path().apply {
        moveTo(cx, cy)
        arcTo(
            rect = androidx.compose.ui.geometry.Rect(cx - radius, cy - radius, cx + radius, cy + radius),
            startAngleDegrees = startDeg.toFloat(),
            sweepAngleDegrees = sweepDeg.toFloat(),
            forceMoveTo = false,
        )
        close()
    }
    drawPath(path, color)
}
