import SwiftUI

/// 이용약관 동의 게이트 — **로그인·가입 전에** 반드시 거친다.
///
/// App Store 심사 지침 1.2 는 사용자 생성 콘텐츠가 있는 앱에 "가입/로그인 전 약관 동의"를
/// 요구한다(2026-08-19 반려 사유). 무관용 방침과 24시간 내 조치 약속이 약관에 드러나야 한다.
struct TermsGateView: View {
    /// 동의 버전. 약관 내용을 고치면 올려서 다시 받는다.
    static let version = 1
    let onAgree: () -> Void

    @State private var agreed = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    VStack(alignment: .leading, spacing: Theme.Space.x2) {
                        Text("이용약관 및 커뮤니티 규칙")
                            .font(.title2.bold()).foregroundStyle(Theme.Palette.ink)
                        Text("SKonnection 을 쓰기 전에 아래 내용에 동의해 주세요.")
                            .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                    }
                    .padding(.top, Theme.Space.x5)

                    section("불쾌한 콘텐츠 무관용", [
                        "욕설·비방, 차별·혐오, 성적이거나 폭력적인 내용, 타인의 개인정보를 올릴 수 없습니다.",
                        "이런 콘텐츠를 올리면 사전 통보 없이 삭제되고, 계정 이용이 중단될 수 있습니다.",
                    ])
                    section("악용 사용자 무관용", [
                        "다른 사용자를 괴롭히거나 위협하는 행위를 허용하지 않습니다.",
                        "반복하거나 심각한 경우 계정을 영구히 이용 중단합니다.",
                    ])
                    section("신고와 차단", [
                        "모든 글과 댓글은 신고할 수 있고, 신고하면 내 화면에서 즉시 사라집니다.",
                        "특정 사용자를 차단하면 그 사용자의 글이 내 피드에서 즉시 사라집니다.",
                    ])
                    section("24시간 내 조치", [
                        "신고가 접수되면 운영자가 24시간 안에 확인해 문제가 있는 콘텐츠를 삭제하고,",
                        "작성자의 이용을 중단합니다.",
                    ])
                    section("작성 내용에 대한 책임", [
                        "올린 내용에 대한 책임은 작성자 본인에게 있습니다.",
                        "회사 기밀이나 타인의 정보를 올리지 않도록 주의해 주세요.",
                    ])
                }
                .padding(.horizontal, Theme.Space.x4)
                .padding(.bottom, Theme.Space.x4)
            }

            VStack(spacing: Theme.Space.x3) {
                // 스위치 대신 '줄 전체가 눌리는' 체크 행. 동의는 한 번 누르면 끝나는 결정이라
                // 좌우로 미는 스위치보다 맞고, 표적이 커서 누가 눌러도 확실히 들어간다.
                Button {
                    agreed.toggle()
                } label: {
                    HStack(alignment: .top, spacing: Theme.Space.x2) {
                        Image(systemName: agreed ? "checkmark.square.fill" : "square")
                            .font(.title3)
                            .foregroundStyle(agreed ? Theme.Palette.cta : Theme.Palette.muted)
                        Text("위 내용을 읽었고, 불쾌한 콘텐츠와 악용 행위에 무관용 원칙이 적용되는 데 동의합니다.")
                            .font(.footnote).foregroundStyle(Theme.Palette.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(agreed ? [.isButton, .isSelected] : .isButton)

                Button {
                    onAgree()
                } label: {
                    Text("동의하고 시작하기").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                .disabled(!agreed)
            }
            .padding(Theme.Space.x4)
            .background(Theme.Palette.surface)
            .overlay(Rectangle().frame(height: 1).foregroundStyle(Theme.Palette.border), alignment: .top)
        }
        .background(Theme.Palette.sunken)
    }

    private func section(_ title: String, _ lines: [String]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(title).font(.subheadline.weight(.bold)).foregroundStyle(Theme.Palette.ink)
            ForEach(lines, id: \.self) { line in
                HStack(alignment: .top, spacing: 6) {
                    Text("•").font(.footnote).foregroundStyle(Theme.Palette.muted)
                    Text(line).font(.footnote).foregroundStyle(Theme.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }
}
