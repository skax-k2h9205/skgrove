import SwiftUI

/// MBTI(16) + DISC(12) 성향 진단 플로우. 마지막 문항 뒤 결과를 계산해 프로필에 반영한다.
struct AssessmentView: View {
    /// (mbti, disc, 소통 가이드) 를 돌려준다.
    let onComplete: (_ mbti: String, _ disc: String, _ collabGuide: String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var index = 0
    @State private var mbtiAnswers: [String: Bool] = [:]      // true = a
    @State private var discAnswers: [String: Character] = [:]
    @State private var result: (mbti: String, disc: Character)?

    private let total = Assessment.mbti.count + Assessment.disc.count

    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Space.x4) {
                if let result {
                    resultView(result)
                } else {
                    ProgressView(value: Double(index), total: Double(total))
                        .tint(Theme.Palette.cta)
                    Text("\(index + 1) / \(total)").font(.caption).foregroundStyle(Theme.Palette.muted)
                    question
                    Spacer()
                }
            }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Theme.Palette.sunken)
            .navigationTitle("성향 진단").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
    }

    @ViewBuilder private var question: some View {
        if index < Assessment.mbti.count {
            let q = Assessment.mbti[index]
            VStack(spacing: Theme.Space.x3) {
                Text("나에게 더 가까운 쪽은?").font(.headline).foregroundStyle(Theme.Palette.ink)
                choice(q.a) { answer(mbti: q.id, a: true) }
                choice(q.b) { answer(mbti: q.id, a: false) }
            }
        } else {
            let q = Assessment.disc[index - Assessment.mbti.count]
            VStack(alignment: .leading, spacing: Theme.Space.x3) {
                Text(q.prompt).font(.headline).foregroundStyle(Theme.Palette.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(Array(q.options.enumerated()), id: \.offset) { _, opt in
                    choice(opt.text) { answer(disc: q.id, key: opt.key) }
                }
            }
        }
    }

    private func choice(_ text: String, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Text(text).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Theme.Space.x4)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
        }
        .buttonStyle(.plain)
    }

    private func answer(mbti id: String, a: Bool) {
        mbtiAnswers[id] = a
        Haptics.selection()
        advance()
    }
    private func answer(disc id: String, key: Character) {
        discAnswers[id] = key
        Haptics.selection()
        advance()
    }

    private func advance() {
        if index + 1 < total {
            withAnimation(.snappy) { index += 1 }
        } else {
            let mbti = Assessment.scoreMBTI(mbtiAnswers)
            let disc = Assessment.scoreDISC(discAnswers)
            withAnimation { result = (mbti, disc) }
            Haptics.success()
        }
    }

    private func resultView(_ r: (mbti: String, disc: Character)) -> some View {
        let label = Assessment.discLabel[r.disc] ?? ""
        let guide = Assessment.discGuide[r.disc] ?? ""
        return VStack(spacing: Theme.Space.x4) {
            Image(systemName: "sparkles").font(.system(size: 40)).foregroundStyle(Theme.Palette.cta)
            Text("\(r.mbti) · \(label)").font(.largeTitle.bold()).foregroundStyle(Theme.Palette.ink)
            Text(guide).font(.subheadline).foregroundStyle(Theme.Palette.muted)
                .multilineTextAlignment(.center)
            Button {
                onComplete(r.mbti, String(r.disc), guide)
                dismiss()
            } label: {
                Text("내 프로필에 반영").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
            Button("다시 하기") { mbtiAnswers = [:]; discAnswers = [:]; index = 0; result = nil }
                .font(.subheadline).tint(Theme.Palette.muted)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}
