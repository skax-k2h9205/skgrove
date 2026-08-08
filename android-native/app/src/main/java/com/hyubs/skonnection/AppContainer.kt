package com.hyubs.skonnection

import android.content.Context
import com.hyubs.skonnection.core.SessionStore
import com.hyubs.skonnection.data.AccountRepository
import com.hyubs.skonnection.data.ActionRepository
import com.hyubs.skonnection.data.AgendaRepository
import com.hyubs.skonnection.data.GatheringRepository
import com.hyubs.skonnection.data.HumorRepository
import com.hyubs.skonnection.data.IssueRepository
import com.hyubs.skonnection.data.MarketRepository
import com.hyubs.skonnection.data.MeetingRepository
import com.hyubs.skonnection.data.MemoryRepository
import com.hyubs.skonnection.data.NotificationRepository
import com.hyubs.skonnection.data.ProfileRepository
import com.hyubs.skonnection.data.Account
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
    val gatheringRepository = GatheringRepository(supabase)
    val marketRepository = MarketRepository(supabase)
    val issueRepository = IssueRepository(supabase)
    val agendaRepository = AgendaRepository(supabase)
    val actionRepository = ActionRepository(supabase)
    val notificationRepository = NotificationRepository(supabase)
    val profileRepository = ProfileRepository(supabase)
    val memoryRepository = MemoryRepository(supabase)
    val meetingRepository = MeetingRepository(supabase)
    val sessionStore = SessionStore(context.applicationContext)

    /**
     * 현재 로그인 사용자. 세션은 이메일만 보관하므로 로그인 직후 accounts 에서
     * 계정을 찾아 캐싱한다. 쓰기 인터랙션(작성자·투표자·입찰자 이름, 삭제 권한)에서 쓴다.
     */
    @Volatile
    var currentUser: Account? = null
        private set

    suspend fun refreshCurrentUser(email: String?): Account? {
        if (email == null) { currentUser = null; return null }
        currentUser = runCatching {
            accountRepository.loadAll().firstOrNull { it.email.equals(email, ignoreCase = true) }
        }.getOrNull()
        return currentUser
    }
}

