import Foundation

/// 모임 썸네일 생성 이음새 — 웹 `gatheringImage.ts` 와 **같은 서버 함수**(`/api/gathering-image`)를 쓴다.
/// 프롬프트·화풍·키는 전부 서버에 있고 여기서는 등록값만 넘긴다(화풍을 바꾸려고 앱을 다시 심을 이유가 없다).
///
/// 앱 작성 시트에는 사진 첨부가 없어 등록한 모임은 늘 아이콘 타일이었다. 이제 등록 직후
/// 백그라운드로 그려 올리고 `image_url` 만 갱신한다 — 생성이 실패해도 모임 자체는 멀쩡해야 한다.
enum GatheringImage {
    /// 웹 `gatheringStore.POSTER_BUCKET` 과 동일 — 앱이 만든 썸네일이 웹·안드로이드에도 그대로 보인다.
    static let bucket = "gathering-images"

    private struct Payload: Encodable {
        struct Fields: Encodable {
            let kind: String
            let title: String
            let startAt: String
            let place: String
            let capacity: Int?
            let desc: String
        }
        let gathering: Fields
    }

    private struct Drawn: Decodable {
        let ok: Bool
        let dataUri: String?
    }

    /// 썸네일을 그려 받아 Storage 에 올리고 공개 URL 을 돌려준다. 어느 단계든 실패하면 nil.
    static func makeAndUpload(for g: Gathering) async -> String? {
        let payload = Payload(gathering: .init(kind: g.kind.dbValue, title: g.title, startAt: g.startAt,
                                               place: g.place, capacity: g.capacity, desc: g.desc))
        guard let drawn: Drawn = try? await APIClient().post("api/gathering-image", body: payload),
              drawn.ok, let uri = drawn.dataUri, let image = decode(uri) else { return nil }
        return await Supabase.uploadImage(bucket: bucket, path: "\(g.id).\(image.ext)",
                                          data: image.data, contentType: image.mime)
    }

    /// `data:image/png;base64,...` → (바이트, MIME, 확장자).
    /// 확장자를 MIME 에서 만드는 이유: 모델이 png 가 아니라 jpeg 를 주는 일이 실제로 있었다(웹에서 확인).
    static func decode(_ dataUri: String) -> (data: Data, mime: String, ext: String)? {
        guard dataUri.hasPrefix("data:"), let comma = dataUri.firstIndex(of: ",") else { return nil }
        let header = dataUri[dataUri.index(dataUri.startIndex, offsetBy: 5)..<comma]   // image/png;base64
        let mime = header.split(separator: ";").first.map(String.init) ?? "image/png"
        guard let data = Data(base64Encoded: String(dataUri[dataUri.index(after: comma)...])) else { return nil }
        let ext = mime.split(separator: "/").last.map(String.init) ?? "png"
        return (data, mime, ext)
    }
}
