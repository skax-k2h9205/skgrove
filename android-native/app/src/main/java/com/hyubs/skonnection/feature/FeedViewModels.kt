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

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _posts.value = runCatching { container.humorRepository.loadPosts() }.getOrDefault(emptyList())
        _loading.value = false
    }
}

class GatheringsViewModel(private val container: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Gathering>>(emptyList())
    val items: StateFlow<List<Gathering>> = _items.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _loading.value = true
        _items.value = runCatching { container.gatheringRepository.loadAll() }.getOrDefault(emptyList())
        _loading.value = false
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
