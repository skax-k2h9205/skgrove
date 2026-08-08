package com.hyubs.skonnection.core

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "skonnection_session")

/** 로그인 세션(현재 이메일)을 앱 재시작 후에도 유지한다. */
class SessionStore(private val context: Context) {
    private val emailKey = stringPreferencesKey("current_email")

    val currentEmail: Flow<String?> = context.dataStore.data.map { it[emailKey] }

    suspend fun save(email: String) {
        context.dataStore.edit { it[emailKey] = email }
    }

    suspend fun clear() {
        context.dataStore.edit { it.remove(emailKey) }
    }
}
