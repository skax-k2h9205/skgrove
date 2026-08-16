package com.hyubs.skonnection.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.net.SupabaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    val loggedInEmail: String? = null,
    val sessionResolved: Boolean = false,
    /** 신규 Slack 사용자(파트 미상) — 값이 있으면 파트 선택 화면을 띄운다. */
    val needsPartFor: SupabaseAuth.Identity? = null,
)

/**
 * 인증 — 웹·iOS(SupabaseAuth/LoginView)와 **동일 절차**: 이메일+비번+6자리 OTP.
 * 로그인/가입/가입OTP검증/비번재설정. 성공 시 accounts 에서 계정을 해석(없으면 가입 정보로 생성)하고
 * 이메일로 세션을 저장한다. onNeedOtp/onSent/onDone 콜백으로 화면이 단계를 넘긴다.
 */
class AuthViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()
    private val MIN_PASSWORD = 6

    init {
        viewModelScope.launch {
            container.sessionStore.currentEmail.collect { email ->
                runCatching { container.refreshCurrentUser(email) }
                _state.value = _state.value.copy(loggedInEmail = email, sessionResolved = true)
            }
        }
        // Slack 딥링크로 돌아온 인가 코드를 감시 → 세션 교환.
        viewModelScope.launch {
            container.pendingSlackCode.collect { code ->
                if (!code.isNullOrBlank()) { container.pendingSlackCode.value = null; completeSlackLogin(code) }
            }
        }
    }

    private fun busy() { _state.value = _state.value.copy(loading = true, error = null, notice = null) }
    private fun fail(msg: String) { _state.value = _state.value.copy(loading = false, error = msg) }
    private fun done(notice: String? = null) { _state.value = _state.value.copy(loading = false, notice = notice) }

    /** resolveAndSession 결과 — Ok(로그인), Failed(오류), NeedsPart(신규 Slack, 파트 선택 필요). */
    private sealed interface Resolution {
        data object Ok : Resolution
        data class Failed(val message: String) : Resolution
        data class NeedsPart(val id: SupabaseAuth.Identity) : Resolution
    }

    /** 인증 성공 → accounts 해석(없으면 가입 정보로 생성) → 세션 저장. */
    private suspend fun resolveAndSession(id: SupabaseAuth.Identity): Resolution {
        val accounts = runCatching { container.accountRepository.loadAll() }.getOrDefault(emptyList())
        val acc = accounts.firstOrNull { it.email.equals(id.email, ignoreCase = true) }
        if (acc != null) {
            when (acc.status) {
                "비활성" -> return Resolution.Failed("비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요.")
                "승인 대기" -> return Resolution.Failed("아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요.")
            }
            container.sessionStore.save(acc.email)
            return Resolution.Ok
        }
        // 신규: 이름·파트가 있으면 바로 생성, 파트만 없으면(신규 Slack) 파트 선택으로.
        if (id.name.isNullOrBlank()) return Resolution.Failed("계정 정보가 부족해요. 가입할 때 이름과 소속 파트를 함께 입력해 주세요.")
        if (id.part.isNullOrBlank()) return Resolution.NeedsPart(id)
        // 계정 생성이 성공했을 때만 세션을 저장한다(실패 시 계정 없는 채로 로그인되는 것 방지).
        val created = runCatching { container.accountRepository.create(id.name, id.email, id.part, id.uid) }.isSuccess
        if (!created) return Resolution.Failed("계정 생성에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.")
        container.sessionStore.save(id.email)
        return Resolution.Ok
    }

    /** resolveAndSession 결과를 UI 상태로 반영. */
    private fun applyResolution(r: Resolution) = when (r) {
        is Resolution.Ok -> done()
        is Resolution.Failed -> fail(r.message)
        is Resolution.NeedsPart -> _state.value = _state.value.copy(loading = false, error = null, notice = null, needsPartFor = r.id)
    }

    /** 신규 Slack 사용자가 파트를 고르면 그 파트로 계정을 만들고 로그인시킨다. */
    fun confirmSlackPart(part: String) {
        val id = _state.value.needsPartFor ?: return
        viewModelScope.launch {
            busy()
            val created = runCatching { container.accountRepository.create(id.name ?: "팀원", id.email, part, id.uid) }.isSuccess
            if (!created) { _state.value = _state.value.copy(loading = false, error = "계정 생성에 실패했어요. 다시 시도해주세요.") ; return@launch }
            _state.value = _state.value.copy(needsPartFor = null)
            container.sessionStore.save(id.email)
            done()
        }
    }

    /** 파트 선택을 취소하면 프롬프트를 닫고 로그인 화면으로 돌아간다. */
    fun cancelSlackPart() {
        _state.value = _state.value.copy(needsPartFor = null, loading = false)
    }

    fun login(email: String, password: String) {
        if (!SupabaseAuth.isCompanyEmail(email)) { fail("사내메일은 @sk.com 계정만 사용할 수 있어요."); return }
        viewModelScope.launch {
            busy()
            try {
                val id = container.supabaseAuth.signInEmail(email.trim(), password)
                applyResolution(resolveAndSession(id))
            } catch (e: SupabaseAuth.AuthException) {
                fail(e.message ?: "로그인에 실패했어요.")
            } catch (t: Throwable) {
                fail("네트워크 오류로 로그인에 실패했어요. 잠시 후 다시 시도해주세요.")
            }
        }
    }

    fun signup(email: String, password: String, name: String, part: String, onNeedOtp: () -> Unit) {
        if (!SupabaseAuth.isCompanyEmail(email)) { fail("사내메일은 @sk.com 계정만 사용할 수 있어요."); return }
        if (name.isBlank()) { fail("이름을 입력해주세요."); return }
        if (password.length < MIN_PASSWORD) { fail("비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요."); return }
        viewModelScope.launch {
            busy()
            try {
                val needOtp = container.supabaseAuth.signUpEmail(email.trim(), password, name.trim(), part)
                if (needOtp) { done("메일로 6자리 인증 코드를 보냈어요."); onNeedOtp() }
                else {
                    val id = container.supabaseAuth.signInEmail(email.trim(), password)
                    applyResolution(resolveAndSession(id.copy(name = name.trim(), part = part)))
                }
            } catch (e: SupabaseAuth.AuthException) {
                fail(if (e.alreadyRegistered) "이미 가입된 사내메일이에요. 로그인하거나 비밀번호 찾기를 이용해주세요." else (e.message ?: "가입에 실패했어요."))
            } catch (t: Throwable) {
                fail("네트워크 오류로 가입에 실패했어요.")
            }
        }
    }

    fun verifySignup(email: String, code: String, name: String, part: String) {
        if (code.isBlank()) { fail("인증 코드를 입력해 주세요."); return }
        viewModelScope.launch {
            busy()
            try {
                val id = container.supabaseAuth.verifySignupOTP(email.trim(), code.trim())
                applyResolution(resolveAndSession(id.copy(name = id.name ?: name.trim(), part = id.part ?: part)))
            } catch (e: SupabaseAuth.AuthException) {
                fail(e.message ?: "인증에 실패했어요.")
            } catch (t: Throwable) {
                fail("네트워크 오류로 인증에 실패했어요.")
            }
        }
    }

    fun requestReset(email: String, onSent: () -> Unit) {
        if (!SupabaseAuth.isCompanyEmail(email)) { fail("사내메일은 @sk.com 계정만 사용할 수 있어요."); return }
        viewModelScope.launch {
            busy()
            // 가입 여부를 노출하지 않도록 성공/실패 무관하게 안내 후 다음 단계로.
            runCatching { container.supabaseAuth.requestReset(email.trim()) }
            done("가입된 계정이라면 메일로 재설정 코드를 보냈어요.")
            onSent()
        }
    }

    fun confirmReset(email: String, code: String, newPassword: String, confirm: String, onDone: () -> Unit) {
        if (newPassword.length < MIN_PASSWORD) { fail("새 비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요."); return }
        if (newPassword != confirm) { fail("두 비밀번호가 서로 달라요."); return }
        viewModelScope.launch {
            busy()
            try {
                container.supabaseAuth.confirmReset(email.trim(), code.trim(), newPassword)
                done("비밀번호가 바뀌었어요. 새 비밀번호로 로그인해 주세요.")
                onDone()
            } catch (e: SupabaseAuth.AuthException) {
                fail(e.message ?: "재설정에 실패했어요.")
            } catch (t: Throwable) {
                fail("네트워크 오류로 재설정에 실패했어요.")
            }
        }
    }

    /** "Slack으로 로그인" — PKCE 를 만들어 보관하고 authorize URL 을 launch(브라우저)로 넘긴다. */
    fun startSlackLogin(launch: (String) -> Unit) {
        viewModelScope.launch {
            busy()
            try {
                val pkce = container.supabaseAuth.newPkce()
                container.sessionStore.saveSlackVerifier(pkce.verifier)
                launch(container.supabaseAuth.slackAuthorizeUrl(pkce.challenge))
                // 브라우저로 넘어가므로 로딩 표시는 콜백 전까지 유지하지 않는다.
                _state.value = _state.value.copy(loading = false)
            } catch (t: Throwable) {
                fail("Slack 로그인을 시작하지 못했어요.")
            }
        }
    }

    /** 딥링크로 돌아온 code → 세션 교환 → 계정 해석. */
    fun completeSlackLogin(code: String) {
        viewModelScope.launch {
            busy()
            try {
                val verifier = container.sessionStore.takeSlackVerifier()
                    ?: return@launch fail("Slack 로그인이 만료됐어요. 다시 시도해주세요.")
                val id = container.supabaseAuth.exchangeSlackCode(code, verifier)
                if (id.email.isBlank()) return@launch fail("Slack 계정에서 이메일을 확인하지 못했어요.")
                applyResolution(resolveAndSession(id))
            } catch (e: SupabaseAuth.AuthException) {
                fail(e.message ?: "Slack 로그인에 실패했어요.")
            } catch (t: Throwable) {
                fail("네트워크 오류로 Slack 로그인에 실패했어요.")
            }
        }
    }

    fun clearMessages() { _state.value = _state.value.copy(error = null, notice = null) }

    fun logout() {
        viewModelScope.launch { container.sessionStore.clear() }
    }
}
