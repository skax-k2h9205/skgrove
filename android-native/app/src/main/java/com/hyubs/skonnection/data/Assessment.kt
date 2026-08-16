package com.hyubs.skonnection.data

// MBTI(16문항) + DISC(12문항) 성향 진단 (웹 assessment.ts · iOS Assessment 이식). 채점은 순수 함수 — 단위테스트.

data class MBTIQuestion(val id: String, val axis: String, val a: String, val b: String)
data class DISCOption(val text: String, val key: Char)
data class DISCQuestion(val id: String, val prompt: String, val options: List<DISCOption>)

object Assessment {
    val mbti: List<MBTIQuestion> = listOf(
        MBTIQuestion("ei1", "EI", "사람들과 얘기하다 보면 아이디어가 샘솟는다", "혼자 정리한 뒤에 공유하고 싶다"),
        MBTIQuestion("ei2", "EI", "사람들과 어울릴 때 힘이 난다", "혼자만의 시간에 힘이 채워진다"),
        MBTIQuestion("ei3", "EI", "떠오르는 대로 말하며 생각을 정리한다", "생각을 다 정리한 뒤에 말한다"),
        MBTIQuestion("ei4", "EI", "처음 보는 자리에서 먼저 말을 건다", "상대가 다가오길 기다리는 편이다"),
        MBTIQuestion("sn1", "SN", "구체적인 사실과 사례부터 본다", "큰 그림과 가능성부터 본다"),
        MBTIQuestion("sn2", "SN", "단계와 예시가 있어야 이해가 편하다", "개념과 의미가 먼저 와닿는다"),
        MBTIQuestion("sn3", "SN", "검증된 방식을 신뢰한다", "새로운 방식을 시도하고 싶다"),
        MBTIQuestion("sn4", "SN", "지금 필요한 현실에 집중한다", "앞으로의 변화를 상상한다"),
        MBTIQuestion("tf1", "TF", "결정할 때 논리와 효율이 우선이다", "결정할 때 사람과 관계가 우선이다"),
        MBTIQuestion("tf2", "TF", "피드백은 문제를 직설적으로 짚는다", "피드백은 상대 기분을 먼저 살핀다"),
        MBTIQuestion("tf3", "TF", "갈등에선 무엇이 옳은지 따진다", "갈등에선 모두가 편한지 살핀다"),
        MBTIQuestion("tf4", "TF", "타당한 근거가 나를 움직인다", "공감과 인정이 나를 움직인다"),
        MBTIQuestion("jp1", "JP", "일정을 미리 계획하고 지킨다", "상황에 따라 유연하게 움직인다"),
        MBTIQuestion("jp2", "JP", "마감은 일찍 끝내야 안심된다", "막판 집중이 더 잘 된다"),
        MBTIQuestion("jp3", "JP", "계획을 짜두면 마음이 편하다", "즉흥적으로 하는 게 즐겁다"),
        MBTIQuestion("jp4", "JP", "할 일과 자리는 정리돼 있어야 한다", "조금 어수선해도 괜찮다"),
    )

    val disc: List<DISCQuestion> = listOf(
        DISCQuestion("d1", "새 업무가 주어지면 먼저", listOf(
            DISCOption("목표와 결과부터 잡는다", 'D'), DISCOption("함께할 사람들과 논의한다", 'I'),
            DISCOption("기존 흐름에 맞춰 안정적으로 시작", 'S'), DISCOption("요건과 기준을 꼼꼼히 확인", 'C'))),
        DISCQuestion("d2", "회의에서 내 역할은", listOf(
            DISCOption("결론으로 몰고 간다", 'D'), DISCOption("분위기를 띄운다", 'I'),
            DISCOption("의견을 조율하고 경청한다", 'S'), DISCOption("근거와 데이터를 챙긴다", 'C'))),
        DISCQuestion("d3", "갈등이 생기면", listOf(
            DISCOption("정면돌파해 빠르게 결론", 'D'), DISCOption("대화로 관계를 회복", 'I'),
            DISCOption("한발 물러나 진정시킴", 'S'), DISCOption("사실관계부터 정리", 'C'))),
        DISCQuestion("d4", "마감이 촉박할 때", listOf(
            DISCOption("밀어붙여 끝낸다", 'D'), DISCOption("팀을 독려한다", 'I'),
            DISCOption("차분히 순서대로 한다", 'S'), DISCOption("품질 기준은 지킨다", 'C'))),
        DISCQuestion("d5", "피드백을 줄 때", listOf(
            DISCOption("핵심만 직설적으로", 'D'), DISCOption("긍정적으로 북돋우며", 'I'),
            DISCOption("부드럽고 배려 있게", 'S'), DISCOption("근거와 예시를 들어", 'C'))),
        DISCQuestion("d6", "새 도구·변화가 오면", listOf(
            DISCOption("일단 써보고 판단", 'D'), DISCOption("신나서 남에게 알림", 'I'),
            DISCOption("충분한 적응기간이 필요", 'S'), DISCOption("검증한 뒤 도입", 'C'))),
        DISCQuestion("d7", "의사결정은", listOf(
            DISCOption("빠르게 내가 결정", 'D'), DISCOption("함께 합의해 결정", 'I'),
            DISCOption("모두 편한 쪽으로", 'S'), DISCOption("데이터로 결정", 'C'))),
        DISCQuestion("d8", "스트레스를 받으면", listOf(
            DISCOption("더 강하게 밀어붙인다", 'D'), DISCOption("말이 많아진다", 'I'),
            DISCOption("조용해지고 참는다", 'S'), DISCOption("혼자 파고든다", 'C'))),
        DISCQuestion("d9", "인정받고 싶은 지점은", listOf(
            DISCOption("성과와 결과", 'D'), DISCOption("영향력과 인기", 'I'),
            DISCOption("신뢰와 성실", 'S'), DISCOption("정확성과 전문성", 'C'))),
        DISCQuestion("d10", "협업에서 가장 답답한 건", listOf(
            DISCOption("느린 진행", 'D'), DISCOption("딱딱한 분위기", 'I'),
            DISCOption("잦은 변경", 'S'), DISCOption("근거 없는 결정", 'C'))),
        DISCQuestion("d11", "내 강점은", listOf(
            DISCOption("추진력", 'D'), DISCOption("사교성", 'I'),
            DISCOption("안정감", 'S'), DISCOption("정확성", 'C'))),
        DISCQuestion("d12", "일할 때 중요한 건", listOf(
            DISCOption("속도와 결과", 'D'), DISCOption("관계와 재미", 'I'),
            DISCOption("조화와 지속", 'S'), DISCOption("정확과 원칙", 'C'))),
    )

    private val axisLetters = mapOf("EI" to ('E' to 'I'), "SN" to ('S' to 'N'), "TF" to ('T' to 'F'), "JP" to ('J' to 'P'))

    /** MBTI 채점 — 축별로 a 응답 비중 ≥50%면 첫 글자. answers: id→true(=a). */
    fun scoreMBTI(answers: Map<String, Boolean>): String {
        val sb = StringBuilder()
        for (axis in listOf("EI", "SN", "TF", "JP")) {
            val qs = mbti.filter { it.axis == axis }
            val answered = qs.filter { answers.containsKey(it.id) }
            val aCount = qs.count { answers[it.id] == true }
            val lean = if (answered.isEmpty()) 50 else Math.round(aCount.toDouble() / answered.size * 100).toInt()
            val (first, second) = axisLetters.getValue(axis)
            sb.append(if (lean >= 50) first else second)
        }
        return sb.toString()
    }

    /** DISC 채점 — 최다 득표(동점은 D>I>S>C). */
    fun scoreDISC(answers: Map<String, Char>): Char {
        val counts = mutableMapOf('D' to 0, 'I' to 0, 'S' to 0, 'C' to 0)
        answers.values.forEach { counts[it] = (counts[it] ?: 0) + 1 }
        val order = listOf('D', 'I', 'S', 'C')
        return order.maxByOrNull { counts.getValue(it) * 10 - order.indexOf(it) } ?: 'S'
    }

    val discLabel = mapOf('D' to "주도형", 'I' to "사교형", 'S' to "안정형", 'C' to "신중형")
    val discGuide = mapOf(
        'D' to "결론부터 간결하게. 목표·결과 중심으로 말하면 빠르게 통합니다.",
        'I' to "밝게 관계부터. 인정과 열정을 곁들이면 잘 움직입니다.",
        'S' to "안심과 시간을 주며 부드럽게. 급한 변경은 미리 알려주세요.",
        'C' to "근거·데이터와 함께. 정확한 기준과 이유를 주면 신뢰합니다.",
    )

    val total get() = mbti.size + disc.size
    val mbtiOptions = listOf("", "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
        "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP")
    val discOptions = listOf("", "D", "I", "S", "C")
}
