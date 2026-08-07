import SwiftUI

// 동료 성향 모델(웹 Profiles 이식). MBTI 를 4대 기질로 묶어 팀 분포를 낸다.

/// 4대 기질 — MBTI 16유형을 팀 협업 관점의 4갈래로 묶는다(Keirsey 기반).
enum Temperament: String, CaseIterable {
    case relational = "관계형", executive = "실행형", standard = "기준형", contextual = "맥락형"

    var hint: String {
        switch self {
        case .relational: return "공감·조율 (NF)"
        case .executive: return "행동·해결 (SP)"
        case .standard: return "체계·정리 (SJ)"
        case .contextual: return "전략·통찰 (NT)"
        }
    }

    static func of(_ mbti: String) -> Temperament? {
        let m = mbti.uppercased()
        guard m.count == 4 else { return nil }
        let hasN = m.contains("N")
        let hasF = m.contains("F")
        // N + F = 관계형, N + T = 맥락형, S + P = 실행형, S + J = 기준형
        if hasN { return hasF ? .relational : .contextual }
        return m.contains("P") ? .executive : .standard
    }
}

struct TeamProfile: Identifiable, Codable {
    let id: String        // 이메일(없으면 이름)
    var name: String
    var part: String
    var mbti: String = ""
    var disc: String = ""
    var collabGuide: String = ""

    var temperamentLabel: String { Temperament.of(mbti)?.rawValue ?? "미작성" }
}

@MainActor
final class ProfileStore: ObservableObject {
    private static let key = "skonnection.profiles"
    @Published var profiles: [TeamProfile] { didSet { Persist.save(profiles, Self.key) } }

    init() {
        profiles = Persist.load(Self.key, as: [TeamProfile].self) ?? Self.seed
        Task { await syncFromRemote() }
    }

    /// 웹과 같은 Supabase 에서 동료 프로필을 불러온다(실패 시 로컬 캐시).
    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        if let rows = try? await Supabase.select("profiles", query: "select=*", as: SupabaseProfileRow.self) {
            let mapped = rows.map { $0.toProfile() }.filter { !$0.name.isEmpty }
            if !mapped.isEmpty { profiles = mapped }
        }
    }

    /// 기질별 인원 분포(작성한 사람만).
    func distribution() -> [(Temperament, Int)] {
        Temperament.allCases.map { t in
            (t, profiles.filter { Temperament.of($0.mbti) == t }.count)
        }
    }

    var writtenCount: Int { profiles.filter { !$0.mbti.isEmpty }.count }

    /// 내 프로필을 갱신(없으면 추가). MyPage 저장이 팀 분포에 바로 반영된다.
    func upsertMine(id: String, name: String, part: String, mbti: String, disc: String, collabGuide: String) {
        if let i = profiles.firstIndex(where: { $0.id == id }) {
            profiles[i].name = name; profiles[i].part = part
            profiles[i].mbti = mbti; profiles[i].disc = disc; profiles[i].collabGuide = collabGuide
        } else {
            profiles.insert(TeamProfile(id: id, name: name, part: part, mbti: mbti, disc: disc,
                                        collabGuide: collabGuide), at: 0)
        }
    }

    func mine(id: String) -> TeamProfile? { profiles.first { $0.id == id } }

    private static let seed: [TeamProfile] = [
        .init(id: "이선민", name: "이선민", part: "TEST혁신파트", mbti: "ENFP", disc: "I",
              collabGuide: "배경과 맥락을 먼저 나누면 빠르게 맞춰가요."),
        .init(id: "김수정", name: "김수정", part: "PM혁신파트", mbti: "ISTJ", disc: "C",
              collabGuide: "명확한 기준과 마감을 정해주면 좋아요."),
        .init(id: "이두민", name: "이두민", part: "ITS혁신파트", mbti: "ESTP", disc: "D",
              collabGuide: "결론부터 이야기하고 바로 실행해요."),
        .init(id: "김영석", name: "김영석", part: "ITS혁신파트", mbti: "INTP", disc: "C",
              collabGuide: "왜 그런지 원리를 함께 보면 몰입해요."),
    ]
}

/// Supabase profiles 행 → iOS TeamProfile 매핑.
struct SupabaseProfileRow: Decodable {
    let owner_email: String?
    let name: String?
    let part: String?
    let mbti_type: String?
    let disc_type: String?
    let collab_guide: String?
    let guide: String?
    func toProfile() -> TeamProfile {
        TeamProfile(id: owner_email ?? (name ?? UUID().uuidString), name: name ?? "", part: part ?? "",
                    mbti: mbti_type ?? "", disc: disc_type ?? "",
                    collabGuide: (collab_guide?.isEmpty == false ? collab_guide : guide) ?? "")
    }
}
