import Foundation

/// 챗봇 답변의 서식을 화면에 맞게 해석한다.
///
/// 서버 프롬프트(lib/counsel/persona.js 의 FORMAT_RULES)가 허용하는 표기는 넷뿐이다:
/// 빈 줄 문단, "- "/"1. " 목록, **굵게**, *기울임*. 예전엔 iOS 가 답변을 그대로
/// Text 에 넣어서 `**누구**` 처럼 별표가 글자로 보였다 — 웹·안드에만 렌더러가 있었다.
///
/// 목록 기호는 일부러 손대지 않는다. "- " 는 그 자체로 읽히고, 문단 구조를 바꾸면
/// 세 플랫폼의 답변 모양이 달라진다.
enum ChatMarkdown {
    static func attributed(_ raw: String) -> AttributedString {
        // inlineOnlyPreservingWhitespace: 굵게·기울임만 해석하고 줄바꿈은 그대로 둔다.
        // 기본 옵션은 줄바꿈을 먹어 문단이 통째로 붙어버린다.
        let options = AttributedString.MarkdownParsingOptions(
            allowsExtendedAttributes: false,
            interpretedSyntax: .inlineOnlyPreservingWhitespace,
            failurePolicy: .returnPartiallyParsedIfPossible)
        guard let parsed = try? AttributedString(markdown: raw, options: options) else {
            return AttributedString(raw)   // 해석 실패해도 본문은 반드시 보여준다
        }
        return parsed
    }
}
