package com.hyubs.skonnection.feature

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * 등록/작성 공용 전체화면 폼(iOS ComposeSheet 대응).
 * 상단에 닫기·저장, 본문은 세로 스크롤 + 키보드 대응(imePadding).
 * AlertDialog가 키보드에 가리고 답답하던 문제를 없앤다.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormScaffold(
    title: String,
    submitLabel: String,
    canSubmit: Boolean,
    onSubmit: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onClose) { Icon(Icons.Filled.Close, contentDescription = "닫기") }
                },
                actions = {
                    TextButton(onClick = onSubmit, enabled = canSubmit) {
                        Text(submitLabel, fontWeight = FontWeight.Bold)
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            content()
        }
    }
}

/**
 * 섹션(더보기) 안에서 쓰는 전체화면 폼. 플랫폼 기본 너비 제한을 끄고 화면을 꽉 채워
 * 섹션 상단바까지 덮는다. AlertDialog 대비 답답함·키보드 가림을 없앤다.
 */
@Composable
fun FullScreenForm(
    title: String,
    submitLabel: String,
    canSubmit: Boolean,
    onSubmit: () -> Unit,
    onClose: () -> Unit,
    content: @Composable () -> Unit,
) {
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onClose,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false),
    ) {
        androidx.compose.material3.Surface(Modifier.fillMaxSize()) {
            FormScaffold(title, submitLabel, canSubmit, onSubmit, onClose, content = content)
        }
    }
}

/** 폼 섹션 라벨 — 필드 위 작은 제목(위계 부여). */
@Composable
fun FormLabel(text: String, required: Boolean = false) {
    Text(
        buildString { append(text); if (required) append(" *") },
        style = MaterialTheme.typography.labelLarge,
        color = if (required) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
        modifier = Modifier.fillMaxWidth(),
    )
}
