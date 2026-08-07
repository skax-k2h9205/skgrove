import SwiftUI

/// 네이티브 로그인 화면. 웹앱 LoginScreen 과 같은 입력(이름·사내메일·비밀번호).
/// Phase 0 에서는 클라이언트 검증만 — 실제 Supabase 인증은 Phase 1 에서 연결한다.
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.x5) {
                header

                field(title: "이름", text: $name, placeholder: "이선민")
                field(title: "사내메일", text: $email, placeholder: "name@sk.com", keyboard: .emailAddress)
                field(title: "비밀번호", text: $password, placeholder: "비밀번호", secure: true)

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Theme.Palette.danger)
                        .padding(Theme.Space.x3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Palette.tintDanger, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                }

                Button(action: submit) {
                    Label("로그인", systemImage: "arrow.right.to.line")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x3)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.Palette.cta)
            }
            .padding(Theme.Space.x5)
        }
        .background(Theme.Palette.page)
    }

    private var header: some View {
        HStack(spacing: Theme.Space.x3) {
            BrandMark(size: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text("SKonnection").font(.title2.bold()).foregroundStyle(Theme.Palette.ink)
                Text("팀을 잇는 곳").font(.subheadline).foregroundStyle(Theme.Palette.muted)
            }
        }
        .padding(.top, Theme.Space.x8)
        .padding(.bottom, Theme.Space.x2)
    }

    @ViewBuilder
    private func field(title: String, text: Binding<String>, placeholder: String,
                       keyboard: UIKeyboardType = .default, secure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            Group {
                if secure {
                    SecureField(placeholder, text: text)
                } else {
                    TextField(placeholder, text: text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .padding(Theme.Space.x3)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.md)
                    .stroke(Theme.Palette.border, lineWidth: 1)
            )
        }
    }

    private func submit() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { error = "이름을 입력해주세요."; return }
        guard trimmedEmail.contains("@") else { error = "사내메일을 입력해주세요."; return }
        guard password.count >= 6 else { error = "비밀번호는 6자 이상이어야 합니다."; return }
        error = nil
        session.login(CurrentUser(name: trimmedName, email: trimmedEmail, part: "ITS혁신파트", role: .partLeader))
    }
}
