package com.hyubs.skonnection.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hyubs.skonnection.data.teamParts
import com.hyubs.skonnection.net.SupabaseAuth
import com.hyubs.skonnection.ui.theme.Sk

/**
 * 첫 Slack 로그인(신규 계정)에게 소속 파트만 1회 물어보는 화면(iOS SlackPartPromptView 이식).
 * Slack 은 이름·이메일은 주지만 파트는 모른다 — 파트지수·파트 필터가 돌려면 최초 1회 고른다.
 */
@Composable
fun SlackPartPrompt(
    identity: SupabaseAuth.Identity,
    busy: Boolean,
    onConfirm: (String) -> Unit,
    onCancel: () -> Unit,
) {
    var part by remember { mutableStateOf(teamParts.firstOrNull() ?: "TEST혁신파트") }
    val who = identity.name?.takeIf { it.isNotBlank() } ?: identity.email

    Box(Modifier.fillMaxSize().background(Sk.Page)) {
        Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            // 브랜드 헤더
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(48.dp).background(Sk.TintPrimary, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Favorite, contentDescription = null, tint = Sk.Primary, modifier = Modifier.size(26.dp))
                }
                Column {
                    Text("SKonnection", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Sk.Ink)
                    Text("팀을 잇는 곳", fontSize = 14.sp, color = Sk.Muted)
                }
            }

            // 환영 배너
            Column(
                Modifier.fillMaxWidth().background(Sk.TintPrimary, RoundedCornerShape(12.dp)).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text("✓ ${who}님, 환영해요", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Sk.TintPrimaryInk)
                Text("처음 로그인이에요. 소속 파트만 한 번 골라주시면 바로 시작합니다.", fontSize = 12.sp, color = Sk.Muted)
            }

            // 파트 선택
            Text("소속 파트", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                teamParts.forEach { p ->
                    FilterChip(selected = part == p, onClick = { part = p }, label = { Text(p) })
                }
            }

            Spacer(Modifier.height(4.dp))
            Button(
                onClick = { onConfirm(part) },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = Sk.Cta),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("시작하기") }
            TextButton(onClick = onCancel, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("취소", color = Sk.Muted) }
        }
    }
}
