package com.hyubs.skonnection.data

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CoffeeGameTest {
    // iOS/웹과 바이트 동일해야 하는 정답 벡터(python 재현: SplitMix64 표준).
    @Test fun splitMix64MatchesReferenceVectors() {
        assertEquals(16294208416658607535uL, SplitMix64(0uL).next())
        assertEquals(10451216379200822465uL, SplitMix64(1uL).next())
        assertEquals(2466975172287755897uL, SplitMix64(123456789uL).next())
        assertEquals(5395234354446855067uL, SplitMix64(0xDEADBEEFuL).next())
    }

    @Test fun winnerIndexIsDeterministicAcrossDevices() {
        // 같은 seed·참가자면 어느 기기든 같은 당첨자.
        val people = (1..5).map { CoffeeParticipant("P$it") }
        val g = CoffeeGame("GAT-1", CoffeeGameKind.WHEEL, CoffeeGamePhase.DONE, seed = 123456789uL, participants = people)
        assertEquals(2, g.winnerIndex)          // 2466975172287755897 % 5 == 2
        assertEquals("P3", g.winnerName)
    }

    @Test fun wheelStopsWithWinnerUnderPointer() {
        // 애니메이션 끝(totalDuration)의 회전각이 당첨 칸을 위쪽(-90°)에 정렬해야 한다.
        val count = 6
        for (winner in 0 until count) {
            val rot = CoffeeSpin.wheelRotation(CoffeeSpin.wheelTotalDuration, winner, count)
            val delta = 360.0 / count
            // 칸 중심각(-90 + (i+0.5)*delta)이 회전 후 위(-90)로 오는지: (center + rot) ≡ -90 (mod 360)
            val center = -90 + (winner + 0.5) * delta
            val landed = CoffeeSpin.mod360(center + rot + 90)
            assertTrue("winner=$winner landed=$landed", landed < 0.5 || landed > 359.5)
        }
    }

    @Test fun fingerFocusEndsOnWinner() {
        val count = 4
        val focusEnd = CoffeeSpin.fingerFocus(CoffeeSpin.FINGER_DURATION, winnerIndex = 3, count = count)
        assertEquals(3, focusEnd)
        // 초반엔 당첨자가 아닌 다른 사람도 지나간다(움직임 확인)
        val focusStart = CoffeeSpin.fingerFocus(0.0, winnerIndex = 3, count = count)
        assertTrue(focusStart in 0 until count)
    }

    @Test fun jsonSchemaMatchesIOSShape() {
        // iOS Codable 은 camelCase 키 + enum rawValue(한글) + phase 소문자. 동일해야 크로스 관전 가능.
        val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
        val g = CoffeeGame("GAT-9", CoffeeGameKind.FINGER, CoffeeGamePhase.SPINNING,
            seed = 42uL, participants = listOf(CoffeeParticipant("김수정", "http://x/p.jpg")),
            winner = "", startedAtMs = 1786000000000L, startedBy = "이두민")
        val s = json.encodeToString(CoffeeGame.serializer(), g)
        assertTrue(s, s.contains("\"gatheringId\":\"GAT-9\""))
        assertTrue(s, s.contains("\"kind\":\"손가락룰렛\""))
        assertTrue(s, s.contains("\"phase\":\"spinning\""))
        assertTrue(s, s.contains("\"startedAtMs\":1786000000000"))
        assertTrue(s, s.contains("\"photoURL\":\"http://x/p.jpg\""))
        // 역직렬화 왕복
        val back = json.decodeFromString(CoffeeGame.serializer(), s)
        assertEquals(g, back)
    }
}
