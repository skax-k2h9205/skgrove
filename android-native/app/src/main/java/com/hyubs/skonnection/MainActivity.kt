package com.hyubs.skonnection

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.hyubs.skonnection.ui.theme.SkTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        val container = (application as SKonnectionApp).container
        handleSlackCallback(intent)
        setContent {
            SkTheme {
                Surface(Modifier.fillMaxSize()) { RootScreen(container) }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleSlackCallback(intent)
    }

    /** skonnection://login-callback?code=.. 딥링크에서 인가 코드를 뽑아 AuthViewModel 로 전달. */
    private fun handleSlackCallback(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        if (data.scheme != "skonnection" || data.host != "login-callback") return
        val code = data.getQueryParameter("code") ?: return
        (application as SKonnectionApp).container.pendingSlackCode.value = code
    }
}
