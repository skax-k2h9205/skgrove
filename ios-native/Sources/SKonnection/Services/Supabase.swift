import Foundation

/// Supabase 연동 설정 + 최소 REST 클라이언트(URLSession).
/// 웹앱과 **같은 프로젝트**를 공유한다 — 웹에서 올린 데이터가 앱에도, 앱에서 쓴 데이터가 웹에도 나타난다.
/// anon 키는 웹 프론트 번들에 그대로 노출되는 공개값(JWT role=anon)이라 앱에 임베드해도 안전하다(RLS로 서버측 보호).
enum Supabase {
    static let url = "https://sjymcpjbmsqapsptvlml.supabase.co"
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeW1jcGpibXNxYXBzcHR2bG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjMzOTYsImV4cCI6MjEwMTI5OTM5Nn0.pgAVA8T9fJ-Fg9YHhlgbzR8dw6OVkPn53mX6H-GM3Wo"

    static var isConfigured: Bool { !anonKey.isEmpty }

    private static func request(_ path: String, method: String = "GET",
                                query: String = "", body: Data? = nil, prefer: String? = nil) -> URLRequest {
        var comps = URLComponents(string: "\(url)/rest/v1/\(path)")!
        if !query.isEmpty { comps.query = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let prefer { req.setValue(prefer, forHTTPHeaderField: "Prefer") }
        req.httpBody = body
        return req
    }

    /// 테이블 조회. query 예: "select=*&order=created_at.desc".
    static func select<Row: Decodable>(_ table: String, query: String = "select=*",
                                       as: Row.Type) async throws -> [Row] {
        let (data, resp) = try await URLSession.shared.data(for: request(table, query: query))
        try check(resp, data)
        return try decoder.decode([Row].self, from: data)
    }

    /// 삽입(upsert 아님). Prefer: return=minimal 로 응답 본문 생략.
    static func insert<Row: Encodable>(_ table: String, _ row: Row) async throws {
        let body = try encoder.encode(row)
        let (data, resp) = try await URLSession.shared.data(for:
            request(table, method: "POST", body: body, prefer: "return=minimal"))
        try check(resp, data)
    }

    /// 업서트 — PK 충돌 시 병합(있으면 수정, 없으면 삽입).
    static func upsert<Row: Encodable>(_ table: String, _ row: Row, onConflict: String) async throws {
        let body = try encoder.encode(row)
        var req = request(table, method: "POST", query: "on_conflict=\(onConflict)", body: body,
                          prefer: "resolution=merge-duplicates,return=minimal")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try check(resp, data)
    }

    /// id 기준 부분 수정.
    static func patch<Fields: Encodable>(_ table: String, id: String, _ fields: Fields) async throws {
        let body = try encoder.encode(fields)
        let (data, resp) = try await URLSession.shared.data(for:
            request(table, method: "PATCH", query: "id=eq.\(id)", body: body, prefer: "return=minimal"))
        try check(resp, data)
    }

    /// 임의 필터(예: "gathering_id=eq.X&name=eq.Y")로 삭제.
    static func delete(_ table: String, query: String) async throws {
        let (data, resp) = try await URLSession.shared.data(for:
            request(table, method: "DELETE", query: query, prefer: "return=minimal"))
        try check(resp, data)
    }

    /// Storage 업로드 후 공개 URL 을 돌려준다. 실패하면 nil —
    /// 화면은 이미지 없이도 성립하므로 호출부는 "없으면 아이콘 타일" 한 갈래만 다루면 된다.
    static func uploadImage(bucket: String, path: String, data: Data, contentType: String) async -> String? {
        guard isConfigured, var comps = URLComponents(string: "\(url)/storage/v1/object/\(bucket)/\(path)") else {
            return nil
        }
        comps.query = nil
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.setValue("true", forHTTPHeaderField: "x-upsert")
        req.httpBody = data
        guard let (body, resp) = try? await URLSession.shared.data(for: req),
              let code = (resp as? HTTPURLResponse)?.statusCode, (200..<300).contains(code) else {
            return nil
        }
        _ = body
        return "\(url)/storage/v1/object/public/\(bucket)/\(path)"
    }

    static let decoder = JSONDecoder()
    static let encoder = JSONEncoder()

    private static func check(_ resp: URLResponse, _ data: Data) throws {
        guard let code = (resp as? HTTPURLResponse)?.statusCode, (200..<300).contains(code) else {
            throw NSError(domain: "Supabase", code: (resp as? HTTPURLResponse)?.statusCode ?? -1,
                          userInfo: [NSLocalizedDescriptionKey: String(data: data, encoding: .utf8) ?? "error"])
        }
    }
}
