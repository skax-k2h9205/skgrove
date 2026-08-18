import SwiftUI

/// 프로젝트 경험 → 역량 레벨·성장 목표 추천. 받은 값은 **그대로 저장하지 않고** 사용자가
/// 하나씩 눌러 적용한다 — 추천은 초안이지 결론이 아니다.
struct GrowthSuggestSheet: View {
    let email: String
    @EnvironmentObject private var growth: GrowthStore
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    @State private var projects = ""
    @State private var loading = false
    @State private var levels: [GrowthSuggest.LevelSuggestion] = []
    @State private var goals: [GrowthSuggest.GoalSuggestion] = []
    @State private var applied: Set<String> = []
    @State private var error: String?

    private var canAsk: Bool { projects.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10 && !loading }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    VStack(alignment: .leading, spacing: Theme.Space.x2) {
                        Text("어떤 일을 해오셨나요?").font(.subheadline.weight(.semibold))
                        Text("프로젝트 이름·역할·한 일을 편하게 적어주세요. 문장이 아니어도 괜찮아요.")
                            .font(.caption).foregroundStyle(Theme.Palette.muted)
                        TextEditor(text: $projects)
                            .frame(minHeight: 140)
                            .padding(6)
                            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.sm).stroke(Theme.Palette.border))
                        // 빈 화면 앞에서 막히지 않게 예시를 준다.
                        Text("예: DAVIS 에이전트 파트 리드, 사내 RAG 챗봇 설계·배포, 신입 온보딩 멘토링")
                            .font(.caption2).foregroundStyle(Theme.Palette.muted)
                    }

                    Button(action: ask) {
                        HStack {
                            if loading { ProgressView().tint(.white) } else { Image(systemName: "sparkles") }
                            Text(loading ? "생각하는 중…" : "추천받기")
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }
                    .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                    .disabled(!canAsk)

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Theme.Palette.danger)
                    }

                    if !levels.isEmpty {
                        Text("역량 레벨 제안").font(.subheadline.weight(.semibold))
                        ForEach(levels) { s in levelCard(s) }
                    }
                    if !goals.isEmpty {
                        Text("성장 목표 제안").font(.subheadline.weight(.semibold))
                        ForEach(goals) { s in goalCard(s) }
                    }
                }
                .padding(Theme.Space.x4)
            }
            .navigationTitle("추천받기")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } }
            }
        }
    }

    private func levelCard(_ s: GrowthSuggest.LevelSuggestion) -> some View {
        let key = "L:\(s.competency)"
        return VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack {
                Text(s.competency).font(.subheadline.weight(.semibold))
                Spacer()
                Text("레벨 \(s.level) · \(GrowthLevelGuide.short[s.level] ?? "")")
                    .font(.caption).foregroundStyle(Theme.Palette.tintPrimaryInk)
            }
            if !s.evidence.isEmpty {
                Text(s.evidence).font(.footnote).foregroundStyle(Theme.Palette.muted)
            }
            Button(applied.contains(key) ? "적용됨" : "이대로 적용") {
                growth.setSelfLevel(ownerEmail: email, competency: s.competency, level: s.level)
                if !s.evidence.isEmpty {
                    growth.setEvidence(ownerEmail: email, competency: s.competency, evidence: s.evidence)
                }
                applied.insert(key)
                Haptics.success()
            }
            .buttonStyle(.bordered)
            .disabled(applied.contains(key))
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }

    private func goalCard(_ s: GrowthSuggest.GoalSuggestion) -> some View {
        let key = "G:\(s.title)"
        return VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(s.title).font(.subheadline.weight(.semibold))
            if !s.detail.isEmpty {
                Text(s.detail).font(.footnote).foregroundStyle(Theme.Palette.muted)
            }
            Button(applied.contains(key) ? "추가됨" : "목표로 추가") {
                growth.addGoal(ownerEmail: email, title: s.title, detail: s.detail, due: "")
                applied.insert(key)
                Haptics.success()
            }
            .buttonStyle(.bordered)
            .disabled(applied.contains(key))
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }

    private func ask() {
        loading = true
        error = nil
        Task {
            let res = await GrowthSuggest.request(
                projects: projects,
                competencies: growthCompetencies,
                role: session.currentUser?.part,
            )
            loading = false
            if res.ok {
                levels = res.levels
                goals = res.goals
            } else {
                // AI 가 꺼져 있어도 화면은 살아 있어야 한다 — 수동 입력으로 돌아가라고 알려준다.
                error = (res.reason ?? "추천을 받지 못했어요.") + "\n직접 입력해도 괜찮아요."
            }
        }
    }
}
