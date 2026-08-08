package com.hyubs.skonnection.feature.sections

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
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
    init { viewModelScope.launch { _items.value = runCatching { c.profileRepository.loadAll() }.getOrDefault(emptyList()); _loading.value = false } }
}

class MemoriesViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<TeamMemory>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    init { viewModelScope.launch { _items.value = runCatching { c.memoryRepository.loadAll() }.getOrDefault(emptyList()); _loading.value = false } }
}

class MeetingsViewModel(private val c: AppContainer) : ViewModel() {
    private val _can = MutableStateFlow<List<CanSession>>(emptyList()); val can = _can.asStateFlow()
    private val _tea = MutableStateFlow<List<TeaSession>>(emptyList()); val tea = _tea.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    init {
        viewModelScope.launch {
            _can.value = runCatching { c.meetingRepository.loadCanSessions() }.getOrDefault(emptyList())
            _tea.value = runCatching { c.meetingRepository.loadTeaSessions() }.getOrDefault(emptyList())
            _loading.value = false
        }
    }
}
