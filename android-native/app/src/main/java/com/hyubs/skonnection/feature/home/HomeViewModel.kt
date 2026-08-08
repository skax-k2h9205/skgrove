package com.hyubs.skonnection.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.HumorPost
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HomeViewModel(private val container: AppContainer) : ViewModel() {
    private val _posts = MutableStateFlow<List<HumorPost>>(emptyList())
    val posts: StateFlow<List<HumorPost>> = _posts.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            _posts.value = try { container.humorRepository.loadPosts() } catch (t: Throwable) { emptyList() }
            _loading.value = false
        }
    }
}
