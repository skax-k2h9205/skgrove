import SwiftUI

// 알림 발송 설정(웹 notifySettingsStore 이식). app_config 의 skgrove:notifysettings 행을 팀 전체가 공유.

@MainActor
final class SystemStore: ObservableObject {
    private static let key = "skonnection.notifysettings"
    private static let configKey = "skgrove:notifysettings"

    /// kind → 발송 위치("team"|"connector"|"dm"|"off").
    @Published var routes: [String: String] { didSet { Persist.save(routes, Self.key + ".routes") } }
    @Published var slackEnabled: Bool { didSet { Persist.save(slackEnabled, Self.key + ".slack") } }
    @Published var dmEnabled: Bool { didSet { Persist.save(dmEnabled, Self.key + ".dm") } }
    /// 채널 ID(슬랙). 읽어와서 저장 시 그대로 돌려보낸다.
    private var channels: [String: String] = ["team": "", "connector": ""]

    /// 화면에 노출할 9종 알림.
    static let kinds: [(id: String, label: String, sub: String)] = [
        ("issue", "새 접수", "대나무숲에 새 의견이 들어온 때"),
        ("agenda", "안건 등록", "새 안건이 투표에 올라온 때"),
        ("deadline", "마감 임박", "안건 투표 마감이 임박한 때"),
        ("action", "액션 배정", "액션아이템 담당이 정해진 때"),
        ("gathering", "모임", "모임·번개가 열린 때"),
        ("market", "장터", "장터에 새 물건·입찰이 있는 때"),
        ("humor", "유머", "유머 게시판에 새 글이 올라온 때"),
        ("tea", "티미팅", "티미팅이 제안·채택된 때"),
        ("message", "메시지", "1:1 제안 등 개인 메시지"),
    ]

    init() {
        routes = Persist.load(Self.key + ".routes", as: [String: String].self) ?? Self.defaultRoutes
        slackEnabled = Persist.load(Self.key + ".slack", as: Bool.self) ?? true
        dmEnabled = Persist.load(Self.key + ".dm", as: Bool.self) ?? true
        Task { await syncFromRemote() }
    }

    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        if let rows = try? await Supabase.select("app_config",
                query: "key=eq.\(Self.configKey)&select=value", as: ConfigRow.self),
           let v = rows.first?.value {
            if let r = v.routes { routes = r }
            slackEnabled = v.slackEnabled ?? true
            dmEnabled = v.dmEnabled ?? true
            if let c = v.channels { channels = c }
        }
    }

    /// 변경 즉시 app_config 에 업서트 → 팀 전체 반영.
    func save() {
        Task { try? await Supabase.upsert("app_config",
            ConfigUpsert(key: Self.configKey,
                         value: NotifyValue(routes: routes, channels: channels,
                                            dmEnabled: dmEnabled, slackEnabled: slackEnabled)),
            onConflict: "key") }
    }

    private static let defaultRoutes: [String: String] = [
        "issue": "dm", "agenda": "team", "deadline": "team", "action": "off",
        "gathering": "off", "market": "off", "humor": "off", "tea": "connector", "message": "dm"]
}

struct NotifyValue: Codable {
    var routes: [String: String]?
    var channels: [String: String]?
    var dmEnabled: Bool?
    var slackEnabled: Bool?
}
struct ConfigRow: Decodable { let value: NotifyValue }
struct ConfigUpsert: Encodable { let key: String; let value: NotifyValue }
