package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ── 색 팔레트 ─────────────────────────────────────────────
private val Blue = Color(0xFF2563EB)
private val Green = Color(0xFF059669)
private val Amber = Color(0xFFD97706)
private val Red = Color(0xFFDC2626)
private val Purple = Color(0xFF7C3AED)
private val Cyan = Color(0xFF0891B2)
private val Gray = Color(0xFF6B7280)

fun statusColor(status: String): Color = when (status) {
    "투표중", "진행중", "안건화", "1on1 제안" -> Blue
    "통과", "결정됨", "완료", "답변완료", "채택" -> Green
    "부결", "높음" -> Red
    "검토중", "재검토", "보통" -> Amber
    "액션아이템" -> Cyan
    else -> Gray
}

private val avatarPalette = listOf(Blue, Purple, Color(0xFFDB2777), Green, Amber, Cyan, Red, Color(0xFF4F46E5))
private fun avatarColor(name: String) =
    avatarPalette[(name.hashCode().let { if (it < 0) -it else it }) % avatarPalette.size]

@Composable
fun MiniAvatar(name: String, size: Int = 32) {
    Box(
        Modifier.size(size.dp).clip(CircleShape).background(avatarColor(name.ifBlank { "?" })),
        contentAlignment = Alignment.Center,
    ) {
        Text(name.trim().take(1).ifBlank { "?" }, color = Color.White, fontWeight = FontWeight.Bold, fontSize = (size * 0.42).sp)
    }
}

/** 상태/긴급도 배지 — 색 배경 pill. */
@Composable
fun StatusBadge(text: String, color: Color = statusColor(text)) {
    Text(
        text,
        color = color,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

/**
 * 인스타 투표 스티커식 막대 — 배경 트랙 + 채움 + "N표 · N%" 오버레이.
 *
 * 퍼센트만 보여주면 "찬성 100%"가 1표인지 30표인지 구분이 안 된다. 표수를 같이 적어
 * 읽는 사람이 집계의 무게를 알 수 있게 한다.
 */
@Composable
fun PollBar(label: String, votes: Int, pct: Int, leading: Boolean, color: Color) {
    Box(
        Modifier.fillMaxWidth().height(38.dp).clip(RoundedCornerShape(9.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Box(
            Modifier.fillMaxWidth(pct / 100f).height(38.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(if (leading) color.copy(alpha = 0.28f) else color.copy(alpha = 0.14f)),
        )
        Row(
            Modifier.fillMaxWidth().height(38.dp).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (leading) FontWeight.Bold else FontWeight.Normal)
            Spacer(Modifier.weight(1f))
            Text("${votes}표 · $pct%", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** 접수/리더관리함 카드 — 아바타 + 제목 + 상태/긴급도 배지 + 분류·대상 + 본문 미리보기. */
@Composable
fun IssueCard(title: String, status: String, urgency: String, category: String, target: String, submitter: String, body: String) {
    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MiniAvatar(submitter)
                Column(Modifier.padding(start = 10.dp).weight(1f)) {
                    Text(submitter.ifBlank { "익명" }, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                    Text("$category · $target", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
                }
                if (status.isNotBlank()) StatusBadge(status)
            }
            Text(title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 10.dp))
            if (body.isNotBlank()) {
                Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2, modifier = Modifier.padding(top = 4.dp))
            }
            if (urgency.isNotBlank()) {
                Row(Modifier.padding(top = 10.dp)) { StatusBadge("긴급도 $urgency", statusColor(urgency)) }
            }
        }
    }
}

/** 안건 카드(iOS 이식) — 상태 + 찬반 바(N표·N%) + 정족수 진행바 + 참여·대상·마감 + 투표. */
@Composable
fun AgendaCard(
    title: String, status: String, category: String, part: String, description: String,
    approve: Int, reject: Int, eligible: Int, deadline: String, quorum: Int,
    voted: Boolean, open: Boolean, onApprove: () -> Unit, onReject: () -> Unit,
) {
    val total = approve + reject
    val rate = if (total > 0) approve * 100 / total else 0
    val rejectRate = if (total > 0) 100 - rate else 0
    val quorumProgress = if (quorum > 0) (total.toFloat() / quorum).coerceIn(0f, 1f) else 1f
    val remaining = (quorum - total).coerceAtLeast(0)
    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(listOf(category, part).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.weight(1f))
                StatusBadge(status)
            }
            Text(title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
            if (description.isNotBlank()) {
                Text(description, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, modifier = Modifier.padding(top = 4.dp))
            }
            // 찬반 바 — "N표 · N%"
            Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PollBar("찬성", approve, if (total > 0) rate else 0, leading = total > 0 && rate >= 50, color = Green)
                PollBar("반대", reject, if (total > 0) rejectRate else 0, leading = total > 0 && rate < 50, color = Red)
            }
            // 정족수 진행바 + 남은 표
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
                Box(Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(50)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                    Box(Modifier.fillMaxWidth(quorumProgress).height(6.dp).clip(RoundedCornerShape(50)).background(Blue))
                }
                Text(if (remaining > 0) "성립까지 ${remaining}표" else "정족수 충족",
                    style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold,
                    color = if (remaining > 0) MaterialTheme.colorScheme.outline else Green,
                    modifier = Modifier.padding(start = 10.dp))
            }
            Text(
                buildString {
                    append("${total}명 참여")
                    if (eligible > 0) append(" · 대상 ${eligible}명")
                    deadlineLabel(deadline)?.let { append(" · $it") }
                },
                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline,
                modifier = Modifier.padding(top = 8.dp),
            )
            if (open && !voted) {
                Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onApprove, modifier = Modifier.weight(1f)) { Text("찬성") }
                    OutlinedButton(onClick = onReject, modifier = Modifier.weight(1f)) { Text("반대") }
                }
            } else if (voted) {
                Text("✓ 투표 완료", color = Blue, style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp))
            }
        }
    }
}

/**
 * 마감일을 남은 기간으로 읽어준다("D-3"). 날짜만 적혀 있으면 급한지 아닌지 한눈에 안 들어온다.
 * 마감일이 없거나 형식이 어긋나면 null — 없는 정보를 지어내지 않는다.
 */
private fun deadlineLabel(deadline: String): String? {
    val date = runCatching { java.time.LocalDate.parse(deadline.take(10)) }.getOrNull() ?: return null
    val days = java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), date)
    return when {
        days < 0 -> "마감 지남"
        days == 0L -> "오늘 마감"
        else -> "마감 D-$days"
    }
}

/** 액션 카드 — 담당자 아바타 + 제목 + 상태 + 목표일(지연 빨강). */
@Composable
fun ActionCard(title: String, status: String, owner: String, due: String, sourceLabel: String, overdue: Boolean, onDelete: (() -> Unit)? = null) {
    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MiniAvatar(owner.ifBlank { "미" }, size = 28)
                Text(owner.ifBlank { "미정" }, style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp).weight(1f))
                StatusBadge(status)
                if (onDelete != null) {
                    Text("삭제", color = Red, style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(start = 8.dp)
                            .clickable(onClick = onDelete)
                            .padding(horizontal = 6.dp, vertical = 2.dp))
                }
            }
            Text(title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 10.dp))
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (due.isNotBlank()) {
                    Text(
                        (if (overdue) "⚠ 목표일 " else "목표일 ") + due.take(10),
                        style = MaterialTheme.typography.labelMedium,
                        color = if (overdue) Red else MaterialTheme.colorScheme.outline,
                        fontWeight = if (overdue) FontWeight.Bold else FontWeight.Normal,
                    )
                }
                if (sourceLabel.isNotBlank()) {
                    Text("  ·  $sourceLabel", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.outline)
                }
            }
        }
    }
}
