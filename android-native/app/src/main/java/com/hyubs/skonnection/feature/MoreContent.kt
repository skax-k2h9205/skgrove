package com.hyubs.skonnection.feature

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** 더보기 허브 — 나머지 섹션(말하고정하기·살펴보기·관리) 진입점. 후속 마일스톤에서 채운다. */
@Composable
fun MoreContent(
    currentEmail: String?,
    onLogout: () -> Unit,
    onOpenSection: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val sections = listOf(
        "마이페이지", "대나무숲 접수", "리더 관리함", "안건 · 투표", "액션아이템", "캔미팅 · 티미팅",
        "팀 추억", "성장 · 커리어", "파트지수 · 리포트", "동료 성향", "조 뽑기",
        "알림 · 메시지", "계정 관리", "시스템 관리",
    )
    // 마지막 항목(로그아웃)이 하단 네비게이션에 잘리지 않도록 여백을 준다.
    LazyColumn(
        modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 24.dp),
    ) {
        item {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("계정", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(currentEmail ?: "-", style = MaterialTheme.typography.titleMedium)
            }
            HorizontalDivider()
        }
        items(sections) { name ->
            ListItem(
                headlineContent = { Text(name) },
                modifier = Modifier.clickable { onOpenSection(name) },
            )
            HorizontalDivider()
        }
        item {
            ListItem(
                headlineContent = { Text("로그아웃", color = MaterialTheme.colorScheme.error) },
                leadingContent = {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                },
                modifier = Modifier.clickable { onLogout() },
            )
        }
    }
}
