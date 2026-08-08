package com.hyubs.skonnection.auth

import com.hyubs.skonnection.core.PasswordHash
import com.hyubs.skonnection.data.Account
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LoginLogicTest {
    private fun acc(email: String, status: String = "활성", hash: String? = null) =
        Account("id-$email", "이름", email, "팀원", "전체", status, false, null, null, hash)

    @Test fun unknownEmailErrors() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com")), "b@sk.com", "pw1234")
        assertTrue(r is LoginResult.Error)
        assertEquals("가입된 계정이 없어요. 먼저 가입 요청을 해주세요.", (r as LoginResult.Error).message)
    }

    @Test fun pendingStatusBlocked() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", status = "승인 대기")), "a@sk.com", "pw1234")
        assertTrue(r is LoginResult.Error)
    }

    @Test fun firstLoginSetsPassword() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = null)), "a@sk.com", "pw1234")
        assertTrue(r is LoginResult.FirstLogin)
        assertTrue((r as LoginResult.FirstLogin).newHash.startsWith("pbkdf2"))
    }

    @Test fun firstLoginTooShortErrors() {
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = null)), "a@sk.com", "123")
        assertTrue(r is LoginResult.Error)
    }

    @Test fun correctPasswordSucceedsCaseInsensitiveEmail() {
        val hash = PasswordHash.hash("pw1234")
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = hash)), "A@SK.com", "pw1234")
        assertTrue(r is LoginResult.Success)
    }

    @Test fun wrongPasswordErrors() {
        val hash = PasswordHash.hash("pw1234")
        val r = LoginLogic.attempt(listOf(acc("a@sk.com", hash = hash)), "a@sk.com", "nope")
        assertEquals("비밀번호가 일치하지 않아요.", (r as LoginResult.Error).message)
    }
}
