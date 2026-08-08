import SwiftUI

/// 시스템 관리 · 알림 발송 — 커넥셔너 전용 설정(웹 SystemManagement 이식).
/// app_config 를 통해 팀 전체가 공유하는 설정. 바꾸면 즉시 원격 저장된다.
struct SystemView: View {
    @EnvironmentObject private var store: SystemStore

    private let routeOptions: [(id: String, label: String)] = [
        ("team", "팀 채널"), ("connector", "커넥셔너"), ("dm", "개인 DM"), ("off", "발송 안 함")]

    var body: some View {
        ScreenScaffold(title: "시스템 관리", showUserChip: false,
                       onRefresh: { await store.syncFromRemote() }) {
            HStack(spacing: Theme.Space.x2) {
                Image(systemName: "gearshape.2.fill").foregroundStyle(Theme.Palette.primary)
                Text("여기서 바꾼 설정은 저장 즉시 팀 전체에 적용됩니다. 슬랙 봇 토큰만 서버 비밀입니다.")
                    .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
            }
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))

            card {
                Text("발송 채널").font(.headline).foregroundStyle(Theme.Palette.ink)
                toggleRow("슬랙 알림 사용", "끄면 어떤 슬랙도 보내지 않고 앱 안 알림만 남습니다.",
                          Binding(get: { store.slackEnabled }, set: { store.slackEnabled = $0; store.save() }))
                Divider()
                toggleRow("개인 DM 발송", "본인에게만 오는 알림은 DM으로도 보냅니다.",
                          Binding(get: { store.dmEnabled }, set: { store.dmEnabled = $0; store.save() }))
                    .disabled(!store.slackEnabled).opacity(store.slackEnabled ? 1 : 0.4)
            }

            card {
                Text("알림별 발송 위치").font(.headline).foregroundStyle(Theme.Palette.ink)
                ForEach(Array(SystemStore.kinds.enumerated()), id: \.element.id) { idx, kind in
                    if idx > 0 { Divider() }
                    routeRow(kind)
                }
            }
        }
    }

    private func routeRow(_ kind: (id: String, label: String, sub: String)) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(kind.label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                Text(kind.sub).font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
            Picker("", selection: Binding(
                get: { store.routes[kind.id] ?? "off" },
                set: { store.routes[kind.id] = $0; store.save() }
            )) {
                ForEach(routeOptions, id: \.id) { Text($0.label).tag($0.id) }
            }.pickerStyle(.menu).tint(Theme.Palette.primary)
            .disabled(!store.slackEnabled)
        }
    }

    private func toggleRow(_ title: String, _ sub: String, _ isOn: Binding<Bool>) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                Text(sub).font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
            Toggle("", isOn: isOn).labelsHidden().tint(Theme.Palette.cta)
        }
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) { content() }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}
