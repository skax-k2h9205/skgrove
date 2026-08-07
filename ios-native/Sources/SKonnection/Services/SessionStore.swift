import Foundation
import SwiftUI

/// 로그인 세션을 보관·복원한다. 웹앱 session.ts 와 같은 규약:
/// 비밀번호는 저장하지 않고, 오래된 세션은 만료시킨다(14일).
@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var currentUser: CurrentUser?

    private let key = "skonnection.session"
    private let maxAge: TimeInterval = 14 * 24 * 60 * 60

    private struct Stored: Codable {
        var user: CurrentUser
        var savedAt: TimeInterval
    }

    init() {
        currentUser = loadSession()
    }

    var isLoggedIn: Bool { currentUser != nil }

    func login(_ user: CurrentUser) {
        currentUser = user
        let stored = Stored(user: user, savedAt: Date().timeIntervalSince1970)
        if let data = try? JSONEncoder().encode(stored) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    func logout() {
        currentUser = nil
        UserDefaults.standard.removeObject(forKey: key)
    }

    private func loadSession() -> CurrentUser? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let stored = try? JSONDecoder().decode(Stored.self, from: data)
        else { return nil }
        if Date().timeIntervalSince1970 - stored.savedAt > maxAge {
            UserDefaults.standard.removeObject(forKey: key)
            return nil
        }
        return stored.user
    }
}
