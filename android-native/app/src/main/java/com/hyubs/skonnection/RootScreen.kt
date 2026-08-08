package com.hyubs.skonnection

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hyubs.skonnection.auth.AuthViewModel
import com.hyubs.skonnection.feature.auth.LoginScreen
import com.hyubs.skonnection.feature.home.HomeScreen

@Composable
fun RootScreen(container: AppContainer) {
    val vm = remember { AuthViewModel(container) }
    val state by vm.state.collectAsStateWithLifecycle()

    when {
        !state.sessionResolved -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        state.loggedInEmail == null ->
            LoginScreen(loading = state.loading, error = state.error, onLogin = vm::login)
        else ->
            HomeScreen(container = container, onLogout = vm::logout)
    }
}
