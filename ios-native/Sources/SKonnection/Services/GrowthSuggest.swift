import Foundation

/// 성장 기록 입력 도우미 — 지금까지 한 프로젝트를 적으면 역량 레벨·성장 목표를 추천받는다.
/// 프롬프트와 키는 서버(`api/growth-suggest.ts`)에 있고 앱은 사실만 넘긴다.
///
/// 추천은 거들 뿐이다. 실패하면 nil 을 돌려주고 화면은 수동 입력 그대로 쓴다 —
/// AI 가 죽어 있어도 성장 기록 자체는 막히면 안 된다.
enum GrowthSuggest {
    struct LevelSuggestion: Identifiable, Decodable {
        let competency: String
        let level: Int
        let evidence: String
        var id: String { competency }
    }

    struct GoalSuggestion: Identifiable, Decodable {
        let title: String
        let detail: String
        var id: String { title }
    }

    struct Result: Decodable {
        let ok: Bool
        var levels: [LevelSuggestion] = []
        var goals: [GoalSuggestion] = []
        var reason: String?
    }

    private struct Payload: Encodable {
        let projects: String
        let competencies: [String]
        let role: String?
    }

    /// 성공하면 추천, 실패하면 사람이 읽을 이유를 담은 에러.
    static func request(projects: String, competencies: [String], role: String?) async -> Result {
        let payload = Payload(projects: projects, competencies: competencies, role: role)
        do {
            let res: Result = try await APIClient().post("api/growth-suggest", body: payload)
            return res
        } catch {
            return Result(ok: false, reason: "추천을 받지 못했어요. 잠시 후 다시 시도해 주세요.")
        }
    }
}

/// 역량 레벨 1~5의 뜻. 서버 프롬프트(LEVEL_GUIDE)와 같은 문장을 쓴다 —
/// 다르면 "AI가 준 4"와 "화면이 말하는 4"가 어긋난다.
enum GrowthLevelGuide {
    static let short: [Int: String] = [
        1: "배우는 중", 2: "혼자 가능", 3: "안정적", 4: "남을 이끎", 5: "조직 기준",
    ]
    static let long: [Int: String] = [
        1: "도움을 받아 수행해요",
        2: "정해진 범위는 혼자 할 수 있어요",
        3: "스스로 판단해 안정적으로 해요",
        4: "설계·리뷰·표준을 만들어 남을 이끌어요",
        5: "다른 팀도 참고하고, 멘토링을 해요",
    ]
}
