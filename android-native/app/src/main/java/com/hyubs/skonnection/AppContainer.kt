package com.hyubs.skonnection

import android.content.Context
import com.hyubs.skonnection.core.SessionStore
import com.hyubs.skonnection.data.AccountRepository
import com.hyubs.skonnection.data.ActionRepository
import com.hyubs.skonnection.data.ChatRepository
import com.hyubs.skonnection.data.CounselRepository
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
    val supabaseAuth = com.hyubs.skonnection.net.SupabaseAuth(httpClient)
    val accountRepository = AccountRepository(supabase)
    val humorRepository = HumorRepository(supabase)
    val gatheringRepository = GatheringRepository(supabase)
    val gatheringImageRepository = com.hyubs.skonnection.data.GatheringImageRepository(httpClient, supabase)
    /** 본 스토리 기록(인스타 규칙) — 홈 트레이 정렬·링 색에 쓴다. */
    val viewedStories = com.hyubs.skonnection.core.ViewedStories(context)
    val marketRepository = MarketRepository(supabase)
    val leaderKeysStore = com.hyubs.skonnection.data.LeaderKeysStore(supabase)
    val growthRepository = com.hyubs.skonnection.data.GrowthRepository(supabase)
    val issueRepository = IssueRepository(supabase, leaderKeysStore)
    val agendaRepository = AgendaRepository(supabase)
    val actionRepository = ActionRepository(supabase)
    val notificationRepository = NotificationRepository(supabase)
    val profileRepository = ProfileRepository(supabase)
    val connectRepository = com.hyubs.skonnection.data.ConnectRepository(supabase)
    val systemRepository = com.hyubs.skonnection.data.SystemRepository(supabase)
    val coffeeGameRepository = com.hyubs.skonnection.data.CoffeeGameRepository(supabase)
    val memoryRepository = MemoryRepository(supabase)
    val meetingRepository = MeetingRepository(supabase)
    val chatRepository = ChatRepository(httpClient)
    val counselRepository = CounselRepository(supabase)
    val sessionStore = SessionStore(context.applicationContext)

    /** Slack 로그인 딥링크(skonnection://login-callback?code=..)로 돌아온 인가 코드. MainActivity가 넣고 AuthViewModel이 소비. */
    val pendingSlackCode = kotlinx.coroutines.flow.MutableStateFlow<String?>(null)

    /**
     * 현재 로그인 사용자. 세션은 이메일만 보관하므로 로그인 직후 accounts 에서
     * 계정을 찾아 캐싱한다. 쓰기 인터랙션(작성자·투표자·입찰자 이름, 삭제 권한)에서 쓴다.
     */
    @Volatile
    var currentUser: Account? = null
        private set

    /** 데이터 삭제(정제) 전용 관리자. 웹과 동일하게 admin@sk.com 계정만 삭제 가능. */
    val isAdmin: Boolean
        get() = currentUser?.email?.equals("admin@sk.com", ignoreCase = true) == true

    /** 리더(팀리더·파트리더). 계정 권한 변경처럼 팀 전체에 영향을 주는 조작을 여기서 막는다. */
    val isLeader: Boolean
        get() = currentUser?.role?.contains("리더") == true

    suspend fun refreshCurrentUser(email: String?): Account? {
        if (email == null) { currentUser = null; return null }
        currentUser = runCatching {
            accountRepository.loadAll().firstOrNull { it.email.equals(email, ignoreCase = true) }
        }.getOrNull()
        return currentUser
    }
}

