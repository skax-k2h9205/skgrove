package com.hyubs.skonnection.feature

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hyubs.skonnection.ui.theme.Sk

/**
 * 브랜드 스플래시 — 웹·iOS와 같은 파란 그라데이션 + 흰 라운드 카드 + 브랜드블루 하트 + 워드마크.
 * iOS SplashView 이식. RootScreen 에서 시작 후 잠깐 오버레이로 띄운다(시스템 스플래시 뒤를 잇는다).
 */
@Composable
fun BrandSplash() {
    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(Sk.Primary, Sk.PrimaryStrong))),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Box(
                Modifier
                    .size(120.dp)
                    .shadow(20.dp, RoundedCornerShape(30.dp))
                    .background(Color.White, RoundedCornerShape(30.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Favorite, contentDescription = null, tint = Sk.Primary, modifier = Modifier.size(58.dp))
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("SKonnection", color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold)
                Text("팀을 잇는 곳", color = Color.White.copy(alpha = 0.85f), fontSize = 18.sp)
            }
        }
    }
}
