package com.hyubs.skonnection.net

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Supabase Auth REST — 웹·iOS(`SupabaseAuth.swift`)와 **동일 절차**: 이메일+비번+6자리 OTP.
 * gotrue 엔드포인트(auth/v1)를 Ktor 로 직접 호출한다(anon 키). 로그인/가입/가입OTP검증/
 * 비번재설정 요청/재설정확인 제공. 세션 토큰은 보관하지 않고(앱은 이메일로 세션 관리),
 * 재설정 확정 때만 임시 access_token 으로 비번을 바꾼다.
 */
class SupabaseAuth(private val http: HttpClient) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val base = "${SupabaseConfig.URL}/auth/v1"

    data class Identity(val email: String, val uid: String, val name: String?, val part: String?)
    class AuthException(message: String, val alreadyRegistered: Boolean = false) : Exception(message)

    // ── 요청 DTO ──
    @Serializable private data class SignInReq(val email: String, val password: String)
    @Serializable private data class SignUpData(@SerialName("full_name") val fullName: String, val part: String)
    @Serializable private data class SignUpReq(val email: String, val password: String, val data: SignUpData)
    @Serializable private data class VerifyReq(val type: String, val email: String, val token: String)
    @Serializable private data class RecoverReq(val email: String)
    @Serializable private data class PasswordReq(val password: String)

    // ── 응답 DTO ──
    @Serializable private data class Meta(
        @SerialName("full_name") val fullName: String? = null,
        val part: String? = null,
        val name: String? = null,
        @SerialName("preferred_username") val preferredUsername: String? = null,
    )
    @Serializable private data class User(val id: String = "", val email: String? = null, @SerialName("user_metadata") val meta: Meta? = null)
    @Serializable private data class AuthResp(
        @SerialName("access_token") val accessToken: String? = null,
        val user: User? = null,
        val id: String? = null, // 가입(이메일확인 필요) 응답은 User 를 최상위로 준다
        val email: String? = null,
        @SerialName("user_metadata") val meta: Meta? = null,
        @SerialName("error_description") val errorDescription: String? = null,
        val msg: String? = null,
        @SerialName("error_code") val errorCode: String? = null,
    )

    private suspend fun postJson(path: String, body: String, bearer: String? = null): HttpResponse =
        http.post("$base/$path") {
            header("apikey", SupabaseConfig.ANON_KEY)
            header("Authorization", "Bearer ${bearer ?: SupabaseConfig.ANON_KEY}")
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    private fun identityFrom(r: AuthResp): Identity {
        val u = r.user
        val meta = u?.meta ?: r.meta
        return Identity(email = u?.email ?: r.email ?: "", uid = u?.id ?: r.id ?: "", name = meta?.fullName, part = meta?.part)
    }

    /** 이메일+비번 로그인(gotrue password grant). */
    suspend fun signInEmail(email: String, password: String): Identity {
        val resp = postJson("token?grant_type=password", json.encodeToString(SignInReq.serializer(), SignInReq(email, password)))
        val r = json.decodeFromString(AuthResp.serializer(), resp.bodyAsText())
        if (!resp.status.isSuccess() || r.accessToken == null) throw AuthException(r.errorDescription ?: r.msg ?: "로그인에 실패했어요.")
        return identityFrom(r)
    }

    /**
     * 가입. 이메일 확인이 켜져 있으면 needOTP=true(메일로 6자리) → verifySignupOTP 로 이어진다.
     * name/part 는 user_metadata 로 실어 신규 계정 생성에 쓴다.
     */
    suspend fun signUpEmail(email: String, password: String, name: String, part: String): Boolean {
        val resp = postJson("signup", json.encodeToString(SignUpReq.serializer(), SignUpReq(email, password, SignUpData(name, part))))
        val text = resp.bodyAsText()
        val r = json.decodeFromString(AuthResp.serializer(), text)
        if (!resp.status.isSuccess()) {
            val already = r.errorCode == "user_already_exists" || text.contains("already registered", true)
            throw AuthException(r.msg ?: r.errorDescription ?: "가입에 실패했어요.", alreadyRegistered = already)
        }
        return r.accessToken == null // 세션 없으면 이메일 확인(OTP) 필요
    }

    /** 가입 OTP 검증 → 세션 확보 + 신원 반환. */
    suspend fun verifySignupOTP(email: String, code: String): Identity {
        val resp = postJson("verify", json.encodeToString(VerifyReq.serializer(), VerifyReq("signup", email, code)))
        val r = json.decodeFromString(AuthResp.serializer(), resp.bodyAsText())
        if (!resp.status.isSuccess() || r.accessToken == null) throw AuthException("인증 코드가 맞지 않아요.")
        return identityFrom(r)
    }

    /** 비밀번호 재설정 코드 요청(가입된 계정이면 메일 발송). */
    suspend fun requestReset(email: String) {
        postJson("recover", json.encodeToString(RecoverReq.serializer(), RecoverReq(email)))
    }

    /** 재설정 코드 검증 → 임시 세션으로 새 비밀번호 설정. */
    suspend fun confirmReset(email: String, code: String, newPassword: String) {
        val resp = postJson("verify", json.encodeToString(VerifyReq.serializer(), VerifyReq("recovery", email, code)))
        val r = json.decodeFromString(AuthResp.serializer(), resp.bodyAsText())
        val token = r.accessToken ?: throw AuthException("재설정 코드가 맞지 않아요.")
        val put = http.put("$base/user") {
            header("apikey", SupabaseConfig.ANON_KEY)
            header("Authorization", "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(PasswordReq.serializer(), PasswordReq(newPassword)))
        }
        if (!put.status.isSuccess()) throw AuthException("비밀번호 변경에 실패했어요.")
    }

    // ── Slack(OIDC) 로그인 — 웹 startSlackLogin · iOS signInWithSlack 규약 이식 ──
    // supabase-swift 가 자동 처리하던 PKCE·브라우저 왕복·토큰 교환을 gotrue REST 로 직접 구현한다.

    /** PKCE 한 쌍. verifier 는 콜백까지 보관, challenge 는 authorize URL 에 싣는다. */
    data class Pkce(val verifier: String, val challenge: String)

    /** code_verifier(랜덤 32B base64url) + code_challenge(SHA-256 → base64url). */
    fun newPkce(): Pkce {
        val bytes = ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }
        val enc = java.util.Base64.getUrlEncoder().withoutPadding()
        val verifier = enc.encodeToString(bytes)
        val digest = java.security.MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
        return Pkce(verifier, enc.encodeToString(digest))
    }

    /** Slack 로그인 authorize URL. redirect_to/딥링크는 Supabase Redirect URLs 허용목록과 같아야 한다. */
    fun slackAuthorizeUrl(challenge: String): String {
        val redirect = java.net.URLEncoder.encode(SLACK_REDIRECT, "UTF-8")
        return "$base/authorize?provider=slack_oidc&flow_type=pkce" +
            "&redirect_to=$redirect&code_challenge=$challenge&code_challenge_method=s256&scopes=openid+email+profile" +
            (if (SLACK_TEAM_ID.isNotBlank()) "&team=$SLACK_TEAM_ID" else "")
    }

    @Serializable private data class PkceExchangeReq(@SerialName("auth_code") val authCode: String, @SerialName("code_verifier") val codeVerifier: String)

    /** 브라우저에서 돌아온 code 를 세션으로 교환(grant_type=pkce) → 신원 반환. */
    suspend fun exchangeSlackCode(code: String, verifier: String): Identity {
        val resp = postJson("token?grant_type=pkce",
            json.encodeToString(PkceExchangeReq.serializer(), PkceExchangeReq(code, verifier)))
        val r = json.decodeFromString(AuthResp.serializer(), resp.bodyAsText())
        if (!resp.status.isSuccess() || r.accessToken == null) {
            throw AuthException(r.errorDescription ?: r.msg ?: "Slack 로그인에 실패했어요.")
        }
        val u = r.user
        val meta = u?.meta ?: r.meta
        val email = (u?.email ?: r.email ?: "").trim().lowercase()
        val name = meta?.fullName ?: meta?.name ?: meta?.preferredUsername
            ?: email.substringBefore("@").ifBlank { "팀원" }
        return Identity(email = email, uid = (u?.id ?: r.id ?: "").lowercase(), name = name, part = meta?.part)
    }

    companion object {
        private val EMAIL = Regex("^[^\\s@]+@sk\\.com$", RegexOption.IGNORE_CASE)
        fun isCompanyEmail(email: String) = EMAIL.matches(email.trim())

        /** Supabase Redirect URLs 허용목록 + Manifest 딥링크 intent-filter 와 같아야 한다. */
        const val SLACK_REDIRECT = "skonnection://login-callback"
        /** 단일 워크스페이스 힌트(비밀 아님, 웹 VITE_SLACK_TEAM_ID 기본값과 동일). */
        private const val SLACK_TEAM_ID = "T07BDCWME6M"
    }
}
