package com.hyubs.skonnection.feature

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Mood
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.activity.compose.BackHandler
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.feature.sections.SectionHost
import kotlinx.coroutines.launch

private data class Tab(val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab("홈", Icons.Filled.Home),
    Tab("유머", Icons.Filled.Mood),
    Tab("모임", Icons.Filled.Bolt),
    Tab("이음장터", Icons.Filled.Storefront),
    Tab("더보기", Icons.Filled.MoreHoriz),
)

/** 앱 최상위 셸 — iOS RootView(5탭 + 챗 FAB) 대응. 더보기 → 섹션 상세는 뒤로가기로 복귀. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScaffold(container: AppContainer, currentEmail: String?, onLogout: () -> Unit) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var openSection by rememberSaveable { mutableStateOf<String?>(null) }
    var showChat by rememberSaveable { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val inSection = openSection != null
    if (inSection) BackHandler { openSection = null }
    if (showChat) BackHandler { showChat = false }

    // 생성(글쓰기·모임 열기·물건 등록)을 iOS처럼 상단 타이틀 좌측 + 버튼으로 올린다.
    var composeHumor by remember { mutableStateOf(false) }
    var composeGathering by remember { mutableStateOf(false) }
    var composeMarket by remember { mutableStateOf(false) }
    // 섹션(대나무숲·액션아이템)의 등록 상태. 상단바가 MainScaffold 소유라 상태도 여기서 든다.
    var composeSection by remember { mutableStateOf(false) }
    // 다른 섹션으로 옮기면 등록 폼을 접는다. 안 그러면 대나무숲에서 열어둔 폼이 다음 섹션까지 따라온다.
    androidx.compose.runtime.LaunchedEffect(openSection) { composeSection = false }
    // 작성 폼이 뜨면 자체 상단바를 가지므로 바깥 크롬(탭바·하단네비·챗 FAB)을 숨겨 전체화면으로.
    val composingAny = composeHumor || composeGathering || composeMarket

    Scaffold(
        topBar = {
            when {
                composingAny -> {}
                showChat -> TopAppBar(
                    title = { Text("AI 상담") },
                    navigationIcon = {
                        IconButton(onClick = { showChat = false }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                        }
                    },
                )
                inSection -> TopAppBar(
                    title = { Text(openSection!!) },
                    navigationIcon = {
                        // 뒤로 + 등록을 타이틀 왼쪽에 나란히 둔다. 유머·모임·장터 탭이 이미
                        // 타이틀 좌측 +로 등록을 받으므로, 섹션도 같은 자리에서 같은 몸짓이 되게 한다.
                        androidx.compose.foundation.layout.Row {
                            IconButton(onClick = { openSection = null }) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                            }
                            if (com.hyubs.skonnection.feature.sections.sectionSupportsCompose(openSection!!)) {
                                IconButton(onClick = { composeSection = true }) {
                                    Icon(
                                        Icons.Filled.Add,
                                        contentDescription = if (openSection == "대나무숲 접수") "접수하기" else "액션 추가",
                                    )
                                }
                            }
                        }
                    },
                )
                else -> TopAppBar(
                    title = { Text(TABS[tab].label) },
                    navigationIcon = {
                        // 유머·모임·장터 탭에서 타이틀 좌측 + 로 생성(iOS ScreenScaffold onCompose).
                        if (tab in 1..3) {
                            IconButton(onClick = {
                                when (tab) {
                                    1 -> composeHumor = true
                                    2 -> composeGathering = true
                                    3 -> composeMarket = true
                                }
                            }) {
                                Icon(
                                    androidx.compose.material.icons.Icons.Filled.Add,
                                    contentDescription = when (tab) { 1 -> "글쓰기"; 2 -> "모임 열기"; else -> "물건 등록" },
                                )
                            }
                        }
                    },
                )
            }
        },
        bottomBar = {
            if (!inSection && !showChat && !composingAny) {
                NavigationBar {
                    TABS.forEachIndexed { i, t ->
                        NavigationBarItem(
                            selected = tab == i,
                            onClick = { tab = i },
                            icon = { Icon(t.icon, contentDescription = t.label) },
                            label = { Text(t.label) },
                        )
                    }
                }
            }
        },
        floatingActionButton = {
            if (!inSection && !showChat && !composingAny) {
                FloatingActionButton(onClick = { showChat = true }) {
                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "AI 상담")
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val contentModifier = Modifier.padding(padding)
        if (showChat) {
            com.hyubs.skonnection.feature.chat.ChatScreen(container, contentModifier)
        } else if (inSection) {
            SectionHost(
                container = container,
                section = openSection!!,
                currentEmail = currentEmail,
                composing = composeSection,
                onComposingChange = { composeSection = it },
                modifier = contentModifier,
            )
        } else {
            when (tab) {
                0 -> com.hyubs.skonnection.feature.home.HomeGridContent(
                    container = container,
                    onOpenTab = { tab = it },
                    onCompose = { tab = 1 },
                    modifier = contentModifier,
                )
                1 -> HumorContent(container, composeHumor, { composeHumor = it }, contentModifier)
                2 -> GatheringsContent(container, composeGathering, { composeGathering = it }, contentModifier)
                3 -> MarketContent(container, composeMarket, { composeMarket = it }, contentModifier)
                else -> MoreContent(
                    currentEmail = currentEmail,
                    onLogout = onLogout,
                    onOpenSection = { openSection = it },
                    modifier = contentModifier,
                )
            }
        }
    }
}
