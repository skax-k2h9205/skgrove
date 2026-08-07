import Foundation

/// 라이브 프로덕션 백엔드(웹앱과 동일)를 호출한다.
/// 서버리스 함수(/api/*)는 서버측 키를 쓰므로 클라이언트 키가 필요 없다.
/// 네이티브라 CORS 제약이 없어 절대경로로 바로 호출한다.
struct APIClient {
    static let baseURL = URL(string: "https://connectioner.vercel.app")!

    enum APIError: Error { case badResponse(Int), decoding }

    /// JSON body 를 POST 하고 응답을 디코드한다.
    func post<Body: Encodable, Response: Decodable>(
        _ path: String, body: Body
    ) async throws -> Response {
        var request = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.badResponse((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }
}
