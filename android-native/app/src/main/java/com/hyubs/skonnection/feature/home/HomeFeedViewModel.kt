package com.hyubs.skonnection.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.core.loadOrNull
import com.hyubs.skonnection.data.HumorMedia
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 홈 통합 피드 — 유머·모임·장터·안건·액션을 라운드로빈으로 섞는다(iOS HomeView 이식). */
class HomeFeedViewModel(private val container: AppContainer) : ViewModel() {
    private val _tiles = MutableStateFlow<List<HomeTile>>(emptyList())
    val tiles = _tiles.asStateFlow()
    /** 스토리 줄에 올릴 모임(번개·커피). 탭하면 모임 상세로 바로 간다. */
    private val _stories = MutableStateFlow<List<com.hyubs.skonnection.data.Gathering>>(emptyList())
    val stories = _stories.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()

    init { refresh() }

    fun retry() = refresh()

    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        // 홈은 다섯 소스를 섞는다. 하나가 실패해도 나머지는 보여주되, 빠졌다는 사실은 error로 알린다.
        val humor = loadOrNull("humor_posts", _error) { container.humorRepository.loadPosts() }.orEmpty()
        val gatherings = loadOrNull("gatherings", _error) { container.gatheringRepository.loadAll() }.orEmpty()
        val market = loadOrNull("market_items", _error) { container.marketRepository.loadAll() }.orEmpty()
        val agendas = loadOrNull("agendas", _error) { container.agendaRepository.loadAll() }.orEmpty()
        val actions = loadOrNull("action_items", _error) { container.actionRepository.loadAll() }.orEmpty()

        val h = humor.take(8).map {
            HomeTile(
                "h:${it.id}", "humor", it.body.ifBlank { "(사진)" }, "❤️ ${it.laughs}",
                HumorMedia.thumbnail(it.mediaUrl), it.author, 1,
                playable = HumorMedia.isPlayable(it.mediaUrl),
            )
        }
        val m = market.take(6).map {
            HomeTile("m:${it.id}", "market", it.title, if (it.kind == "giveaway") "나눔" else "경매", it.imageUrl, it.seller, 3)
        }
        // 번개·커피는 위 스토리 줄이 맡는다 — 피드에도 넣으면 같은 모임이 위아래로 두 번 보인다.
        // 일반 모임은 지나고 나서도 기록으로 남아야 해서 피드에 그대로 둔다.
        val storyKinds = setOf("flash", "coffee", "번개", "커피")
        // 안 본 스토리 먼저(인스타). 같은 그룹 안에서는 시작이 임박한 순.
        val viewed = container.viewedStories.all()
        _stories.value = gatherings
            .filter { it.kind in storyKinds }
            .sortedWith(compareBy({ it.id in viewed }, { it.startAt }))
            .take(12)
        val g = gatherings.filterNot { it.kind in storyKinds }.take(6).map {
            HomeTile("g:${it.id}", "gathering", it.title, it.kind, it.imageUrl, it.host, 2)
        }
        val a = agendas.take(4).map {
            HomeTile("a:${it.id}", "agenda", it.title, it.status, null, null, 4)
        }
        val ac = actions.take(4).map {
            HomeTile("ac:${it.id}", "action", it.title, it.status, null, null, 4)
        }
        _tiles.value = roundRobin(listOf(h, m, g, a, ac))
        _loading.value = false
    }

    /** 스토리를 열면 '봤음'으로 기록하고 트레이를 다시 정렬한다. */
    fun markStoryViewed(id: String) {
        container.viewedStories.mark(id)
        val viewed = container.viewedStories.all()
        _stories.value = _stories.value.sortedWith(compareBy({ it.id in viewed }, { it.startAt }))
    }

    private fun roundRobin(lists: List<List<HomeTile>>): List<HomeTile> {
        val out = mutableListOf<HomeTile>()
        var idx = 0
        var remaining = true
        while (remaining) {
            remaining = false
            for (list in lists) if (idx < list.size) { out.add(list[idx]); remaining = true }
            idx++
        }
        return out
    }
}
