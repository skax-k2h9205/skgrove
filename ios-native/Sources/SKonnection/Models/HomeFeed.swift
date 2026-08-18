import SwiftUI

/// 홈 통합 피드의 한 조각(웹 homeFeed.ts HomeFeedItem 이식).
/// 5개 도메인(안건·액션·번개·유머·장터)을 같은 크기 타일로 모은다.
enum FeedKind: String, Codable {
    case agenda, action, gathering, humor, market

    var label: String {
        switch self {
        case .agenda: return "안건"
        case .action: return "액션"
        case .gathering: return "모임"
        case .humor: return "유머"
        case .market: return "장터"
        }
    }

    var icon: String {
        switch self {
        case .agenda: return "checkmark.square"
        case .action: return "bolt"
        case .gathering: return "calendar"
        case .humor: return "face.smiling"
        case .market: return "shippingbox"
        }
    }

    /// 색 타일 배경/글자색(웹 KIND_STYLE tint 클래스 이식).
    var tint: Color {
        switch self {
        case .agenda: return Theme.Palette.tintPrimary
        case .action: return Theme.Palette.tintSuccess
        case .gathering, .market: return Theme.Palette.tintNeutral
        case .humor: return Theme.Palette.tintDanger
        }
    }

    var ink: Color {
        switch self {
        case .agenda: return Theme.Palette.tintPrimaryInk
        case .action: return Theme.Palette.tintSuccessInk
        case .humor: return Theme.Palette.danger
        default: return Theme.Palette.ink
        }
    }
}

struct HomeFeedItem: Identifiable {
    /// 도메인 접두어가 붙은 피드 키("h:HUM-1"). 도메인이 달라도 겹치지 않게.
    let id: String
    /// 접두어 없는 원본 id — 탭했을 때 그 글의 상세를 열려면 이게 필요하다.
    var refId: String = ""
    let kind: FeedKind
    let title: String
    var meta: String?
    var imageURL: URL?
    /// 글쓴이(유머 작성자·모임 주최자·장터 판매자). 있으면 타일에 유머게시판처럼 글쓴이+내용 캡션을 얹는다.
    var author: String?
}

extension HomeFeedItem {
    /// Phase 1 시드 피드(웹 홈 화면을 재현). Supabase 연동 시 실데이터로 대체.
    static let seed: [HomeFeedItem] = [
        .init(id: "humor:1", kind: .humor, title: "연차 쓴 날 아침에 눈 번쩍 떠지는 사람 손 🙋 (나만 그런 거 아니지?)", meta: "빵터짐 8",
              imageURL: URL(string: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg")),
        .init(id: "humor:2", kind: .humor, title: "월급날 통장: 스쳐 지나가는 인연 👋 (짧고 굵었다)", meta: "빵터짐 4"),
        .init(id: "humor:3", kind: .humor, title: "재택근무 복장 레벨: 상의 셔츠 / 하의 잠옷", meta: "빵터짐 2"),
        .init(id: "agenda:1", kind: .agenda, title: "티미팅 아젠다 3개 제한안 작성", meta: "진행중"),
        .init(id: "action:1", kind: .action, title: "캔미팅 의견 제출 양식 배포", meta: "대기"),
        .init(id: "humor:4", kind: .humor, title: "오늘 배포 성공해서 기분 좋아 커피 쏩니다 ☕", meta: "빵터짐 6"),
        .init(id: "agenda:2", kind: .agenda, title: "팀 워크숍 장소 정하기", meta: "투표중"),
        .init(id: "humor:5", kind: .humor, title: "\"이번엔 진짜 일찍 잔다\" 하고 새벽 3시에 유튜브 보는 중", meta: "빵터짐 1"),
        .init(id: "gathering:1", kind: .gathering, title: "제주도 여행 티미팅 세션 준비", meta: "번개"),
        .init(id: "action:2", kind: .action, title: "파트 섞기 커피챗 1차 매칭", meta: "완료"),
        .init(id: "humor:6", kind: .humor, title: "월요일 아침의 나 vs 금요일 저녁의 나 😵", meta: "빵터짐 4"),
        .init(id: "market:1", kind: .market, title: "안 쓰는 기계식 키보드 나눔합니다", meta: "나눔"),
    ]
}
