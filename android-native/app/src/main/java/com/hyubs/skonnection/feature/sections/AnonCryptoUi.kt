package com.hyubs.skonnection.feature.sections

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.hyubs.skonnection.core.IssueCrypto
import com.hyubs.skonnection.data.AnonEncrypt
import com.hyubs.skonnection.data.Issue
import com.hyubs.skonnection.data.LeaderKeysStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 암호화 접수 본문 열람 UI — iOS `AnonCryptoViews`(EncryptedIssueBody/LeaderKeySetupView) 이식.
 * 개인키는 감싼 채 서버에 있고, 패스프레이즈로 세션 중 1회 풀어 메모리에 캐시한다(운영자 불가독 유지).
 */

/** 세션 내 복호화된 개인키 캐시(계정별). 로그아웃/앱 종료 시 사라진다. */
object CryptoSession {
    private val cache = HashMap<String, IssueCrypto.Jwk>()
    fun put(accountId: String, priv: IssueCrypto.Jwk) { cache[accountId] = priv }
    fun get(accountId: String): IssueCrypto.Jwk? = cache[accountId]
    fun clear() = cache.clear()
}

private sealed interface EncPhase {
    data object Loading : EncPhase
    data object NotRecipient : EncPhase
    data object NoKey : EncPhase
    data object Locked : EncPhase
    data class Error(val msg: String) : EncPhase
    data class Unlocked(val body: String, val expectedChange: String) : EncPhase
}

@Composable
fun EncryptedIssueBody(issue: Issue, myAccountId: String, store: LeaderKeysStore) {
    val encIssue = remember(issue.id) {
        IssueCrypto.EncryptedIssue(issue.encAlg.ifBlank { IssueCrypto.ALG }, issue.encPayload, issue.encKeys)
    }
    val iAmRecipient = remember(issue.id, myAccountId) { issue.encKeys.any { it.accountId == myAccountId } }
    var phase by remember(issue.id, myAccountId) { mutableStateOf<EncPhase>(EncPhase.Loading) }
    var pass by remember(issue.id) { mutableStateOf("") }
    var busy by remember(issue.id) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(issue.id, myAccountId) {
        if (myAccountId.isBlank() || !iAmRecipient) { phase = EncPhase.NotRecipient; return@LaunchedEffect }
        val cached = CryptoSession.get(myAccountId)
        if (cached != null) {
            val parsed = withContext(Dispatchers.Default) {
                runCatching { AnonEncrypt.decodePayload(IssueCrypto.decryptAsRecipient(encIssue, myAccountId, cached)) }.getOrNull()
            }?.let { it }
            phase = if (parsed != null) EncPhase.Unlocked(parsed.first, parsed.second) else EncPhase.Error("복호화에 실패했어요.")
            return@LaunchedEffect
        }
        val rec = withContext(Dispatchers.IO) { store.loadRecord(myAccountId) }
        phase = if (rec == null) EncPhase.NoKey else EncPhase.Locked
    }

    fun unlock() {
        busy = true
        scope.launch {
            val rec = withContext(Dispatchers.IO) { store.loadRecord(myAccountId) }
            if (rec == null) { phase = EncPhase.NoKey; busy = false; return@launch }
            val parsed = withContext(Dispatchers.Default) {
                runCatching {
                    val priv = IssueCrypto.unwrapPrivateKey(rec.encPrivPassphrase, pass)
                    CryptoSession.put(myAccountId, priv)
                    AnonEncrypt.decodePayload(IssueCrypto.decryptAsRecipient(encIssue, myAccountId, priv))
                }.getOrNull()
            }
            phase = if (parsed != null) EncPhase.Unlocked(parsed.first, parsed.second)
            else EncPhase.Error("패스프레이즈가 맞지 않아요.")
            busy = false
        }
    }

    when (val p = phase) {
        EncPhase.Loading -> LockNote("불러오는 중…")
        EncPhase.NotRecipient -> LockNote("이 글은 회원님 키로 암호화되지 않아 열람할 수 없어요.")
        EncPhase.NoKey -> Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            LockNote("암호화된 접수예요. 열람하려면 암호화 키를 먼저 설정하세요.")
            KeySetupCard(accountId = myAccountId, store = store, onDone = { phase = EncPhase.Locked })
        }
        is EncPhase.Unlocked -> Column(Modifier.padding(top = 4.dp)) {
            Text("🔓 접수 내용 (복호화됨)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            if (p.body.isNotBlank()) Text(p.body, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 2.dp))
            if (p.expectedChange.isNotBlank()) {
                Text("기대 변화", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                Text(p.expectedChange, style = MaterialTheme.typography.bodySmall)
            }
        }
        else -> Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            LockNote("🔒 대상자만 열람할 수 있어요. 패스프레이즈로 해제하세요.")
            if (p is EncPhase.Error) Text(p.msg, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
            OutlinedTextField(
                value = pass, onValueChange = { pass = it }, singleLine = true,
                label = { Text("패스프레이즈") }, visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(onClick = { unlock() }, enabled = !busy && pass.isNotBlank()) {
                if (busy) { CircularProgressIndicator(Modifier.height(16.dp)); Spacer(Modifier.width(8.dp)) }
                Text("열람")
            }
        }
    }
}

/** 암호화 열람/작성 키 생성 — 패스프레이즈 + 복구코드로 개인키를 감싸 저장한다(iOS LeaderKeySetupView). */
@Composable
fun KeySetupCard(accountId: String, store: LeaderKeysStore, onDone: () -> Unit, intro: String? = null) {
    var pass by remember { mutableStateOf("") }
    var pass2 by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var recovery by remember { mutableStateOf<String?>(null) }
    var confirmed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun create() {
        if (pass.length < 8) { error = "패스프레이즈는 8자 이상이어야 해요."; return }
        if (pass != pass2) { error = "두 패스프레이즈가 서로 달라요."; return }
        busy = true; error = null
        scope.launch {
            val ok = withContext(Dispatchers.Default) {
                runCatching {
                    val kp = IssueCrypto.generateRecipientKeypair()
                    val code = IssueCrypto.generateRecoveryCode()
                    val rec = com.hyubs.skonnection.data.LeaderKeyRecord(
                        accountId = accountId, publicJwk = kp.publicJwk,
                        encPrivPassphrase = IssueCrypto.wrapPrivateKey(kp.privateJwk, pass),
                        encPrivRecovery = IssueCrypto.wrapPrivateKey(kp.privateJwk, code),
                        alg = IssueCrypto.ALG,
                    )
                    val saved = withContext(Dispatchers.IO) { store.save(rec) }
                    if (saved) { CryptoSession.put(accountId, kp.privateJwk); code } else null
                }.getOrNull()
            }
            busy = false
            if (ok != null) recovery = ok else error = "키 저장에 실패했어요. 잠시 후 다시 시도해 주세요."
        }
    }

    if (recovery != null) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("복구코드를 꼭 저장하세요", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text("패스프레이즈를 잊으면 이 코드로만 복구할 수 있어요. 서버·운영자는 이 코드를 모릅니다.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(recovery!!, style = MaterialTheme.typography.titleMedium)
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                androidx.compose.material3.Checkbox(checked = confirmed, onCheckedChange = { confirmed = it })
                Text("복구코드를 안전한 곳에 저장했어요.", style = MaterialTheme.typography.bodySmall)
            }
            Button(onClick = onDone, enabled = confirmed, modifier = Modifier.fillMaxWidth()) { Text("완료") }
        }
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(intro ?: "암호화 열람 키를 만들어요. 패스프레이즈는 이 기기에서만 쓰이고 서버로 전송되지 않습니다.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(value = pass, onValueChange = { pass = it }, singleLine = true, label = { Text("패스프레이즈 (8자 이상)") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = pass2, onValueChange = { pass2 = it }, singleLine = true, label = { Text("패스프레이즈 확인") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
        if (error != null) Text(error!!, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
        Button(onClick = { create() }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(if (busy) "키 생성 중…" else "키 만들기") }
    }
}

@Composable
private fun LockNote(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
}
