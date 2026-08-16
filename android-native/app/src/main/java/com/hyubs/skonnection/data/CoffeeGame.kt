package com.hyubs.skonnection.data

import com.hyubs.skonnection.net.SupabaseClient
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

// 커피 내기 게임(커피룰렛 · 손가락룰렛) — iOS CoffeeGame 이식.
// 화면을 스트리밍하지 않는다. 주최자가 seed·시작시각만 올리고, 각 기기가 같은 seed 로
// 똑같은 애니메이션을 스스로 그린다(실시간 중계 + 다시보기를 데이터 한 건으로).
// 저장은 기존 app_config(key, value jsonb) 재사용 — 키 `coffee_game:<모임id>`.
//
// **iOS/웹과 JSON 스키마·난수기가 반드시 일치**해야 iOS 주최 ↔ Android 관전에서
// 모두가 같은 당첨자를 본다(SplitMix64Test·camelCase 키).

@Serializable
enum class CoffeeGameKind {
    @SerialName("커피룰렛") WHEEL,
    @SerialName("손가락룰렛") FINGER;

    val label: String get() = if (this == WHEEL) "커피룰렛" else "손가락룰렛"
    val blurb: String get() = if (this == WHEEL) "이름 칸으로 나뉜 원판을 돌립니다" else "다 같이 한 폰에 손가락을 올립니다"
}

@Serializable
enum class CoffeeGamePhase {
    @SerialName("ready") READY,
    @SerialName("spinning") SPINNING,
    @SerialName("done") DONE,
}

@Serializable
data class CoffeeParticipant(
    val name: String,
    val photoURL: String = "",
)

@Serializable
data class CoffeeGame(
    val gatheringId: String,
    val kind: CoffeeGameKind,
    val phase: CoffeeGamePhase,
    val seed: ULong = 0uL,
    val participants: List<CoffeeParticipant> = emptyList(),
    val winner: String = "",
    val startedAtMs: Long = 0,
    val startedBy: String = "",
) {
    /** seed 로 정해지는 당첨자 인덱스 — 모든 기기가 같은 답을 낸다. */
    val winnerIndex: Int
        get() = if (participants.isEmpty()) 0 else (SplitMix64(seed).next() % participants.size.toULong()).toInt()

    val winnerName: String
        get() = participants.getOrNull(winnerIndex)?.name ?: ""

    /** spinning 시작 후 흐른 시간(초). 관전자 화면 위치를 맞추는 기준. */
    fun elapsed(nowMs: Long): Double = maxOf(0.0, (nowMs - startedAtMs) / 1000.0)

    companion object {
        fun key(gatheringId: String) = "coffee_game:$gatheringId"
    }
}

/**
 * 씨앗을 받는 결정론적 난수기(SplitMix64). iOS/웹과 **바이트 동일**해야 한다.
 * Kotlin ULong 연산은 자동 래핑되어 Swift `&+`/`&*` 와 같은 결과를 낸다.
 */
class SplitMix64(seed: ULong) {
    private var state: ULong = seed
    fun next(): ULong {
        state += 0x9E3779B97F4A7C15uL
        var z = state
        z = (z xor (z shr 30)) * 0xBF58476D1CE4E5B9uL
        z = (z xor (z shr 27)) * 0x94D049BB133111EBuL
        return z xor (z shr 31)
    }
}

/**
 * 두 게임의 연출 타임라인 — 시간만 넣으면 화면이 정해지는 순수 계산.
 * 주최자·관전자가 각자 그려도 같은 그림이 나온다(동기화의 핵심). iOS CoffeeSpin 이식.
 */
object CoffeeSpin {
    // ── 커피룰렛(원판) ──
    const val WHEEL_FAST = 1.4
    const val WHEEL_SLOW = 3.2
    val wheelTotalDuration get() = WHEEL_FAST + WHEEL_SLOW
    private const val WHEEL_FAST_SPEED = 900.0 // deg/s

    fun mod360(x: Double): Double {
        val m = x % 360.0
        return if (m < 0) m + 360 else m
    }

    /** 원판이 최종적으로 멈춰야 하는 각도(당첨 칸이 위쪽 바늘에 오는 각). */
    fun wheelTotalRotation(winnerIndex: Int, count: Int): Double {
        if (count <= 0) return 0.0
        val delta = 360.0 / count
        val align = mod360(-(winnerIndex + 0.5) * delta)
        val fast = WHEEL_FAST_SPEED * WHEEL_FAST
        val base = fast + 360 * 3
        return base + mod360(align - mod360(base))
    }

    /** 경과 시간 t 에서의 회전각. */
    fun wheelRotation(t: Double, winnerIndex: Int, count: Int): Double {
        val total = wheelTotalRotation(winnerIndex, count)
        if (t <= 0) return 0.0
        if (t < WHEEL_FAST) return WHEEL_FAST_SPEED * t
        val fast = WHEEL_FAST_SPEED * WHEEL_FAST
        val p = minOf(1.0, (t - WHEEL_FAST) / WHEEL_SLOW)
        val eased = 1 - Math.pow(1 - p, 3.0) // easeOutCubic
        return fast + (total - fast) * eased
    }

    // ── 손가락룰렛(두구두구) ──
    const val FINGER_DURATION = 3.0

    private fun fingerSteps(): List<Double> {
        val steps = ArrayList<Double>()
        var d = 0.075
        var sum = 0.0
        while (sum < FINGER_DURATION) {
            steps.add(d); sum += d; d *= 1.16
        }
        return steps
    }

    /** 경과 시간 t 에 포커스된 참가자 인덱스. 마지막 칸이 당첨자가 되도록 역산. */
    fun fingerFocus(t: Double, winnerIndex: Int, count: Int): Int {
        if (count <= 0) return 0
        val steps = fingerSteps()
        var acc = 0.0
        for (k in steps.indices) {
            acc += steps[k]
            if (t < acc) {
                val fromEnd = steps.size - 1 - k
                return ((winnerIndex - fromEnd) % count + count) % count
            }
        }
        return winnerIndex
    }
}

// ── app_config I/O ──
@Serializable
private data class CoffeeGameRow(val value: CoffeeGame)

@Serializable
private data class CoffeeGameUpsert(val key: String, val value: CoffeeGame)

@Serializable
private data class AccountPhotoRow(val name: String? = null, @SerialName("photo_url") val photoUrl: String? = null)

/** 커피 게임 원격 상태(app_config) + 참가자 사진(accounts.photo_url). */
class CoffeeGameRepository(private val supabase: SupabaseClient) {
    suspend fun load(gatheringId: String): CoffeeGame? =
        supabase.select(
            "app_config", "key=eq.${CoffeeGame.key(gatheringId)}&select=value",
            ListSerializer(CoffeeGameRow.serializer()),
        ).firstOrNull()?.value

    suspend fun push(game: CoffeeGame) =
        supabase.upsert(
            "app_config", CoffeeGameUpsert(CoffeeGame.key(game.gatheringId), game),
            CoffeeGameUpsert.serializer(), onConflict = "key",
        )

    suspend fun clear(gatheringId: String) =
        supabase.delete("app_config", "key=eq.${CoffeeGame.key(gatheringId)}")

    /** 이름 → 프로필 사진 URL. 사외망에선 안 열릴 수 있어 화면은 이니셜 폴백. */
    suspend fun loadPhotos(): Map<String, String> =
        supabase.select("accounts", "select=name,photo_url", ListSerializer(AccountPhotoRow.serializer()))
            .mapNotNull { r -> val n = r.name; val p = r.photoUrl; if (!n.isNullOrBlank() && !p.isNullOrBlank()) n to p else null }
            .toMap()
}
