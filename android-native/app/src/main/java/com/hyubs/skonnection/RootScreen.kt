package com.hyubs.skonnection

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.hyubs.skonnection.auth.AuthViewModel
import com.hyubs.skonnection.feature.BrandSplash
import com.hyubs.skonnection.feature.MainScaffold
import com.hyubs.skonnection.feature.auth.LoginScreen
import kotlinx.coroutines.delay

@Composable
fun RootScreen(container: AppContainer) {
    // 라이프사이클이 소유하는 ViewModel — 화면 회전 등으로 재생성돼도 이전 인스턴스가
    // onCleared 로 정리돼 viewModelScope 가 취소된다(누수·Slack 코드 이중 수집 방지).
    val vm: AuthViewModel = viewModel(factory = viewModelFactory { initializer { AuthViewModel(container) } })
    val state by vm.state.collectAsStateWithLifecycle()

    // 시작 브랜드 스플래시를 잠깐 보여준 뒤 앱으로 전환한다(iOS SplashView 와 동일 톤).
    var showSplash by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        delay(1400)
        showSplash = false
    }

    Box(Modifier.fillMaxSize()) {
        when {
            !state.sessionResolved -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            state.needsPartFor != null ->
                com.hyubs.skonnection.feature.auth.SlackPartPrompt(
                    identity = state.needsPartFor!!,
                    busy = state.loading,
                    onConfirm = { part -> vm.confirmSlackPart(part) },
                    onCancel = { vm.cancelSlackPart() },
                )
            state.loggedInEmail == null ->
                LoginScreen(vm = vm, state = state)
            else ->
                MainScaffold(container = container, currentEmail = state.loggedInEmail, onLogout = vm::logout)
        }
        if (showSplash) BrandSplash()
    }
}
