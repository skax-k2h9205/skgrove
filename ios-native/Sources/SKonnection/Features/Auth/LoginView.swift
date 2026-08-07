import SwiftUI

/// 네이티브 로그인 화면. 웹앱 LoginScreen 과 같은 입력(이름·사내메일·비밀번호).
/// Phase 0 에서는 클라이언트 검증만 — 실제 Supabase 인증은 Phase 1 에서 연결한다.
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var email = ""
    @State private var password = ""
    @State private var error: String?

    /// 입력한 메일이 등록 계정이고 비밀번호가 아직 없으면 '첫 로그인'(비밀번호 설정) 모드.
    private var isFirstLogin: Bool {
        guard let account = Account.find(email: email) else { return false }
        return !AuthService.hasPassword(email: account.email)
    }

    var body: some View {
        // 전체 화면 기준으로 세로 중앙 정렬한다(ZStack 이 자식을 가운데 놓는다).
        // 콘텐츠가 화면 중앙이라 세이프에어리어와 겹치지 않는다.
        ZStack {
            Theme.Palette.page.ignoresSafeArea()
            VStack(alignment: .leading, spacing: Theme.Space.x5) {
                header

                field(title: "사내메일", text: $email, placeholder: "name@sk.com", keyboard: .emailAddress)

                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    field(title: isFirstLogin ? "비밀번호 설정" : "비밀번호",
                          text: $password,
                          placeholder: isFirstLogin ? "앞으로 쓸 비밀번호 (6자 이상)" : "비밀번호",
                          secure: true)
                    if isFirstLogin {
                        Text("👋 처음이면, 여기 입력한 비밀번호가 그대로 등록돼요.")
                            .font(.footnote)
                            .foregroundStyle(Theme.Palette.tintPrimaryInk)
                            .padding(Theme.Space.x3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    }
                }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Theme.Palette.danger)
                        .padding(Theme.Space.x3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Palette.tintDanger, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                }

                Button(action: submit) {
                    Label(isFirstLogin ? "비밀번호 설정하고 로그인" : "로그인", systemImage: "arrow.right.to.line")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x3)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.Palette.cta)
            }
            .padding(Theme.Space.x5)
            .frame(maxWidth: .infinity)
        }
        // 상단 세이프에어리어(다이나믹 아일랜드)만큼 위로 확장해 '전체 화면' 기준
        // 중앙에 오게 한다. 하단 인셋은 남겨 키보드 회피를 보존한다.
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
        // 이메일이 계정을 식별하므로 이름은 받지 않는다(불필요한 마찰 제거).
        // 세션에는 계정의 실제 이름이 들어간다.
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard trimmedEmail.contains("@") else { error = "사내메일을 입력해주세요."; return }

        switch AuthService.authenticate(email: trimmedEmail, password: password) {
        case .success(let account):
            error = nil
            session.login(account.currentUser)
        case .unknownEmail:
            error = "등록된 사내메일이 아니에요."
        case .wrongPassword:
            error = "비밀번호가 일치하지 않아요."
        case .tooShort:
            error = "비밀번호는 6자 이상이어야 합니다."
        case .needsPassword:
            error = "비밀번호를 설정해주세요."
        }
    }
}
