package com.hyubs.skonnection.data

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountRowTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test fun decodesAccountsRowAndMapsToAccount() {
        val payload = """
          [{"id":"ACC-SYS-ADMIN","name":"관리자","email":"admin@sk.com","role":"팀리더",
            "part":"전체","status":"활성","is_connectioner":true,"password_hash":"HASH-PLACEHOLDER"}]
        """.trimIndent()
        val rows = json.decodeFromString(ListSerializer(AccountRow.serializer()), payload)
        val acc = rows.single().toAccount()
        assertEquals("admin@sk.com", acc.email)
        assertEquals("관리자", acc.name)
        assertEquals("팀리더", acc.role)
        assertTrue(acc.connectioner)
        assertEquals("HASH-PLACEHOLDER", acc.passwordHash)
    }

    @Test fun toleratesMissingOptionalColumns() {
        val payload = """[{"id":"USR-04","email":"dumin@sk.com","name":"이두민"}]"""
        val acc = json.decodeFromString(ListSerializer(AccountRow.serializer()), payload).single().toAccount()
        assertEquals("팀원", acc.role)
        assertEquals("활성", acc.status)
        assertEquals(false, acc.connectioner)
        assertEquals(null, acc.passwordHash)
    }
}
