import Foundation

/// 모임 포스터 생성 이음새 — 웹(src/gatheringImage.ts)과 **같은 서버 함수**를 부른다.
///
/// 지금까지 포스터는 웹에서 만든 모임에만 붙었다. iOS 로 연 모임은 그림 없이 아이콘
/// 타일로만 떠서, 같은 격자에 두 종류가 섞여 보였다. 화풍·프롬프트·키는 전부 서버에
/// 있으므로 여기서는 등록값만 넘긴다.
enum GatheringPoster {
    /// 서버 함수 주소. 웹 배포와 같은 도메인을 쓴다.
    private static let endpoint = "https://connectioner.vercel.app/api/gathering-image"
    private static let bucket = "gathering-images"

    private struct Response: Decodable {
        let ok: Bool?
        let dataUri: String?
    }

    /// 포스터를 만들어 Storage 에 올리고 공개 URL 을 돌려준다.
    /// 어느 단계든 실패하면 nil — 모임은 그림 없이도 성립한다.
    static func make(for gathering: Gathering) async -> String? {
        guard Supabase.isConfigured, let url = URL(string: endpoint) else { return nil }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // 그림 생성은 글자 검사·재시도까지 돌아 오래 걸린다. 기본 60초로는 모자란다.
        req.timeoutInterval = 120
        let payload: [String: Any] = ["gathering": [
            "kind": gathering.kind.dbValue,
            "title": gathering.title,
            "startAt": gathering.startAt,
            "place": gathering.place,
            "capacity": gathering.capacity as Any,
            "desc": gathering.desc,
        ]]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              let code = (resp as? HTTPURLResponse)?.statusCode, (200..<300).contains(code),
              let decoded = try? JSONDecoder().decode(Response.self, from: data),
              decoded.ok == true, let dataUri = decoded.dataUri else { return nil }

        guard let (bytes, mime) = decode(dataUri) else { return nil }
        let ext = mime.split(separator: "/").last.map(String.init) ?? "png"
        return await Supabase.uploadImage(bucket: bucket,
                                          path: "\(gathering.id)/poster.\(ext)",
                                          data: bytes, contentType: mime)
    }

    /// `data:image/png;base64,....` 를 바이트와 MIME 으로 가른다.
    /// 모델이 png 가 아니라 jpeg 를 주는 일이 실제로 있어 확장자를 실제 형식에서 만든다.
    private static func decode(_ dataUri: String) -> (Data, String)? {
        guard let comma = dataUri.firstIndex(of: ","),
              let semi = dataUri.firstIndex(of: ";"),
              dataUri.hasPrefix("data:") else { return nil }
        let mime = String(dataUri[dataUri.index(dataUri.startIndex, offsetBy: 5)..<semi])
        let base64 = String(dataUri[dataUri.index(after: comma)...])
        guard let bytes = Data(base64Encoded: base64) else { return nil }
        return (bytes, mime)
    }
}
