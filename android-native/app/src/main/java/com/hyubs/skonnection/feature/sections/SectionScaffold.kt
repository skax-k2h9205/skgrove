package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 더보기 섹션 공통 뼈대 — iOS ScreenScaffold 대응.
 *
 * iOS는 모든 화면이 같은 sunken 배경 위에 놓이고 당겨서 새로고침이 된다.
 * 안드로이드는 섹션마다 배경도, 새로고침 여부도 달라서 같은 앱처럼 보이지 않았다.
 * 여기서 배경과 pull-to-refresh를 한 번에 씌워 열 개 섹션이 같은 몸이 되게 한다.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SectionScaffold(
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = {
            onRefresh()
            // ViewModel의 loading 상태를 여기까지 끌어오지 않는다. 인디케이터는 짧게 보여주고
            // 실제 결과는 목록/에러 화면이 말한다 — 새로고침 표시가 로딩과 이중으로 겹치지 않게.
            scope.launch { refreshing = true; delay(600); refreshing = false }
        },
        modifier = modifier.fillMaxSize(),
    ) {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) { content() }
    }
}
