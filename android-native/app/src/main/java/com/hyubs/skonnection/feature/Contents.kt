package com.hyubs.skonnection.feature

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
fun HumorContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { HumorViewModel(container) }
    val posts by vm.posts.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var composing by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<com.hyubs.skonnection.data.HumorPost?>(null) }
    var detailPost by remember { mutableStateOf<com.hyubs.skonnection.data.HumorPost?>(null) }

    detailPost?.let { post ->
        androidx.activity.compose.BackHandler { detailPost = null }
        HumorDetailView(
            container = container,
            post = post,
            liked = post.likedBy(vm.currentName),
            onToggleLike = { vm.toggleLike(post) },
            onBack = { detailPost = null },
            modifier = modifier,
        )
        return
    }

    Box(modifier.fillMaxSize()) {
        if (loading && posts.isEmpty()) {
            LoadingBox()
        } else {
            androidx.compose.material3.pulltorefresh.PullToRefreshBox(
                isRefreshing = loading,
                onRefresh = { vm.refresh() },
                modifier = Modifier.fillMaxSize(),
            ) {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(top = 8.dp, bottom = 88.dp),
                ) {
                    if (posts.isEmpty()) {
                        item { EmptyBox("아직 유머 글이 없어요. 첫 글을 남겨보세요!", Modifier.fillMaxWidth().padding(top = 80.dp)) }
                    }
                    items(posts, key = { it.id }) { p ->
                        InstaPostCard(
                            author = p.author,
                            subtitle = p.createdAt.ifBlank { null },
                            body = p.body,
                            mediaUrl = p.mediaUrl,
                            likes = p.laughs,
                            liked = p.likedBy(vm.currentName),
                            onToggleLike = { vm.toggleLike(p) },
                            onComment = { detailPost = p },
                            onOverflow = if (vm.isAdmin) ({ deleteTarget = p }) else null,
                        )
                    }
                }
            }
        }
        // 챗 FAB(우하단)와 겹치지 않게 그 위로 올린다.
        ExtendedFloatingActionButton(
            onClick = { composing = true },
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text("글쓰기") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 88.dp),
        )
    }

    if (composing) {
        ComposeHumorDialog(
            onDismiss = { composing = false },
            onSubmit = { body, media -> vm.createPost(body, media) { composing = false } },
        )
    }

    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("글 삭제") },
            text = { Text("이 글을 삭제할까요? 되돌릴 수 없습니다.") },
            confirmButton = {
                TextButton(onClick = { vm.deletePost(target); deleteTarget = null }) {
                    Text("삭제", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("취소") } },
        )
    }
}

@Composable
private fun ComposeHumorDialog(onDismiss: () -> Unit, onSubmit: (body: String, media: String) -> Unit) {
    var body by remember { mutableStateOf("") }
    var media by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("유머 글쓰기") },
        text = {
            Column {
                OutlinedTextField(
                    value = body, onValueChange = { body = it },
                    label = { Text("내용") }, modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = media, onValueChange = { media = it },
                    label = { Text("이미지/영상 링크 (선택)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { if (body.isNotBlank()) onSubmit(body, media) }, enabled = body.isNotBlank()) {
                Text("등록")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("취소") } },
    )
}

@Composable
fun GatheringsContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { GatheringsViewModel(container) }
    val items by vm.items.collectAsStateWithLifecycle()
    val signups by vm.signups.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var composing by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<com.hyubs.skonnection.data.Gathering?>(null) }

    Box(modifier.fillMaxSize()) {
        when {
            loading && items.isEmpty() -> LoadingBox()
            items.isEmpty() -> EmptyBox("열린 모임이 없어요. 첫 모임을 열어보세요!")
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 8.dp, bottom = 88.dp)) {
                items(items, key = { it.id }) { g ->
                    val roster = signups[g.id].orEmpty()
                    val joined = vm.currentName != null && roster.contains(vm.currentName)
                    GatheringCard(
                        title = g.title.ifBlank { "(제목 없음)" },
                        kind = g.kind,
                        subtitle = "${g.host} · ${g.part}",
                        body = g.description.ifBlank { null },
                        meta = buildString {
                            if (g.startAt.isNotBlank()) append(g.startAt.take(16).replace("T", " "))
                            if (g.place.isNotBlank()) append(" · ${g.place}")
                            if (g.cost.isNotBlank()) append(" · ${g.cost}")
                        }.ifBlank { null },
                        count = roster.size,
                        capacity = g.capacity,
                        joined = joined,
                        onToggle = { vm.toggleJoin(g) },
                        onDelete = if (vm.isAdmin) ({ deleteTarget = g }) else null,
                    )
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { composing = true },
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text("모임 열기") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 88.dp),
        )
    }

    if (composing) {
        GatheringComposeDialog(
            onDismiss = { composing = false },
            onSubmit = { title, place, desc, cap, kind -> vm.create(title, place, desc, cap, kind) { composing = false } },
        )
    }
    deleteTarget?.let { t ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("모임 삭제") },
            text = { Text("이 모임을 삭제할까요? 신청 기록도 함께 삭제됩니다.") },
            confirmButton = { TextButton(onClick = { vm.delete(t); deleteTarget = null }) { Text("삭제", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("취소") } },
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
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(top = 2.dp))
            if (!body.isNullOrBlank()) Text(body, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
            if (meta != null) Text(meta, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(top = 8.dp))
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
private fun GatheringComposeDialog(onDismiss: () -> Unit, onSubmit: (title: String, place: String, desc: String, capacity: Int?, kind: String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var place by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var capacity by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("flash") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("모임 열기") },
        text = {
            Column {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("제목") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(Modifier.padding(top = 8.dp)) {
                    androidx.compose.material3.FilterChip(selected = kind == "flash", onClick = { kind = "flash" }, label = { Text("번개") }, modifier = Modifier.padding(end = 6.dp))
                    androidx.compose.material3.FilterChip(selected = kind == "gathering", onClick = { kind = "gathering" }, label = { Text("모임") })
                }
                OutlinedTextField(value = place, onValueChange = { place = it }, label = { Text("장소") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                OutlinedTextField(value = capacity, onValueChange = { s -> capacity = s.filter { it.isDigit() } }, label = { Text("정원(명, 선택)") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("설명") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        },
        confirmButton = { TextButton(onClick = { if (title.isNotBlank()) onSubmit(title, place, desc, capacity.toIntOrNull(), kind) }, enabled = title.isNotBlank()) { Text("열기") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("취소") } },
    )
}

@Composable
fun MarketContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MarketViewModel(container) }
    val items by vm.items.collectAsStateWithLifecycle()
    val topBids by vm.topBids.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var bidding by remember { mutableStateOf<com.hyubs.skonnection.data.MarketItem?>(null) }
    val snackScope = androidx.compose.runtime.rememberCoroutineScope()
    val snackHost = remember { androidx.compose.material3.SnackbarHostState() }

    var composing by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<com.hyubs.skonnection.data.MarketItem?>(null) }

    Box(modifier.fillMaxSize()) {
        when {
            loading && items.isEmpty() -> LoadingBox()
            items.isEmpty() -> EmptyBox("등록된 물건이 없어요. 첫 물건을 올려보세요!")
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 8.dp, bottom = 88.dp)) {
                items(items, key = { it.id }) { m ->
                    val top = topBids[m.id]
                    MarketCard(
                        title = m.title.ifBlank { "(제목 없음)" },
                        giveaway = m.kind == "giveaway",
                        seller = m.seller,
                        body = m.description.ifBlank { null },
                        priceLine = if (m.kind == "giveaway") "무료 나눔"
                        else if (top != null) "현재가 ${"%,d".format(top.amount)}원 · 최고 ${top.name}"
                        else "시작가 ${"%,d".format(m.startPrice)}원",
                        canceled = m.canceled,
                        onBid = { bidding = m },
                        onDelete = if (vm.isAdmin) ({ deleteTarget = m }) else null,
                    )
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { composing = true },
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text("물건 등록") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 88.dp),
        )
        androidx.compose.material3.SnackbarHost(snackHost, modifier = Modifier.align(Alignment.BottomCenter))
    }

    if (composing) {
        MarketComposeDialog(
            onDismiss = { composing = false },
            onSubmit = { title, desc, price, step, kind -> vm.create(title, desc, price, step, kind) { composing = false } },
        )
    }
    deleteTarget?.let { t ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("물건 삭제") },
            text = { Text("이 물건을 삭제할까요? 입찰 기록도 함께 삭제됩니다.") },
            confirmButton = { TextButton(onClick = { vm.delete(t); deleteTarget = null }) { Text("삭제", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("취소") } },
        )
    }

    bidding?.let { item ->
        BidDialog(
            title = item.title,
            minBid = vm.nextMinBid(item),
            onDismiss = { bidding = null },
            onSubmit = { amount ->
                vm.bid(item, amount) { err ->
                    bidding = null
                    if (err != null) snackScope.launch { snackHost.showSnackbar(err) }
                }
            },
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
            Text(seller, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(top = 2.dp))
            if (!body.isNullOrBlank()) Text(body, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
            Text(priceLine, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(top = 8.dp))
            if (!giveaway && !canceled) {
                androidx.compose.material3.Button(onClick = onBid, modifier = Modifier.padding(top = 10.dp)) { Text("입찰하기") }
            } else if (canceled) {
                Text("거래 취소됨", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 10.dp))
            }
        }
    }
}

@Composable
private fun MarketComposeDialog(onDismiss: () -> Unit, onSubmit: (title: String, desc: String, price: Int, step: Int, kind: String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var step by remember { mutableStateOf("1000") }
    var kind by remember { mutableStateOf("auction") }
    val numKeyboard = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("물건 등록") },
        text = {
            Column {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("제목") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(Modifier.padding(top = 8.dp)) {
                    androidx.compose.material3.FilterChip(selected = kind == "auction", onClick = { kind = "auction" }, label = { Text("경매") }, modifier = Modifier.padding(end = 6.dp))
                    androidx.compose.material3.FilterChip(selected = kind == "giveaway", onClick = { kind = "giveaway" }, label = { Text("나눔") })
                }
                if (kind == "auction") {
                    OutlinedTextField(value = price, onValueChange = { s -> price = s.filter { it.isDigit() } }, label = { Text("시작가(원)") }, singleLine = true, keyboardOptions = numKeyboard, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                    OutlinedTextField(value = step, onValueChange = { s -> step = s.filter { it.isDigit() } }, label = { Text("입찰 단위(원)") }, singleLine = true, keyboardOptions = numKeyboard, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                }
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("설명") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (title.isNotBlank()) {
                        val p = if (kind == "giveaway") 0 else price.toIntOrNull() ?: 0
                        val s = step.toIntOrNull() ?: 1000
                        onSubmit(title, desc, p, s, kind)
                    }
                },
                enabled = title.isNotBlank(),
            ) { Text("등록") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("취소") } },
    )
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
    modifier: Modifier = Modifier,
) {
    val vm = remember(post.id) { com.hyubs.skonnection.feature.HumorDetailViewModel(container, post.id) }
    val comments by vm.comments.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var input by remember { mutableStateOf("") }

    Column(modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(8.dp)) {
            androidx.compose.material3.IconButton(onClick = onBack) {
                Icon(androidx.compose.material.icons.Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
            }
            Text("게시물", style = MaterialTheme.typography.titleMedium)
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
                item { Text("첫 댓글을 남겨보세요.", color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) }
            } else {
                items(comments, key = { it.id }) { c ->
                    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        Text(c.author, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                        Text(c.body, style = MaterialTheme.typography.bodyMedium)
                        if (c.createdAt.isNotBlank()) Text(c.createdAt.take(10),
                            style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
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
