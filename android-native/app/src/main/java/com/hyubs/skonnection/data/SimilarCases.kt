package com.hyubs.skonnection.data

/**
 * 상담 맥락용 '유사 사례' 추리기(웹 features/chat/similarCases.ts 이식).
 *
 * 임베딩·RAG 없이 키워드 겹침으로 상위 N건만 고른다. 팀 안에서 실제 제기된 일이 쌓이는 곳 —
 * 대나무숲 접수와 안건 — 에서 질문과 겹치는 단어가 많은 것을 근거로 삼아
 * "우리 팀에도 이런 일이 있었다"에 답하게 한다.
 */
object SimilarCases {

    /** 조사·접속사 등 흔한 말은 겹쳐도 의미가 없어 점수에서 뺀다. */
    private val STOP = setOf(
        "그리고", "하지만", "그런데", "저는", "제가", "너무", "정말", "우리", "회사", "있어요",
        "있는", "해요", "하고", "하는", "그냥", "근데", "어떻게", "때문", "에서", "으로", "합니다",
        "같아요", "싶어요", "거예요", "거에요", "어요", "네요", "이에요", "예요",
    )

    private val WORD = Regex("[가-힣a-z0-9]{2,}")

    private fun tokens(text: String): List<String> =
        WORD.findAll(text.lowercase()).map { it.value }.filterNot { it in STOP }.toList()

    private fun snip(text: String, n: Int = 80): String {
        val t = text.trim().replace(Regex("\\s+"), " ")
        return if (t.length > n) t.take(n) + "…" else t
    }

    /** 질문과 키워드가 겹치는 접수·안건을 점수순 상위 limit 건으로. 겹치는 게 없으면 빈 목록. */
    fun find(query: String, issues: List<Issue>, agendas: List<Agenda>, limit: Int = 3): List<CaseBrief> {
        val q = tokens(query).toSet()
        if (q.isEmpty()) return emptyList()
        fun score(text: String) = tokens(text).count { it in q }

        val pool = mutableListOf<Pair<Int, CaseBrief>>()
        issues.forEach { issue ->
            val s = score("${issue.title} ${issue.body} ${issue.expectedChange}")
            if (s > 0) {
                pool += s to CaseBrief(
                    source = "대나무숲", id = issue.id, title = issue.title, status = issue.status,
                    snippet = snip(issue.body.ifBlank { issue.expectedChange }),
                )
            }
        }
        agendas.forEach { agenda ->
            val s = score("${agenda.title} ${agenda.description}")
            if (s > 0) {
                pool += s to CaseBrief(
                    source = "안건", id = agenda.id, title = agenda.title, status = agenda.status,
                    snippet = snip(agenda.description),
                )
            }
        }

        return pool.sortedByDescending { it.first }.take(limit).map { it.second }
    }
}
