import Foundation

/// 등록 계정(웹 accountStore.ts seedAccounts 이식).
/// Phase 1 은 이 시드로 클라이언트 인증한다(Supabase 연동은 이후 단계).
struct Account: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let email: String
    let role: Role
    let part: String
    var connectioner: Bool = false

    var currentUser: CurrentUser {
        CurrentUser(name: name, email: email, part: part, role: role)
    }
}

extension Account {
    static let seed: [Account] = [
        Account(id: "USR-ADMIN", name: "이선민", email: "sunmin.l@sk.com", role: .teamLeader, part: "전체", connectioner: true),
        Account(id: "USR-02", name: "김승현", email: "k2h9205@sk.com", role: .partLeader, part: "ITS혁신파트", connectioner: true),
        Account(id: "USR-03", name: "김수정", email: "crystalk@sk.com", role: .member, part: "PM혁신파트"),
        Account(id: "USR-04", name: "이두민", email: "dumin@sk.com", role: .member, part: "TEST혁신파트"),
    ]

    static func find(email: String) -> Account? {
        let key = email.trimmingCharacters(in: .whitespaces).lowercased()
        return seed.first { $0.email.lowercased() == key }
    }
}
