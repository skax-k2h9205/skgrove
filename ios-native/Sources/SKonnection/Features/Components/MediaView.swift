import AVKit
import SwiftUI
import WebKit

/// 유머 글에 붙은 링크의 해석 결과 — 웹 humorRules.resolveMedia 와 같은 규칙을 쓴다.
/// 두 플랫폼이 같은 링크를 다르게 읽으면, 웹에선 재생되는 글이 앱에선 안 되는 일이 생긴다.
enum HumorMedia {
    case youtube(id: String)
    case video(URL)   // mp4·webm·ogg 직링크
    case image(URL)
    case link(URL)    // 그 밖의 http(s) — 앱 안에서 열 수 없으니 밖으로 넘긴다

    /// 목록 타일에 쓸 정지 이미지. 유튜브는 hqdefault(모든 영상에 존재).
    var thumbnail: URL? {
        switch self {
        case let .youtube(id): return URL(string: "https://img.youtube.com/vi/\(id)/hqdefault.jpg")
        case let .image(url): return url
        case .video, .link: return nil
        }
    }

    static func resolve(_ raw: String) -> HumorMedia? {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }
        if let id = youtubeID(s) { return .youtube(id: id) }
        guard s.lowercased().hasPrefix("http://") || s.lowercased().hasPrefix("https://"),
              let url = URL(string: s) else { return nil }
        // 쿼리스트링을 뺀 경로의 확장자로 판별한다(?si=… 가 붙어도 그림·영상은 그림·영상이다).
        let ext = (url.path as NSString).pathExtension.lowercased()
        if ["mp4", "webm", "ogg"].contains(ext) { return .video(url) }
        if ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg"].contains(ext) { return .image(url) }
        return .link(url)
    }

    /// 유튜브 영상 id 는 11자다. 웹과 같은 길이로 잘라야 같은 영상을 가리킨다.
    private static func youtubeID(_ url: String) -> String? {
        for marker in ["v=", "youtu.be/", "/shorts/", "/embed/"] {
            guard let r = url.range(of: marker) else { continue }
            let id = url[r.upperBound...].prefix { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
            if id.count >= 11 { return String(id.prefix(11)) }
        }
        return nil
    }
}

/// 유튜브 인라인 재생. 앱 안에서 바로 보게 한다 — 유머는 흐름이 끊기면 재미가 반감된다.
///
/// 임베드 주소를 URLRequest 로 그냥 열면 origin 이 없어 유튜브가 "오류 153"(동영상 플레이어
/// 구성 오류)을 돌려준다. iframe 을 감싼 HTML 을 baseURL 과 함께 실어야 정상 origin 이 된다.
private struct YouTubePlayer: UIViewRepresentable {
    let videoID: String

    private static let origin = URL(string: "https://www.youtube.com")!

    private var html: String {
        let src = "https://www.youtube.com/embed/\(videoID)?playsinline=1&rel=0"
        return """
        <!doctype html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <style>html,body{margin:0;padding:0;background:#000;height:100%}
        iframe{border:0;width:100%;height:100%;display:block}</style></head>
        <body><iframe src="\(src)"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe></body></html>
        """
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // 빈 배열 = "재생에 사용자 동작이 필요한 미디어 없음". 탭 한 번으로 바로 재생된다.
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.navigationDelegate = context.coordinator
        web.loadHTMLString(html, baseURL: Self.origin)
        context.coordinator.loadedID = videoID
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        guard context.coordinator.loadedID != videoID else { return }
        context.coordinator.loadedID = videoID
        web.loadHTMLString(html, baseURL: Self.origin)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    /// 같은 영상을 다시 싣지 않기 위한 표식. loadHTMLString 은 web.url 이 baseURL 로만
    /// 남아 영상이 바뀌었는지 URL 로는 구분할 수 없다.
    ///
    /// 네비게이션도 가로챈다 — 임베드가 막힌 영상(오류 150·152 계열: 소유자가 외부 재생을
    /// 꺼둔 경우)은 유튜브가 "YouTube에서 동영상 보기" 링크를 대신 그려준다. 웹뷰 안에서는
    /// 그 링크가 아무 데도 가지 않으므로, 밖(유튜브 앱·사파리)으로 넘겨줘야 실제로 열린다.
    final class Coordinator: NSObject, WKNavigationDelegate {
        var loadedID: String?

        func webView(_ web: WKWebView,
                     decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard action.navigationType == .linkActivated, let url = action.request.url else {
                decisionHandler(.allow); return
            }
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
        }
    }
}

/// 유머 상세의 미디어 블록 — 종류에 맞는 재생기를 고른다.
struct HumorMediaView: View {
    let media: HumorMedia
    @Environment(\.openURL) private var openURL

    var body: some View {
        switch media {
        case let .youtube(id):
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                YouTubePlayer(videoID: id)
                    .aspectRatio(16.0 / 9.0, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
                // 임베드는 영상 소유자가 언제든 막을 수 있다(음원이 든 Shorts 는 특히 잦다).
                // 그때도 볼 방법이 남아 있어야 해서, 바깥으로 나가는 길을 항상 같이 둔다.
                if let watch = URL(string: "https://www.youtube.com/watch?v=\(id)") {
                    Button { openURL(watch) } label: {
                        Label("YouTube에서 보기", systemImage: "play.rectangle.fill")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.Palette.muted)
                    }
                    .buttonStyle(.plain)
                }
            }
        case let .video(url):
            VideoPlayer(player: AVPlayer(url: url))
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        case let .image(url):
            AsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { Theme.Palette.sunken }
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        case let .link(url):
            // 재생할 수 없는 링크는 있는 그대로 보여주고 사파리로 넘긴다.
            Button { openURL(url) } label: {
                Label(url.host ?? "링크 열기", systemImage: "safari")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            }
            .buttonStyle(.plain)
        }
    }
}
