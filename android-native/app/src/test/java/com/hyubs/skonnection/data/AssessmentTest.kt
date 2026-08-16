package com.hyubs.skonnection.data

import org.junit.Assert.assertEquals
import org.junit.Test

class AssessmentTest {
    @Test fun banksHaveExpectedSizes() {
        assertEquals(16, Assessment.mbti.size)
        assertEquals(12, Assessment.disc.size)
        assertEquals(28, Assessment.total)
    }

    @Test fun scoreMBTI_allA_isESTJ() {
        val answers = Assessment.mbti.associate { it.id to true }
        assertEquals("ESTJ", Assessment.scoreMBTI(answers))
    }

    @Test fun scoreMBTI_allB_isINFP() {
        val answers = Assessment.mbti.associate { it.id to false }
        assertEquals("INFP", Assessment.scoreMBTI(answers))
    }

    @Test fun scoreMBTI_unansweredAxisLeansFirst() {
        // 아무 응답 없으면 lean=50 → 첫 글자 → ESTJ
        assertEquals("ESTJ", Assessment.scoreMBTI(emptyMap()))
    }

    @Test fun scoreDISC_majorityWins() {
        val answers = mapOf("d1" to 'C', "d2" to 'C', "d3" to 'C', "d4" to 'I')
        assertEquals('C', Assessment.scoreDISC(answers))
    }

    @Test fun scoreDISC_tieBreaksByDISCOrder() {
        // D와 I 동점 → D 우선
        val answers = mapOf("d1" to 'I', "d2" to 'D')
        assertEquals('D', Assessment.scoreDISC(answers))
        // S와 C 동점 → S 우선
        val sc = mapOf("d1" to 'C', "d2" to 'S')
        assertEquals('S', Assessment.scoreDISC(sc))
    }
}
