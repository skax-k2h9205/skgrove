import SwiftUI

// 팀 추억 모델(웹 Memory/memoryStore 이식). team_memories + team_memory_assets 를 웹과 공유.

struct TeamMemory: Identifiable, Codable {
    let id: Int
    var title: String
    var eventDate: String     // "YYYY-MM-DD"
    var place: String
    var host: String
    var summary: String

    var month: String { String(eventDate.prefix(7)) }   // "YYYY-MM"
}

/// 앨범 한 장(사진/영상). team_memory_assets 이식.
struct MemoryAsset: Identifiable, Codable {
    let id: Int
    let memoryId: Int
    let type: String          // "photo" | "video"
    var title: String
    var uploader: String
    var previewURL: String

    var isVideo: Bool { type == "video" }
    var url: URL? { URL(string: previewURL) }
}

@MainActor
final class MemoryStore: ObservableObject {
    private static let key = "skonnection.memories"
    @Published var memories: [TeamMemory] { didSet { Persist.save(memories, Self.key) } }
    /// memory_id → 앨범 사진/영상(업로드 순).
    @Published var assetsByMemory: [Int: [MemoryAsset]] = [:]

    init() {
        memories = Persist.load(Self.key, as: [TeamMemory].self) ?? Self.seed
        Task { await syncFromRemote() }
    }

    /// 웹과 같은 Supabase 에서 추억·자산을 불러온다(실패 시 로컬 캐시 유지).
    func syncFromRemote() async {
        guard Supabase.isConfigured else { return }
        if let rows = try? await Supabase.select("team_memories", query: "select=*&order=event_date.desc",
                                                 as: SupabaseMemoryRow.self) {
            memories = rows.map { $0.toMemory() }
        }
        if let rows = try? await Supabase.select(
            "team_memory_assets",
            query: "select=id,memory_id,type,title,uploader,preview_url&order=created_at.asc",
            as: SupabaseAssetRow.self
        ) {
            var grouped: [Int: [MemoryAsset]] = [:]
            for r in rows { if let a = r.toAsset() { grouped[a.memoryId, default: []].append(a) } }
            assetsByMemory = grouped
        }
    }

    func assets(_ id: Int) -> [MemoryAsset] { assetsByMemory[id] ?? [] }
    func count(_ id: Int) -> Int { assetsByMemory[id]?.count ?? 0 }

    /// 앨범 대표(커버) 사진 — 첫 사진 우선, 없으면 첫 자산.
    func coverURL(_ id: Int) -> URL? {
        let list = assets(id)
        let cover = list.first { $0.type == "photo" && !$0.previewURL.isEmpty }
            ?? list.first { !$0.previewURL.isEmpty }
        return cover?.url
    }

    /// 행사를 연 사람 수(중복 제거).
    var hostCount: Int { Set(memories.map(\.host).filter { !$0.isEmpty }).count }
    var totalAssets: Int { assetsByMemory.values.reduce(0) { $0 + $1.count } }

    /// 월별 그룹(캘린더 탭).
    var byMonth: [(month: String, items: [TeamMemory])] {
        Dictionary(grouping: memories, by: \.month)
            .map { (month: $0.key, items: $0.value) }
            .sorted { $0.month > $1.month }
    }

    private static let seed: [TeamMemory] = [
        .init(id: 1, title: "3분기 워크숍", eventDate: "2026-07-15", place: "양평", host: "이수현", summary: "함께한 워크숍 기록"),
        .init(id: 2, title: "팀 회식", eventDate: "2026-06-20", place: "회사 근처", host: "김승현", summary: "고생한 우리 회식"),
    ]
}

struct SupabaseMemoryRow: Decodable {
    let id: Int
    let title: String?
    let event_date: String?
    let place: String?
    let host: String?
    let summary: String?
    func toMemory() -> TeamMemory {
        TeamMemory(id: id, title: title ?? "", eventDate: String((event_date ?? "").prefix(10)),
                   place: place ?? "", host: host ?? "", summary: summary ?? "")
    }
}

struct SupabaseAssetRow: Decodable {
    let id: Int
    let memory_id: Int?
    let type: String?
    let title: String?
    let uploader: String?
    let preview_url: String?
    func toAsset() -> MemoryAsset? {
        guard let memory_id else { return nil }
        return MemoryAsset(id: id, memoryId: memory_id, type: type ?? "photo",
                           title: title ?? "", uploader: uploader ?? "",
                           previewURL: preview_url ?? "")
    }
}
