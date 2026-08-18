package com.hyubs.skonnection.feature

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.core.loadOrNull
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

    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    val currentName: String? get() = container.currentUser?.name
    val isAdmin: Boolean get() = container.isAdmin

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("humor_posts", _error) { container.humorRepository.loadPosts() }?.let { _posts.value = it }
        _loading.value = false
    }

    /** 글 삭제(admin 전용). */
    fun deletePost(post: HumorPost) {
        if (!container.isAdmin) return
        _posts.value = _posts.value.filterNot { it.id == post.id } // 낙관적
        viewModelScope.launch {
            runCatching { container.humorRepository.deletePost(post.id) }.onFailure { refresh() }
        }
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

class HumorDetailViewModel(private val container: AppContainer, private val postId: String) : ViewModel() {
    private val _comments = MutableStateFlow<List<com.hyubs.skonnection.data.HumorComment>>(emptyList())
    val comments = _comments.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    init { refresh() }
    fun retry() = refresh()
    private fun refresh() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("humor_comments", _error) { container.humorRepository.loadComments(postId) }
            ?.let { _comments.value = it }
        _loading.value = false
    }

    fun addComment(body: String, onDone: () -> Unit) {
        val me = container.currentUser?.name ?: return
        if (body.isBlank()) return
        viewModelScope.launch {
            runCatching { container.humorRepository.addComment(postId, me, body.trim()) }
            refresh(); onDone()
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
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    val currentName: String? get() = container.currentUser?.name
    val isAdmin: Boolean get() = container.isAdmin

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("gatherings", _error) { container.gatheringRepository.loadAll() }?.let { _items.value = it }
        loadOrNull("gathering_signups", _error) { container.gatheringRepository.loadSignups() }?.let { _signups.value = it }
        _loading.value = false
    }

    fun create(title: String, place: String, description: String, capacity: Int?, kind: String, onDone: () -> Unit) {
        val me = container.currentUser ?: return
        val cleanTitle = title.trim()
        viewModelScope.launch {
            val id = runCatching {
                container.gatheringRepository.create(kind, cleanTitle, place, description, capacity, me.name, me.part)
            }.getOrNull()

            // 연 사람은 당연히 참석자다. 예전엔 0명으로 시작해 주최자가 자기 모임에 또 신청해야 했고
            // 커피뽑기 후보에서도 빠졌다. gathering_signups 에 FK 가 있어 모임 insert 성공 뒤에만 건다.
            if (id != null) runCatching { container.gatheringRepository.join(id, me.name) }

            refresh(); onDone()

            // 썸네일은 등록을 붙잡지 않는다 — 모임이 먼저 뜨고, 그려지면 사진으로 바뀐다.
            // 실패해도 모임은 멀쩡해야 하므로 조용히 넘긴다(아이콘 타일 유지).
            if (id == null) return@launch
            val url = container.gatheringImageRepository.makeAndUpload(
                id = id, kind = kind, title = cleanTitle, startAt = "", place = place,
                capacity = capacity, desc = description,
            ) ?: return@launch
            runCatching { container.gatheringRepository.setImageUrl(id, url) }
            refresh()
        }
    }

    fun delete(g: Gathering) {
        if (!container.isAdmin) return
        _items.value = _items.value.filterNot { it.id == g.id }
        viewModelScope.launch { runCatching { container.gatheringRepository.delete(g.id) }.onFailure { refresh() } }
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
    private val _topBids = MutableStateFlow<Map<String, com.hyubs.skonnection.data.TopBid>>(emptyMap())
    val topBids: StateFlow<Map<String, com.hyubs.skonnection.data.TopBid>> = _topBids.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    val currentName: String? get() = container.currentUser?.name
    val isAdmin: Boolean get() = container.isAdmin

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("market_items", _error) { container.marketRepository.loadAll() }?.let { _items.value = it }
        loadOrNull("market_bids", _error) { container.marketRepository.loadTopBids() }?.let { _topBids.value = it }
        _loading.value = false
    }

    fun create(title: String, description: String, startPrice: Int, minStep: Int, kind: String, onDone: () -> Unit) {
        val me = container.currentUser ?: return
        viewModelScope.launch {
            runCatching { container.marketRepository.create(kind, title.trim(), description, startPrice, minStep, me.name) }
            refresh(); onDone()
        }
    }

    fun delete(item: MarketItem) {
        if (!container.isAdmin) return
        _items.value = _items.value.filterNot { it.id == item.id }
        viewModelScope.launch { runCatching { container.marketRepository.delete(item.id) }.onFailure { refresh() } }
    }

    /** 현재가(최고 입찰 없으면 시작가). */
    fun currentPrice(item: MarketItem): Int = _topBids.value[item.id]?.amount ?: item.startPrice

    /** 다음 최소 입찰가 = 현재가 + 단위(입찰 없으면 시작가). */
    fun nextMinBid(item: MarketItem): Int {
        val top = _topBids.value[item.id]
        return if (top == null) item.startPrice else top.amount + item.minStep
    }

    fun bid(item: MarketItem, amount: Int, onResult: (String?) -> Unit) {
        val me = container.currentUser?.name ?: return onResult("로그인이 필요해요.")
        if (amount < nextMinBid(item)) return onResult("최소 ${"%,d".format(nextMinBid(item))}원 이상 입찰해야 해요.")
        _topBids.value = _topBids.value + (item.id to com.hyubs.skonnection.data.TopBid(me, amount)) // 낙관적
        viewModelScope.launch {
            runCatching { container.marketRepository.bid(item.id, me, amount) }
                .onSuccess { onResult(null) }
                .onFailure { refresh(); onResult("입찰에 실패했어요. 다시 시도해주세요.") }
        }
    }
}
