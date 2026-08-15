import SwiftUI

/// 리더 암호화 키 설정(최초 1회) — 웹 LeaderKeySetup 이식.
/// 패스프레이즈는 이 기기에서만 쓰이고 서버로 전송되지 않는다. 복구코드는 1회만 표시.
struct LeaderKeySetupView: View {
    let accountId: String
    let onDone: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var pass = ""
    @State private var pass2 = ""
    @State private var busy = false
    @State private var error: String?
    @State private var recoveryCode = ""
    @State private var confirmed = false

    private let minPass = 8

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    if recoveryCode.isEmpty { setupForm } else { recoveryStep }
                }
                .padding(Theme.Space.x4)
            }
            .navigationTitle("암호화 키 설정")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var setupForm: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            note("익명 접수를 열어보려면 암호화 키가 필요해요. 패스프레이즈는 기기에서만 쓰이고 서버로 전송되지 않습니다.")
            field("패스프레이즈", $pass, placeholder: "\(minPass)자 이상")
            field("패스프레이즈 확인", $pass2, placeholder: "한 번 더")
            if let error { Text(error).font(.footnote).foregroundStyle(Theme.Palette.danger) }
            Button(action: create) {
                Label(busy ? "키 생성 중…" : "키 만들기", systemImage: "key.fill")
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta).disabled(busy)
        }
    }

    private var recoveryStep: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x4) {
            note("복구코드를 안전한 곳에 저장하세요. 패스프레이즈를 잊으면 이 코드로만 복구됩니다. 서버·운영자는 이 코드를 모릅니다. 다시 보여주지 않습니다.")
            HStack {
                Text(recoveryCode).font(.system(.body, design: .monospaced)).textSelection(.enabled)
                Spacer()
                Button { UIPasteboard.general.string = recoveryCode } label: { Image(systemName: "doc.on.doc") }
            }
            .padding(Theme.Space.x3)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            Toggle("복구코드를 저장했어요.", isOn: $confirmed)
            Button {
                onDone(); dismiss()
            } label: {
                Label("완료", systemImage: "checkmark.shield.fill")
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta).disabled(!confirmed)
        }
    }

    private func create() {
        guard pass.count >= minPass else { error = "패스프레이즈는 \(minPass)자 이상이어야 해요."; return }
        guard pass == pass2 else { error = "두 패스프레이즈가 서로 달라요."; return }
        busy = true; error = nil
        Task {
            defer { busy = false }
            let pair = IssueCrypto.generateRecipientKeypair()
            let code = IssueCrypto.generateRecoveryCode()
            do {
                let rec = LeaderKeysStore.Record(
                    accountId: accountId,
                    publicJwk: pair.publicJwk,
                    encPrivPassphrase: try IssueCrypto.wrapPrivateKey(pair.privateJwk, secret: pass),
                    encPrivRecovery: try IssueCrypto.wrapPrivateKey(pair.privateJwk, secret: code),
                    alg: IssueCrypto.alg)
                let ok = await LeaderKeysStore.save(rec)
                if !ok { error = "키 저장에 실패했어요. 잠시 후 다시 시도해 주세요."; return }
                LeaderKeysStore.cachePrivateKey(accountId, pair.privateJwk)
                recoveryCode = code
            } catch { self.error = "키 생성에 실패했어요." }
        }
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.footnote).foregroundStyle(Theme.Palette.muted)
            .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }
    private func field(_ title: String, _ text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x1) {
            Text(title).font(.subheadline.weight(.semibold))
            SecureField(placeholder, text: text)
                .padding(Theme.Space.x3)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
        }
    }
}

/// 암호화 접수 본문 — 대상 리더만 자기 기기에서 복호화해 표시. 웹 EncryptedIssueBody 이식.
struct EncryptedIssueBody: View {
    let issue: Issue
    let accountId: String

    private enum Phase { case loading, notRecipient, noKey, locked, unlocked, error }
    @State private var phase: Phase = .loading
    @State private var record: LeaderKeysStore.Record?
    @State private var body_ = ""
    @State private var expected = ""
    @State private var pass = ""
    @State private var busy = false
    @State private var message = ""
    @State private var showSetup = false

    private var encIssue: IssueCrypto.EncryptedIssue {
        IssueCrypto.EncryptedIssue(alg: issue.encAlg ?? IssueCrypto.alg,
                                   payload: issue.encPayload ?? "",
                                   keys: issue.encKeys ?? [])
    }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                Label("불러오는 중…", systemImage: "lock.fill").font(.footnote).foregroundStyle(Theme.Palette.muted)
            case .notRecipient:
                lockNote("이 글은 회원님 키로 암호화되지 않아 열람할 수 없어요.")
            case .noKey:
                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    lockNote("암호화된 익명 접수예요. 열람하려면 암호화 키를 먼저 설정하세요.")
                    Button { showSetup = true } label: { Label("암호화 키 설정", systemImage: "key.fill") }
                        .buttonStyle(.bordered).tint(Theme.Palette.cta)
                }
            case .locked, .error:
                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    lockNote("대상 리더인 회원님만 열람할 수 있어요.")
                    SecureField("패스프레이즈", text: $pass)
                        .padding(Theme.Space.x2)
                        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
                        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.sm).stroke(Theme.Palette.border))
                    if phase == .error, !message.isEmpty {
                        Text(message).font(.caption).foregroundStyle(Theme.Palette.danger)
                    }
                    Button(action: unlock) { Label(busy ? "여는 중…" : "열람", systemImage: "lock.open.fill") }
                        .buttonStyle(.bordered).tint(Theme.Palette.cta).disabled(busy || pass.isEmpty)
                }
            case .unlocked:
                VStack(alignment: .leading, spacing: Theme.Space.x1) {
                    Label("복호화됨", systemImage: "checkmark.shield.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(Theme.Palette.tintSuccessInk)
                    Text(body_).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                    if !expected.isEmpty {
                        Text("기대 변화: \(expected)").font(.caption).foregroundStyle(Theme.Palette.muted)
                    }
                }
            }
        }
        .task(id: accountId) { await load() }
        .sheet(isPresented: $showSetup) {
            LeaderKeySetupView(accountId: accountId, onDone: { Task { await load() } })
        }
    }

    private func load() async {
        guard !accountId.isEmpty else { phase = .loading; return }
        guard encIssue.keys.contains(where: { $0.accountId == accountId }) else { phase = .notRecipient; return }
        if let cached = await LeaderKeysStore.cachedPrivateKey(accountId) {
            decrypt(with: cached); return
        }
        if let rec = await LeaderKeysStore.loadRecord(accountId) {
            record = rec; phase = .locked
        } else {
            phase = .noKey
        }
    }

    private func unlock() {
        guard let rec = record else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                let priv = try IssueCrypto.unwrapPrivateKey(rec.encPrivPassphrase, secret: pass)
                LeaderKeysStore.cachePrivateKey(accountId, priv)
                pass = ""
                decrypt(with: priv)
            } catch {
                message = "패스프레이즈가 올바르지 않아요."; phase = .error
            }
        }
    }

    private func decrypt(with priv: IssueCrypto.JWK) {
        do {
            let text = try IssueCrypto.decryptAsRecipient(encIssue, accountId: accountId, privateJwk: priv)
            if let p = AnonEncrypt.decodePayload(text) { body_ = p.body; expected = p.expectedChange }
            else { body_ = text }
            phase = .unlocked
        } catch { message = "복호화에 실패했어요."; phase = .error }
    }

    private func lockNote(_ text: String) -> some View {
        Label(text, systemImage: "lock.fill").font(.footnote).foregroundStyle(Theme.Palette.muted)
    }
}
