package com.hyubs.skonnection.feature.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.core.loadOrNull
import com.hyubs.skonnection.data.ChatTurn
import com.hyubs.skonnection.data.Agenda
import com.hyubs.skonnection.data.CounselMessage
import com.hyubs.skonnection.data.Issue
import com.hyubs.skonnection.data.Profile
import com.hyubs.skonnection.data.SimilarCases
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class ChatMode(val api: String, val label: String, val greeting: String) {
    COUNSEL("counsel", "마음 상담", "안녕하세요. 요즘 어떤 점이 힘드신가요? 편하게 이야기해 주세요."),
    RULE("rule", "팀지식", "팀 운영·예산·근태·규칙 등 궁금한 점을 물어보세요."),
}

data class ChatUiState(
    val mode: ChatMode = ChatMode.COUNSEL,
    val messages: List<ChatTurn> = emptyList(),
    val sending: Boolean = false,
    /** 고를 수 있는 동료(나 자신은 뺀다). */
    val partners: List<Profile> = emptyList(),
    /** 지금 이야기 상대. 안 고르면 일반 상담. */
    val partner: Profile? = null,
)

/** 이번에 앱에서 시작한 대화 묶음. 웹 newId('CS') 와 같은 역할. */
private fun newSessionId() = "CS-A" + System.currentTimeMillis()

class ChatViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(ChatUiState())
    val state = _state.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)

    /** 내 성향. 서버가 "나와 상대의 언어를 서로 번역"하는 데 쓴다. */
    private var self: Profile? = null

    // 유사 사례를 찾을 원본. 질문마다 다시 읽지 않고 화면을 열 때 한 번만 읽는다.
    private var issues: List<Issue> = emptyList()
    private var agendas: List<Agenda> = emptyList()

    // 대화는 화면이 아니라 서버에 산다 — 앱을 닫았다 열어도, 웹에서 이어 봐도 남아 있다.
    private val sessionId = newSessionId()
    private var saved: List<CounselMessage> = emptyList()
    private val author: String get() = container.currentUser?.email.orEmpty()

    init { loadProfiles(); loadCasePool(); loadHistory() }

    /** 저장된 상담 기록을 불러와 현재 모드의 대화로 깐다. 실패해도 새 대화는 시작할 수 있다. */
    private fun loadHistory() = viewModelScope.launch {
        val all = loadOrNull("counsel_messages", _error) {
            container.counselRepository.loadFor(author)
        } ?: return@launch
        saved = all
        showThread(_state.value.mode)
    }

    /** 저장된 것 중 이 모드의 대화만 화면에 올린다. 상담과 팀지식은 성격이 달라 섞지 않는다. */
    private fun showThread(mode: ChatMode) {
        _state.value = _state.value.copy(
            mode = mode,
            messages = saved.filter { it.mode == mode.api }.map { ChatTurn(it.role, it.content) },
            sending = false,
        )
    }

    /** 화면과 기억에 즉시 반영하고 서버는 뒤따른다 — 방금 쓴 말이 늦게 뜨면 안 된다. */
    private fun remember(role: String, content: String, partnerName: String?) {
        val mode = _state.value.mode.api
        val message = CounselMessage(
            id = "CM-A" + System.currentTimeMillis() + "-" + role.first() + saved.size,
            sessionId = sessionId, author = author, mode = mode, role = role,
            content = content, partnerName = partnerName,
            createdAt = container.counselRepository.now(),
        )
        saved = saved + message
        if (author.isNotBlank()) {
            viewModelScope.launch { runCatching { container.counselRepository.add(message) } }
        }
    }

    /**
     * 이 모드의 대화를 지운다. 상담은 개인적인 이야기라 본인이 지울 수 있어야 한다.
     * 서버 삭제가 실패해도 화면은 지운 상태로 둔다 — 지우겠다는 뜻이 우선이다.
     */
    fun clearThread() {
        val mode = _state.value.mode.api
        val doomed = saved.filter { it.mode == mode }.map { it.id }
        if (doomed.isEmpty()) return
        saved = saved.filterNot { it.mode == mode }
        _state.value = _state.value.copy(messages = emptyList())
        viewModelScope.launch { runCatching { container.counselRepository.deleteAll(doomed) } }
    }

    /** 유사 사례 후보. 실패해도 상담은 되어야 하므로 조용히 비워둔다(로그는 남는다). */
    private fun loadCasePool() = viewModelScope.launch {
        issues = loadOrNull("issues", _error) { container.issueRepository.loadAll() } ?: emptyList()
        agendas = loadOrNull("agendas", _error) { container.agendaRepository.loadAll() } ?: emptyList()
    }

    private fun loadProfiles() = viewModelScope.launch {
        val all = loadOrNull("profiles", _error) { container.profileRepository.loadAll() } ?: return@launch
        val myName = container.currentUser?.name
        self = all.firstOrNull { it.name == myName }
        // 나를 상대로 고를 수는 없다. 이름이 비어 있는 행은 목록에서 뺀다.
        _state.value = _state.value.copy(
            partners = all.filter { it.name.isNotBlank() && it.name != myName },
        )
    }

    fun switchMode(mode: ChatMode) {
        if (mode == _state.value.mode) return
        // 모드를 바꾸면 그 모드에 저장된 대화를 꺼낸다. 예전에는 비웠는데, 저장이 생긴 뒤로는
        // 비우는 게 곧 "사라졌다"로 읽힌다. 고른 상대는 유지 — 다시 고르게 하면 번거롭다.
        showThread(mode)
    }

    fun selectPartner(profile: Profile?) {
        _state.value = _state.value.copy(partner = profile)
    }

    fun send(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _state.value.sending) return
        val history = _state.value.messages + ChatTurn("user", trimmed)
        _state.value = _state.value.copy(messages = history, sending = true)

        val counsel = _state.value.mode == ChatMode.COUNSEL
        val selfBrief = if (counsel) self?.toBrief() else null
        val partnerBrief = if (counsel) _state.value.partner?.toBrief() else null
        remember("user", trimmed, if (counsel) _state.value.partner?.name else null)
        // 방금 쓴 질문과 겹치는 접수·안건만 고른다. 대화 전체가 아니라 이번 질문 기준이다.
        val cases = if (counsel) SimilarCases.find(trimmed, issues, agendas) else null

        viewModelScope.launch {
            val result = container.chatRepository.send(
                _state.value.mode.api, history, selfBrief, partnerBrief, cases,
            )
            val reply = result.getOrElse { "죄송해요, 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." }
            // 실패 문구는 남기지 않는다 — 다음에 열었을 때 대화에 사과문이 박혀 있으면 이상하다.
            if (result.isSuccess) remember("assistant", reply, if (counsel) _state.value.partner?.name else null)
            _state.value = _state.value.copy(
                messages = _state.value.messages + ChatTurn("assistant", reply),
                sending = false,
            )
        }
    }
}
