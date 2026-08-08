package com.hyubs.skonnection.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 홈 통합 피드 — 유머·모임·장터·안건·액션을 라운드로빈으로 섞는다(iOS HomeView 이식). */
class HomeFeedViewModel(private val container: AppContainer) : ViewModel() {
    private val _tiles = MutableStateFlow<List<HomeTile>>(emptyList())
    val tiles = _tiles.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _loading.value = true
        val humor = runCatching { container.humorRepository.loadPosts() }.getOrDefault(emptyList())
        val gatherings = runCatching { container.gatheringRepository.loadAll() }.getOrDefault(emptyList())
        val market = runCatching { container.marketRepository.loadAll() }.getOrDefault(emptyList())
        val agendas = runCatching { container.agendaRepository.loadAll() }.getOrDefault(emptyList())
        val actions = runCatching { container.actionRepository.loadAll() }.getOrDefault(emptyList())

        val h = humor.take(8).map {
            HomeTile("h:${it.id}", "humor", it.body.ifBlank { "(사진)" }, "❤️ ${it.laughs}", it.mediaUrl, it.author, 1)
        }
        val m = market.take(6).map {
            HomeTile("m:${it.id}", "market", it.title, if (it.kind == "giveaway") "나눔" else "경매", it.imageUrl, it.seller, 3)
        }
        val g = gatherings.take(6).map {
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
