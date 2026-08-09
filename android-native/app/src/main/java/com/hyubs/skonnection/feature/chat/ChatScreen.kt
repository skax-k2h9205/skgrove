package com.hyubs.skonnection.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.ChatTurn

@Composable
fun ChatScreen(container: AppContainer, modifier: Modifier = Modifier) {
    val vm = remember { ChatViewModel(container) }
    val state by vm.state.collectAsStateWithLifecycle()
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    // 새 메시지가 오면 맨 아래로 스크롤.
    LaunchedEffect(state.messages.size, state.sending) {
        val count = state.messages.size + if (state.sending) 1 else 0
        if (count > 0) listState.animateScrollToItem(count)
    }

    Column(modifier.fillMaxSize()) {
        // 모드 선택
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(12.dp)) {
            ChatMode.entries.forEachIndexed { i, m ->
                SegmentedButton(
                    selected = state.mode == m,
                    onClick = { vm.switchMode(m) },
                    shape = SegmentedButtonDefaults.itemShape(i, ChatMode.entries.size),
                ) { Text(m.label) }
            }
        }

        // 대화가 서버에 남기 시작했으니 지우는 길도 같이 둔다. 상담은 개인적인 이야기다.
        if (state.messages.isNotEmpty()) {
            var confirm by remember { mutableStateOf(false) }
            TextButton(
                onClick = { confirm = true },
                modifier = Modifier.align(Alignment.End).padding(horizontal = 8.dp),
            ) { Text("이 대화 지우기", style = MaterialTheme.typography.labelMedium) }

            if (confirm) {
                AlertDialog(
                    onDismissRequest = { confirm = false },
                    title = { Text("이 대화를 지울까요?") },
                    text = {
                        Text("${state.mode.label} 기록이 이 기기와 웹에서 모두 사라집니다. 되돌릴 수 없어요.")
                    },
                    confirmButton = {
                        TextButton(onClick = { vm.clearThread(); confirm = false }) { Text("지우기") }
                    },
                    dismissButton = {
                        TextButton(onClick = { confirm = false }) { Text("그대로 두기") }
                    },
                )
            }
        }

        // 상담 상대 — 성향을 함께 보내야 "상대의 언어로 번역"이 되므로, 상담 모드에서만 고른다.
        if (state.mode == ChatMode.COUNSEL) {
            PartnerPicker(
                partners = state.partners,
                selected = state.partner,
                onSelect = vm::selectPartner,
            )
        }

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        ) {
            item {
                Bubble(
                    assistant = true,
                    text = state.partner?.let {
                        "${it.name}님과의 일을 상담하시는군요. 어떤 점이 힘드셨는지 편하게 이야기해 주세요."
                    } ?: state.mode.greeting,
                )
            }
            items(state.messages) { m -> Bubble(assistant = m.role == "assistant", text = m.content) }
            // 빈 입력창만 보면 무엇을 물어야 할지 몰라 그냥 닫는다. 눌러서 바로 보내지게 둔다.
            if (state.messages.isEmpty() && !state.sending) {
                item { Starters(state.mode.starters) { vm.send(it) } }
            }
            if (state.sending) {
                item {
                    Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.padding(4.dp), strokeWidth = 2.dp)
                        Text("생각 중…", modifier = Modifier.padding(start = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        TextButton(onClick = vm::cancel) { Text("그만 받기") }
                    }
                }
            }
        }

        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("메시지를 입력하세요") },
                modifier = Modifier.weight(1f),
                maxLines = 4,
            )
            IconButton(
                onClick = { vm.send(input); input = "" },
                enabled = input.isNotBlank() && !state.sending,
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "보내기", tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

/** 첫 화면의 예시 질문. 누르면 그대로 보내진다. */
@Composable
private fun Starters(questions: List<String>, onPick: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(
            "이런 걸 물어볼 수 있어요",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 6.dp),
        )
        for (q in questions) {
            OutlinedButton(
                onClick = { onPick(q) },
                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
            ) {
                Text(q, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null,
                     tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
private fun Bubble(assistant: Boolean, text: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = if (assistant) Alignment.CenterStart else Alignment.CenterEnd) {
        Column(
            Modifier.widthIn(max = 300.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(if (assistant) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.primary)
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            val ink = if (assistant) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onPrimary
            if (!assistant) {
                // 내가 쓴 말은 서식이 아니라 쓴 그대로여야 한다.
                Text(text, color = ink, style = MaterialTheme.typography.bodyMedium)
            } else {
                for (block in ChatMarkdown.parse(text)) {
                    when (block) {
                        is ChatMarkdown.Block.Paragraph ->
                            Text(block.text, color = ink, style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(bottom = 6.dp))
                        is ChatMarkdown.Block.ListItem ->
                            // 기호 자리를 고정폭으로 잡아 둘째 줄이 글머리 아래로 들어가지 않게 한다.
                            Row(Modifier.padding(bottom = 4.dp)) {
                                Text(block.marker, color = ink, style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.widthIn(min = 18.dp))
                                Text(block.text, color = ink, style = MaterialTheme.typography.bodyMedium)
                            }
                        ChatMarkdown.Block.Rule ->
                            HorizontalDivider(Modifier.padding(vertical = 8.dp), color = ink.copy(alpha = 0.25f))
                    }
                }
            }
        }
    }
    Spacer(Modifier.padding(2.dp))
}

/**
 * 상담 상대 고르기.
 *
 * 상대를 고르면 그 사람의 성향(MBTI·협업 스타일)이 상담에 함께 실린다. 안 고르면 일반 상담이다.
 * 동료 성향이 아직 하나도 없으면 고를 것이 없으므로 줄 자체를 띄우지 않는다.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun PartnerPicker(
    partners: List<com.hyubs.skonnection.data.Profile>,
    selected: com.hyubs.skonnection.data.Profile?,
    onSelect: (com.hyubs.skonnection.data.Profile?) -> Unit,
) {
    if (partners.isEmpty()) return
    var open by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = open,
        onExpandedChange = { open = it },
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
    ) {
        OutlinedTextField(
            value = selected?.let { "${it.name} · ${it.part}" } ?: "상대 없음 (일반 상담)",
            onValueChange = {},
            readOnly = true,
            label = { Text("상담 상대") },
            supportingText = {
                Text(
                    selected?.let { "${it.temperamentLabel}${if (it.mbti.isNotBlank()) " · ${it.mbti}" else ""} 성향을 함께 전달해요" }
                        ?: "상대를 고르면 그 사람의 성향까지 반영해 조언해요",
                    style = MaterialTheme.typography.labelSmall,
                )
            },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = open) },
            modifier = Modifier.fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text("상대 없음 (일반 상담)") },
                onClick = { onSelect(null); open = false },
            )
            partners.forEach { p ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(p.name, fontWeight = FontWeight.SemiBold)
                            Text(
                                listOf(p.part, p.temperamentLabel).filter { it.isNotBlank() }.joinToString(" · "),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                    onClick = { onSelect(p); open = false },
                )
            }
        }
    }
}
