package com.hyubs.skonnection

import android.content.Context
import com.hyubs.skonnection.core.SessionStore
import com.hyubs.skonnection.data.AccountRepository
import com.hyubs.skonnection.data.HumorRepository
import com.hyubs.skonnection.net.SupabaseClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp

/**
 * 수동 DI 컨테이너 — iOS의 "루트에서 스토어 주입" 패턴 대응.
 * 앱 전역 싱글턴(HTTP/Supabase/리포지토리/세션)을 한곳에서 만든다.
 */
class AppContainer(context: Context) {
    private val httpClient = HttpClient(OkHttp)
    val supabase = SupabaseClient(httpClient)
    val accountRepository = AccountRepository(supabase)
    val humorRepository = HumorRepository(supabase)
    val sessionStore = SessionStore(context.applicationContext)
}
