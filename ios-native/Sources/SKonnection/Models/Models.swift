import Foundation

/// 로그인한 사용자. 웹앱 CurrentUser 와 같은 형태(이름·메일·소속·역할).
struct CurrentUser: Codable, Equatable {
    var name: String
    var email: String
    var part: String
    var role: Role
}

/// 권한 3단계. 웹앱의 역할 체계(팀원 < 파트리더 < 팀리더)와 일치.
enum Role: String, Codable, CaseIterable {
    case member = "팀원"
    case partLeader = "파트리더"
    case teamLeader = "팀리더"
    case connectioner = "커넥셔너"

    var isLeader: Bool { self == .partLeader || self == .teamLeader || self == .connectioner }
}
