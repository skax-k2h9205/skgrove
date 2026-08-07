import SwiftUI

private struct ManagedAccount: Identifiable, Codable {
    let id: String
    let name: String
    let email: String
    var role: Role
    var part: String
    var active: Bool
    var connectioner: Bool
}

@MainActor
private final class AccountStore: ObservableObject {
    private static let key = "skonnection.accounts"
    @Published var accounts: [ManagedAccount] { didSet { Persist.save(accounts, Self.key) } }

    init() {
        accounts = Persist.load(Self.key, as: [ManagedAccount].self) ?? Account.seed.map {
            ManagedAccount(id: $0.id, name: $0.name, email: $0.email, role: $0.role,
                           part: $0.part, active: true, connectioner: $0.connectioner)
        }
    }
}

/// 계정 관리 — 팀 계정의 권한·상태·커넥셔너를 관리(웹 AccountManagement 이식, 리더 전용).
struct AccountsView: View {
    @StateObject private var store = AccountStore()

    var body: some View {
        ScreenScaffold(title: "계정 관리", showUserChip: false) {
            HStack(spacing: Theme.Space.x2) {
                Image(systemName: "person.2.badge.gearshape.fill").foregroundStyle(Theme.Palette.primary)
                Text("권한·파트·상태·커넥셔너를 바꾸면 즉시 반영됩니다. \(store.accounts.count)명")
                    .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
            }
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))

            ForEach($store.accounts) { $account in
                VStack(alignment: .leading, spacing: Theme.Space.x3) {
                    HStack(spacing: Theme.Space.x3) {
                        Avatar(name: account.name)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(account.name).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                            Text(account.email).font(.caption).foregroundStyle(Theme.Palette.muted)
                        }
                        Spacer()
                        if !account.active {
                            StatusBadge(text: "비활성", tint: Theme.Palette.tintNeutral, ink: Theme.Palette.muted)
                        }
                    }
                    HStack {
                        Text("권한").font(.caption).foregroundStyle(Theme.Palette.muted)
                        Spacer()
                        Picker("권한", selection: $account.role) {
                            ForEach(Role.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }.pickerStyle(.menu).tint(Theme.Palette.primary)
                    }
                    Toggle("활성", isOn: $account.active).tint(Theme.Palette.cta)
                    Toggle("커넥셔너 전권", isOn: $account.connectioner).tint(Theme.Palette.cta)
                }
                .padding(Theme.Space.x4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
            }
        }
    }
}
