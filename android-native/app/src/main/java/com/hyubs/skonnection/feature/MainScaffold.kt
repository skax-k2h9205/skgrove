package com.hyubs.skonnection.feature

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val inSection = openSection != null
    if (inSection) BackHandler { openSection = null }

    Scaffold(
        topBar = {
            if (inSection) {
                TopAppBar(
                    title = { Text(openSection!!) },
                    navigationIcon = {
                        IconButton(onClick = { openSection = null }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                        }
                    },
                )
            } else {
                TopAppBar(title = { Text(TABS[tab].label) })
            }
        },
        bottomBar = {
            if (!inSection) {
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
            if (!inSection) {
                FloatingActionButton(onClick = {
                    scope.launch { snackbar.showSnackbar("AI 상담은 곧 제공됩니다.") }
                }) {
                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "AI 상담")
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val contentModifier = Modifier.padding(padding)
        if (inSection) {
            SectionHost(container, openSection!!, currentEmail, contentModifier)
        } else {
            when (tab) {
                0 -> HomeFeedContent(container, contentModifier)
                1 -> HumorContent(container, contentModifier)
                2 -> GatheringsContent(container, contentModifier)
                3 -> MarketContent(container, contentModifier)
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
