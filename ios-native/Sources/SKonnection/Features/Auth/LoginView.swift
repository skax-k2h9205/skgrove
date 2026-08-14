import SwiftUI

/// 네이티브 로그인 화면. 웹앱 `LoginScreen` 과 **같은 절차**를 따른다:
/// 이메일+비밀번호 → 서버 인증(api/auth) → (서버 없으면) anon+PBKDF2 폴백 검증 → 세션.
/// 초기 비번은 첫 로그인 때 강제 변경(change), 잊었으면 슬랙 DM 인증번호로 초기화(reset).
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore

    // auth: 로그인 · change: 첫 로그인 강제 변경 · reset-*: 인증번호 초기화
    private enum Phase { case auth, change, resetRequest, resetConfirm }

    @State private var phase: Phase = .auth
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var notice: String?
    @State private var busy = false

    // 강제 변경·초기화 단계에서 쓰는 값들.
    @State private var newPw = ""
    @State private var newPw2 = ""
    @State private var code = ""
    // 강제 변경에는 방금 로그인에 쓴 값들이 필요하다(현재 비번 확인 + 입장할 유저 + 폴백 계정).
    @State private var pendingUser: CurrentUser?
    @State private var pendingCurrentPw = ""
    @State private var pendingAccount: AuthApi.Account?

    private let minPassword = 6

    var body: some View {
        ZStack {
            Theme.Palette.page.ignoresSafeArea()
            VStack(alignment: .leading, spacing: Theme.Space.x5) {
                header

                switch phase {
                case .auth: authFields
                case .change: changeFields
                case .resetRequest: resetRequestFields
                case .resetConfirm: resetConfirmFields
                }

                if let error {
                    banner(error, tint: Theme.Palette.tintDanger, ink: Theme.Palette.danger)
                }
                if let notice {
                    banner(notice, tint: Theme.Palette.tintPrimary, ink: Theme.Palette.tintPrimaryInk)
                }

                primaryButton
                if phase != .auth { cancelButton }
            }
            .padding(Theme.Space.x5)
            .frame(maxWidth: .infinity)
        }
        // 상단 세이프에어리어(다이나믹 아일랜드)만큼 위로 확장해 '전체 화면' 기준 중앙 정렬.
        .ignoresSafeArea(.container, edges: .top)
    }

    // MARK: - 단계별 입력

    private var authFields: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x5) {
            field(title: "사내메일", text: $email, placeholder: "name@sk.com", keyboard: .emailAddress)
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                field(title: "비밀번호", text: $password, placeholder: "비밀번호", secure: true)
                Button("비밀번호를 잊으셨나요?") {
                    phase = .resetRequest
                    resetTransient()
                }
                .font(.footnote)
                .foregroundStyle(Theme.Palette.cta)
            }
        }
    }

    private var changeFields: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x5) {
            noteCard(icon: "checkmark.shield.fill", title: "새 비밀번호를 정해 주세요",
                     body: "보안을 위해 초기 비밀번호는 처음 로그인할 때 반드시 바꿔야 해요.")
            field(title: "새 비밀번호", text: $newPw, placeholder: "\(minPassword)자 이상", secure: true)
            field(title: "새 비밀번호 확인", text: $newPw2, placeholder: "한 번 더", secure: true)
        }
    }

    private var resetRequestFields: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x5) {
            noteCard(icon: "key.fill", title: "비밀번호 초기화",
                     body: "사내메일로 인증번호를 슬랙 DM으로 보내드려요.")
            field(title: "사내메일", text: $email, placeholder: "name@sk.com", keyboard: .emailAddress)
        }
    }

    private var resetConfirmFields: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x5) {
            field(title: "인증번호", text: $code, placeholder: "슬랙 DM으로 받은 6자리", keyboard: .numberPad)
            field(title: "새 비밀번호", text: $newPw, placeholder: "\(minPassword)자 이상", secure: true)
            field(title: "새 비밀번호 확인", text: $newPw2, placeholder: "한 번 더", secure: true)
        }
    }

    // MARK: - 액션

    private func submit() async {
        if busy { return }
        busy = true
        defer { busy = false }
        error = nil

        switch phase {
        case .change: await submitChange()
        case .resetRequest: await submitResetRequest()
        case .resetConfirm: await submitResetConfirm()
        case .auth: await submitLogin()
        }
    }

    private func submitLogin() async {
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard AuthApi.isCompanyEmail(trimmedEmail) else {
            error = "사내메일은 @sk.com 계정만 사용할 수 있어요."; return
        }
        guard !password.isEmpty else { error = "비밀번호를 입력해주세요."; return }

        // 상태 안내는 서버 왕복 전에 accounts 로 먼저 거른다(웹과 동일). 폴백 검증에도 이 행을 쓴다.
        let account = await AuthApi.fetchAccount(email: trimmedEmail)
        if account?.status == "승인 대기" {
            error = "아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요."; return
        }
        if account?.status == "비활성" {
            error = "비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요."; return
        }

        switch await AuthApi.login(email: trimmedEmail, password: password, fallbackAccount: account) {
        case .failure(let message):
            error = message
        case .success(let user, let mustChange):
            notice = nil
            if mustChange {
                // 초기 비번 등 → 입장 전에 새 비번을 강제로 정한다.
                pendingUser = user
                pendingCurrentPw = password
                pendingAccount = account
                phase = .change
            } else {
                session.login(user)
            }
        }
    }

    private func submitChange() async {
        guard newPw.count >= minPassword else { error = "새 비밀번호는 \(minPassword)자 이상이어야 해요."; return }
        guard newPw == newPw2 else { error = "두 비밀번호가 서로 달라요."; return }
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        let r = await AuthApi.changePassword(email: trimmedEmail, currentPassword: pendingCurrentPw,
                                             newPassword: newPw, fallbackAccount: pendingAccount)
        if !r.ok { error = r.error ?? "비밀번호를 바꾸지 못했어요."; return }
        if let pendingUser { session.login(pendingUser) } // 변경 성공 → 그대로 입장.
    }

    private func submitResetRequest() async {
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard AuthApi.isCompanyEmail(trimmedEmail) else {
            error = "사내메일은 @sk.com 계정만 사용할 수 있어요."; return
        }
        let r = await AuthApi.requestReset(email: trimmedEmail)
        if !r.ok { error = r.error ?? "요청에 실패했어요."; return }
        notice = "가입된 계정이라면 슬랙 DM으로 인증번호를 보냈어요. 5분 안에 입력해 주세요."
        phase = .resetConfirm
    }

    private func submitResetConfirm() async {
        guard !code.trimmingCharacters(in: .whitespaces).isEmpty else { error = "인증번호를 입력해 주세요."; return }
        guard newPw.count >= minPassword else { error = "새 비밀번호는 \(minPassword)자 이상이어야 해요."; return }
        guard newPw == newPw2 else { error = "두 비밀번호가 서로 달라요."; return }
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        let r = await AuthApi.confirmReset(email: trimmedEmail,
                                           code: code.trimmingCharacters(in: .whitespaces), newPassword: newPw)
        if !r.ok { error = r.error ?? "초기화에 실패했어요."; return }
        backToAuth()
        notice = "비밀번호가 바뀌었어요. 새 비밀번호로 로그인해 주세요."
    }

    private func backToAuth() {
        phase = .auth
        resetTransient()
        password = ""
        pendingUser = nil
        pendingCurrentPw = ""
        pendingAccount = nil
    }

    /// 단계 전환 시 일시적 입력·안내를 비운다.
    private func resetTransient() {
        error = nil
        notice = nil
        newPw = ""
        newPw2 = ""
        code = ""
    }

    // MARK: - 버튼

    private var primaryLabel: String {
        switch phase {
        case .auth: return busy ? "확인 중…" : "로그인"
        case .change: return busy ? "처리 중…" : "새 비밀번호로 시작하기"
        case .resetRequest: return busy ? "처리 중…" : "인증번호 받기"
        case .resetConfirm: return busy ? "처리 중…" : "비밀번호 바꾸기"
        }
    }

    private var primaryIcon: String {
        phase == .auth ? "arrow.right.to.line" : "checkmark.shield.fill"
    }

    private var primaryButton: some View {
        Button { Task { await submit() } } label: {
            Label(primaryLabel, systemImage: primaryIcon)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Space.x3)
        }
        .buttonStyle(.borderedProminent)
        .tint(Theme.Palette.cta)
        .disabled(busy)
    }

    private var cancelButton: some View {
        // 강제 변경은 취소할 수 없다(입장 전에 반드시 새 비번을 정해야 함).
        Group {
            if phase != .change {
                Button("취소") { backToAuth() }
                    .font(.subheadline)
                    .foregroundStyle(Theme.Palette.muted)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - 조각

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

    private func banner(_ text: String, tint: Color, ink: Color) -> some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(ink)
            .padding(Theme.Space.x3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tint, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }

    private func noteCard(icon: String, title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x1) {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.Palette.tintPrimaryInk)
            Text(body).font(.footnote).foregroundStyle(Theme.Palette.muted)
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
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
}
