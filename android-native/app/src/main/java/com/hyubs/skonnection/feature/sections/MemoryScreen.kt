package com.hyubs.skonnection.feature.sections

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.MemoryAsset
import com.hyubs.skonnection.data.TeamMemory
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.ErrorBox
import com.hyubs.skonnection.feature.LoadingBox
import com.hyubs.skonnection.feature.SkCard
import com.hyubs.skonnection.ui.theme.Sk

/**
 * 팀 추억 — 앨범 목록과 앨범 안 사진(웹 Memory / iOS AlbumView 이식).
 *
 * 사진은 team_memories가 아니라 team_memory_assets에 있다. 예전에는 앨범만 읽어서
 * 제목·날짜만 나오고 정작 사진이 하나도 보이지 않았다.
 */
@Composable
fun MemoriesSection(c: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MemoriesViewModel(c) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var openId by remember { mutableStateOf<Long?>(null) }

    // 상세는 전체화면으로 띄운다. 섹션 상단바 아래에 그리면 뒤로가기 화살표가 두 개 겹쳐
    // 어느 것이 앨범을 닫는지 알 수 없다(앱의 등록 폼도 같은 이유로 전체화면이다).
    items.firstOrNull { it.id == openId }?.let { opened ->
        BackHandler { openId = null }
        MemoryDetail(opened, onBack = { openId = null })
    }

    SectionScaffold(onRefresh = vm::retry, modifier = modifier) {
        when {
            loading && items.isEmpty() -> LoadingBox()
            error != null && items.isEmpty() -> ErrorBox(error!!, vm::retry)
            items.isEmpty() -> EmptyBox("기록된 팀 추억이 없어요.")
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
                items(items, key = { it.id }) { m ->
                    MemoryCard(m, onOpen = { openId = m.id })
                }
            }
        }
    }
}

/**
 * 앨범 카드 — 표지 사진 + 제목/날짜 오버레이.
 * 사진이 한 장도 없으면 표지를 비워두지 않고 날짜 칩 레이아웃으로 떨어뜨린다.
 */
@Composable
private fun MemoryCard(m: TeamMemory, onOpen: () -> Unit) {
    SkCard(Modifier.padding(horizontal = 16.dp, vertical = 6.dp), onClick = onOpen) {
        val cover = m.cover
        if (cover != null) {
            Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f)) {
                AsyncImage(
                    model = cover.previewUrl,
                    contentDescription = m.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                // 사진 위 글씨가 밝은 사진에서 묻히지 않도록 아래쪽만 어둡게 깐다.
                Box(
                    Modifier.fillMaxSize().background(
                        Brush.verticalGradient(
                            0.55f to Color.Transparent,
                            1f to Color.Black.copy(alpha = 0.55f),
                        ),
                    ),
                )
                Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
                    Text(m.title.ifBlank { "(제목 없음)" }, color = Color.White,
                        style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        listOf(m.eventDate.take(10), "사진 ${m.assets.size}장")
                            .filter { it.isNotBlank() }.joinToString(" · "),
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }
        Row(Modifier.padding(14.dp)) {
            if (cover == null) DateChip(m.eventDate)
            Column(Modifier.weight(1f).padding(start = if (cover == null) 14.dp else 0.dp)) {
                if (cover == null) {
                    Text(m.title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold)
                }
                Text(listOf(m.host, m.place).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (m.summary.isNotBlank()) {
                    Text(m.summary, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2,
                        modifier = Modifier.padding(top = 6.dp))
                }
                if (m.tags.isNotEmpty()) {
                    Text(m.tags.joinToString(" ") { "#$it" }, style = MaterialTheme.typography.labelSmall,
                        color = Sk.Cta, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
    }
}

/** 앨범 상세 — 제목/메타 + 3열 사진 그리드. 홈 그리드와 같은 타일 언어로 맞춘다. */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun MemoryDetail(m: TeamMemory, onBack: () -> Unit) {
    var viewing by remember { mutableStateOf<MemoryAsset?>(null) }

    Dialog(onDismissRequest = onBack, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        // 다이얼로그 창은 내비게이션 바 아래까지 그려진다. 안전영역 패딩을 여기서 한 번 주지 않으면
        // 화면 맨 아래 요소(사진 캡션)가 내비게이션 바에 눌려 1~2px로 잘린다.
        androidx.compose.material3.Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
            androidx.compose.material3.Scaffold(
                topBar = {
                    androidx.compose.material3.TopAppBar(
                        title = {
                            Column {
                                Text(m.title.ifBlank { "(제목 없음)" },
                                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text(
                                    listOf(m.eventDate.take(10), m.place, m.host)
                                        .filter { it.isNotBlank() }.joinToString(" · "),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        },
                        navigationIcon = {
                            IconButton(onClick = onBack) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                            }
                        },
                    )
                },
            ) { padding ->
                Box(Modifier.fillMaxSize().padding(padding)) {
                Column(
                    Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
                ) {
                    if (m.assets.isEmpty()) {
                        EmptyBox("아직 올라온 사진이 없어요.")
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(3),
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(3.dp),
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            if (m.summary.isNotBlank()) {
                                item(span = { GridItemSpan(3) }) {
                                    Text(m.summary, style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp))
                                }
                            }
                            items(m.assets, key = { it.id }) { asset ->
                                AssetTile(asset) { viewing = asset }
                            }
                        }
                    }
                }
                viewing?.let { asset ->
                    BackHandler { viewing = null }
                    AssetViewerOverlay(asset) { viewing = null }
                }
                }
            }
        }
    }

}

@Composable
private fun AssetTile(asset: MemoryAsset, onOpen: () -> Unit) {
    Box(
        Modifier.aspectRatio(1f).clip(RoundedCornerShape(2.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onOpen),
    ) {
        if (asset.previewUrl.isNotBlank()) {
            AsyncImage(
                model = asset.previewUrl,
                contentDescription = asset.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        // 영상은 정지 프레임만 보여주면 사진과 구분이 안 된다. 재생 표시를 얹는다.
        if (asset.isVideo) {
            Icon(
                Icons.Filled.PlayCircle, contentDescription = "영상",
                tint = Color.White,
                modifier = Modifier.align(Alignment.Center).width(28.dp),
            )
        }
    }
}

/**
 * 사진 크게 보기 — 상세 화면 위에 덮는 오버레이. 아무 데나 누르면 닫힌다.
 *
 * 별도 Dialog로 띄우면(= 다이얼로그 안의 다이얼로그) 캡션 높이가 0으로 눌려 화면 밖으로 밀렸다.
 * 이미 전체화면인 상세 위에 그대로 덮으면 제약이 확정돼 사진과 캡션이 각자 자리를 갖는다.
 */
@Composable
private fun AssetViewerOverlay(asset: MemoryAsset, onClose: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(Color.Black).clickable(onClick = onClose),
    ) {
        // 캡션은 사진 위쪽에 둔다. 이 전체화면 다이얼로그에서는 하단 인셋이 0으로 와서
        // 아래에 두면 내비게이션 바에 눌려 잘린다(상단은 정상 동작).
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp)) {
            Text(asset.title, color = Color.White, style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold)
            if (asset.uploader.isNotBlank()) {
                Text("올린 사람 ${asset.uploader}", color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.labelSmall)
            }
        }
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            AsyncImage(
                model = asset.previewUrl,
                contentDescription = asset.title,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** 날짜 칩 — "8월 / 14" 두 줄. 표지 사진이 없는 앨범에서만 쓴다. */
@Composable
private fun DateChip(raw: String) {
    val date = remember(raw) { runCatching { java.time.LocalDate.parse(raw.take(10)) }.getOrNull() }
    Column(
        Modifier.width(52.dp).clip(RoundedCornerShape(10.dp))
            .background(Sk.Cta.copy(alpha = 0.10f)).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (date == null) {
            Text("—", style = MaterialTheme.typography.labelSmall, color = Sk.Cta)
        } else {
            Text("${date.monthValue}월", style = MaterialTheme.typography.labelSmall, color = Sk.Cta)
            Text("${date.dayOfMonth}", style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold, color = Sk.Cta)
        }
    }
}
