package com.hyubs.skonnection.core

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

class IssueCryptoTest {
    private val json = Json { ignoreUnknownKeys = true }

    // ── 크로스플랫폼 벡터: 웹(Node WebCrypto, issueCrypto.ts와 동일 알고리즘)으로 생성.
    //    Android 가 웹 암호문을 그대로 복호화할 수 있어야 한다(바이트 호환). ──
    private val webPlaintext = "E2E interop 벡터 · operator-must-not-read · 운영자 불가독 ✅"
    private val webPrivJwk =
        """{"key_ops":["deriveBits"],"ext":true,"kty":"EC","x":"g1WSgecAKUHHZ3dMLP0U4-Ypqt45M4h5RlwEWlF8L7s","y":"pSwU9FJwGbfDa870-QxSkxzVedI0ovzVnxOp-DrMyzQ","crv":"P-256","d":"TDhpdoPmyKUrLv0yzSAe6c47-8fNaTQHE9bXQXqsqYg"}"""
    private val webEnc =
        """{"alg":"v1:ecdh-p256+aesgcm256+hkdf-sha256+pbkdf2-210k","payload":"duifY0HBT2q7GAv/HWIrr+ZAntkadeLsql8dUaIC9TssOE2AxJCeUxspsJXJ9eODRPhOuCD4n3wJdi+lfzAIh6PuUICdQx8vLZZY1rN78iwPveCL0sI1ZVcizbI5OnNWNznz","keys":[{"accountId":"acc-1","ephemeralPub":{"key_ops":[],"ext":true,"kty":"EC","x":"2Dy2s4e6P6TMDb5swWDHAttbG0cVkfbqNKRASB9rtxQ","y":"nmNo-S5C0qUKGXn1Yd7wpuNTmNGun-x3gk1_l3XWjGA","crv":"P-256"},"wrappedCK":"u6RsLsn/PJkoAEXkP3+rNpQsDB7d+DT09cA02XoWtvdd2hx5y8wqRFz9vhJR5Y+b","iv":"MhFH+246hAtMkywL"}]}"""

    @Test fun decryptsWebGeneratedVector() {
        val priv = json.decodeFromString(IssueCrypto.Jwk.serializer(), webPrivJwk)
        val enc = json.decodeFromString(IssueCrypto.EncryptedIssue.serializer(), webEnc)
        val out = IssueCrypto.decryptAsRecipient(enc, "acc-1", priv)
        assertEquals("웹 암호문을 Android 가 그대로 복호화해야 한다", webPlaintext, out)
    }

    @Test fun roundtripSingleRecipientAndNoPlaintextInPayload() {
        val kp = IssueCrypto.generateRecipientKeypair()
        val pt = "SECRET_MARKER_KT_5R7 운영자가 못 봐야 하는 본문"
        val enc = IssueCrypto.encryptForRecipients(pt, listOf("acc-A" to kp.publicJwk))
        // 라운드트립 일치
        assertEquals(pt, IssueCrypto.decryptAsRecipient(enc, "acc-A", kp.privateJwk))
        // payload(암호문)에 평문이 남지 않는다
        val raw = Base64.getDecoder().decode(enc.payload)
        val rawStr = String(raw, Charsets.ISO_8859_1)
        assertFalse("payload 에 평문 마커가 남으면 안 된다", rawStr.contains("SECRET_MARKER_KT_5R7"))
        assertEquals(IssueCrypto.ALG, enc.alg)
    }

    @Test fun multiRecipientEachDecryptsOwnAndNonRecipientFails() {
        val a = IssueCrypto.generateRecipientKeypair()
        val b = IssueCrypto.generateRecipientKeypair()
        val c = IssueCrypto.generateRecipientKeypair() // 수신자 아님
        val pt = "다중 수신자 본문"
        val enc = IssueCrypto.encryptForRecipients(pt, listOf("A" to a.publicJwk, "B" to b.publicJwk))
        assertEquals(pt, IssueCrypto.decryptAsRecipient(enc, "A", a.privateJwk))
        assertEquals(pt, IssueCrypto.decryptAsRecipient(enc, "B", b.privateJwk))
        // 수신자 목록에 없는 계정 → 항목 없음으로 실패
        var threwNoEntry = false
        try { IssueCrypto.decryptAsRecipient(enc, "C", c.privateJwk) } catch (e: Exception) { threwNoEntry = true }
        assertTrue("비수신자는 복호화 실패해야 한다", threwNoEntry)
        // 남의 항목을 내 키로 열려 하면 GCM 인증 실패
        var threwBadKey = false
        try { IssueCrypto.decryptAsRecipient(enc, "A", b.privateJwk) } catch (e: Exception) { threwBadKey = true }
        assertTrue("틀린 개인키로는 복호화 실패해야 한다", threwBadKey)
    }

    @Test fun wrapUnwrapPrivateKeyRoundtripAndWrongSecretFails() {
        val kp = IssueCrypto.generateRecipientKeypair()
        val wrapped = IssueCrypto.wrapPrivateKey(kp.privateJwk, "passphrase-1234")
        val unwrapped = IssueCrypto.unwrapPrivateKey(wrapped, "passphrase-1234")
        assertEquals(kp.privateJwk.d, unwrapped.d)
        assertEquals(kp.privateJwk.x, unwrapped.x)
        var threw = false
        try { IssueCrypto.unwrapPrivateKey(wrapped, "wrong-secret") } catch (e: Exception) { threw = true }
        assertTrue("틀린 패스프레이즈는 실패해야 한다", threw)
    }

    @Test fun recoveryCodeFormat() {
        val code = IssueCrypto.generateRecoveryCode()
        // 32 base32 문자 + 7 하이픈 = 39자, 4자 그룹
        assertEquals(39, code.length)
        assertEquals(8, code.split("-").size)
        code.split("-").forEach { assertEquals(4, it.length) }
        assertNotEquals(code, IssueCrypto.generateRecoveryCode()) // 매번 다름
    }
}
