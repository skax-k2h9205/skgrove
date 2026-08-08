package com.hyubs.skonnection.feature

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
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
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
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
    when {
        loading && posts.isEmpty() -> LoadingBox(modifier)
        posts.isEmpty() -> EmptyBox("아직 유머 글이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
            items(posts, key = { it.id }) { p ->
                FeedCard(title = p.author, body = p.body.ifBlank { null }, meta = "❤️ ${p.laughs}")
            }
        }
    }
}

@Composable
fun GatheringsContent(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { GatheringsViewModel(container) }
    val items by vm.items.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    when {
        loading && items.isEmpty() -> LoadingBox(modifier)
        items.isEmpty() -> EmptyBox("열린 모임이 없어요.", modifier)
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
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
        else -> LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp)) {
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
