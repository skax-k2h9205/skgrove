package com.hyubs.skonnection.data

import org.junit.Assert.assertEquals
import org.junit.Test

class GrowthRulesTest {
    @Test fun clampsProgressAndLevel() {
        assertEquals(0, GrowthRules.clampProgress(-10))
        assertEquals(100, GrowthRules.clampProgress(150))
        assertEquals(55, GrowthRules.clampProgress(55))
        assertEquals(1, GrowthRules.clampLevel(0))
        assertEquals(5, GrowthRules.clampLevel(9))
        assertEquals(3, GrowthRules.clampLevel(3))
    }

    @Test fun nextStatusByProgress() {
        assertEquals("진행중", GrowthRules.nextStatus(0))
        assertEquals("진행중", GrowthRules.nextStatus(99))
        assertEquals("완료", GrowthRules.nextStatus(100))
    }

    @Test fun curveFiltersByCompetencyAndByAndSortsByTime() {
        val log = listOf(
            CompetencyLogEntry("1", "a@sk.com", "협업·소통", 2, "self", "2026-08-01T00:00:00Z"),
            CompetencyLogEntry("2", "a@sk.com", "협업·소통", 3, "self", "2026-08-03T00:00:00Z"),
            CompetencyLogEntry("3", "a@sk.com", "협업·소통", 4, "leader", "2026-08-02T00:00:00Z"),
            CompetencyLogEntry("4", "a@sk.com", "실행·개발", 5, "self", "2026-08-02T00:00:00Z"),
        )
        assertEquals(listOf(2, 3), GrowthRules.curve(log, "협업·소통", "self"))
        assertEquals(listOf(4), GrowthRules.curve(log, "협업·소통", "leader"))
        assertEquals(listOf(5), GrowthRules.curve(log, "실행·개발", "self"))
        assertEquals(emptyList<Int>(), GrowthRules.curve(log, "AI 활용", "self"))
    }
}
