package com.hyubs.skonnection.feature

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.Gathering
import com.hyubs.skonnection.data.HumorPost
import com.hyubs.skonnection.data.MarketItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 공통 로딩 상태 홀더 — 각 피드 화면이 재사용. */
class ListState<T> {
    val items = MutableStateFlow<List<T>>(emptyList())
    val loading = MutableStateFlow(true)
}

class HumorViewModel(private val container: AppContainer) : ViewModel() {
    private val _posts = MutableStateFlow<List<HumorPost>>(emptyList())
    val posts: StateFlow<List<HumorPost>> = _posts.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    val currentName: String? get() = container.currentUser?.name

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _posts.value = runCatching { container.humorRepository.loadPosts() }.getOrDefault(emptyList())
        _loading.value = false
    }

    /** 좋아요 토글 — 낙관적 업데이트 후 Supabase 반영. */
    fun toggleLike(post: HumorPost) {
        val me = container.currentUser?.name ?: return
        val next = if (post.likedBy.contains(me)) post.likedBy - me else post.likedBy + me
        _posts.value = _posts.value.map { if (it.id == post.id) it.copy(likedBy = next) else it }
        viewModelScope.launch {
            runCatching { container.humorRepository.setLikedBy(post.id, next) }
                .onFailure { refresh() } // 실패 시 서버 상태로 되돌림
        }
    }

    fun createPost(body: String, mediaUrl: String, onDone: () -> Unit) {
        val me = container.currentUser?.name ?: return
        viewModelScope.launch {
            runCatching { container.humorRepository.createPost(me, body.trim(), mediaUrl.trim()) }
            refresh()
            onDone()
        }
    }
}

class GatheringsViewModel(private val container: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Gathering>>(emptyList())
    val items: StateFlow<List<Gathering>> = _items.asStateFlow()
    private val _signups = MutableStateFlow<Map<String, List<String>>>(emptyMap())
    val signups: StateFlow<Map<String, List<String>>> = _signups.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    val currentName: String? get() = container.currentUser?.name

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _items.value = runCatching { container.gatheringRepository.loadAll() }.getOrDefault(emptyList())
        _signups.value = runCatching { container.gatheringRepository.loadSignups() }.getOrDefault(emptyMap())
        _loading.value = false
    }

    fun toggleJoin(g: Gathering) {
        val me = container.currentUser?.name ?: return
        val current = _signups.value[g.id].orEmpty()
        val joined = current.contains(me)
        val next = if (joined) current - me else current + me
        _signups.value = _signups.value + (g.id to next)  // 낙관적
        viewModelScope.launch {
            runCatching {
                if (joined) container.gatheringRepository.leave(g.id, me)
                else container.gatheringRepository.join(g.id, me)
            }.onFailure { refresh() }
        }
    }
}

class MarketViewModel(private val container: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<MarketItem>>(emptyList())
    val items: StateFlow<List<MarketItem>> = _items.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _items.value = runCatching { container.marketRepository.loadAll() }.getOrDefault(emptyList())
        _loading.value = false
    }
}
