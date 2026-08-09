import SwiftUI

/// LLM 답변용 초경량 마크다운. 웹 `Markdownish.tsx` 와 **같은 서식만** 지원한다.
///
/// 지금까지 `Text(turn.content)` 로 날글자를 그려서, 모델이 쓴 `**굵게**`·`---`·
/// `*기울임*` 이 별표째로 화면에 보였다. 상담 답변 한 건에 별표가 8개 나오는 일도 있었다.
///
/// 지원 목록은 취향이 아니라 `api/chat.ts` 의 [답변 서식] 과 맞춘 것이다.
/// 한쪽을 늘리면 세 플랫폼(웹·iOS·Android)을 같이 늘려야 한다.
enum ChatMarkdown {

    /// 한 덩어리의 표시 단위. 문단·목록 한 줄·구분선 셋뿐이다.
    enum Block: Identifiable {
        case paragraph(AttributedString)
        case listItem(marker: String, text: AttributedString)
        case rule

        var id: String {
            switch self {
            case .paragraph(let s): return "p:" + String(s.characters)
            case .listItem(let m, let s): return "l:" + m + String(s.characters)
            case .rule: return "hr:\(UUID().uuidString)"
            }
        }
    }

    static func parse(_ text: String) -> [Block] {
        var blocks: [Block] = []
        var ordinal = 0            // 번호 목록이 이어지는 동안의 카운터

        for rawLine in text.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n",
                                                                              omittingEmptySubsequences: false) {
            let line = String(rawLine)
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty { ordinal = 0; continue }

            // `---`, `***`, `___` 구분선. 목록 기호와 헷갈리지 않게 목록보다 먼저 본다.
            if isRule(trimmed) { ordinal = 0; blocks.append(.rule); continue }

            if let body = listBody(trimmed, prefixes: ["- ", "* "]) {
                ordinal = 0
                blocks.append(.listItem(marker: "•", text: inline(body)))
                continue
            }
            if let body = numberedBody(trimmed) {
                ordinal += 1
                blocks.append(.listItem(marker: "\(ordinal).", text: inline(body)))
                continue
            }
            ordinal = 0
            // 제목은 굵은 한 줄로 낮춘다 — 상담 답변에 큰 제목이 끼면 말투가 깨진다.
            if let body = headingBody(trimmed) {
                blocks.append(.paragraph(inline("**" + body + "**")))
                continue
            }
            blocks.append(.paragraph(inline(trimmed)))
        }
        return blocks
    }

    /// 인라인 서식(`**굵게**` `*기울임*` `` `코드` ``)만 처리한다.
    /// AttributedString 의 마크다운 파서를 쓰되 `.inlineOnly` 로 제한한다 — 전체 파싱을
    /// 맡기면 줄바꿈을 제 마음대로 접어 문단이 뭉개진다.
    static func inline(_ text: String) -> AttributedString {
        (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
    }

    private static func isRule(_ s: String) -> Bool {
        guard s.count >= 3, let first = s.first, "-*_".contains(first) else { return false }
        return s.allSatisfy { $0 == first }
    }

    private static func listBody(_ s: String, prefixes: [String]) -> String? {
        for p in prefixes where s.hasPrefix(p) {
            return String(s.dropFirst(p.count)).trimmingCharacters(in: .whitespaces)
        }
        return nil
    }

    /// `1. ` / `2) ` 형태. 숫자 뒤에 구분자와 공백이 모두 있어야 목록이다.
    private static func numberedBody(_ s: String) -> String? {
        let digits = s.prefix { $0.isNumber }
        guard !digits.isEmpty else { return nil }
        var rest = s.dropFirst(digits.count)
        guard let sep = rest.first, sep == "." || sep == ")" else { return nil }
        rest = rest.dropFirst()
        guard rest.first == " " else { return nil }
        return String(rest).trimmingCharacters(in: .whitespaces)
    }

    private static func headingBody(_ s: String) -> String? {
        let hashes = s.prefix { $0 == "#" }
        guard (1...6).contains(hashes.count) else { return nil }
        let rest = s.dropFirst(hashes.count)
        guard rest.first == " " else { return nil }
        return String(rest).trimmingCharacters(in: .whitespaces)
    }
}

/// 파싱한 블록을 세로로 쌓는다. 말풍선 안에 들어간다.
struct ChatMarkdownText: View {
    let text: String
    var tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            ForEach(ChatMarkdown.parse(text)) { block in
                switch block {
                case .paragraph(let s):
                    Text(s).frame(maxWidth: .infinity, alignment: .leading)
                case .listItem(let marker, let s):
                    // 기호를 고정폭으로 잡아 둘째 줄이 글머리 아래로 들어가지 않게 한다.
                    HStack(alignment: .firstTextBaseline, spacing: Theme.Space.x2) {
                        Text(marker).frame(minWidth: 14, alignment: .trailing)
                        Text(s).frame(maxWidth: .infinity, alignment: .leading)
                    }
                case .rule:
                    Rectangle().fill(tint.opacity(0.25)).frame(height: 1)
                        .padding(.vertical, Theme.Space.x1)
                }
            }
        }
    }
}
