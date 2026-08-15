import SwiftUI

/// 로그인 — 웹앱(dev, blind-email-auth)과 **동일한 절차**: Supabase Auth 이메일+비번+6자리 OTP.
///  login → 이메일+비번 · signup → 이름·메일·비번·파트 → 코드 발송 · verify → 코드 확인 → 입장
///  reset → 메일로 코드 → 새 비번. 접근은 @sk.com 게이트. 세션→계정 매칭은 AuthLink(이메일 기준).
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore

    private enum Phase { case login, signup, verifySignup, reset, resetVerify }

    @State private var phase: Phase = .login
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var part = teamParts.first ?? "TEST혁신파트"
    @State private var code = ""
    @State private var newPw = ""
    @State private var newPw2 = ""
    @State private var error: String?
    @State private var notice: String?
    @State private var busy = false
    // 신규 @sk.com 인데 파트 정보가 없을 때만(예외) 파트 선택으로.
    @State private var pendingNewUser: SlackIdentity?

    private let minPassword = 6

    var body: some View {
        if let identity = pendingNewUser {
            SlackPartPromptView(
                identity: identity,
                onConfirm: { chosen in
                    Task { let user = await AuthLink.createAccount(identity, part: chosen)
                        pendingNewUser = nil; session.login(user) }
                },
                onCancel: { pendingNewUser = nil; Task { await SupabaseAuth.signOut() } })
        } else {
            form
        }
    }

    private var form: some View {
        ZStack {
            Theme.Palette.page.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x5) {
                    header
                    fields
                    if let error { banner(error, tint: Theme.Palette.tintDanger, ink: Theme.Palette.danger) }
                    if let notice { banner(notice, tint: Theme.Palette.tintPrimary, ink: Theme.Palette.tintPrimaryInk) }
                    primaryButton
                    footerLinks
                }
                .padding(Theme.Space.x5)
                .frame(maxWidth: .infinity)
            }
        }
        .ignoresSafeArea(.container, edges: .top)
    }

    // MARK: - 단계별 입력

    @ViewBuilder private var fields: some View {
        switch phase {
        case .login:
            field("사내메일", $email, placeholder: "name@sk.com", keyboard: .emailAddress)
            field("비밀번호", $password, placeholder: "비밀번호", secure: true)
        case .signup:
            field("이름", $name, placeholder: "이선민")
            field("사내메일", $email, placeholder: "name@sk.com", keyboard: .emailAddress)
            field("비밀번호", $password, placeholder: "\(minPassword)자 이상", secure: true)
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                Text("소속 파트").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                Picker("소속 파트", selection: $part) {
                    ForEach(teamParts, id: \.self) { Text($0).tag($0) }
                }.pickerStyle(.segmented)
            }
        case .verifySignup:
            noteCard("메일로 받은 6자리 인증 코드를 입력해 주세요.")
            field("인증 코드", $code, placeholder: "6자리", keyboard: .numberPad)
        case .reset:
            noteCard("사내메일로 재설정 코드를 보내드려요.")
            field("사내메일", $email, placeholder: "name@sk.com", keyboard: .emailAddress)
        case .resetVerify:
            field("재설정 코드", $code, placeholder: "메일로 받은 6자리", keyboard: .numberPad)
            field("새 비밀번호", $newPw, placeholder: "\(minPassword)자 이상", secure: true)
            field("새 비밀번호 확인", $newPw2, placeholder: "한 번 더", secure: true)
        }
    }

    // MARK: - 액션

    private func submit() async {
        if busy { return }
        busy = true; error = nil; notice = nil
        defer { busy = false }
        let em = email.trimmingCharacters(in: .whitespaces).lowercased()
        let needEmail = phase == .login || phase == .signup || phase == .reset
        if needEmail, !AuthApi.isCompanyEmail(em) {
            error = "사내메일은 @sk.com 계정만 사용할 수 있어요."; return
        }
        do {
            switch phase {
            case .login:
                let id = try await SupabaseAuth.signInEmail(em, password)
                await onAuthSuccess(id)
            case .signup:
                guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { error = "이름을 입력해주세요."; return }
                guard password.count >= minPassword else { error = "비밀번호는 \(minPassword)자 이상이어야 해요."; return }
                let needOTP = try await SupabaseAuth.signUpEmail(em, password,
                                                                 name: name.trimmingCharacters(in: .whitespaces), part: part)
                if needOTP { phase = .verifySignup; notice = "메일로 6자리 인증 코드를 보냈어요." }
                else { let id = try await SupabaseAuth.signInEmail(em, password); await onAuthSuccess(id) }
            case .verifySignup:
                guard !code.trimmingCharacters(in: .whitespaces).isEmpty else { error = "인증 코드를 입력해 주세요."; return }
                let id = try await SupabaseAuth.verifySignupOTP(em, code.trimmingCharacters(in: .whitespaces))
                await onAuthSuccess(id)
            case .reset:
                try await SupabaseAuth.requestReset(em)
                phase = .resetVerify; notice = "가입된 계정이라면 메일로 재설정 코드를 보냈어요."
            case .resetVerify:
                guard newPw.count >= minPassword else { error = "새 비밀번호는 \(minPassword)자 이상이어야 해요."; return }
                guard newPw == newPw2 else { error = "두 비밀번호가 서로 달라요."; return }
                try await SupabaseAuth.confirmReset(em, code.trimmingCharacters(in: .whitespaces), newPassword: newPw)
                phase = .login; code = ""; newPw = ""; newPw2 = ""
                notice = "비밀번호가 바뀌었어요. 새 비밀번호로 로그인해 주세요."
            }
        } catch let e as SupabaseAuth.EmailError {
            error = (e == .alreadyRegistered)
                ? "이미 가입된 사내메일이에요. 로그인하거나 비밀번호 찾기를 이용해주세요."
                : "인증에 실패했어요. 다시 시도해 주세요."
            if e == .alreadyRegistered { phase = .login }
        } catch {
            // Supabase Auth 오류(비번 불일치·코드 오류 등)를 일반 문구로.
            self.error = errorMessage(for: phase)
        }
    }

    private func onAuthSuccess(_ identity: SlackIdentity) async {
        let roster = await AuthLink.fetchRoster()
        switch AuthLink.resolve(identity, roster) {
        case .login(let account, let user):
            await AuthLink.link(account, identity)
            session.login(user)
        case .newUser(let id):
            if let p = id.part, !p.isEmpty {
                let user = await AuthLink.createAccount(id, part: p)
                session.login(user)
            } else {
                pendingNewUser = id
            }
        case .blocked(let reason):
            error = reason
            await SupabaseAuth.signOut()
        }
    }

    private func errorMessage(for phase: Phase) -> String {
        switch phase {
        case .login: return "이메일 또는 비밀번호가 올바르지 않아요. (메일 인증 전이면 가입 코드부터 확인해 주세요.)"
        case .verifySignup, .resetVerify: return "코드가 올바르지 않거나 만료됐어요. 다시 확인해 주세요."
        default: return "요청에 실패했어요. 잠시 후 다시 시도해 주세요."
        }
    }

    // MARK: - 버튼/링크

    private var primaryLabel: String {
        switch phase {
        case .login: return busy ? "확인 중…" : "로그인"
        case .signup: return busy ? "코드 보내는 중…" : "가입하고 코드 받기"
        case .verifySignup: return busy ? "확인 중…" : "코드 확인하고 시작"
        case .reset: return busy ? "보내는 중…" : "재설정 코드 받기"
        case .resetVerify: return busy ? "처리 중…" : "비밀번호 바꾸기"
        }
    }

    private var primaryButton: some View {
        Button { Task { await submit() } } label: {
            Label(primaryLabel, systemImage: phase == .login ? "arrow.right.to.line" : "checkmark.shield.fill")
                .font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x3)
        }
        .buttonStyle(.borderedProminent).tint(Theme.Palette.cta).disabled(busy)
    }

    @ViewBuilder private var footerLinks: some View {
        HStack {
            switch phase {
            case .login:
                Button("비밀번호를 잊으셨나요?") { go(.reset) }
                Spacer()
                Button("가입") { go(.signup) }
            case .signup, .reset:
                Button("로그인으로") { go(.login) }
            case .verifySignup:
                Button("가입 다시") { go(.signup) }
                Spacer()
                Button("로그인으로") { go(.login) }
            case .resetVerify:
                Button("로그인으로") { go(.login) }
            }
        }
        .font(.footnote).foregroundStyle(Theme.Palette.cta)
    }

    private func go(_ next: Phase) {
        phase = next; error = nil; notice = nil; code = ""; password = ""
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
        Text(text).font(.footnote).foregroundStyle(ink)
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(tint, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }

    private func noteCard(_ text: String) -> some View {
        Text(text).font(.footnote).foregroundStyle(Theme.Palette.muted)
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }

    @ViewBuilder
    private func field(_ title: String, _ text: Binding<String>, placeholder: String,
                       keyboard: UIKeyboardType = .default, secure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            Group {
                if secure { SecureField(placeholder, text: text) }
                else {
                    TextField(placeholder, text: text)
                        .keyboardType(keyboard).textInputAutocapitalization(.never).autocorrectionDisabled()
                }
            }
            .padding(Theme.Space.x3)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border, lineWidth: 1))
        }
    }
}
