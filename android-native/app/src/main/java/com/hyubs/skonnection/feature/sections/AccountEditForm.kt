package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hyubs.skonnection.data.Account
import com.hyubs.skonnection.data.accountStatuses
import com.hyubs.skonnection.data.partForRole
import com.hyubs.skonnection.data.teamParts
import com.hyubs.skonnection.data.userRoles
import com.hyubs.skonnection.feature.FormLabel
import com.hyubs.skonnection.feature.FullScreenForm

/**
 * 계정 편집 — 권한·파트·상태·커넥셔너(웹 AccountManagement 이식, 리더 전용).
 *
 * 권한을 팀리더로 올리면 파트가 '전체'로 고정된다. 파트가 '전체'로 남은 파트리더가 생기면
 * 파트 한정 안건의 투표 대상 계산이 어긋나서, 권한을 바꿀 때 파트도 같이 맞춘다.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AccountEditForm(account: Account, onClose: () -> Unit, onSave: (Account) -> Unit) {
    var role by remember(account.id) { mutableStateOf(account.role) }
    var part by remember(account.id) { mutableStateOf(account.part) }
    var status by remember(account.id) { mutableStateOf(account.status) }
    var connectioner by remember(account.id) { mutableStateOf(account.connectioner) }

    val changed = role != account.role || part != account.part ||
        status != account.status || connectioner != account.connectioner

    FullScreenForm(
        title = account.name.ifBlank { account.email },
        submitLabel = "저장",
        canSubmit = changed,
        onSubmit = {
            onSave(account.copy(role = role, part = part, status = status, connectioner = connectioner))
        },
        onClose = onClose,
    ) {
        Text(account.email, style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline)

        FormLabel("권한")
        ChipGroup(userRoles, role) { picked ->
            role = picked
            part = partForRole(picked, part)
        }

        FormLabel("소속 파트")
        if (role == "팀리더") {
            Text("팀리더는 전체 파트를 담당합니다.", style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline)
        } else {
            ChipGroup(teamParts, part) { part = it }
        }

        FormLabel("계정 상태")
        ChipGroup(accountStatuses, status) { status = it }

        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Switch(checked = connectioner, onCheckedChange = { connectioner = it })
            Text("커넥셔너 전권", fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 10.dp))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChipGroup(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            FilterChip(
                selected = selected == option,
                onClick = { onSelect(option) },
                label = { Text(option) },
            )
        }
    }
}
