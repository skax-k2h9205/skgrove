import Foundation

// MBTI(16문항) + DISC(12문항) 성향 진단(웹 assessment.ts 이식).

struct MBTIQuestion: Identifiable { let id: String; let axis: String; let a: String; let b: String }
struct DISCOption { let text: String; let key: Character }
struct DISCQuestion: Identifiable { let id: String; let prompt: String; let options: [DISCOption] }

enum Assessment {
    static let mbti: [MBTIQuestion] = [
        .init(id: "ei1", axis: "EI", a: "사람들과 얘기하다 보면 아이디어가 샘솟는다", b: "혼자 정리한 뒤에 공유하고 싶다"),
        .init(id: "ei2", axis: "EI", a: "사람들과 어울릴 때 힘이 난다", b: "혼자만의 시간에 힘이 채워진다"),
        .init(id: "ei3", axis: "EI", a: "떠오르는 대로 말하며 생각을 정리한다", b: "생각을 다 정리한 뒤에 말한다"),
        .init(id: "ei4", axis: "EI", a: "처음 보는 자리에서 먼저 말을 건다", b: "상대가 다가오길 기다리는 편이다"),
        .init(id: "sn1", axis: "SN", a: "구체적인 사실과 사례부터 본다", b: "큰 그림과 가능성부터 본다"),
        .init(id: "sn2", axis: "SN", a: "단계와 예시가 있어야 이해가 편하다", b: "개념과 의미가 먼저 와닿는다"),
        .init(id: "sn3", axis: "SN", a: "검증된 방식을 신뢰한다", b: "새로운 방식을 시도하고 싶다"),
        .init(id: "sn4", axis: "SN", a: "지금 필요한 현실에 집중한다", b: "앞으로의 변화를 상상한다"),
        .init(id: "tf1", axis: "TF", a: "결정할 때 논리와 효율이 우선이다", b: "결정할 때 사람과 관계가 우선이다"),
        .init(id: "tf2", axis: "TF", a: "피드백은 문제를 직설적으로 짚는다", b: "피드백은 상대 기분을 먼저 살핀다"),
        .init(id: "tf3", axis: "TF", a: "갈등에선 무엇이 옳은지 따진다", b: "갈등에선 모두가 편한지 살핀다"),
        .init(id: "tf4", axis: "TF", a: "타당한 근거가 나를 움직인다", b: "공감과 인정이 나를 움직인다"),
        .init(id: "jp1", axis: "JP", a: "일정을 미리 계획하고 지킨다", b: "상황에 따라 유연하게 움직인다"),
        .init(id: "jp2", axis: "JP", a: "마감은 일찍 끝내야 안심된다", b: "막판 집중이 더 잘 된다"),
        .init(id: "jp3", axis: "JP", a: "계획을 짜두면 마음이 편하다", b: "즉흥적으로 하는 게 즐겁다"),
        .init(id: "jp4", axis: "JP", a: "할 일과 자리는 정리돼 있어야 한다", b: "조금 어수선해도 괜찮다"),
    ]

    static let disc: [DISCQuestion] = [
        .init(id: "d1", prompt: "새 업무가 주어지면 먼저", options: [
            .init(text: "목표와 결과부터 잡는다", key: "D"), .init(text: "함께할 사람들과 논의한다", key: "I"),
            .init(text: "기존 흐름에 맞춰 안정적으로 시작", key: "S"), .init(text: "요건과 기준을 꼼꼼히 확인", key: "C")]),
        .init(id: "d2", prompt: "회의에서 내 역할은", options: [
            .init(text: "결론으로 몰고 간다", key: "D"), .init(text: "분위기를 띄운다", key: "I"),
            .init(text: "의견을 조율하고 경청한다", key: "S"), .init(text: "근거와 데이터를 챙긴다", key: "C")]),
        .init(id: "d3", prompt: "갈등이 생기면", options: [
            .init(text: "정면돌파해 빠르게 결론", key: "D"), .init(text: "대화로 관계를 회복", key: "I"),
            .init(text: "한발 물러나 진정시킴", key: "S"), .init(text: "사실관계부터 정리", key: "C")]),
        .init(id: "d4", prompt: "마감이 촉박할 때", options: [
            .init(text: "밀어붙여 끝낸다", key: "D"), .init(text: "팀을 독려한다", key: "I"),
            .init(text: "차분히 순서대로 한다", key: "S"), .init(text: "품질 기준은 지킨다", key: "C")]),
        .init(id: "d5", prompt: "피드백을 줄 때", options: [
            .init(text: "핵심만 직설적으로", key: "D"), .init(text: "긍정적으로 북돋우며", key: "I"),
            .init(text: "부드럽고 배려 있게", key: "S"), .init(text: "근거와 예시를 들어", key: "C")]),
        .init(id: "d6", prompt: "새 도구·변화가 오면", options: [
            .init(text: "일단 써보고 판단", key: "D"), .init(text: "신나서 남에게 알림", key: "I"),
            .init(text: "충분한 적응기간이 필요", key: "S"), .init(text: "검증한 뒤 도입", key: "C")]),
        .init(id: "d7", prompt: "의사결정은", options: [
            .init(text: "빠르게 내가 결정", key: "D"), .init(text: "함께 합의해 결정", key: "I"),
            .init(text: "모두 편한 쪽으로", key: "S"), .init(text: "데이터로 결정", key: "C")]),
        .init(id: "d8", prompt: "스트레스를 받으면", options: [
            .init(text: "더 강하게 밀어붙인다", key: "D"), .init(text: "말이 많아진다", key: "I"),
            .init(text: "조용해지고 참는다", key: "S"), .init(text: "혼자 파고든다", key: "C")]),
        .init(id: "d9", prompt: "인정받고 싶은 지점은", options: [
            .init(text: "성과와 결과", key: "D"), .init(text: "영향력과 인기", key: "I"),
            .init(text: "신뢰와 성실", key: "S"), .init(text: "정확성과 전문성", key: "C")]),
        .init(id: "d10", prompt: "협업에서 가장 답답한 건", options: [
            .init(text: "느린 진행", key: "D"), .init(text: "딱딱한 분위기", key: "I"),
            .init(text: "잦은 변경", key: "S"), .init(text: "근거 없는 결정", key: "C")]),
        .init(id: "d11", prompt: "내 강점은", options: [
            .init(text: "추진력", key: "D"), .init(text: "사교성", key: "I"),
            .init(text: "안정감", key: "S"), .init(text: "정확성", key: "C")]),
        .init(id: "d12", prompt: "일할 때 중요한 건", options: [
            .init(text: "속도와 결과", key: "D"), .init(text: "관계와 재미", key: "I"),
            .init(text: "조화와 지속", key: "S"), .init(text: "정확과 원칙", key: "C")]),
    ]

    private static let axisLetters: [String: (String, String)] = [
        "EI": ("E", "I"), "SN": ("S", "N"), "TF": ("T", "F"), "JP": ("J", "P")]

    /// MBTI 채점 — 축별로 a 응답 비중 ≥50%면 첫 글자.
    static func scoreMBTI(_ answers: [String: Bool]) -> String {   // true = a
        var type = ""
        for axis in ["EI", "SN", "TF", "JP"] {
            let qs = mbti.filter { $0.axis == axis }
            let answered = qs.filter { answers[$0.id] != nil }
            let aCount = qs.filter { answers[$0.id] == true }.count
            let lean = answered.isEmpty ? 50 : Int((Double(aCount) / Double(answered.count) * 100).rounded())
            let (first, second) = axisLetters[axis]!
            type += lean >= 50 ? first : second
        }
        return type
    }

    /// DISC 채점 — 최다 득표(동점은 D>I>S>C).
    static func scoreDISC(_ answers: [String: Character]) -> Character {
        var counts: [Character: Int] = ["D": 0, "I": 0, "S": 0, "C": 0]
        for v in answers.values { counts[v, default: 0] += 1 }
        let order: [Character] = ["D", "I", "S", "C"]
        return order.max { (counts[$0]!, order.firstIndex(of: $1)!) < (counts[$1]!, order.firstIndex(of: $0)!) } ?? "S"
    }

    static let discLabel: [Character: String] = ["D": "주도형", "I": "사교형", "S": "안정형", "C": "신중형"]
    /// "나와 일하는 법"을 평소 쓰는 AI(Claude·GPT 등)에게 물어볼 프롬프트.
    ///
    /// 왜 관찰을 먼저 시키나: MBTI·DISC 라벨만 주면 누구에게나 해당되는 일반론이 나온다.
    /// 사용자가 늘 쓰는 AI 에는 대화 이력이 있으니 그 관찰이 훨씬 구체적이다.
    /// 왜 자백 문구를 넣나: 새 대화창에 붙여넣으면 AI 는 사용자를 모르는데 "관찰한 걸 써줘"만
    /// 시키면 지시를 지키려고 없는 관찰을 지어낸다(오은영AI 가 가짜 사례번호를 만들던 것과 같다).
    /// 출력 형식을 고정하는 이유: 어떤 AI 를 쓰든 같은 모양이어야 팀 안에서 비교가 된다.
    /// 담당 파트는 넣지 않는다 — 성향과 무관해 답을 흐린다.
    static func collabPrompt(mbti: String, disc: String) -> String {
        var known: [String] = []
        if !mbti.isEmpty { known.append("- MBTI: \(mbti)") }
        if let c = disc.first, let label = discLabel[c] { known.append("- DISC: \(disc) (\(label))") }

        let diagnosis = known.isEmpty
            ? "진단 결과는 아직 없어. 관찰만으로 써줘."
            : "참고용 진단 결과 — 관찰과 어긋나면 관찰을 우선해:\n" + known.joined(separator: "\n")

        return [
            "나는 회사에서 일하는 사람이고, 동료들이 나와 협업할 때 참고할 \"나와 일하는 법\"을",
            "정리하려고 해.",
            "",
            "먼저 지금까지 나와 나눈 대화에서 네가 관찰한 내 모습을 근거로 써줘 —",
            "질문하는 방식, 결정하는 속도, 무엇을 답답해했고 무엇에 만족했는지 같은 것들.",
            "관찰한 게 없거나 기억나지 않으면 지어내지 말고 아래 진단 결과만으로 쓰고,",
            "맨 끝에 \"(대화 기록 없이 진단 결과만으로 작성했어요)\"라고 한 줄 붙여줘.",
            "",
            diagnosis,
            "",
            "아래 형식 그대로 한국어 존댓말로, 각 항목 한 문장씩,",
            "실제 업무 상황에 쓸 수 있게 구체적으로. 설명이나 서론 없이 형식만 출력해.",
            "",
            "[이렇게 하면 잘 통해요]",
            "- (소통 방식)",
            "- (일 맡길 때)",
            "- (피드백 줄 때)",
            "",
            "[이런 건 피해주세요]",
            "- (한 문장)",
            "- (한 문장)",
            "",
            "[급할 때는]",
            "- (한 문장)",
        ].joined(separator: "\n")
    }

    static let discGuide: [Character: String] = [
        "D": "결론부터 간결하게. 목표·결과 중심으로 말하면 빠르게 통합니다.",
        "I": "밝게 관계부터. 인정과 열정을 곁들이면 잘 움직입니다.",
        "S": "안심과 시간을 주며 부드럽게. 급한 변경은 미리 알려주세요.",
        "C": "근거·데이터와 함께. 정확한 기준과 이유를 주면 신뢰합니다."]
}
