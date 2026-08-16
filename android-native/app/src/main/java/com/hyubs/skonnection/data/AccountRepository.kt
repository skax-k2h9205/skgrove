package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

/** 권한·파트·상태·커넥셔너를 한 번에 보낸다(iOS AccountPatch 동일). 넷 다 항상 채워 보내므로 유실이 없다. */
@Serializable
private data class AccountPatch(
    val role: String,
    val part: String,
    val status: String,
    @SerialName("is_connectioner") val isConnectioner: Boolean,
)

/** 신규 가입 계정 insert 바디. */
@Serializable
private data class NewAccount(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val part: String,
    val status: String,
    @SerialName("auth_uid") val authUid: String?,
)

/** 선택 가능한 권한·파트·상태. 웹 auth.ts / types.ts와 같은 목록. */
val userRoles = listOf("팀원", "파트리더", "팀리더")
val teamParts = listOf("TEST혁신파트", "ITS혁신파트", "PM혁신파트")
val accountStatuses = listOf("승인 대기", "활성", "비활성")

/**
 * 팀리더는 파트가 '전체'로 고정되고, 팀리더에서 내려오면 파트를 다시 골라야 한다.
 * 웹 AccountManagement.updateRole / normalizePart와 같은 규칙 — 파트가 '전체'로 남은
 * 파트리더가 생기면 파트 한정 안건의 투표 대상 계산이 어긋난다.
 */
fun partForRole(role: String, currentPart: String): String =
    if (role == "팀리더") "전체" else if (currentPart == "전체") teamParts.first() else currentPart

/** 권한(팀리더>파트리더>팀원) 순서. 가입 순서로 두면 누가 권한을 가졌는지 훑기 어렵다. */
private fun roleOrder(role: String) = when (role) {
    "팀리더" -> 0
    "파트리더" -> 1
    else -> 2
}

/** 웹 AccountManagement와 같은 정렬 — 권한 → 파트 → 이름. */
fun List<Account>.sortedForManagement(): List<Account> =
    sortedWith(compareBy({ roleOrder(it.role) }, { it.part }, { it.name }))

class AccountRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Account> =
        supabase.select(
            table = "accounts",
            query = "select=*&order=joined_at.asc",
            deserializer = ListSerializer(AccountRow.serializer()),
        ).map { it.toAccount() }

    /** 신규 가입 계정 생성(이메일 OTP 인증 후). 웹 authLink.createAccount 대응 — 팀원·활성. */
    suspend fun create(name: String, email: String, part: String, authUid: String?) {
        val id = "USR-" + System.currentTimeMillis().toString(36).uppercase()
        supabase.insert(
            "accounts",
            NewAccount(id = id, name = name, email = email, role = "팀원", part = part, status = "활성", authUid = authUid),
            NewAccount.serializer(),
        )
    }

    /** 권한·파트·상태·커넥셔너 변경을 accounts 테이블에 반영(팀 공유). */
    suspend fun update(account: Account) = supabase.patch(
        "accounts", account.id,
        AccountPatch(account.role, account.part, account.status, account.connectioner),
        AccountPatch.serializer(),
    )
}
