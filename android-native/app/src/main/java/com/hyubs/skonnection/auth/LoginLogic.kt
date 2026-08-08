package com.hyubs.skonnection.auth

import com.hyubs.skonnection.core.PasswordHash
import com.hyubs.skonnection.data.Account

sealed interface LoginResult {
    data class Success(val account: Account) : LoginResult
    data class FirstLogin(val email: String, val newHash: String) : LoginResult
    data class Error(val message: String) : LoginResult
}

/**
 * 웹 LoginScreen.tsx / iOS AuthService 와 동일한 로그인 규칙.
 * 이메일로 계정을 찾고 비밀번호만 검증한다(이름은 로그인에서 받지 않는다).
 */
object LoginLogic {
    private const val MIN_PASSWORD = 6

    fun attempt(accounts: List<Account>, email: String, password: String): LoginResult {
        val key = email.trim().lowercase()
        val account = accounts.firstOrNull { it.email.lowercase() == key }
            ?: return LoginResult.Error("가입된 계정이 없어요. 먼저 가입 요청을 해주세요.")

        when (account.status) {
            "승인 대기" -> return LoginResult.Error("아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요.")
            "비활성" -> return LoginResult.Error("비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요.")
        }

        val stored = account.passwordHash
        if (stored.isNullOrEmpty()) {
            if (password.length < MIN_PASSWORD) {
                return LoginResult.Error("첫 로그인이에요. 사용할 비밀번호를 ${MIN_PASSWORD}자 이상 정해주세요.")
            }
            return LoginResult.FirstLogin(account.email, PasswordHash.hash(password))
        }

        if (password.isEmpty()) return LoginResult.Error("비밀번호를 입력해주세요.")
        return if (PasswordHash.verify(password, stored)) LoginResult.Success(account)
        else LoginResult.Error("비밀번호가 일치하지 않아요.")
    }
}
