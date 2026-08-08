package com.hyubs.skonnection.core

import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * 웹 src/passwordHash.ts 와 동일한 형식/파라미터로 비밀번호를 해싱/검증한다.
 * 저장 형식: pbkdf2$<iterations>$<saltB64>$<hashB64>
 * (PBKDF2WithHmacSHA256, 100,000회, 256bit, salt 16바이트, 표준 Base64)
 * minSdk 26(Android 8)이라 java.util.Base64 사용 가능 — 단위테스트도 실기기 없이 동작.
 */
object PasswordHash {
    private const val ALGO = "pbkdf2"
    private const val ITERATIONS = 100_000
    private const val KEY_BITS = 256
    private const val SALT_BYTES = 16

    fun hash(password: String): String {
        val salt = ByteArray(SALT_BYTES).also { SecureRandom().nextBytes(it) }
        val derived = derive(password, salt, ITERATIONS)
        return "$ALGO\$$ITERATIONS\$${b64(salt)}\$${b64(derived)}"
    }

    fun verify(password: String, stored: String): Boolean {
        val parts = stored.split("$")
        if (parts.size != 4 || parts[0] != ALGO) return false
        val iterations = parts[1].toIntOrNull() ?: return false
        if (iterations <= 0) return false
        val salt = runCatching { b64d(parts[2]) }.getOrNull() ?: return false
        val expected = parts[3]
        val actual = b64(derive(password, salt, iterations))
        return constantTimeEquals(actual, expected)
    }

    private fun derive(password: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, KEY_BITS)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return factory.generateSecret(spec).encoded
    }

    private fun b64(bytes: ByteArray): String = java.util.Base64.getEncoder().encodeToString(bytes)
    private fun b64d(s: String): ByteArray = java.util.Base64.getDecoder().decode(s)

    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var diff = 0
        for (i in a.indices) diff = diff or (a[i].code xor b[i].code)
        return diff == 0
    }
}
