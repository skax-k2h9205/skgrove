import SwiftUI
import AuthenticationServices

/// 로그인 라우터 — 웹 `App.tsx`/`LoginScreen` 의 새 규약을 이식.
/// 정상 배포(Supabase 설정됨)에선 **Slack 로그인이 유일한 입구**다. 이메일/비번 화면은
/// Supabase 미설정(로컬 개발) 폴백으로만 뜬다(웹 `showEmailLogin = !onSlackLogin` 과 동일).
/// 접근 통제는 Slack 워크스페이스 멤버십 — @sk.com 도메인 게이트는 없다.
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    // 첫 슬랙 로그인(매칭 실패) → 소속 파트 1회 선택 후 자동 활성 팀원 생성.
    @State private var slackNewUser: SlackIdentity?

    var body: some View {
        if let identity = slackNewUser {
            SlackPartPromptView(
                identity: identity,
                onConfirm: { part in
                    Task {
                        let user = await AuthLink.createAccount(identity, part: part)
                        slackNewUser = nil
                        session.login(user)
                    }
                },
                onCancel: {
                    slackNewUser = nil
                    Task { await SupabaseAuth.signOut() }
                })
        } else if Supabase.isConfigured {
            SlackLoginView(onNewUser: { slackNewUser = $0 })
        } else {
            EmailPasswordLoginView() // 로컬 폴백(정상 배포에선 안 보임)
        }
    }
}

// MARK: - Slack 로그인(기본)

private struct SlackLoginView: View {
    @EnvironmentObject private var session: SessionStore
    var onNewUser: (SlackIdentity) -> Void

    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ZStack {
            Theme.Palette.page.ignoresSafeArea()
            VStack(alignment: .leading, spacing: Theme.Space.x5) {
                header

                Text("사내 슬랙 계정으로 로그인해요.\n슬랙 워크스페이스 멤버라면 바로 시작할 수 있어요.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Theme.Palette.danger)
                        .padding(Theme.Space.x3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Palette.tintDanger, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                }

                Button(action: start) {
                    Label(busy ? "슬랙 여는 중…" : "Slack으로 로그인", systemImage: "number.square.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x3)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.Palette.cta)
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

    private func start() {
        busy = true
        error = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                let identity = try await SupabaseAuth.signInWithSlack()
                let roster = await AuthLink.fetchRoster()
                switch AuthLink.resolve(identity, roster) {
                case .login(let account, let user):
                    await AuthLink.link(account, identity)
                    session.login(user)
                case .newUser(let id):
                    onNewUser(id)
                case .blocked(let reason):
                    error = reason
                    await SupabaseAuth.signOut()
                }
            } catch {
                // 사용자가 로그인 창을 닫은 경우는 조용히 넘긴다.
                if !isUserCancel(error) {
                    self.error = "슬랙 로그인을 완료하지 못했어요. 다시 시도해 주세요."
                }
            }
        }
    }

    private func isUserCancel(_ error: Error) -> Bool {
        if let e = error as? ASWebAuthenticationSessionError { return e.code == .canceledLogin }
        return false
    }
}

// MARK: - 이메일/비번 폴백(Supabase 미설정 로컬 개발 전용)
//
// 정상 배포에선 렌더되지 않는다. 서버 인증(/api/auth) 우선 + anon+PBKDF2 폴백으로,
// 웹 `authApi.ts` 와 같은 절차. (이전 커밋 1644de3 의 로그인 화면을 폴백으로 보존.)

private struct EmailPasswordLoginView: View {
    @EnvironmentObject private var session: SessionStore

    private enum Phase { case auth, change, resetRequest, resetConfirm }

    @State private var phase: Phase = .auth
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var notice: String?
    @State private var busy = false

    @State private var newPw = ""
    @State private var newPw2 = ""
    @State private var code = ""
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
        .ignoresSafeArea(.container, edges: .top)
    }

    private var authFields: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x5) {
            field(title: "사내메일", text: $email, placeholder: "name@sk.com", keyboard: .emailAddress)
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                field(title: "비밀번호", text: $password, placeholder: "비밀번호", secure: true)
                Button("비밀번호를 잊으셨나요?") { phase = .resetRequest; resetTransient() }
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
        if let pendingUser { session.login(pendingUser) }
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

    private func resetTransient() {
        error = nil; notice = nil; newPw = ""; newPw2 = ""; code = ""
    }

    private var primaryLabel: String {
        switch phase {
        case .auth: return busy ? "확인 중…" : "로그인"
        case .change: return busy ? "처리 중…" : "새 비밀번호로 시작하기"
        case .resetRequest: return busy ? "처리 중…" : "인증번호 받기"
        case .resetConfirm: return busy ? "처리 중…" : "비밀번호 바꾸기"
        }
    }

    private var primaryButton: some View {
        Button { Task { await submit() } } label: {
            Label(primaryLabel, systemImage: phase == .auth ? "arrow.right.to.line" : "checkmark.shield.fill")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Space.x3)
        }
        .buttonStyle(.borderedProminent)
        .tint(Theme.Palette.cta)
        .disabled(busy)
    }

    private var cancelButton: some View {
        Group {
            if phase != .change {
                Button("취소") { backToAuth() }
                    .font(.subheadline)
                    .foregroundStyle(Theme.Palette.muted)
                    .frame(maxWidth: .infinity)
            }
        }
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
