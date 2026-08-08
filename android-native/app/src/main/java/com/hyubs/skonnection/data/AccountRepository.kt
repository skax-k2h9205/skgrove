package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.builtins.ListSerializer

class AccountRepository(private val supabase: SupabaseClient) {
    suspend fun loadAll(): List<Account> =
        supabase.select(
            table = "accounts",
            query = "select=*&order=joined_at.asc",
            deserializer = ListSerializer(AccountRow.serializer()),
        ).map { it.toAccount() }
}
