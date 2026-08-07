import SwiftUI

/// 마이페이지 — 내 프로필 + 성향(MBTI·DISC) + '나와 일하는 법'(웹 mypage 이식).
/// 본인이 편집하는 값이라 기기에 저장(UserDefaults). 실제 공유는 Supabase 연동 시.
struct MyPageView: View {
    @EnvironmentObject private var session: SessionStore

    @AppStorage("mypage.mbti") private var mbti = ""
    @AppStorage("mypage.disc") private var disc = ""
    @AppStorage("mypage.collabGuide") private var collabGuide = ""
    @State private var saved = false

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
            }

            Button { saved = true; Haptics.success() } label: {
                Label(saved ? "저장됨" : "저장", systemImage: saved ? "checkmark" : "square.and.arrow.down")
                    .font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(saved ? Theme.Palette.success : Theme.Palette.cta)
        }
        .onChange(of: mbti) { _, _ in saved = false }
        .onChange(of: disc) { _, _ in saved = false }
        .onChange(of: collabGuide) { _, _ in saved = false }
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
