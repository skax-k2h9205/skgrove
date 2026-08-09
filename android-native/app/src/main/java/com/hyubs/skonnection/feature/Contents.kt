package com.hyubs.skonnection.feature

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hyubs.skonnection.AppContainer
import kotlinx.coroutines.launch

/** 홈 피드 — 인스타 스타일 세로 피드(유머 최신글). 당겨서 새로고침 지원. */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun HomeFeedContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { HumorViewModel(container) }
    val posts by vm.posts.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    if (loading && posts.isEmpty()) { LoadingBox(modifier); return }
    androidx.compose.material3.pulltorefresh.PullToRefreshBox(
        isRefreshing = loading,
        onRefresh = { vm.refresh() },
        modifier = modifier.fillMaxSize(),
    ) {
        if (posts.isEmpty()) {
            EmptyBox("아직 글이 없어요.")
        } else {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 4.dp, bottom = 8.dp)) {
                items(posts, key = { it.id }) { p ->
                    InstaPostCard(
                        author = p.author,
                        subtitle = p.createdAt.ifBlank { null },
                        body = p.body,
                        mediaUrl = p.mediaUrl,
                        likes = p.laughs,
                        liked = p.likedBy(vm.currentName),
                        onToggleLike = { vm.toggleLike(p) },
                    )
                }
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun HumorContent(
    container: AppContainer,
    composing: Boolean,
    onComposingChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm = remember { HumorViewModel(container) }
    val posts by vm.posts.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var detailPost by remember { mutableStateOf<com.hyubs.skonnection.data.HumorPost?>(null) }

    if (composing) {
        androidx.activity.compose.BackHandler { onComposingChange(false) }
        HumorComposeForm(
            onClose = { onComposingChange(false) },
            onSubmit = { body, media -> vm.createPost(body, media) { onComposingChange(false) } },
            modifier = modifier,
        )
        return
    }

    detailPost?.let { post ->
        androidx.activity.compose.BackHandler { detailPost = null }
        HumorDetailView(
            container = container,
            post = post,
            liked = post.likedBy(vm.currentName),
            onToggleLike = { vm.toggleLike(post) },
            onBack = { detailPost = null },
            isAdmin = vm.isAdmin,
            onDelete = { vm.deletePost(post); detailPost = null },
            modifier = modifier,
        )
        return
    }

    Box(modifier.fillMaxSize()) {
        com.hyubs.skonnection.feature.home.DomainTileGrid(
            tiles = posts.map {
                com.hyubs.skonnection.feature.home.HomeTile(
                    "h:${it.id}", "humor", it.body.ifBlank { "(사진)" }, "❤️ ${it.laughs}",
                    // 유튜브 링크는 썸네일 주소로 바꿔 넣는다. 원본 링크를 그대로 주면 그림이 없는 회색 타일이 된다.
                    com.hyubs.skonnection.data.HumorMedia.thumbnail(it.mediaUrl), it.author, 1,
                    playable = com.hyubs.skonnection.data.HumorMedia.isPlayable(it.mediaUrl),
                )
            },
            loading = loading,
            emptyText = "아직 유머 글이 없어요. 첫 글을 남겨보세요!",
            onRefresh = { vm.refresh() },
            onTap = { tile -> detailPost = posts.firstOrNull { "h:${it.id}" == tile.id } },
        )
    }
}

@Composable
private fun HumorComposeForm(onClose: () -> Unit, onSubmit: (body: String, media: String) -> Unit, modifier: Modifier = Modifier) {
    var body by remember { mutableStateOf("") }
    var media by remember { mutableStateOf("") }
    com.hyubs.skonnection.feature.FormScaffold(
        title = "유머 글쓰기", submitLabel = "등록", canSubmit = body.isNotBlank(),
        onSubmit = { if (body.isNotBlank()) onSubmit(body, media) }, onClose = onClose, modifier = modifier,
    ) {
        com.hyubs.skonnection.feature.FormLabel("내용", required = true)
        OutlinedTextField(
            value = body, onValueChange = { body = it },
            placeholder = { Text("팀에 웃음을 주는 이야기를 남겨보세요") },
            modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp),
        )
        com.hyubs.skonnection.feature.FormLabel("이미지 / 영상 링크 (선택)")
        OutlinedTextField(
            value = media, onValueChange = { media = it },
            placeholder = { Text("https://…") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun GatheringsContent(
    container: AppContainer,
    composing: Boolean,
    onComposingChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm = remember { GatheringsViewModel(container) }
    val items by vm.items.collectAsStateWithLifecycle()
    val signups by vm.signups.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var detail by remember { mutableStateOf<com.hyubs.skonnection.data.Gathering?>(null) }

    if (composing) {
        androidx.activity.compose.BackHandler { onComposingChange(false) }
        GatheringComposeForm(
            onClose = { onComposingChange(false) },
            onSubmit = { title, place, desc, cap, kind -> vm.create(title, place, desc, cap, kind) { onComposingChange(false) } },
            modifier = modifier,
        )
        return
    }

    detail?.let { g ->
        androidx.activity.compose.BackHandler { detail = null }
        val roster = signups[g.id].orEmpty()
        GatheringDetailView(
            g = g, count = roster.size,
            joined = vm.currentName != null && roster.contains(vm.currentName),
            onToggleJoin = { vm.toggleJoin(g) },
            isAdmin = vm.isAdmin,
            onDelete = { vm.delete(g); detail = null },
            onBack = { detail = null },
            modifier = modifier,
        )
        return
    }

    Box(modifier.fillMaxSize()) {
        com.hyubs.skonnection.feature.home.DomainTileGrid(
            tiles = items.map { g ->
                com.hyubs.skonnection.feature.home.HomeTile(
                    "g:${g.id}", "gathering", g.title.ifBlank { "(제목 없음)" }, g.kind, g.imageUrl, g.host, 2,
                )
            },
            loading = loading,
            emptyText = "열린 모임이 없어요. 첫 모임을 열어보세요!",
            onRefresh = { vm.refresh() },
            onTap = { tile -> detail = items.firstOrNull { "g:${it.id}" == tile.id } },
        )
    }
}

@Composable
private fun GatheringDetailView(
    g: com.hyubs.skonnection.data.Gathering, count: Int, joined: Boolean,
    onToggleJoin: () -> Unit, isAdmin: Boolean, onDelete: () -> Unit, onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var confirmDelete by remember { mutableStateOf(false) }
    Column(modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(8.dp)) {
            androidx.compose.material3.IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
            }
            Text("모임", style = MaterialTheme.typography.titleMedium)
            if (isAdmin) {
                androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                TextButton(onClick = { confirmDelete = true }) { Text("삭제", color = MaterialTheme.colorScheme.error) }
            }
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(16.dp)) {
            item {
                val cover = g.imageUrl
                if (cover.isNotBlank()) {
                    coil.compose.AsyncImage(
                        model = cover, contentDescription = null,
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 10f)
                            .clip(androidx.compose.foundation.shape.RoundedCornerShape(14.dp)),
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
                    Text(g.title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    Text(g.kind, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                }
                Text("${g.host} · ${g.part}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                val meta = buildString {
                    if (g.startAt.isNotBlank()) append(g.startAt.take(16).replace("T", " "))
                    if (g.place.isNotBlank()) { if (isNotEmpty()) append(" · "); append(g.place) }
                    if (g.cost.isNotBlank()) { if (isNotEmpty()) append(" · "); append(g.cost) }
                }
                if (meta.isNotBlank()) Text(meta, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
                if (g.description.isNotBlank()) Text(g.description, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 12.dp))
                val cap = if (g.capacity != null && g.capacity > 0) "/${g.capacity}" else ""
                Text("신청 $count$cap 명", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 16.dp))
                if (joined) {
                    androidx.compose.material3.OutlinedButton(onClick = onToggleJoin, modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) { Text("신청 취소") }
                } else {
                    androidx.compose.material3.Button(onClick = onToggleJoin, modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) { Text("신청하기") }
                }
            }
        }
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("모임 삭제") },
            text = { Text("이 모임을 삭제할까요? 신청 기록도 함께 삭제됩니다.") },
            confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("삭제", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("취소") } },
        )
    }
}

@Composable
private fun GatheringCard(
    title: String, kind: String, subtitle: String, body: String?, meta: String?,
    count: Int, capacity: Int?, joined: Boolean, onToggle: () -> Unit, onDelete: (() -> Unit)? = null,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(end = 8.dp))
                Text(kind, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                if (onDelete != null) {
                    androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                    Text("삭제", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.clickable { onDelete() }.padding(4.dp))
                }
            }
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
            if (!body.isNullOrBlank()) Text(body, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
            if (meta != null) Text(meta, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                val cap = if (capacity != null && capacity > 0) "/$capacity" else ""
                Text("신청 $count$cap 명", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(end = 12.dp))
                if (joined) {
                    androidx.compose.material3.OutlinedButton(onClick = onToggle) { Text("신청 취소") }
                } else {
                    androidx.compose.material3.Button(onClick = onToggle) { Text("신청하기") }
                }
            }
        }
    }
}

@Composable
private fun GatheringComposeForm(onClose: () -> Unit, onSubmit: (title: String, place: String, desc: String, capacity: Int?, kind: String) -> Unit, modifier: Modifier = Modifier) {
    var title by remember { mutableStateOf("") }
    var place by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var capacity by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("flash") }
    com.hyubs.skonnection.feature.FormScaffold(
        title = "모임 열기", submitLabel = "열기", canSubmit = title.isNotBlank(),
        onSubmit = { if (title.isNotBlank()) onSubmit(title, place, desc, capacity.toIntOrNull(), kind) },
        onClose = onClose, modifier = modifier,
    ) {
        com.hyubs.skonnection.feature.FormLabel("제목", required = true)
        OutlinedTextField(value = title, onValueChange = { title = it }, placeholder = { Text("무엇을 함께 할까요?") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        com.hyubs.skonnection.feature.FormLabel("종류")
        Row {
            androidx.compose.material3.FilterChip(selected = kind == "flash", onClick = { kind = "flash" }, label = { Text("번개") }, modifier = Modifier.padding(end = 8.dp))
            androidx.compose.material3.FilterChip(selected = kind == "gathering", onClick = { kind = "gathering" }, label = { Text("모임") })
        }
        com.hyubs.skonnection.feature.FormLabel("장소")
        OutlinedTextField(value = place, onValueChange = { place = it }, placeholder = { Text("예: 4층 카페") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        com.hyubs.skonnection.feature.FormLabel("정원 (선택)")
        OutlinedTextField(value = capacity, onValueChange = { s -> capacity = s.filter { it.isDigit() } }, placeholder = { Text("명 수") }, singleLine = true, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        com.hyubs.skonnection.feature.FormLabel("설명")
        OutlinedTextField(value = desc, onValueChange = { desc = it }, placeholder = { Text("자세한 내용을 적어주세요" ) }, modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp))
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun MarketContent(
    container: AppContainer,
    composing: Boolean,
    onComposingChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm = remember { MarketViewModel(container) }
    val items by vm.items.collectAsStateWithLifecycle()
    val topBids by vm.topBids.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var detail by remember { mutableStateOf<com.hyubs.skonnection.data.MarketItem?>(null) }

    if (composing) {
        androidx.activity.compose.BackHandler { onComposingChange(false) }
        MarketComposeForm(
            onClose = { onComposingChange(false) },
            onSubmit = { title, desc, price, step, kind -> vm.create(title, desc, price, step, kind) { onComposingChange(false) } },
            modifier = modifier,
        )
        return
    }

    detail?.let { m ->
        androidx.activity.compose.BackHandler { detail = null }
        val top = topBids[m.id]
        MarketDetailView(
            m = m,
            priceLine = if (m.kind == "giveaway") "무료 나눔"
            else if (top != null) "현재가 ${"%,d".format(top.amount)}원 · 최고 ${top.name}"
            else "시작가 ${"%,d".format(m.startPrice)}원",
            nextMinBid = vm.nextMinBid(m),
            onBid = { amount, onResult -> vm.bid(m, amount, onResult) },
            isAdmin = vm.isAdmin,
            onDelete = { vm.delete(m); detail = null },
            onBack = { detail = null },
            modifier = modifier,
        )
        return
    }

    Box(modifier.fillMaxSize()) {
        com.hyubs.skonnection.feature.home.DomainTileGrid(
            tiles = items.map { m ->
                com.hyubs.skonnection.feature.home.HomeTile(
                    "m:${m.id}", "market", m.title.ifBlank { "(제목 없음)" },
                    if (m.kind == "giveaway") "나눔" else "경매", m.imageUrl, m.seller, 3,
                )
            },
            loading = loading,
            emptyText = "등록된 물건이 없어요. 첫 물건을 올려보세요!",
            onRefresh = { vm.refresh() },
            onTap = { tile -> detail = items.firstOrNull { "m:${it.id}" == tile.id } },
        )
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun MarketDetailView(
    m: com.hyubs.skonnection.data.MarketItem, priceLine: String, nextMinBid: Int,
    onBid: (Int, (String?) -> Unit) -> Unit, isAdmin: Boolean, onDelete: () -> Unit, onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var confirmDelete by remember { mutableStateOf(false) }
    var bidding by remember { mutableStateOf(false) }
    val snackScope = androidx.compose.runtime.rememberCoroutineScope()
    val snackHost = remember { androidx.compose.material3.SnackbarHostState() }
    val giveaway = m.kind == "giveaway"

    Box(modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(8.dp)) {
                androidx.compose.material3.IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                Text("이음장터", style = MaterialTheme.typography.titleMedium)
                if (isAdmin) {
                    androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                    TextButton(onClick = { confirmDelete = true }) { Text("삭제", color = MaterialTheme.colorScheme.error) }
                }
            }
            LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(16.dp)) {
                item {
                    if (m.imageUrl.isNotBlank()) {
                        coil.compose.AsyncImage(
                            model = m.imageUrl, contentDescription = null,
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().aspectRatio(16f / 10f)
                                .clip(androidx.compose.foundation.shape.RoundedCornerShape(14.dp)),
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
                        Text(m.title.ifBlank { "(제목 없음)" }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Text(if (giveaway) "나눔" else "경매", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    }
                    Text(m.seller, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                    if (m.description.isNotBlank()) Text(m.description, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 12.dp))
                    Text(priceLine, style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 16.dp))
                    if (m.canceled) {
                        Text("거래 취소됨", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 10.dp))
                    } else if (!giveaway) {
                        androidx.compose.material3.Button(onClick = { bidding = true }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) { Text("입찰하기") }
                    }
                }
            }
        }
        androidx.compose.material3.SnackbarHost(snackHost, modifier = Modifier.align(Alignment.BottomCenter))
    }

    if (bidding) {
        BidDialog(title = m.title, minBid = nextMinBid, onDismiss = { bidding = false }, onSubmit = { amount ->
            onBid(amount) { err -> bidding = false; if (err != null) snackScope.launch { snackHost.showSnackbar(err) } }
        })
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("물건 삭제") },
            text = { Text("이 물건을 삭제할까요? 입찰 기록도 함께 삭제됩니다.") },
            confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("삭제", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("취소") } },
        )
    }
}

@Composable
private fun MarketCard(
    title: String, giveaway: Boolean, seller: String, body: String?, priceLine: String,
    canceled: Boolean, onBid: () -> Unit, onDelete: (() -> Unit)? = null,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(end = 8.dp))
                Text(if (giveaway) "나눔" else "경매", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                if (onDelete != null) {
                    androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                    Text("삭제", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.clickable { onDelete() }.padding(4.dp))
                }
            }
            Text(seller, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
            if (!body.isNullOrBlank()) Text(body, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
            Text(priceLine, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
            if (!giveaway && !canceled) {
                androidx.compose.material3.Button(onClick = onBid, modifier = Modifier.padding(top = 10.dp)) { Text("입찰하기") }
            } else if (canceled) {
                Text("거래 취소됨", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 10.dp))
            }
        }
    }
}

@Composable
private fun MarketComposeForm(onClose: () -> Unit, onSubmit: (title: String, desc: String, price: Int, step: Int, kind: String) -> Unit, modifier: Modifier = Modifier) {
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var step by remember { mutableStateOf("1000") }
    var kind by remember { mutableStateOf("auction") }
    val numKeyboard = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
    com.hyubs.skonnection.feature.FormScaffold(
        title = "물건 등록", submitLabel = "등록", canSubmit = title.isNotBlank(),
        onSubmit = {
            if (title.isNotBlank()) {
                val p = if (kind == "giveaway") 0 else price.toIntOrNull() ?: 0
                onSubmit(title, desc, p, step.toIntOrNull() ?: 1000, kind)
            }
        },
        onClose = onClose, modifier = modifier,
    ) {
        com.hyubs.skonnection.feature.FormLabel("제목", required = true)
        OutlinedTextField(value = title, onValueChange = { title = it }, placeholder = { Text("무엇을 올릴까요?") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        com.hyubs.skonnection.feature.FormLabel("종류")
        Row {
            androidx.compose.material3.FilterChip(selected = kind == "auction", onClick = { kind = "auction" }, label = { Text("경매") }, modifier = Modifier.padding(end = 8.dp))
            androidx.compose.material3.FilterChip(selected = kind == "giveaway", onClick = { kind = "giveaway" }, label = { Text("나눔") })
        }
        if (kind == "auction") {
            com.hyubs.skonnection.feature.FormLabel("시작가 (원)", required = true)
            OutlinedTextField(value = price, onValueChange = { s -> price = s.filter { it.isDigit() } }, placeholder = { Text("예: 3000") }, singleLine = true, keyboardOptions = numKeyboard, modifier = Modifier.fillMaxWidth())
            com.hyubs.skonnection.feature.FormLabel("입찰 단위 (원)")
            OutlinedTextField(value = step, onValueChange = { s -> step = s.filter { it.isDigit() } }, singleLine = true, keyboardOptions = numKeyboard, modifier = Modifier.fillMaxWidth())
        }
        com.hyubs.skonnection.feature.FormLabel("설명")
        OutlinedTextField(value = desc, onValueChange = { desc = it }, placeholder = { Text("상태·특징을 적어주세요") }, modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp))
    }
}

@Composable
private fun BidDialog(title: String, minBid: Int, onDismiss: () -> Unit, onSubmit: (Int) -> Unit) {
    var amount by remember { mutableStateOf(minBid.toString()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("입찰 · $title") },
        text = {
            Column {
                Text("최소 ${"%,d".format(minBid)}원 이상", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(
                    value = amount,
                    onValueChange = { s -> amount = s.filter { it.isDigit() } },
                    label = { Text("입찰 금액(원)") },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                    ),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { amount.toIntOrNull()?.let(onSubmit) },
                enabled = amount.toIntOrNull() != null,
            ) { Text("입찰") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("취소") } },
    )
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun HumorDetailView(
    container: AppContainer,
    post: com.hyubs.skonnection.data.HumorPost,
    liked: Boolean,
    onToggleLike: () -> Unit,
    onBack: () -> Unit,
    isAdmin: Boolean = false,
    onDelete: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val vm = remember(post.id) { com.hyubs.skonnection.feature.HumorDetailViewModel(container, post.id) }
    val comments by vm.comments.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var input by remember { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }

    Column(modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(8.dp)) {
            androidx.compose.material3.IconButton(onClick = onBack) {
                Icon(androidx.compose.material.icons.Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
            }
            Text("게시물", style = MaterialTheme.typography.titleMedium)
            if (isAdmin && onDelete != null) {
                androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                TextButton(onClick = { confirmDelete = true }) {
                    Text("삭제", color = MaterialTheme.colorScheme.error)
                }
            }
        }
        if (confirmDelete) {
            AlertDialog(
                onDismissRequest = { confirmDelete = false },
                title = { Text("글 삭제") },
                text = { Text("이 글을 삭제할까요? 되돌릴 수 없습니다.") },
                confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete?.invoke() }) { Text("삭제", color = MaterialTheme.colorScheme.error) } },
                dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("취소") } },
            )
        }
        androidx.compose.foundation.lazy.LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
            item {
                InstaPostCard(
                    author = post.author,
                    subtitle = post.createdAt.ifBlank { null },
                    body = post.body,
                    mediaUrl = post.mediaUrl,
                    likes = post.laughs,
                    liked = liked,
                    onToggleLike = onToggleLike,
                )
            }
            item {
                Text("댓글 ${comments.size}개", style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            }
            if (loading && comments.isEmpty()) {
                item { LoadingBox(Modifier.padding(24.dp)) }
            } else if (comments.isEmpty()) {
                item { Text("첫 댓글을 남겨보세요.", color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) }
            } else {
                items(comments, key = { it.id }) { c ->
                    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        Text(c.author, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                        Text(c.body, style = MaterialTheme.typography.bodyMedium)
                        if (c.createdAt.isNotBlank()) Text(c.createdAt.take(10),
                            style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        // 우하단 챗 FAB(약 72dp)와 겹치지 않도록 오른쪽 여백을 둔다.
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 76.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = input, onValueChange = { input = it },
                placeholder = { Text("댓글 달기") }, modifier = Modifier.weight(1f), maxLines = 3,
            )
            TextButton(onClick = { vm.addComment(input) { input = "" } }, enabled = input.isNotBlank()) { Text("등록") }
        }
    }
}
