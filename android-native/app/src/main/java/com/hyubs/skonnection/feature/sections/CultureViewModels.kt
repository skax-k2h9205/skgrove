package com.hyubs.skonnection.feature.sections

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.core.loadOrNull
import com.hyubs.skonnection.data.CanSession
import com.hyubs.skonnection.data.Profile
import com.hyubs.skonnection.data.TeaSession
import com.hyubs.skonnection.data.TeamMemory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ProfilesViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Profile>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    init { retry() }

    fun retry() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("profiles", _error) { c.profileRepository.loadAll() }?.let { _items.value = it }
        _loading.value = false
    }
}

class MemoriesViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<TeamMemory>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    init { retry() }

    fun retry() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("team_memories", _error) { c.memoryRepository.loadAll() }?.let { _items.value = it }
        _loading.value = false
    }
}

class MeetingsViewModel(private val c: AppContainer) : ViewModel() {
    private val _can = MutableStateFlow<List<CanSession>>(emptyList()); val can = _can.asStateFlow()
    private val _tea = MutableStateFlow<List<TeaSession>>(emptyList()); val tea = _tea.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    init { retry() }

    fun retry() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        // 한쪽만 실패할 수 있다. 성공한 쪽은 그대로 보여주고 실패는 error로 알린다.
        loadOrNull("can_sessions", _error) { c.meetingRepository.loadCanSessions() }?.let { _can.value = it }
        loadOrNull("tea_sessions", _error) { c.meetingRepository.loadTeaSessions() }?.let { _tea.value = it }
        _loading.value = false
    }
}
