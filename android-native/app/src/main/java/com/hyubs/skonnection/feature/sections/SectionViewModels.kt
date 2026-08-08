package com.hyubs.skonnection.feature.sections

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.Account
import com.hyubs.skonnection.data.ActionItem
import com.hyubs.skonnection.data.Agenda
import com.hyubs.skonnection.data.AppNotification
import com.hyubs.skonnection.data.Issue
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class IssuesViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Issue>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    init { viewModelScope.launch { _items.value = runCatching { c.issueRepository.loadAll() }.getOrDefault(emptyList()); _loading.value = false } }
}

class AgendaViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Agenda>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    init { viewModelScope.launch { _items.value = runCatching { c.agendaRepository.loadAll() }.getOrDefault(emptyList()); _loading.value = false } }
}

class ActionsViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<ActionItem>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    init { viewModelScope.launch { _items.value = runCatching { c.actionRepository.loadAll() }.getOrDefault(emptyList()); _loading.value = false } }
}

class AccountsViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Account>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    init { viewModelScope.launch { _items.value = runCatching { c.accountRepository.loadAll() }.getOrDefault(emptyList()); _loading.value = false } }
}

class NotificationsViewModel(private val c: AppContainer, private val email: String?) : ViewModel() {
    private val _items = MutableStateFlow<List<AppNotification>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    init {
        viewModelScope.launch {
            // 세션은 이메일만 보관 → accounts 에서 현재 사용자 이름을 찾아 수신 알림을 부른다.
            val name = runCatching {
                c.accountRepository.loadAll().firstOrNull { it.email.equals(email, ignoreCase = true) }?.name
            }.getOrNull()
            _items.value = if (name == null) emptyList()
            else runCatching { c.notificationRepository.loadFor(name) }.getOrDefault(emptyList())
            _loading.value = false
        }
    }
}
