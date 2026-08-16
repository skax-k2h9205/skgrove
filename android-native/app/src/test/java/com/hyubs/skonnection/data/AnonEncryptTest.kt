package com.hyubs.skonnection.data

import org.junit.Assert.assertEquals
import org.junit.Test

class AnonEncryptTest {
    // 웹 issueEncryptionPolicy / iOS AnonEncrypt.plan 과 동일한 정책이어야 한다.
    @Test fun anonymousAlwaysEncryptsWithoutAuthor() {
        assertEquals(AnonEncrypt.Plan(encrypt = true, includeAuthor = false), AnonEncrypt.plan("익명", "리더만 보기"))
        assertEquals(AnonEncrypt.Plan(encrypt = true, includeAuthor = false), AnonEncrypt.plan("익명", "안건 후보로 공개 가능"))
    }

    @Test fun namedLeaderOnlyEncryptsWithAuthor() {
        assertEquals(AnonEncrypt.Plan(encrypt = true, includeAuthor = true), AnonEncrypt.plan("실명", "리더만 보기"))
    }

    @Test fun namedPublicIsPlaintext() {
        assertEquals(AnonEncrypt.Plan(encrypt = false, includeAuthor = false), AnonEncrypt.plan("실명", "안건 후보로 공개 가능"))
    }
}
