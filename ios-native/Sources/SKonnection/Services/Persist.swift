import Foundation

/// UserDefaults 기반 로컬 영속화 헬퍼.
/// Supabase 연동 전까지 공유 스토어들이 앱 재실행 후에도 데이터를 유지하도록 한다.
/// (원격 동기화가 붙으면 이 계층만 교체하면 된다.)
enum Persist {
    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()

    static func load<T: Decodable>(_ key: String, as type: T.Type) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }

    static func save<T: Encodable>(_ value: T, _ key: String) {
        guard let data = try? encoder.encode(value) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
