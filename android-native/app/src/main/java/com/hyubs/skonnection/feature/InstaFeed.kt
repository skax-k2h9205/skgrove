package com.hyubs.skonnection.feature

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PlayCircleFilled
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hyubs.skonnection.data.HumorMedia

private val AvatarColors = listOf(
    Color(0xFF2563EB), Color(0xFF7C3AED), Color(0xFFDB2777), Color(0xFF059669),
    Color(0xFFD97706), Color(0xFF0891B2), Color(0xFFDC2626), Color(0xFF4F46E5),
)

private fun colorFor(name: String): Color =
    AvatarColors[(name.hashCode().let { if (it < 0) -it else it }) % AvatarColors.size]


/** 인스타 스타일 피드 카드 — 아바타 헤더 · (이미지) · 좋아요/댓글 · 캡션. */
@Composable
fun InstaPostCard(
    author: String,
    subtitle: String?,
    body: String,
    mediaUrl: String,
    likes: Int,
    liked: Boolean,
    onToggleLike: (() -> Unit)? = null,
    comments: Int? = null,
    onComment: (() -> Unit)? = null,
    onOverflow: (() -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
        // 헤더
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Avatar(author)
            Spacer(Modifier.size(10.dp))
            Column(Modifier.weight(1f)) {
                Text(author, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (!subtitle.isNullOrBlank()) {
                    Text(subtitle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (onOverflow != null) {
                Text("⋯", modifier = Modifier.clickable { onOverflow() }.padding(8.dp), fontSize = 18.sp)
            }
        }

        // 미디어 — 유튜브 링크는 썸네일로 바꿔 그리고, 누르면 원본을 연다(목록 타일과 같은 규칙).
        val thumb = HumorMedia.thumbnail(mediaUrl)
        if (thumb != null) {
            val playable = HumorMedia.isPlayable(mediaUrl)
            val context = LocalContext.current
            Box(
                Modifier.fillMaxWidth().aspectRatio(1f)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .then(
                        if (playable) Modifier.clickable { openLink(context, mediaUrl) } else Modifier,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                AsyncImage(
                    model = thumb,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                if (playable) {
                    Icon(
                        Icons.Filled.PlayCircleFilled, contentDescription = "영상 보기",
                        tint = Color.White.copy(alpha = 0.92f), modifier = Modifier.size(64.dp),
                    )
                }
            }
        }

        // 액션 바
        val haptic = LocalHapticFeedback.current
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 6.dp, top = 2.dp)) {
            if (onToggleLike != null) {
                IconButton(onClick = { haptic.performHapticFeedback(HapticFeedbackType.LongPress); onToggleLike() }) {
                    Icon(
                        if (liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = "좋아요",
                        tint = if (liked) Color(0xFFE0245E) else MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
            if (onComment != null) {
                IconButton(onClick = onComment) {
                    Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = "댓글")
                }
            }
        }

        // 좋아요 수
        if (likes > 0) {
            Text(
                "좋아요 ${likes}개",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 14.dp),
            )
        }

        // 캡션(작성자 볼드 + 본문)
        if (body.isNotBlank()) {
            Text(
                buildAnnotatedString {
                    withStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.SemiBold)) { append(author) }
                    append("  ")
                    append(body)
                },
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 4.dp),
            )
        }

        if (comments != null && comments > 0 && onComment != null) {
            Text(
                "댓글 ${comments}개 모두 보기",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable { onComment() }.padding(horizontal = 14.dp, vertical = 2.dp),
            )
        }

        Spacer(Modifier.size(6.dp))
        androidx.compose.material3.HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
    }
}

@Composable
private fun Avatar(name: String) {
    Box(
        modifier = Modifier.size(38.dp).clip(CircleShape).background(colorFor(name)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.trim().take(1).ifBlank { "?" },
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
        )
    }
}

/** 인스타 스토리 링(모임 등 가로 스크롤) 자리 — 후속 확장용 껍데기. */
@Composable
fun StoryRingRow(labels: List<String>, modifier: Modifier = Modifier) {
    Row(modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        labels.take(10).forEach { label ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier.size(58.dp).clip(CircleShape)
                        .background(colorFor(label)),
                    contentAlignment = Alignment.Center,
                ) { Text(label.take(1), color = Color.White, fontWeight = FontWeight.Bold) }
                Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1)
            }
        }
    }
}

/**
 * 원본 링크를 외부 앱(유튜브·브라우저)으로 연다.
 * 앱 안에서 영상을 재생하지 않는 것은 iOS와 같은 선택이다 — 유튜브는 자기 앱에서 봐야
 * 로그인·화질·기록이 사용자 것과 이어진다. 열 수 있는 앱이 없으면 조용히 넘어간다.
 */
private fun openLink(context: android.content.Context, url: String) {
    runCatching {
        context.startActivity(
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
