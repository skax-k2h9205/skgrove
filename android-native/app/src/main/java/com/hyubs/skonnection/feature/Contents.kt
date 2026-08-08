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

/** 홈 피드 — 여러 도메인 요약. M1에서는 유머 최신글을 보여준다(이후 통합 피드로 확장). */
@Composable
fun HomeFeedContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { HumorViewModel(container) }
    val posts by vm.posts.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && posts.isEmpty() -> LoadingBox(modifier)
        posts.isEmpty() -> EmptyBox("아직 글이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            items(posts, key = { it.id }) { p ->
                FeedCard(title = p.author, body = p.body.ifBlank { null }, meta = "❤️ ${p.laughs}")
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
                    HumorPostCard(
                        author = p.author,
                        body = p.body,
                        laughs = p.laughs,
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
private fun HumorPostCard(
    author: String,
    body: String,
    laughs: Int,
    liked: Boolean,
    onToggleLike: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(author, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (body.isNotBlank()) {
                Text(body, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                FilledTonalButton(onClick = onToggleLike) {
                    Icon(
                        if (liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = "좋아요",
                        modifier = Modifier.padding(end = 6.dp),
                    )
                    Text("$laughs")
                }
            }
        }
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
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("열린 모임이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { g ->
                FeedCard(
                    title = g.title.ifBlank { "(제목 없음)" },
                    pill = g.kind,
                    subtitle = "${g.host} · ${g.part}",
                    body = g.description.ifBlank { null },
                    meta = buildString {
                        if (g.startAt.isNotBlank()) append(g.startAt.take(16).replace("T", " "))
                        if (g.place.isNotBlank()) append(" · ${g.place}")
                        if (g.cost.isNotBlank()) append(" · ${g.cost}")
                    }.ifBlank { null },
                )
            }
        }
    }
}

@Composable
fun MarketContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { MarketViewModel(container) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("등록된 물건이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
            items(items, key = { it.id }) { m ->
                FeedCard(
                    title = m.title.ifBlank { "(제목 없음)" },
                    pill = if (m.kind == "giveaway") "나눔" else "경매",
                    subtitle = m.seller,
                    body = m.description.ifBlank { null },
                    meta = if (m.kind == "giveaway") "무료 나눔"
                    else "시작가 ${"%,d".format(m.startPrice)}원 · ${"%,d".format(m.minStep)}원 단위",
                )
            }
        }
    }
}
