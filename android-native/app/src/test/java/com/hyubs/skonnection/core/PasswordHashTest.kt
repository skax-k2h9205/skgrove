package com.hyubs.skonnection.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PasswordHashTest {
    // 웹/파이썬(passwordHash.ts와 동일 알고리즘)으로 "admin123"에 대해 생성한 고정 벡터.
    // Android verify 가 웹 저장값을 그대로 검증할 수 있어야 한다(크로스 플랫폼 호환).
    private val webVector =
        "pbkdf2\$100000\$MDEyMzQ1Njc4OWFiY2RlZg==\$uPtNBdODS3xaM0ReibZXfoov2Q95BgyTxghoqkEp3BI="

    @Test fun verifiesWebGeneratedHash() {
        assertTrue(PasswordHash.verify("admin123", webVector))
    }

    @Test fun verifyRejectsWrongPassword() {
        assertFalse(PasswordHash.verify("wrong", webVector))
    }

    @Test fun malformedStoredRejected() {
        assertFalse(PasswordHash.verify("x", "not-a-valid-hash"))
    }

    @Test fun hashThenVerifyRoundtrips() {
        val made = PasswordHash.hash("hello-team-123")
        assertTrue(made.startsWith("pbkdf2\$100000\$"))
        assertTrue(PasswordHash.verify("hello-team-123", made))
        assertFalse(PasswordHash.verify("nope", made))
    }
}
