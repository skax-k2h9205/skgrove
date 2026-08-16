package com.hyubs.skonnection.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConnectDrawTest {
    private fun m(name: String, part: String) = DrawMember(name, part)

    @Test fun snakeBalancesGroupSizes() {
        val people = (1..7).map { m("P$it", "A") }
        val groups = ConnectDraw.snake(people, 3)
        assertEquals(3, groups.size)
        // 7명/3조 → 3,2,2 (±1 이내)
        val sizes = groups.map { it.size }.sortedDescending()
        assertEquals(listOf(3, 2, 2), sizes)
        // 스네이크: 1조=P1,P6,P7 / 2조=P2,P5 / 3조=P3,P4
        assertEquals(listOf("P1", "P6", "P7"), groups[0].map { it.name })
        assertEquals(listOf("P2", "P5"), groups[1].map { it.name })
        assertEquals(listOf("P3", "P4"), groups[2].map { it.name })
    }

    @Test fun interleaveSpreadsParts() {
        val people = listOf(
            m("a1", "A"), m("a2", "A"), m("a3", "A"),
            m("b1", "B"), m("b2", "B"),
            m("c1", "C"),
        )
        val out = ConnectDraw.interleaveByPart(people)
        assertEquals(people.size, out.size)
        // 라운드로빈: A,B,C,A,B,A
        assertEquals(listOf("a1", "b1", "c1", "a2", "b2", "a3"), out.map { it.name })
    }

    @Test fun interleaveThenSnakeSpreadsPartsAcrossGroups() {
        val people = listOf(
            m("a1", "A"), m("a2", "A"), m("a3", "A"), m("a4", "A"),
            m("b1", "B"), m("b2", "B"), m("b3", "B"), m("b4", "B"),
        )
        val groups = ConnectDraw.snake(ConnectDraw.interleaveByPart(people), 2)
        // 두 파트가 두 조에 골고루 흩어져야 한다(한 조에 몰리지 않음)
        groups.forEach { g ->
            val aCount = g.count { it.part == "A" }
            assertTrue("각 조에 A파트가 몰리지 않아야 함", aCount in 1..3)
        }
    }

    @Test fun shareTextFormats() {
        val groups = listOf(listOf(m("A", "P"), m("B", "P")), listOf(m("C", "P")))
        assertEquals("1조: A, B\n2조: C", ConnectDraw.shareText(groups))
    }
}
