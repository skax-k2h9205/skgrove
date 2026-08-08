package com.hyubs.skonnection.feature.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.ChatTurn
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
)

class ChatViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(ChatUiState())
    val state = _state.asStateFlow()

    fun switchMode(mode: ChatMode) {
        if (mode == _state.value.mode) return
        _state.value = ChatUiState(mode = mode) // 모드 바꾸면 대화 초기화(웹과 동일)
    }

    fun send(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _state.value.sending) return
        val history = _state.value.messages + ChatTurn("user", trimmed)
        _state.value = _state.value.copy(messages = history, sending = true)
        viewModelScope.launch {
            val result = container.chatRepository.send(_state.value.mode.api, history)
            val reply = result.getOrElse { "죄송해요, 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." }
            _state.value = _state.value.copy(
                messages = _state.value.messages + ChatTurn("assistant", reply),
                sending = false,
            )
        }
    }
}
