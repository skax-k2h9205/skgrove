import SwiftUI

/// 팀 추억 — 행사별 사진·반응을 모으는 인스타 프로필식 화면(웹 Memory 이식).
struct MemoryView: View {
    @State private var tab = "게시물"

    var body: some View {
        ScreenScaffold(title: "팀 추억", showUserChip: false) {
            profileHeader
            Picker("보기", selection: $tab) {
                Text("게시물").tag("게시물")
                Text("캘린더").tag("캘린더")
            }
            .pickerStyle(.segmented)

            VStack(spacing: Theme.Space.x3) {
                Image(systemName: "photo.stack").font(.system(size: 36)).foregroundStyle(Theme.Palette.primary)
                Text("캘린더 탭에서 행사를 먼저 만들어 보세요.")
                    .font(.subheadline).foregroundStyle(Theme.Palette.muted).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x8)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        }
    }

    private var profileHeader: some View {
        HStack(spacing: Theme.Space.x4) {
            Circle().fill(Theme.Palette.tintNeutral).frame(width: 64, height: 64)
                .overlay(Image(systemName: "party.popper.fill").foregroundStyle(Theme.Palette.primary))
            VStack(alignment: .leading, spacing: Theme.Space.x2) {
                Text("team_memory").font(.headline).foregroundStyle(Theme.Palette.ink)
                HStack(spacing: Theme.Space.x4) {
                    stat("행사", "0"); stat("기록", "0"); stat("함께한 사람", "0")
                }
            }
            Spacer()
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
            Text(label).font(.caption2).foregroundStyle(Theme.Palette.muted)
        }
    }
}
