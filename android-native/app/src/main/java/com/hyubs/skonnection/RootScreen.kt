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
import com.hyubs.skonnection.auth.AuthViewModel
import com.hyubs.skonnection.feature.BrandSplash
import com.hyubs.skonnection.feature.MainScaffold
import com.hyubs.skonnection.feature.auth.LoginScreen
import kotlinx.coroutines.delay

@Composable
fun RootScreen(container: AppContainer) {
    val vm = remember { AuthViewModel(container) }
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
            state.loggedInEmail == null ->
                LoginScreen(vm = vm, state = state)
            else ->
                MainScaffold(container = container, currentEmail = state.loggedInEmail, onLogout = vm::logout)
        }
        if (showSplash) BrandSplash()
    }
}
