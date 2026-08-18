import SwiftUI
import UIKit

/// 마이페이지 — 내 프로필 + 성향(MBTI·DISC) + '나와 일하는 법'(웹 mypage 이식).
/// 본인이 편집하는 값이라 기기에 저장(UserDefaults). 실제 공유는 Supabase 연동 시.
struct MyPageView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var profiles: ProfileStore

    @AppStorage("mypage.mbti") private var mbti = ""
    @AppStorage("mypage.disc") private var disc = ""
    @AppStorage("mypage.collabGuide") private var collabGuide = ""
    @State private var assessing = false
    @State private var promptCopied = false

    /// 저장 여부는 상태 플래그가 아니라 **저장된 프로필과 비교**해서 판단한다.
    /// 예전엔 save() 가 saved=true 로 켜자마자 값 변경 onChange 가 곧바로 false 로 되돌려,
    /// 실제로는 저장됐는데 버튼이 "저장"으로 남아 안 된 것처럼 보였다.
    private var storedMine: TeamProfile? {
        guard let email = session.currentUser?.email else { return nil }
        return profiles.profiles.first { $0.id == email }
    }
    private var isSaved: Bool {
        guard let m = storedMine else { return false }
        return m.mbti == mbti && m.disc == disc && m.collabGuide == collabGuide
    }

    private let mbtis = ["", "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
                         "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]
    private let discs = ["", "D", "I", "S", "C"]

    var body: some View {
        ScreenScaffold(title: "마이페이지", showUserChip: false) {
            if let user = session.currentUser {
                header(user)
            }

            card {
                Text("성향").font(.headline).foregroundStyle(Theme.Palette.ink)
                Text("평소 성향(MBTI)과 업무 성향(DISC)을 골라두면 동료가 협업할 때 참고해요.")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
                Button { assessing = true } label: {
                    Label("성향 진단하기 (28문항)", systemImage: "sparkles")
                        .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.bordered).tint(Theme.Palette.cta)
                labeled("MBTI (평소)") {
                    Picker("MBTI", selection: $mbti) {
                        ForEach(mbtis, id: \.self) { Text($0.isEmpty ? "선택 안 함" : $0).tag($0) }
                    }.pickerStyle(.menu).tint(Theme.Palette.primary).frame(maxWidth: .infinity, alignment: .leading)
                }
                labeled("DISC (업무)") {
                    Picker("DISC", selection: $disc) {
                        ForEach(discs, id: \.self) { Text($0.isEmpty ? "선택 안 함" : $0).tag($0) }
                    }.pickerStyle(.segmented)
                }
                // D·I·S·C 알파벳만으로는 무엇을 고르는지 알 수 없다.
                if let c = disc.first, let label = Assessment.discLabel[c] {
                    // 고른 뒤에는 그 유형이 무슨 뜻이고 동료가 어떻게 맞춰주면 되는지 보여준다.
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(disc) · \(label)").font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.Palette.tintPrimaryInk)
                        Text(Assessment.discGuide[c] ?? "").font(.caption).foregroundStyle(Theme.Palette.ink)
                    }
                    .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                } else {
                    // 고르기 전에는 네 글자가 각각 무슨 유형인지 알려준다.
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(["D", "I", "S", "C"], id: \.self) { key in
                            if let c = key.first, let label = Assessment.discLabel[c] {
                                Text("\(key) · \(label) — \(Assessment.discGuide[c] ?? "")")
                                    .font(.caption).foregroundStyle(Theme.Palette.muted)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            card {
                Text("나와 일하는 법").font(.headline).foregroundStyle(Theme.Palette.ink)
                Text("동료가 나와 협업할 때 알아두면 좋은 점을 적어두세요.")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
                TextField("예: 결정 전 배경과 리스크를 함께 보면 빠르게 맞춰갑니다.", text: $collabGuide, axis: .vertical)
                    .lineLimit(3...8)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))

                // 빈 칸 앞에서 뭘 써야 할지 막히는 자리다. 평소 쓰는 AI 는 나와 나눈 대화를
                // 기억하니, 거기에 물어보게 하면 훨씬 개인적인 초안을 얻는다.
                Button {
                    UIPasteboard.general.string = Assessment.collabPrompt(mbti: mbti, disc: disc)
                    withAnimation { promptCopied = true }
                    Haptics.success()
                } label: {
                    Label(promptCopied ? "복사했어요 — Claude·GPT에 붙여넣어 보세요" : "AI에게 물어볼 프롬프트 복사",
                          systemImage: promptCopied ? "checkmark" : "doc.on.doc")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.bordered)
                .tint(promptCopied ? Theme.Palette.success : Theme.Palette.cta)

                Text("평소 쓰는 AI에 붙여넣으면 나와 나눈 대화를 근거로 초안을 써줘요. 받은 내용을 위 칸에 붙여넣고 다듬으면 돼요.")
                    .font(.caption2).foregroundStyle(Theme.Palette.muted)
            }

            Button { save() } label: {
                Label(isSaved ? "저장됨 · 팀 분포에 반영됨" : "저장",
                      systemImage: isSaved ? "checkmark" : "square.and.arrow.down")
                    .font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(isSaved ? Theme.Palette.success : Theme.Palette.cta)
            .disabled(isSaved)
        }
        .onChange(of: mbti) { _, _ in promptCopied = false }
        .onChange(of: disc) { _, _ in promptCopied = false }
        .sheet(isPresented: $assessing) {
            AssessmentView { resultMbti, resultDisc, guide in
                mbti = resultMbti
                disc = resultDisc
                if collabGuide.trimmingCharacters(in: .whitespaces).isEmpty { collabGuide = guide }
                save()   // 진단 결과를 바로 프로필에 저장(원격 반영)
            }
        }
    }

    /// 저장 시 내 프로필을 공유 스토어에 반영해 팀 성향 분포·동료 목록에 바로 나타나게 한다.
    private func save() {
        if let user = session.currentUser {
            profiles.upsertMine(id: user.email, name: user.name, part: user.part,
                                mbti: mbti, disc: disc, collabGuide: collabGuide)
        }
        Haptics.success()
    }

    private func header(_ user: CurrentUser) -> some View {
        HStack(spacing: Theme.Space.x4) {
            Avatar(name: user.name, size: 64)
            VStack(alignment: .leading, spacing: 3) {
                Text(user.name).font(.title3.bold()).foregroundStyle(Theme.Palette.ink)
                Text("\(user.role.rawValue) · \(user.part)").font(.subheadline).foregroundStyle(Theme.Palette.muted)
                Text(user.email).font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
        }
        .padding(.vertical, Theme.Space.x2)
    }

    private func labeled(_ title: String, @ViewBuilder _ control: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            control()
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
