package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

// 알림 발송 설정(웹 notifySettingsStore · iOS SystemStore 이식). app_config 의 skgrove:notifysettings 행을 팀 전체가 공유.

/** 화면에 노출할 9종 알림. */
data class NotifyKind(val id: String, val label: String, val sub: String)

object NotifyDefaults {
    val kinds = listOf(
        NotifyKind("issue", "새 접수", "대나무숲에 새 의견이 들어온 때"),
        NotifyKind("agenda", "안건 등록", "새 안건이 투표에 올라온 때"),
        NotifyKind("deadline", "마감 임박", "안건 투표 마감이 임박한 때"),
        NotifyKind("action", "액션 배정", "액션아이템 담당이 정해진 때"),
        NotifyKind("gathering", "모임", "모임·번개가 열린 때"),
        NotifyKind("market", "장터", "장터에 새 물건·입찰이 있는 때"),
        NotifyKind("humor", "유머", "유머 게시판에 새 글이 올라온 때"),
        NotifyKind("tea", "티미팅", "티미팅이 제안·채택된 때"),
        NotifyKind("message", "메시지", "1:1 제안 등 개인 메시지"),
    )

    val routeOptions = listOf(
        "team" to "팀 채널", "connector" to "커넥셔너", "dm" to "개인 DM", "off" to "발송 안 함",
    )

    val routes: Map<String, String> = mapOf(
        "issue" to "dm", "agenda" to "team", "deadline" to "team", "action" to "off",
        "gathering" to "off", "market" to "off", "humor" to "off", "tea" to "connector", "message" to "dm",
    )
}

/** app_config.value(jsonb) 스키마 — 웹·iOS와 동일. */
@Serializable
data class NotifyValue(
    val routes: Map<String, String>? = null,
    val channels: Map<String, String>? = null,
    val dmEnabled: Boolean? = null,
    val slackEnabled: Boolean? = null,
)

@Serializable
data class ConfigRow(val value: NotifyValue)

@Serializable
data class ConfigUpsert(val key: String, val value: NotifyValue)

/** 알림 설정 원격 I/O — app_config(key=skgrove:notifysettings) 한 행. */
class SystemRepository(private val supabase: SupabaseClient) {
    private val configKey = "skgrove:notifysettings"

    suspend fun load(): NotifyValue? =
        supabase.select("app_config", "key=eq.$configKey&select=value", ListSerializer(ConfigRow.serializer()))
            .firstOrNull()?.value

    suspend fun save(value: NotifyValue) =
        supabase.upsert("app_config", ConfigUpsert(configKey, value), ConfigUpsert.serializer(), onConflict = "key")
}
