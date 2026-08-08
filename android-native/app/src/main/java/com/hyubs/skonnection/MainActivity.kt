package com.hyubs.skonnection

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
        setContent {
            SkTheme {
                Surface(Modifier.fillMaxSize()) { RootScreen(container) }
            }
        }
    }
}
