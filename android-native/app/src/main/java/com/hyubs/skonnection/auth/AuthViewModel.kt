package com.hyubs.skonnection.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val loggedInEmail: String? = null,
    val sessionResolved: Boolean = false,
)

class AuthViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            container.sessionStore.currentEmail.collect { email ->
                _state.value = _state.value.copy(loggedInEmail = email, sessionResolved = true)
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val result = try {
                val accounts = container.accountRepository.loadAll()
                LoginLogic.attempt(accounts, email, password)
            } catch (t: Throwable) {
                LoginResult.Error("네트워크 오류로 로그인에 실패했어요. 잠시 후 다시 시도해주세요.")
            }
            when (result) {
                is LoginResult.Success -> {
                    container.sessionStore.save(result.account.email)
                    _state.value = _state.value.copy(loading = false)
                }
                is LoginResult.FirstLogin -> {
                    // M0: 첫 로그인 시 비밀번호의 Supabase 저장은 후속 단계에서. 지금은 세션만 부여.
                    container.sessionStore.save(result.email)
                    _state.value = _state.value.copy(loading = false)
                }
                is LoginResult.Error ->
                    _state.value = _state.value.copy(loading = false, error = result.message)
            }
        }
    }

    fun logout() {
        viewModelScope.launch { container.sessionStore.clear() }
    }
}
