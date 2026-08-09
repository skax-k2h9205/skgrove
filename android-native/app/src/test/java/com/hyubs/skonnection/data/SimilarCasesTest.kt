package com.hyubs.skonnection.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 유사 사례 추리기 — 웹 similarCases.ts 와 같은 규칙인지 고정한다. */
class SimilarCasesTest {

    private fun issue(id: String, title: String, body: String = "", expected: String = "") = Issue(
        id = id, title = title, category = "", target = "", status = "접수", urgency = "",
        body = body, submitter = "", identity = "", expectedChange = expected, visibility = "",
        leaderReply = "", oneOnOneNote = "", reason = "", actionItem = "", createdAt = "",
    )

    private fun agenda(id: String, title: String, description: String = "") = Agenda(
        id = id, title = title, description = description, category = "", part = "전체",
        approve = 0, reject = 0, status = "투표중", deadline = "", eligibleCount = 0,
    )

    @Test
    fun `겹치는 단어가 없으면 빈 목록`() {
        val cases = SimilarCases.find(
            "휴가 절차가 궁금해요",
            listOf(issue("SOOP-1", "회의가 너무 길어요", "매번 두 시간씩 합니다")),
            emptyList(),
        )
        assertTrue(cases.isEmpty())
    }

    @Test
    fun `질문이 비면 아무것도 고르지 않는다`() {
        val cases = SimilarCases.find("", listOf(issue("SOOP-1", "회의가 길어요")), emptyList())
        assertTrue(cases.isEmpty())
    }

    @Test
    fun `접수와 안건을 함께 고르고 출처를 구분한다`() {
        val cases = SimilarCases.find(
            "회의 시간이 길어서 힘들어요",
            listOf(issue("SOOP-1", "회의가 너무 길어요", "회의 시간을 줄이면 좋겠어요")),
            listOf(agenda("AGD-1", "회의 시간 제한", "회의 최대 한 시간")),
        )
        assertEquals(2, cases.size)
        assertTrue(cases.any { it.source == "대나무숲" && it.id == "SOOP-1" })
        assertTrue(cases.any { it.source == "안건" && it.id == "AGD-1" })
    }

    @Test
    fun `겹치는 단어가 많은 것이 앞에 온다`() {
        val cases = SimilarCases.find(
            "회의 피드백 문화",
            listOf(
                issue("SOOP-weak", "피드백 이야기", ""),
                issue("SOOP-strong", "회의 피드백 문화", "회의 피드백 문화가 아쉽습니다"),
            ),
            emptyList(),
        )
        assertEquals("SOOP-strong", cases.first().id)
    }

    @Test
    fun `흔한 조사·접속사만 겹치는 것은 근거로 삼지 않는다`() {
        val cases = SimilarCases.find(
            "저는 우리 회사가 너무 좋아요",
            listOf(issue("SOOP-1", "우리 회사 주차 문제", "저는 정말 불편합니다")),
            emptyList(),
        )
        assertTrue("불용어만 겹치면 사례로 뽑히면 안 된다", cases.isEmpty())
    }

    @Test
    fun `기본 상한은 세 건이다`() {
        val issues = (1..10).map { issue("SOOP-$it", "회의 문화 개선", "회의 문화 이야기") }
        assertEquals(3, SimilarCases.find("회의 문화", issues, emptyList()).size)
    }

    @Test
    fun `본문이 비면 기대하는 변화를 발췌로 쓴다`() {
        val cases = SimilarCases.find(
            "야근 줄이기",
            listOf(issue("SOOP-1", "야근", body = "", expected = "야근을 줄이면 좋겠습니다")),
            emptyList(),
        )
        assertEquals("야근을 줄이면 좋겠습니다", cases.single().snippet)
    }

    /**
     * 실제 팀 데이터로 끝단 확인 — 이 질문이 이 접수를 근거로 고르지 못하면
     * 상담 답에서 "우리 팀에도 이런 일이 있었다"가 사라진다.
     */
    @Test
    fun `실제 접수 문구로 회의 고민을 물으면 그 접수가 근거로 뽑힌다`() {
        val real = issue(
            "SOOP-MSIOBTEC",
            "회의 시간 및 운영 방식 효율화가 필요합니다.",
            "사전 안건 공유나 명확한 쟁점 정리 없이 회의가 소집되어 쓸데없이 논의가 길어지는 경우가 많습니다",
        )
        val noise = issue("SOOP-X", "주차장 자리가 부족해요", "출근길이 힘듭니다")

        val cases = SimilarCases.find(
            "회의가 너무 길고 쟁점 없이 흘러가서 지칩니다. 어떻게 하면 좋을까요?",
            listOf(noise, real),
            emptyList(),
        )
        assertEquals("SOOP-MSIOBTEC", cases.first().id)
        assertEquals("대나무숲", cases.first().source)
    }
}
