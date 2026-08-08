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
    init { refresh() }
    private fun refresh() = viewModelScope.launch {
        _loading.value = true
        _items.value = runCatching { c.issueRepository.loadAll() }.getOrDefault(emptyList())
        _loading.value = false
    }

    fun submit(
        title: String, category: String, target: String, urgency: String,
        body: String, expectedChange: String, visibility: String, anonymous: Boolean,
        onDone: () -> Unit,
    ) {
        val me = c.currentUser
        viewModelScope.launch {
            runCatching {
                c.issueRepository.create(
                    title = title.trim(), category = category, target = target, urgency = urgency,
                    body = body.trim(), expectedChange = expectedChange.trim(), visibility = visibility,
                    anonymous = anonymous,
                    submitterName = me?.name, submitterEmail = me?.email, submitterPart = me?.part,
                )
            }
            refresh()
            onDone()
        }
    }
}

class AgendaViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Agenda>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _votedIds = MutableStateFlow<Set<String>>(emptySet()); val votedIds = _votedIds.asStateFlow()

    init { refresh() }

    private fun refresh() = viewModelScope.launch {
        _loading.value = true
        _items.value = runCatching { c.agendaRepository.loadAll() }.getOrDefault(emptyList())
        recomputeVoted()
        _loading.value = false
    }

    private suspend fun recomputeVoted() {
        val email = c.currentUser?.email ?: return
        val keys = runCatching { c.agendaRepository.loadBallotKeys() }.getOrDefault(emptySet())
        _votedIds.value = _items.value
            .filter { keys.contains(it.id to com.hyubs.skonnection.core.VoterKey.make(email, it.id)) }
            .map { it.id }.toSet()
    }

    /** 찬성/반대 투표. 이미 투표했거나 마감된 안건이면 무시. 낙관적 카운트 반영. */
    fun vote(agenda: Agenda, approveVote: Boolean) {
        val email = c.currentUser?.email ?: return
        if (agenda.status != "투표중") return
        if (_votedIds.value.contains(agenda.id)) return
        val key = com.hyubs.skonnection.core.VoterKey.make(email, agenda.id)
        _items.value = _items.value.map {
            if (it.id != agenda.id) it
            else it.copy(approve = it.approve + if (approveVote) 1 else 0, reject = it.reject + if (approveVote) 0 else 1)
        }
        _votedIds.value = _votedIds.value + agenda.id
        viewModelScope.launch {
            runCatching {
                c.agendaRepository.vote(agenda.id, approveVote, key, agenda.approve, agenda.reject)
            }.onFailure { refresh() }
        }
    }
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
