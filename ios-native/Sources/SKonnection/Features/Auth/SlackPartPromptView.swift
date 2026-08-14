import SwiftUI

/// 첫 슬랙 로그인(신규 계정)에게 소속 파트만 1회 물어보는 화면. 웹 `SlackPartPrompt.tsx` 이식.
/// Slack 은 이름·이메일은 주지만 파트는 모른다 — 파트지수·파트 필터가 돌려면 최초 1회 본인이 고른다.
struct SlackPartPromptView: View {
    let identity: SlackIdentity
    let onConfirm: (String) -> Void
    let onCancel: () -> Void

    @State private var part: String = teamParts.first ?? "TEST혁신파트"
    @State private var busy = false

    var body: some View {
        ZStack {
            Theme.Palette.page.ignoresSafeArea()
            VStack(alignment: .leading, spacing: Theme.Space.x5) {
                header

                VStack(alignment: .leading, spacing: Theme.Space.x1) {
                    Label("\(identity.name.isEmpty ? identity.email : identity.name)님, 환영해요",
                          systemImage: "checkmark.shield.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.Palette.tintPrimaryInk)
                    Text("처음 로그인이에요. 소속 파트만 한 번 골라주시면 바로 시작합니다.")
                        .font(.footnote).foregroundStyle(Theme.Palette.muted)
                }
                .padding(Theme.Space.x3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))

                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    Text("소속 파트").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                    Picker("소속 파트", selection: $part) {
                        ForEach(teamParts, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                Button {
                    busy = true
                    onConfirm(part)
                } label: {
                    Label("시작하기", systemImage: "checkmark.shield.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x3)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.Palette.cta)
                .disabled(busy)

                Button("취소") { onCancel() }
                    .font(.subheadline)
                    .foregroundStyle(Theme.Palette.muted)
                    .frame(maxWidth: .infinity)
                    .disabled(busy)
            }
            .padding(Theme.Space.x5)
            .frame(maxWidth: .infinity)
        }
        .ignoresSafeArea(.container, edges: .top)
    }

    private var header: some View {
        HStack(spacing: Theme.Space.x3) {
            BrandMark(size: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text("SKonnection").font(.title2.bold()).foregroundStyle(Theme.Palette.ink)
                Text("팀을 잇는 곳").font(.subheadline).foregroundStyle(Theme.Palette.muted)
            }
        }
        .padding(.bottom, Theme.Space.x2)
    }
}
