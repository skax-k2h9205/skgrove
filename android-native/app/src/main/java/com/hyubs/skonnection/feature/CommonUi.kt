package com.hyubs.skonnection.feature

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hyubs.skonnection.ui.theme.SkRadius

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

/**
 * 빈 상태 — 아이콘 + 안내 문구(iOS EmptyState 이식).
 * 회색 글씨 한 줄만 두면 화면이 고장난 것처럼 보인다.
 */
@Composable
fun EmptyBox(text: String, modifier: Modifier = Modifier, icon: ImageVector = Icons.Outlined.Inbox) {
    StateBox(icon, text, MaterialTheme.colorScheme.onSurfaceVariant, modifier)
}

/**
 * 로드 실패 화면. 빈 목록과 반드시 구분해서 보여준다 —
 * "없어요"로 보이면 사용자는 다시 시도할 생각을 하지 않고, 개발자는 버그를 못 찾는다.
 */
@Composable
fun ErrorBox(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    StateBox(Icons.Outlined.CloudOff, message, MaterialTheme.colorScheme.error, modifier) {
        TextButton(onClick = onRetry, modifier = Modifier.padding(top = 4.dp)) { Text("다시 시도") }
    }
}

@Composable
private fun StateBox(
    icon: ImageVector,
    text: String,
    textColor: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    action: @Composable (() -> Unit)? = null,
) {
    Box(modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.outlineVariant,
                modifier = Modifier.size(40.dp))
            Text(
                text,
                style = MaterialTheme.typography.bodyMedium,
                color = textColor,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp),
            )
            action?.invoke()
        }
    }
}

/**
 * 공용 카드 — 흰 표면 + 회색 테두리, 그림자 없음(iOS surface/border 언어).
 *
 * Material3 기본 Card는 톤 배경과 그림자를 쓴다. 그대로 두면 같은 화면이
 * 웹·iOS와 다른 재질로 보여서, 세 플랫폼을 나란히 놓았을 때 안드로이드만 떠 보인다.
 */
@Composable
fun SkCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    borderColor: androidx.compose.ui.graphics.Color? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(SkRadius.LG.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, borderColor ?: MaterialTheme.colorScheme.outline, shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        content = content,
    )
}

/** 공용 콘텐츠 카드 — 제목/작성자 + 본문 + 하단 메타 라인. */
@Composable
fun FeedCard(
    title: String,
    subtitle: String? = null,
    body: String? = null,
    meta: String? = null,
    pill: String? = null,
) {
    SkCard(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(end = 8.dp),
                )
                if (pill != null) {
                    Text(
                        pill,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (!body.isNullOrBlank()) {
                Text(body, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
            }
            if (meta != null) {
                Text(
                    meta,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}
