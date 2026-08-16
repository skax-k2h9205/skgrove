package com.hyubs.skonnection.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPrivateKeySpec
import java.security.spec.ECPublicKeySpec
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * 대나무숲 글 종단간(E2E) 암호화 코어 — 웹 `issueCrypto.ts`·iOS `IssueCrypto.swift`와 **바이트 호환**.
 *
 * 모델(하이브리드): 본문은 랜덤 콘텐츠키 CK(AES-256-GCM)로 1회 암호화하고, CK 를 각 수신자
 * 공개키로 감싼다(ephemeral ECDH P-256 → HKDF-SHA256 → AES-256-GCM). 리더 개인키(JWK)는
 * 패스프레이즈/복구코드로 각각 감싸(PBKDF2 210k → AES-GCM) 서버에 암호문만 저장한다.
 * 운영자(서버)는 공개키·암호문만 보므로 본문을 복호화할 수 없다.
 *
 * 바이트 호환 핵심: ECDH 공유비밀=X좌표 32B 고정, HKDF salt=빈값→HashLen(32) zero·info=ALG,
 * AES-GCM 출력=ciphertext‖tag(128b), payload=iv(12)‖ct, JWK 좌표는 base64url·그 외 표준 base64.
 */
object IssueCrypto {
    const val ALG = "v1:ecdh-p256+aesgcm256+hkdf-sha256+pbkdf2-210k"
    private const val PBKDF2_ITERATIONS = 210_000
    private val rng = SecureRandom()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // ── JWK / 타입 (웹·iOS와 필드 호환) ──
    @Serializable
    data class Jwk(
        val kty: String = "EC",
        val crv: String = "P-256",
        val x: String,
        val y: String,
        val d: String? = null,
    )

    @Serializable
    data class WrappedKey(val salt: String, val iv: String, val ciphertext: String)

    @Serializable
    data class RecipientKey(
        val accountId: String,
        val ephemeralPub: Jwk,
        val wrappedCK: String,
        val iv: String,
    )

    @Serializable
    data class EncryptedIssue(val alg: String, val payload: String, val keys: List<RecipientKey>)

    data class Keypair(val publicJwk: Jwk, val privateJwk: Jwk)

    // ── P-256 파라미터 ──
    private val p256: ECParameterSpec by lazy {
        val params = AlgorithmParameters.getInstance("EC")
        params.init(ECGenParameterSpec("secp256r1"))
        params.getParameterSpec(ECParameterSpec::class.java)
    }

    // ── base64: 좌표는 base64url(무패딩), 그 외는 표준 ──
    private val b64 = Base64.getEncoder()
    private val b64d = Base64.getDecoder()
    private val b64url = Base64.getUrlEncoder().withoutPadding()
    private val b64urld = Base64.getUrlDecoder()

    private fun randomBytes(n: Int): ByteArray = ByteArray(n).also { rng.nextBytes(it) }

    /** BigInteger → 부호 없는 고정 길이(32B) 빅엔디안. leading-zero 벗겨짐/부호바이트 정규화. */
    private fun fixed32(v: BigInteger): ByteArray {
        var b = v.toByteArray()
        if (b.size == 33 && b[0].toInt() == 0) b = b.copyOfRange(1, 33) // 부호 바이트 제거
        if (b.size == 32) return b
        val out = ByteArray(32)
        System.arraycopy(b, 0, out, 32 - b.size, b.size) // 좌측 zero 패딩
        return out
    }

    // ── 키페어 ──
    fun generateRecipientKeypair(): Keypair {
        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(ECGenParameterSpec("secp256r1"), rng)
        val kp = kpg.generateKeyPair()
        val pub = kp.public as ECPublicKey
        val priv = kp.private as ECPrivateKey
        val x = b64url.encodeToString(fixed32(pub.w.affineX))
        val y = b64url.encodeToString(fixed32(pub.w.affineY))
        val d = b64url.encodeToString(fixed32(priv.s))
        return Keypair(Jwk(x = x, y = y), Jwk(x = x, y = y, d = d))
    }

    private fun pubFromJwk(j: Jwk): ECPublicKey {
        val x = BigInteger(1, b64urld.decode(j.x))
        val y = BigInteger(1, b64urld.decode(j.y))
        val spec = ECPublicKeySpec(ECPoint(x, y), p256)
        return KeyFactory.getInstance("EC").generatePublic(spec) as ECPublicKey
    }

    private fun privFromJwk(j: Jwk): ECPrivateKey {
        val d = BigInteger(1, b64urld.decode(j.d ?: error("private JWK 아님")))
        val spec = ECPrivateKeySpec(d, p256)
        return KeyFactory.getInstance("EC").generatePrivate(spec) as ECPrivateKey
    }

    // ── ECDH 공유비밀 X좌표(32B 고정) ──
    private fun ecdhX(priv: ECPrivateKey, pub: ECPublicKey): ByteArray {
        val ka = KeyAgreement.getInstance("ECDH")
        ka.init(priv)
        ka.doPhase(pub, true)
        val secret = ka.generateSecret()
        if (secret.size == 32) return secret
        val out = ByteArray(32)
        System.arraycopy(secret, maxOf(0, secret.size - 32), out, maxOf(0, 32 - secret.size), minOf(secret.size, 32))
        return out
    }

    // ── HKDF-SHA256 (표준 라이브러리 없음 → HMAC 수동). salt 빈값=HashLen(32) zero ──
    private fun hkdf(ikm: ByteArray, salt: ByteArray, info: ByteArray, len: Int): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        val actualSalt = if (salt.isEmpty()) ByteArray(32) else salt
        mac.init(SecretKeySpec(actualSalt, "HmacSHA256"))
        val prk = mac.doFinal(ikm) // extract
        mac.init(SecretKeySpec(prk, "HmacSHA256"))
        val out = ByteArray(len)
        var t = ByteArray(0)
        var pos = 0
        var counter = 1
        while (pos < len) {
            mac.update(t)
            mac.update(info)
            mac.update(counter.toByte())
            t = mac.doFinal()
            val n = minOf(t.size, len - pos)
            System.arraycopy(t, 0, out, pos, n)
            pos += n
            counter += 1
        }
        return out
    }

    private fun deriveSharedAesKey(priv: ECPrivateKey, pub: ECPublicKey): ByteArray =
        hkdf(ecdhX(priv, pub), ByteArray(0), ALG.toByteArray(Charsets.UTF_8), 32)

    private fun aesGcmEncrypt(key: ByteArray, iv: ByteArray, plaintext: ByteArray): ByteArray {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
        return c.doFinal(plaintext) // ciphertext‖tag
    }

    private fun aesGcmDecrypt(key: ByteArray, iv: ByteArray, ctAndTag: ByteArray): ByteArray {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
        return c.doFinal(ctAndTag)
    }

    // ── 개인키 감싸기(패스프레이즈/복구코드 공통, PBKDF2 210k → AES-GCM) ──
    private fun deriveWrapKey(secret: String, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(secret.toCharArray(), salt, PBKDF2_ITERATIONS, 256)
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    }

    fun wrapPrivateKey(privateJwk: Jwk, secret: String): WrappedKey {
        val salt = randomBytes(16)
        val iv = randomBytes(12)
        val key = deriveWrapKey(secret, salt)
        val ct = aesGcmEncrypt(key, iv, json.encodeToString(Jwk.serializer(), privateJwk).toByteArray(Charsets.UTF_8))
        return WrappedKey(b64.encodeToString(salt), b64.encodeToString(iv), b64.encodeToString(ct))
    }

    fun unwrapPrivateKey(wrapped: WrappedKey, secret: String): Jwk {
        val key = deriveWrapKey(secret, b64d.decode(wrapped.salt))
        val pt = aesGcmDecrypt(key, b64d.decode(wrapped.iv), b64d.decode(wrapped.ciphertext))
        return json.decodeFromString(Jwk.serializer(), String(pt, Charsets.UTF_8))
    }

    // ── 본문 암호화: 랜덤 CK로 1회 암호화 → 각 수신자 공개키로 CK 감싸기 ──
    fun encryptForRecipients(plaintext: String, recipients: List<Pair<String, Jwk>>): EncryptedIssue {
        require(recipients.isNotEmpty()) { "수신자가 없습니다" }
        val rawCk = randomBytes(32)
        val payloadIv = randomBytes(12)
        val payloadCt = aesGcmEncrypt(rawCk, payloadIv, plaintext.toByteArray(Charsets.UTF_8))
        val payloadBytes = payloadIv + payloadCt // iv(12) ‖ ciphertext‖tag

        val keys = recipients.map { (accountId, pubJwk) ->
            val recipientPub = pubFromJwk(pubJwk)
            val kpg = KeyPairGenerator.getInstance("EC")
            kpg.initialize(ECGenParameterSpec("secp256r1"), rng)
            val eph = kpg.generateKeyPair()
            val wrapKey = deriveSharedAesKey(eph.private as ECPrivateKey, recipientPub)
            val iv = randomBytes(12)
            val wrappedCK = aesGcmEncrypt(wrapKey, iv, rawCk)
            val ephPub = eph.public as ECPublicKey
            RecipientKey(
                accountId = accountId,
                ephemeralPub = Jwk(
                    x = b64url.encodeToString(fixed32(ephPub.w.affineX)),
                    y = b64url.encodeToString(fixed32(ephPub.w.affineY)),
                ),
                wrappedCK = b64.encodeToString(wrappedCK),
                iv = b64.encodeToString(iv),
            )
        }
        return EncryptedIssue(ALG, b64.encodeToString(payloadBytes), keys)
    }

    fun decryptAsRecipient(enc: EncryptedIssue, accountId: String, privateJwk: Jwk): String {
        val entry = enc.keys.firstOrNull { it.accountId == accountId }
            ?: error("이 계정으로 암호화된 항목이 없습니다")
        val priv = privFromJwk(privateJwk)
        val ephPub = pubFromJwk(entry.ephemeralPub)
        val wrapKey = deriveSharedAesKey(priv, ephPub)
        val rawCk = aesGcmDecrypt(wrapKey, b64d.decode(entry.iv), b64d.decode(entry.wrappedCK))

        val payloadBytes = b64d.decode(enc.payload)
        val iv = payloadBytes.copyOfRange(0, 12)
        val ct = payloadBytes.copyOfRange(12, payloadBytes.size)
        return String(aesGcmDecrypt(rawCk, iv, ct), Charsets.UTF_8)
    }

    // ── 복구코드: 16B 랜덤 → Crockford base32 → 4자 그룹 (웹과 동일 규칙) ──
    private const val BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // I,L,O,U 제외
    fun generateRecoveryCode(): String {
        val bytes = randomBytes(16)
        val sb = StringBuilder()
        for (b in bytes) {
            val ub = b.toInt() and 0xFF
            sb.append(BASE32[ub and 31]).append(BASE32[(ub shr 3) and 31])
        }
        return sb.toString().chunked(4).joinToString("-")
    }
}
