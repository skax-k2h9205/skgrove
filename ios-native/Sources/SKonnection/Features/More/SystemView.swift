import SwiftUI

/// 시스템 관리 · 알림 발송 — 커넥셔너 전용 설정(웹 SystemManagement 이식).
struct SystemView: View {
    @AppStorage("system.slack") private var slackOn = true
    @AppStorage("system.dm") private var dmOn = true
    @AppStorage("system.ch.intake") private var chIntake = "커넥셔너 채널"
    @AppStorage("system.ch.agenda") private var chAgenda = "팀 채널"
    @AppStorage("system.ch.deadline") private var chDeadline = "팀 채널"

    private let channels = ["팀 채널", "커넥셔너 채널", "발송 안 함"]

    var body: some View {
        ScreenScaffold(title: "시스템 관리", showUserChip: false) {
            HStack(spacing: Theme.Space.x2) {
                Image(systemName: "gearshape.2.fill").foregroundStyle(Theme.Palette.primary)
                Text("여기서 바꾼 설정은 저장 즉시 팀 전체에 적용됩니다. 슬랙 봇 토큰만 서버 비밀입니다.")
                    .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
            }
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))

            card {
                Text("발송 채널").font(.headline).foregroundStyle(Theme.Palette.ink)
                toggleRow("슬랙 알림 사용", "끄면 어떤 슬랙도 보내지 않고 앱 안 알림만 남습니다.", $slackOn)
                Divider()
                toggleRow("개인 DM 발송", "본인에게만 오는 알림은 DM으로도 보냅니다.", $dmOn)
                    .disabled(!slackOn).opacity(slackOn ? 1 : 0.4)
            }

            card {
                Text("알림별 발송 위치").font(.headline).foregroundStyle(Theme.Palette.ink)
                channelRow("새 접수", "대나무숲에 새 의견이 들어온 때", $chIntake)
                Divider()
                channelRow("안건 등록", "새 안건이 투표에 올라온 때", $chAgenda)
                Divider()
                channelRow("마감 임박", "안건 투표 마감이 임박한 때", $chDeadline)
            }
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

    private func channelRow(_ title: String, _ sub: String, _ sel: Binding<String>) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                Text(sub).font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
            Picker("", selection: sel) {
                ForEach(channels, id: \.self) { Text($0).tag($0) }
            }.pickerStyle(.menu).tint(Theme.Palette.primary)
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
