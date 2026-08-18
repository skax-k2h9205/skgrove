package com.hyubs.skonnection.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.width
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
import androidx.compose.material.icons.filled.PlayCircleFilled
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
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
    /** 유튜브·동영상이면 재생 표시를 얹는다. 정지 썸네일만 두면 사진과 구분이 안 된다. */
    val playable: Boolean = false,
)

/**
 * 타일에 그릴 그림 주소. 유튜브 원본 링크는 썸네일 주소로 바꿔서 넣어야 한다
 * (HumorMedia.thumbnail). 여기서는 이미 변환된 값이 오는지만 본다.
 */
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
            if (tile.playable) {
                Icon(
                    Icons.Filled.PlayCircleFilled, contentDescription = "영상",
                    tint = Color.White.copy(alpha = 0.92f),
                    modifier = Modifier.align(Alignment.Center).size(38.dp),
                )
            }
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
                    Text(tile.meta, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
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
    /** 스토리 탭 → 그 모임 상세로. 지정 안 하면 모임 탭으로만 이동한다. */
    onOpenGathering: (String) -> Unit = { onOpenTab(2) },
) {
    val vm = remember { HomeFeedViewModel(container) }
    val tiles by vm.tiles.collectAsStateWithLifecycle()
    val stories by vm.stories.collectAsStateWithLifecycle()
    // 링 색을 결정하려면 '본 목록'이 필요하다. 탭할 때마다 다시 읽어 즉시 회색으로 바뀌게 한다.
    var viewedIds by remember { mutableStateOf(container.viewedStories.all()) }
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()

    if (loading && tiles.isEmpty()) { LoadingBox(modifier); return }
    // 홈은 다섯 소스를 섞는다. 전부 못 읽었을 때만 실패로 본다 — 일부만 빠지면 있는 것부터 보여준다.
    if (tiles.isEmpty()) {
        error?.let { com.hyubs.skonnection.feature.ErrorBox(it, vm::retry, modifier); return }
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(4.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(3) }) {
            StoryRow(
                stories = stories, viewedIds = viewedIds, onCompose = onCompose,
                onCoffee = { onOpenTab(2) },
                onOpenGathering = { id ->
                    vm.markStoryViewed(id)
                    viewedIds = container.viewedStories.all()
                    onOpenGathering(id)
                },
            )
        }
        items(tiles, key = { it.id }) { tile ->
            HomeGridTile(tile) { onOpenTab(tile.tab) }
        }
    }
}

/** 도메인 탭(유머·모임·장터) 공용 3열 그리드 — 홈과 같은 타일 언어로 통일. */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun DomainTileGrid(
    tiles: List<HomeTile>,
    loading: Boolean,
    emptyText: String,
    onRefresh: () -> Unit,
    onTap: (HomeTile) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (loading && tiles.isEmpty()) { LoadingBox(modifier); return }
    androidx.compose.material3.pulltorefresh.PullToRefreshBox(
        isRefreshing = loading, onRefresh = onRefresh, modifier = modifier.fillMaxSize(),
    ) {
        if (tiles.isEmpty()) {
            com.hyubs.skonnection.feature.EmptyBox(emptyText)
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 4.dp, end = 4.dp, top = 4.dp, bottom = 96.dp),
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                items(tiles, key = { it.id }) { tile -> HomeGridTile(tile) { onTap(tile) } }
            }
        }
    }
}

@Composable
private fun StoryRow(
    stories: List<com.hyubs.skonnection.data.Gathering>,
    viewedIds: Set<String>,
    onCompose: () -> Unit,
    onCoffee: () -> Unit,
    onOpenGathering: (String) -> Unit,
) {
    // 고정 진입 2개 + 번개·커피 모임들. 개수가 늘 수 있어 가로 스크롤로 둔다.
    Row(
        Modifier.fillMaxWidth()
            .horizontalScroll(androidx.compose.foundation.rememberScrollState())
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        StoryCircle("말하기", Icons.Filled.Add, ringed = false, onClick = onCompose)
        StoryCircle("커피 내기", Icons.Filled.Bolt, ringed = true, onClick = onCoffee)
        stories.forEach { g ->
            StoryCircle(g.title, Icons.Filled.Bolt, ringed = g.id !in viewedIds,
                        imageUrl = g.imageUrl.ifBlank { null }) {
                onOpenGathering(g.id)
            }
        }
    }
}

@Composable
private fun StoryCircle(
    label: String,
    icon: ImageVector,
    ringed: Boolean,
    /** 모임 썸네일(AI 생성 또는 첨부). 없으면 아이콘으로 떨어진다. */
    imageUrl: String? = null,
    onClick: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onClick() }) {
        Box(contentAlignment = Alignment.Center) {
            // 안 본 것은 무지개 링, 본 것은 회색 링 — 인스타와 같은 신호(사라지지 않고 흐려진다).
            Box(
                Modifier.size(64.dp).clip(CircleShape).background(
                    if (ringed) {
                        Brush.sweepGradient(listOf(
                            Color(0xFF9C27B0), Color(0xFFE91E63), Color(0xFFFF9800),
                            Color(0xFFFFEB3B), Color(0xFF9C27B0)))
                    } else {
                        androidx.compose.ui.graphics.SolidColor(Color(0xFFC7C7C7))
                    }
                )
            )
            Box(
                Modifier.size(57.dp).clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl, contentDescription = label,
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                    )
                } else {
                    Icon(icon, contentDescription = label, tint = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
        Text(
            label, style = MaterialTheme.typography.labelSmall,
            maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp).width(64.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}
