package com.hyubs.skonnection.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.Mood
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.feature.LoadingBox

/** 홈 통합 피드 한 조각. iOS HomeFeedItem 대응. */
data class HomeTile(
    val id: String,
    val kind: String,          // humor | gathering | market | agenda | action
    val title: String,
    val meta: String,
    val imageUrl: String?,
    val author: String?,
    val tab: Int,              // 탭 이동 대상(유머1·모임2·장터3·더보기는 섹션)
)

private fun isImageUrl(url: String?): Boolean {
    val u = url?.lowercase() ?: return false
    return u.startsWith("http") &&
        (u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") ||
            u.endsWith(".gif") || u.endsWith(".webp") || u.contains("/image") ||
            u.contains("supabase.co/storage") || u.contains("img.youtube"))
}

private fun kindIcon(kind: String): ImageVector = when (kind) {
    "humor" -> Icons.Filled.Mood
    "gathering" -> Icons.Filled.Bolt
    "market" -> Icons.Filled.Storefront
    "agenda" -> Icons.Filled.CheckBox
    else -> Icons.Outlined.CalendarMonth
}

private fun kindTint(kind: String): Color = when (kind) {
    "humor" -> Color(0xFFFDE7EA)
    "agenda" -> Color(0xFFE3EDFF)
    "action" -> Color(0xFFE4F6EC)
    else -> Color(0xFFEFEFF3)
}

/** iOS GridTile 대응 — 이미지면 사진 타일+캡션, 없으면 색 타일(아이콘·제목·메타). 9:16. */
@Composable
fun HomeGridTile(tile: HomeTile, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().aspectRatio(9f / 16f)
            .clip(RoundedCornerShape(10.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.BottomStart,
    ) {
        if (isImageUrl(tile.imageUrl)) {
            AsyncImage(
                model = tile.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().background(Color(0xFF2B2B33)),
            )
            // 코너 글리프
            Icon(
                kindIcon(tile.kind), contentDescription = null, tint = Color.White,
                modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(15.dp),
            )
            // 하단 그라데이션 + 글쓴이·제목 캡션
            Column(
                Modifier.fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.55f), Color.Black.copy(alpha = 0.9f))
                        )
                    )
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            ) {
                if (tile.author != null) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(16.dp).clip(CircleShape).background(avatarColor(tile.author)),
                            contentAlignment = Alignment.Center,
                        ) { Text(tile.author.take(1), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
                        Text(tile.author, color = Color.White.copy(alpha = 0.9f), fontSize = 11.sp,
                            maxLines = 1, modifier = Modifier.padding(start = 4.dp))
                    }
                }
                Text(tile.title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    maxLines = 2, modifier = Modifier.padding(top = 3.dp))
            }
        } else {
            Column(
                Modifier.fillMaxSize().background(kindTint(tile.kind)).padding(8.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(kindIcon(tile.kind), contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                Text(tile.title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold,
                    maxLines = 3, modifier = Modifier.padding(top = 6.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                if (tile.meta.isNotBlank()) {
                    Text(tile.meta, fontSize = 10.sp, color = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}

private val avatarPalette = listOf(
    Color(0xFF2563EB), Color(0xFF7C3AED), Color(0xFFDB2777), Color(0xFF059669),
    Color(0xFFD97706), Color(0xFF0891B2), Color(0xFFDC2626), Color(0xFF4F46E5),
)
private fun avatarColor(name: String): Color =
    avatarPalette[(name.hashCode().let { if (it < 0) -it else it }) % avatarPalette.size]

/** 홈 그리드 — 스토리줄 + 3열 통합 그리드. iOS HomeView 대응. */
@Composable
fun HomeGridContent(
    container: AppContainer,
    onOpenTab: (Int) -> Unit,
    onCompose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm = remember { HomeFeedViewModel(container) }
    val tiles by vm.tiles.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()

    if (loading && tiles.isEmpty()) { LoadingBox(modifier); return }

    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(4.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(3) }) {
            StoryRow(onCompose = onCompose, onCoffee = { onOpenTab(2) })
        }
        items(tiles, key = { it.id }) { tile ->
            HomeGridTile(tile) { onOpenTab(tile.tab) }
        }
    }
}

@Composable
private fun StoryRow(onCompose: () -> Unit, onCoffee: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp, horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        StoryCircle("말하기", Icons.Filled.Add, ringed = false, onClick = onCompose)
        StoryCircle("커피 내기", Icons.Filled.Bolt, ringed = true, onClick = onCoffee)
    }
}

@Composable
private fun StoryCircle(label: String, icon: ImageVector, ringed: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onClick() }) {
        Box(contentAlignment = Alignment.Center) {
            if (ringed) {
                Box(
                    Modifier.size(64.dp).clip(CircleShape)
                        .background(Brush.sweepGradient(listOf(
                            Color(0xFF9C27B0), Color(0xFFE91E63), Color(0xFFFF9800),
                            Color(0xFFFFEB3B), Color(0xFF9C27B0))))
                )
            }
            Box(
                Modifier.size(if (ringed) 57.dp else 58.dp).clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) { Icon(icon, contentDescription = label, tint = MaterialTheme.colorScheme.onSurface) }
        }
        Text(label, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 4.dp))
    }
}
