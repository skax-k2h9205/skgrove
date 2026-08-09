package com.hyubs.skonnection.feature.chat

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle

/**
 * LLM 답변용 초경량 마크다운. 웹 `Markdownish.tsx`·iOS `ChatMarkdown.swift` 와 **같은 서식만** 다룬다.
 *
 * 지금까지 답변을 날글자로 그려서, 모델이 쓴 `**굵게**`·`---`·`*기울임*` 이 별표째로 보였다.
 * 상담 답변 한 건에 별표가 8개 나온 적도 있다.
 *
 * 지원 목록은 취향이 아니라 `api/chat.ts` 의 [답변 서식] 과 맞춘 것이다 —
 * 한쪽을 늘리면 세 플랫폼을 같이 늘려야 한다.
 */
object ChatMarkdown {

    sealed interface Block {
        data class Paragraph(val text: AnnotatedString) : Block
        data class ListItem(val marker: String, val text: AnnotatedString) : Block
        data object Rule : Block
    }

    fun parse(source: String): List<Block> {
        val blocks = mutableListOf<Block>()
        var ordinal = 0

        for (raw in source.replace("\r\n", "\n").split("\n")) {
            val line = raw.trim()
            if (line.isEmpty()) { ordinal = 0; continue }

            // 구분선을 목록보다 먼저 본다 — `---` 를 `- ` 불릿으로 삼키지 않도록.
            if (isRule(line)) { ordinal = 0; blocks += Block.Rule; continue }

            val bullet = BULLET.matchEntire(line)
            if (bullet != null) {
                ordinal = 0
                blocks += Block.ListItem("•", inline(bullet.groupValues[1].trim()))
                continue
            }
            val numbered = NUMBERED.matchEntire(line)
            if (numbered != null) {
                ordinal += 1
                blocks += Block.ListItem("$ordinal.", inline(numbered.groupValues[1].trim()))
                continue
            }
            ordinal = 0
            val heading = HEADING.matchEntire(line)
            if (heading != null) {
                // 제목은 굵은 한 줄로 낮춘다 — 상담 답변에 큰 제목이 끼면 말투가 깨진다.
                blocks += Block.Paragraph(inline("**" + heading.groupValues[1].trim() + "**"))
                continue
            }
            blocks += Block.Paragraph(inline(line))
        }
        return blocks
    }

    /**
     * 한 줄 안의 `**굵게**` · `*기울임*` · `` `코드` `` 를 스타일로 바꾼다.
     *
     * 굵게를 기울임보다 **먼저** 적는다. 순서가 바뀌면 `**굵게**` 의 안쪽을 기울임으로
     * 먼저 집어 별표 한 쌍이 글자로 남는다.
     */
    fun inline(text: String): AnnotatedString = buildAnnotatedString {
        var last = 0
        for (m in INLINE.findAll(text)) {
            if (m.range.first > last) append(text.substring(last, m.range.first))
            val token = m.value
            when {
                token.startsWith("**") ->
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(token.drop(2).dropLast(2)) }
                token.startsWith("*") ->
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(token.drop(1).dropLast(1)) }
                else ->
                    withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) { append(token.drop(1).dropLast(1)) }
            }
            last = m.range.last + 1
        }
        if (last < text.length) append(text.substring(last))
    }

    private fun isRule(s: String): Boolean =
        s.length >= 3 && s[0] in "-*_" && s.all { it == s[0] }

    private val BULLET = Regex("""^[-*]\s+(.*)$""")
    private val NUMBERED = Regex("""^\d+[.)]\s+(.*)$""")
    private val HEADING = Regex("""^#{1,6}\s+(.*)$""")
    private val INLINE = Regex("""\*\*[^*]+?\*\*|\*[^*\n]+?\*|`[^`]+?`""")
}
