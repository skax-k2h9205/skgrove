package com.hyubs.skonnection.feature.sections

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.core.loadOrNull
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
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    init { retry() }
    fun retry() = refresh()
    private fun refresh() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("issues", _error) { c.issueRepository.loadAll() }?.let { _items.value = it }
        _loading.value = false
    }

    fun submit(
        title: String, category: String, target: String, urgency: String,
        body: String, expectedChange: String, visibility: String, anonymous: Boolean,
        onDone: () -> Unit,
    ) {
        val me = c.currentUser
        viewModelScope.launch {
            // 암호화 수신자(대상 리더 + 작성자) 해석에 계정 목록·내 계정 id가 필요하다.
            val accounts = runCatching { c.accountRepository.loadAll() }.getOrDefault(emptyList())
            val authorId = accounts.firstOrNull { it.email.equals(me?.email, ignoreCase = true) }?.id
            runCatching {
                c.issueRepository.create(
                    title = title.trim(), category = category, target = target, urgency = urgency,
                    body = body.trim(), expectedChange = expectedChange.trim(), visibility = visibility,
                    anonymous = anonymous,
                    submitterName = me?.name, submitterEmail = me?.email, submitterPart = me?.part,
                    accounts = accounts, authorAccountId = authorId,
                )
            }
            refresh()
            onDone()
        }
    }
}

/**
 * 리더 관리함 — 접수를 답변·1:1 제안·안건화·보류/종료로 처리한다(웹 LeaderInbox / iOS LeaderView 이식).
 *
 * 접수 화면(IssuesViewModel)과 달리 여기서는 목록을 읽기만 하지 않고 상태를 바꾼다.
 * 처리 결과는 낙관적으로 먼저 반영하고, 서버 실패 시 refresh로 되돌린다.
 */
class LeaderViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Issue>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _filter = MutableStateFlow<String?>(null); val filter = _filter.asStateFlow()
    /** 방금 안건으로 올린 접수 안내. 한 번 보여주고 지운다. */
    private val _promoted = MutableStateFlow<String?>(null); val promoted = _promoted.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    private var accounts: List<Account> = emptyList()

    init { refresh() }

    fun retry() = refresh()

    private fun refresh() = viewModelScope.launch {
        _error.value = null
        loadOrNull("issues", _error) { c.issueRepository.loadAll() }?.let { _items.value = it }
        if (accounts.isEmpty()) {
            // 계정은 안건화 시 투표 대상 수를 세는 데만 쓴다. 실패해도 목록은 계속 보여준다.
            accounts = loadOrNull("accounts", _error) { c.accountRepository.loadAll() } ?: emptyList()
        }
        _loading.value = false
    }

    fun setFilter(status: String?) { _filter.value = status }
    fun clearPromoted() { _promoted.value = null }

    /**
     * 투표 대상 인원. 파트 한정 안건은 해당 파트 + '전체' 소속(팀리더)만 센다(웹 eligibleCountFor).
     * 계정을 못 읽었으면 0 — 지어낸 모수로 정족수를 계산하지 않는다.
     */
    fun eligibleCountFor(part: String): Int = accounts.count {
        it.status == "활성" && (part == "전체" || it.part == part || it.part == "전체")
    }

    fun reply(issue: Issue, text: String) = act(issue) { c.issueRepository.reply(issue, text) }
    fun proposeOneOnOne(issue: Issue, text: String) = act(issue) { c.issueRepository.proposeOneOnOne(issue, text) }
    fun hold(issue: Issue, reason: String) = act(issue) { c.issueRepository.decide(issue.id, "보류", reason) }
    fun close(issue: Issue, reason: String) = act(issue) { c.issueRepository.decide(issue.id, "종료", reason) }

    /** 접수를 안건으로 올리고 접수 상태를 '안건화'로 옮긴다. 둘 중 하나만 성공하면 목록을 다시 읽어 맞춘다. */
    fun promote(issue: Issue, title: String, description: String, part: String, deadline: String, onDone: () -> Unit) {
        viewModelScope.launch {
            val ok = runCatching {
                c.agendaRepository.createFromIssue(
                    issue, title.trim(), description.trim(), part,
                    deadline.ifBlank { defaultDeadline() }, eligibleCountFor(part),
                )
                c.issueRepository.mark(issue.id, "안건화")
            }.isSuccess
            if (ok) _promoted.value = "\"${title.trim()}\" 안건으로 올렸어요 — 안건·투표 화면에서 볼 수 있어요."
            refresh()
            onDone()
        }
    }

    /** 처리 후 목록을 다시 읽는다. 답변 이력은 서버에서 이어 붙이므로 낙관적 조작보다 재조회가 안전하다. */
    private fun act(issue: Issue, block: suspend () -> Unit) = viewModelScope.launch {
        runCatching { block() }
        refresh()
    }

    companion object {
        /** 사람이 마감일을 정하지 않으면 7일. 기한 없이 방치되는 안건을 막는다(웹 DEFAULT_VOTING_DAYS). */
        fun defaultDeadline(): String = java.time.LocalDate.now().plusDays(7).toString()
    }
}

class AgendaViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Agenda>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _votedIds = MutableStateFlow<Set<String>>(emptySet()); val votedIds = _votedIds.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    init { refresh() }

    fun retry() = refresh()

    private fun refresh() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        loadOrNull("agendas", _error) { c.agendaRepository.loadAll() }?.let { _items.value = it }
        recomputeVoted()
        _loading.value = false
    }

    private suspend fun recomputeVoted() {
        val email = c.currentUser?.email ?: return
        // 투표용지 조회 실패는 화면을 막지 않는다(중복 투표 표시만 못 할 뿐). 로그는 남긴다.
        val keys = loadOrNull("agenda_ballots", _error) { c.agendaRepository.loadBallotKeys() } ?: emptySet()
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
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    val isAdmin: Boolean get() = c.isAdmin
    init { refresh() }
    fun retry() = refresh()
    private fun refresh() = viewModelScope.launch {
        _error.value = null
        loadOrNull("action_items", _error) { c.actionRepository.loadAll() }?.let { _items.value = it }
        _loading.value = false
    }
    fun create(title: String, owner: String, due: String, onDone: () -> Unit) = viewModelScope.launch {
        runCatching { c.actionRepository.create(title.trim(), owner.trim().ifBlank { "미정" }, due) }
        refresh(); onDone()
    }
    fun delete(item: ActionItem) {
        if (!c.isAdmin) return
        _items.value = _items.value.filterNot { it.id == item.id }
        viewModelScope.launch { runCatching { c.actionRepository.delete(item.id) }.onFailure { refresh() } }
    }
}

data class Metrics(
    val reflectionRate: Int = 0,
    val agendaPassRate: Int = 0,
    val actionDoneRate: Int = 0,
    val cultureHealth: Int = 0,
    val issueCount: Int = 0,
    val agendaCount: Int = 0,
    val actionCount: Int = 0,
    val overdueCount: Int = 0,
)

class MetricsViewModel(private val c: AppContainer) : ViewModel() {
    private val _metrics = MutableStateFlow(Metrics()); val metrics = _metrics.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()

    init { retry() }

    fun retry() = viewModelScope.launch {
        run {
            _loading.value = true
            _error.value = null
            // 셋 중 하나라도 못 읽으면 비율이 실제와 달라진다. 지표는 틀린 값보다 못 불러왔다고 말하는 게 낫다.
            val issues = loadOrNull("issues", _error) { c.issueRepository.loadAll() } ?: return@run
            val agendas = loadOrNull("agendas", _error) { c.agendaRepository.loadAll() } ?: return@run
            val actions = loadOrNull("action_items", _error) { c.actionRepository.loadAll() } ?: return@run

            val reflected = setOf("답변완료", "1on1 제안", "액션아이템", "안건화", "종료")
            val reflectionRate = pct(issues.count { it.status in reflected }, issues.size)
            val agendaPassRate = pct(agendas.count { it.status == "통과" || it.status == "결정됨" }, agendas.size)
            val actionDoneRate = pct(actions.count { it.status == "완료" }, actions.size)
            val today = java.time.LocalDate.now().toString()
            val overdue = actions.count { it.status != "완료" && it.due.isNotBlank() && it.due.take(10) < today }
            val base = (reflectionRate + agendaPassRate + actionDoneRate) / 3
            val health = (base - overdue * 5).coerceIn(0, 100)

            _metrics.value = Metrics(
                reflectionRate, agendaPassRate, actionDoneRate, health,
                issues.size, agendas.size, actions.size, overdue,
            )
        }
        _loading.value = false
    }

    private fun pct(part: Int, total: Int) = if (total == 0) 0 else (part * 100.0 / total).toInt()
}

class AccountsViewModel(private val c: AppContainer) : ViewModel() {
    private val _items = MutableStateFlow<List<Account>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    /** 권한·상태 변경은 팀 전체에 영향을 준다. 리더가 아니면 카드는 읽기 전용으로 둔다. */
    val canEdit: Boolean get() = c.isLeader

    init { refresh() }

    fun retry() = refresh()

    private fun refresh() = viewModelScope.launch {
        _error.value = null
        loadOrNull("accounts", _error) { c.accountRepository.loadAll() }?.let { _items.value = it }
        _loading.value = false
    }

    /**
     * 계정 변경 저장. 화면에 먼저 반영하고 서버에 보낸 뒤, 실패하면 다시 읽어 되돌린다.
     * 권한이 없으면 아무것도 하지 않는다 — 화면에서 막더라도 여기서 한 번 더 막는다.
     */
    fun save(updated: Account, onDone: () -> Unit) {
        if (!canEdit) return
        _items.value = _items.value.map { if (it.id == updated.id) updated else it }
        viewModelScope.launch {
            runCatching { c.accountRepository.update(updated) }.onFailure { refresh() }
            onDone()
        }
    }
}

class NotificationsViewModel(private val c: AppContainer, private val email: String?) : ViewModel() {
    private val _items = MutableStateFlow<List<AppNotification>>(emptyList()); val items = _items.asStateFlow()
    private val _loading = MutableStateFlow(true); val loading = _loading.asStateFlow()
    /** 알림은 수신자 '이름'으로 걸려 있다. 읽음 처리에도 같은 이름이 필요해 들고 있는다. */
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    private var recipientName: String? = null

    init { retry() }

    fun retry() = viewModelScope.launch {
        _loading.value = true
        _error.value = null
        // 세션은 이메일만 보관 → accounts 에서 현재 사용자 이름을 찾아 수신 알림을 부른다.
        recipientName = loadOrNull("accounts", _error) { c.accountRepository.loadAll() }
            ?.firstOrNull { it.email.equals(email, ignoreCase = true) }?.name
        recipientName?.let { name ->
            loadOrNull("notifications", _error) { c.notificationRepository.loadFor(name) }
                ?.let { _items.value = it }
        }
        _loading.value = false
    }

    /** 알림 하나를 읽음으로. 이미 읽은 건은 서버를 다시 부르지 않는다. */
    fun markRead(item: AppNotification) {
        if (item.read) return
        _items.value = _items.value.map { if (it.id == item.id) it.copy(read = true) else it }
        viewModelScope.launch { runCatching { c.notificationRepository.markRead(item.id) } }
    }

    fun markAllRead() {
        val name = recipientName ?: return
        if (_items.value.none { !it.read }) return
        _items.value = _items.value.map { it.copy(read = true) }
        viewModelScope.launch { runCatching { c.notificationRepository.markAllRead(name) } }
    }
}
