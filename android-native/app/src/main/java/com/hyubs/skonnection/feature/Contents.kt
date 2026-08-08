package com.hyubs.skonnection.feature

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

/** 홈 피드 — 인스타 스타일 세로 피드(유머 최신글). */
@Composable
fun HomeFeedContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { HumorViewModel(container) }
    val posts by vm.posts.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && posts.isEmpty() -> LoadingBox(modifier)
        posts.isEmpty() -> EmptyBox("아직 글이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(top = 4.dp, bottom = 8.dp)) {
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

@Composable
fun HumorContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { HumorViewModel(container) }
    val posts by vm.posts.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var composing by remember { mutableStateOf(false) }

    Box(modifier.fillMaxSize()) {
        when {
            loading && posts.isEmpty() -> LoadingBox()
            else -> LazyColumn(
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
                    )
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
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("열린 모임이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
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
                )
            }
        }
    }
}

@Composable
private fun GatheringCard(
    title: String, kind: String, subtitle: String, body: String?, meta: String?,
    count: Int, capacity: Int?, joined: Boolean, onToggle: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(end = 8.dp))
                Text(kind, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
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
fun MarketContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MarketViewModel(container) }
    val items by vm.items.collectAsStateWithLifecycle()
    val topBids by vm.topBids.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    var bidding by remember { mutableStateOf<com.hyubs.skonnection.data.MarketItem?>(null) }
    val snackScope = androidx.compose.runtime.rememberCoroutineScope()
    val snackHost = remember { androidx.compose.material3.SnackbarHostState() }

    Box(modifier.fillMaxSize()) {
        when {
            loading && items.isEmpty() -> LoadingBox()
            items.isEmpty() -> EmptyBox("등록된 물건이 없어요.")
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
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
                    )
                }
            }
        }
        androidx.compose.material3.SnackbarHost(snackHost, modifier = Modifier.align(Alignment.BottomCenter))
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
    canceled: Boolean, onBid: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(end = 8.dp))
                Text(if (giveaway) "나눔" else "경매", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
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
