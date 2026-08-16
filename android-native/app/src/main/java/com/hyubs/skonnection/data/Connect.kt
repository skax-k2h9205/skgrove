package com.hyubs.skonnection.data

import kotlinx.serialization.Serializable

// 조 뽑기(웹 Connect · iOS ConnectView 이식). 배분은 순수 함수로 두어 무작위 없이 단위테스트한다.

/** 조 편성 대상 한 명 — 이름·파트만 있으면 배분할 수 있다. */
data class DrawMember(val name: String, val part: String)

fun Profile.toDrawMember() = DrawMember(name = name, part = part)

object ConnectDraw {
    /**
     * 파트별 버킷을 라운드로빈으로 인터리브 — 같은 파트가 이어지지 않게 섞는다.
     * 입력 순서(무작위는 호출측이 미리 섞어 넘긴다)를 버킷 안에서 보존한다.
     */
    fun interleaveByPart(people: List<DrawMember>): List<DrawMember> {
        val buckets = LinkedHashMap<String, ArrayDeque<DrawMember>>()
        for (p in people) buckets.getOrPut(p.part) { ArrayDeque() }.addLast(p)
        val lists = buckets.values.toList()
        val out = ArrayList<DrawMember>(people.size)
        var i = 0
        while (lists.any { it.isNotEmpty() }) {
            val q = lists[i % lists.size]
            if (q.isNotEmpty()) out.add(q.removeFirst())
            i++
        }
        return out
    }

    /**
     * 스네이크(1→n→1) 배분 — 조 인원과 파트 구성을 고르게 한다.
     * groupCount 는 2 이상, 인원 수 이하로 호출측이 보장한다.
     */
    fun snake(ordered: List<DrawMember>, groupCount: Int): List<List<DrawMember>> {
        val n = groupCount.coerceAtLeast(1)
        val groups = MutableList(n) { mutableListOf<DrawMember>() }
        var g = 0
        var forward = true
        for (p in ordered) {
            groups[g].add(p)
            if (forward) { if (g == n - 1) forward = false else g++ }
            else { if (g == 0) forward = true else g-- }
        }
        return groups
    }

    /** 공유·저장용 텍스트: "1조: A, B\n2조: C, D". */
    fun shareText(groups: List<List<DrawMember>>): String =
        groups.mapIndexed { i, g -> "${i + 1}조: " + g.joinToString(", ") { it.name } }
            .joinToString("\n")
}

/** connect_results 저장 페이로드 — 웹·iOS와 같은 테이블. */
@Serializable
data class ConnectResultRow(
    val id: String,
    val mode: String,
    val title: String,
    val created_at: String,
    val summary: String,
    val share_text: String,
    val share_url: String = "",
)
