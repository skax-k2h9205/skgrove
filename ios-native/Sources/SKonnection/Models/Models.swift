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

    /// 리더 관리함 전용 — 커넥셔너 '전권'은 제외한다(웹 hasLeaderRole 과 동일).
    /// 대나무숲은 접수자가 대상을 지정해 보내는 글이다. 전권으로 남의 접수함을 열면
    /// 대상 지정이 무의미해지고, 익명 제보자가 고르지 않은 사람이 내용을 보게 된다.
    var hasLeaderRole: Bool { self == .partLeader || self == .teamLeader }

    /// 계정 관리 — 팀리더 또는 커넥셔너(웹 isTeamLeader).
    var canManageAccounts: Bool { self == .teamLeader || self == .connectioner }

    /// 시스템 관리 — 커넥셔너만(웹 isConnectioner).
    var canManageSystem: Bool { self == .connectioner }
}

/// 대나무숲 접수의 대상 판정.
///
/// 웹은 leadersFor(target) 로 "대상 리더 목록"을 만들어 그 안에 내가 있는지 본다.
/// 앱에는 전역 계정 목록이 없어, 같은 판정을 **나 기준으로 뒤집어** 계산한다.
/// 이름이 지정된 접수는 정확히 그 사람만 본다 — 모르면 넓히지 않고 막는 쪽이 안전하다.
enum IssueTargeting {
    static func isTargeted(_ issue: Issue, me: CurrentUser) -> Bool {
        let raw = (issue.targetRaw ?? issue.target.rawValue).trimmingCharacters(in: .whitespaces)
        switch raw {
        case IssueTarget.teamLeader.rawValue: return me.role == .teamLeader
        case IssueTarget.partLeader.rawValue: return me.role == .partLeader
        case "리더 전체", "": return me.role.hasLeaderRole
        default: return raw == me.name   // 웹에서 특정 리더를 지정한 접수
        }
    }
}
