package com.hyubs.skonnection.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.hyubs.skonnection.auth.AuthUiState
import com.hyubs.skonnection.auth.AuthViewModel
import com.hyubs.skonnection.data.teamParts

private enum class Phase { Login, Signup, VerifySignup, Reset, ResetVerify }

/** 로그인 화면 — 웹·iOS와 동일: 이메일+비번+6자리 OTP 가입·비번 재설정. */
@Composable
fun LoginScreen(vm: AuthViewModel, state: AuthUiState) {
    var phase by rememberSaveable { mutableStateOf(Phase.Login) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var part by rememberSaveable { mutableStateOf(teamParts.first()) }
    var code by rememberSaveable { mutableStateOf("") }
    var newPw by rememberSaveable { mutableStateOf("") }
    var newPw2 by rememberSaveable { mutableStateOf("") }

    fun go(p: Phase) { vm.clearMessages(); phase = p }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("SKonnection", style = MaterialTheme.typography.headlineMedium)
        Text("팀을 잇는 곳", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp, bottom = 16.dp))

        when (phase) {
            Phase.Login, Phase.Signup, Phase.Reset -> field(email, { email = it }, "사내메일", KeyboardType.Email)
            else -> Text(email, style = MaterialTheme.typography.bodyMedium)
        }

        when (phase) {
            Phase.Signup -> {
                field(name, { name = it }, "이름")
                PartDropdown(part) { part = it }
                field(password, { password = it }, "비밀번호 (6자 이상)", KeyboardType.Password, secure = true)
            }
            Phase.Login -> field(password, { password = it }, "비밀번호", KeyboardType.Password, secure = true)
            Phase.VerifySignup -> field(code, { code = it }, "메일로 받은 6자리 코드", KeyboardType.Number)
            Phase.Reset -> {}
            Phase.ResetVerify -> {
                field(code, { code = it }, "메일로 받은 재설정 코드", KeyboardType.Number)
                field(newPw, { newPw = it }, "새 비밀번호 (6자 이상)", KeyboardType.Password, secure = true)
                field(newPw2, { newPw2 = it }, "새 비밀번호 확인", KeyboardType.Password, secure = true)
            }
        }

        state.notice?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }

        Button(
            onClick = {
                when (phase) {
                    Phase.Login -> vm.login(email, password)
                    Phase.Signup -> vm.signup(email, password, name, part) { phase = Phase.VerifySignup }
                    Phase.VerifySignup -> vm.verifySignup(email, code, name, part)
                    Phase.Reset -> vm.requestReset(email) { phase = Phase.ResetVerify }
                    Phase.ResetVerify -> vm.confirmReset(email, code, newPw, newPw2) { phase = Phase.Login; password = ""; code = ""; newPw = ""; newPw2 = "" }
                }
            },
            enabled = !state.loading,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
        ) {
            if (state.loading) CircularProgressIndicator(modifier = Modifier.padding(2.dp))
            else Text(
                when (phase) {
                    Phase.Login -> "로그인"; Phase.Signup -> "가입하고 인증 코드 받기"
                    Phase.VerifySignup -> "인증하고 시작하기"; Phase.Reset -> "재설정 코드 받기"
                    Phase.ResetVerify -> "비밀번호 변경"
                },
            )
        }

        // 화면 전환 링크
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center) {
            when (phase) {
                Phase.Login -> {
                    TextButton(onClick = { go(Phase.Signup) }) { Text("가입") }
                    TextButton(onClick = { go(Phase.Reset) }) { Text("비밀번호 찾기") }
                }
                else -> TextButton(onClick = { go(Phase.Login) }) { Text("로그인으로 돌아가기") }
            }
        }
    }
}

@Composable
private fun field(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    keyboard: KeyboardType = KeyboardType.Text,
    secure: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        visualTransformation = if (secure) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
    )
}

@Composable
private fun PartDropdown(part: String, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.padding(top = 12.dp)) {
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) {
            Text("소속 파트 · $part", modifier = Modifier.fillMaxWidth())
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            teamParts.forEach { p ->
                DropdownMenuItem(text = { Text(p) }, onClick = { onSelect(p); open = false })
            }
        }
    }
}
