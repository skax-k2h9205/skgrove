package com.hyubs.skonnection.feature.system

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hyubs.skonnection.AppContainer
import com.hyubs.skonnection.data.NotifyDefaults
import com.hyubs.skonnection.data.NotifyValue
import com.hyubs.skonnection.feature.EmptyBox
import com.hyubs.skonnection.feature.sections.SectionScaffold
import com.hyubs.skonnection.ui.theme.Sk
import kotlinx.coroutines.launch

/** 시스템 관리 · 알림 발송 — 리더 전용. app_config 로 팀 전체 공유, 바꾸면 즉시 원격 저장. */
@Composable
fun SystemSection(container: AppContainer, modifier: Modifier = Modifier) {
    if (!container.isLeader) {
        SectionScaffold(onRefresh = {}, modifier = modifier) {
            EmptyBox("시스템 관리는 리더·커넥셔너만 볼 수 있어요.")
        }
        return
    }

    val routes = remember { mutableStateMapOf<String, String>().apply { putAll(NotifyDefaults.routes) } }
    var slackEnabled by remember { mutableStateOf(true) }
    var dmEnabled by remember { mutableStateOf(true) }
    var channels by remember { mutableStateOf<Map<String, String>>(mapOf("team" to "", "connector" to "")) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    suspend fun pull() {
        val v = runCatching { container.systemRepository.load() }.getOrNull() ?: return
        v.routes?.let { routes.clear(); routes.putAll(it) }
        slackEnabled = v.slackEnabled ?: true
        dmEnabled = v.dmEnabled ?: true
        v.channels?.let { channels = it }
    }
    LaunchedEffect(Unit) { pull() }

    fun save() {
        val value = NotifyValue(routes = routes.toMap(), channels = channels, dmEnabled = dmEnabled, slackEnabled = slackEnabled)
        scope.launch { runCatching { container.systemRepository.save(value) } }
    }

    SectionScaffold(onRefresh = { scope.launch { pull() } }, modifier = modifier) {
        LazyColumn(
            Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Text(
                    "여기서 바꾼 설정은 저장 즉시 팀 전체에 적용됩니다. 슬랙 봇 토큰만 서버 비밀입니다.",
                    fontSize = 13.sp, color = Sk.TintPrimaryInk,
                    modifier = Modifier.fillMaxWidth()
                        .background(Sk.TintPrimary, RoundedCornerShape(10.dp)).padding(12.dp),
                )
            }

            item {
                Syscard {
                    Text("발송 채널", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                    ToggleRow("슬랙 알림 사용", "끄면 어떤 슬랙도 보내지 않고 앱 안 알림만 남습니다.", slackEnabled) {
                        slackEnabled = it; save()
                    }
                    HorizontalDivider()
                    ToggleRow("개인 DM 발송", "본인에게만 오는 알림은 DM으로도 보냅니다.", dmEnabled, enabled = slackEnabled) {
                        dmEnabled = it; save()
                    }
                }
            }

            item {
                Syscard {
                    Text("알림별 발송 위치", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Sk.Ink)
                    NotifyDefaults.kinds.forEachIndexed { i, kind ->
                        if (i > 0) HorizontalDivider()
                        RouteRow(
                            kind.label, kind.sub, routes[kind.id] ?: "off", enabled = slackEnabled,
                            onPick = { routes[kind.id] = it; save() },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ToggleRow(title: String, sub: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Sk.Ink)
            Text(sub, fontSize = 12.sp, color = Sk.Muted)
        }
        Switch(checked = checked && enabled, onCheckedChange = { if (enabled) onChange(it) }, enabled = enabled)
    }
}

@Composable
private fun RouteRow(label: String, sub: String, value: String, enabled: Boolean, onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Sk.Ink)
            Text(sub, fontSize = 12.sp, color = Sk.Muted)
        }
        Box {
            TextButton(onClick = { if (enabled) open = true }, enabled = enabled) {
                Text(NotifyDefaults.routeOptions.firstOrNull { it.first == value }?.second ?: "발송 안 함", color = Sk.Primary)
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                NotifyDefaults.routeOptions.forEach { (id, opt) ->
                    DropdownMenuItem(text = { Text(opt) }, onClick = { onPick(id); open = false })
                }
            }
        }
    }
}

@Composable
private fun Syscard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Sk.Surface), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}
