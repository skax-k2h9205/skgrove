package com.hyubs.skonnection.feature.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.core.loadOrNull
import com.hyubs.skonnection.data.ChatTurn
import com.hyubs.skonnection.data.Agenda
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

class ChatViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(ChatUiState())
    val state = _state.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)

    /** 내 성향. 서버가 "나와 상대의 언어를 서로 번역"하는 데 쓴다. */
    private var self: Profile? = null

    // 유사 사례를 찾을 원본. 질문마다 다시 읽지 않고 화면을 열 때 한 번만 읽는다.
    private var issues: List<Issue> = emptyList()
    private var agendas: List<Agenda> = emptyList()

    init { loadProfiles(); loadCasePool() }

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
        // 모드를 바꾸면 대화만 초기화한다(웹과 동일). 고른 상대는 유지 — 다시 고르게 하면 번거롭다.
        _state.value = _state.value.copy(mode = mode, messages = emptyList(), sending = false)
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
        // 방금 쓴 질문과 겹치는 접수·안건만 고른다. 대화 전체가 아니라 이번 질문 기준이다.
        val cases = if (counsel) SimilarCases.find(trimmed, issues, agendas) else null

        viewModelScope.launch {
            val result = container.chatRepository.send(
                _state.value.mode.api, history, selfBrief, partnerBrief, cases,
            )
            val reply = result.getOrElse { "죄송해요, 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." }
            _state.value = _state.value.copy(
                messages = _state.value.messages + ChatTurn("assistant", reply),
                sending = false,
            )
        }
    }
}
