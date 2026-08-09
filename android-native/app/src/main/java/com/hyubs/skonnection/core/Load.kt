package com.hyubs.skonnection.core

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.serialization.SerializationException
import java.io.IOException

private const val TAG = "SKonnection"

/**
 * 원격 로드 공통 처리 — 실패를 '빈 목록'으로 뭉개지 않는다.
 *
 * 이전에는 어디서나 `runCatching { ... }.getOrDefault(emptyList())` 였다.
 * 이러면 네트워크 오류도, 모델 타입 불일치도 전부 "등록된 게 없어요" 화면이 된다.
 * 실제로 팀 추억이 id 타입 불일치(Int↔Long)로 오랫동안 통째로 비어 있었는데
 * 화면이 정상으로 보여서 아무도 알아채지 못했다.
 *
 * 여기서 예외를 logcat에 남기고 호출부에는 null을 돌려준다. 화면은 error 상태를 받아
 * '데이터 없음'과 '못 불러옴'을 구분해 보여주고, 다시 시도할 길을 준다.
 *
 * 성공해도 error를 지우지 **않는다**. 한 화면이 두 번 로드할 때(캔미팅+티미팅) 나중 성공이
 * 앞선 실패를 덮어버리기 때문이다. 초기화는 호출부가 로드를 시작할 때 한 번 한다.
 */
suspend fun <T> loadOrNull(label: String, error: MutableStateFlow<String?>, block: suspend () -> T): T? =
    runCatching { block() }
        .onFailure {
            Log.w(TAG, "load failed: $label", it)
            error.value = it.loadMessage()
        }
        .getOrNull()

/**
 * 사용자에게 보일 한 줄. 손쓸 방법이 달라지는 만큼만 구분하고 자세한 것은 logcat에 남긴다.
 * 형식 불일치는 다시 눌러도 소용없으므로 원인을 분명히 말해준다.
 */
fun Throwable.loadMessage(): String = when (this) {
    is IOException -> "네트워크에 연결하지 못했어요."
    is SerializationException -> "데이터 형식이 앱과 맞지 않아요. 앱 업데이트가 필요할 수 있어요."
    else -> "불러오지 못했어요."
}
