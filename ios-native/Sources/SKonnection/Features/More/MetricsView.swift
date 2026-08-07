import SwiftUI

/// 파트지수 / 리포트 — 팀의 거버넌스 활동을 공유 스토어에서 실시간 산출한다(웹 Metrics 이식).
struct MetricsView: View {
    @EnvironmentObject private var issues: IssueStore
    @EnvironmentObject private var agendas: AgendaStore
    @EnvironmentObject private var actions: ActionStore
    @EnvironmentObject private var meetings: MeetingStore
    @EnvironmentObject private var gatherings: GatheringStore
    @EnvironmentObject private var market: MarketStore

    // MARK: 실산출 지표

    /// 접수가 리더 처리(답변·1on1·안건화·액션·종료)로 반영된 비율.
    private var reflectionRate: Int {
        guard !issues.issues.isEmpty else { return 0 }
        let reflected = issues.issues.filter {
            [.answered, .oneOnOne, .action, .agenda, .closed].contains($0.status)
        }.count
        return Int((Double(reflected) / Double(issues.issues.count) * 100).rounded())
    }
    /// 안건 성사율(통과+결정 / 전체).
    private var agendaPassRate: Int {
        guard !agendas.agendas.isEmpty else { return 0 }
        let passed = agendas.agendas.filter { $0.status == .passed || $0.status == .decided }.count
        return Int((Double(passed) / Double(agendas.agendas.count) * 100).rounded())
    }
    /// 액션 완료율.
    private var actionDoneRate: Int {
        guard !actions.items.isEmpty else { return 0 }
        let done = actions.items.filter { $0.status == .done }.count
        return Int((Double(done) / Double(actions.items.count) * 100).rounded())
    }
    /// 문화 건강도 — 반영률·안건성사·액션완료·지연을 종합(0~100).
    private var cultureHealth: Int {
        let base = (reflectionRate + agendaPassRate + actionDoneRate) / 3
        let penalty = actions.overdueCount * 5
        return max(0, min(100, base - penalty))
    }

    var body: some View {
        ScreenScaffold(title: "파트지수 / 리포트", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            hero
            summary
            activityCard
            healthNote
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text("CULTURE HEALTH REPORT").font(.caption.weight(.bold)).foregroundStyle(Theme.Palette.primarySoft)
            Text("팀 문화 건강도 \(cultureHealth)").font(.title.bold()).foregroundStyle(.white)
            Text("접수·안건·액션·미팅 흐름을 실데이터로 집계합니다.")
                .font(.subheadline).foregroundStyle(Theme.Palette.primarySoft)
        }
        .padding(Theme.Space.x5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surfaceDark, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
    }

    private var summary: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.Space.x3) {
            stat("의견 제출", "\(issues.issues.count)", "chart.bar.doc.horizontal")
            stat("반영률", "\(reflectionRate)%", "checkmark.seal")
            stat("안건 성사율", "\(agendaPassRate)%", "checkmark.square")
            stat("액션 완료율", "\(actionDoneRate)%", "checkmark.circle")
        }
    }

    /// 기능별 활동량 — 실제 스토어 카운트로 막대를 그린다.
    private var activityCard: some View {
        let rows: [(String, Int, Color)] = [
            ("대나무숲 접수", issues.issues.count, Theme.Palette.primary),
            ("안건 / 투표", agendas.agendas.count, Theme.Palette.cta),
            ("액션아이템", actions.items.count, Theme.Palette.success),
            ("미팅(캔+티)", meetings.cans.count + meetings.teas.count, Theme.Palette.primaryStrong),
            ("모임 · 번개", gatherings.gatherings.count, Theme.Palette.heart),
            ("이음장터", market.items.count, Theme.Palette.danger),
        ]
        let maxV = max(rows.map(\.1).max() ?? 1, 1)
        return card {
            Label("기능별 활동량", systemImage: "chart.bar").font(.headline).foregroundStyle(Theme.Palette.ink)
            ForEach(rows, id: \.0) { name, value, color in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(name).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                        Spacer()
                        Text("\(value)건").font(.subheadline.weight(.bold)).foregroundStyle(Theme.Palette.ink)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4).fill(Theme.Palette.sunken)
                            RoundedRectangle(cornerRadius: 4).fill(color)
                                .frame(width: max(6, geo.size.width * CGFloat(value) / CGFloat(maxV)))
                        }
                    }
                    .frame(height: 8)
                }
                .padding(.vertical, Theme.Space.x1)
            }
        }
    }

    private var healthNote: some View {
        HStack(alignment: .top, spacing: Theme.Space.x2) {
            Image(systemName: "info.circle.fill").foregroundStyle(Theme.Palette.primary)
            Text(actions.overdueCount > 0
                 ? "지연된 액션 \(actions.overdueCount)건이 문화 건강도를 낮추고 있어요. 먼저 처리해 보세요."
                 : "지연된 액션이 없어 흐름이 건강해요. 이대로 유지해요. 👍")
                .font(.footnote).foregroundStyle(Theme.Palette.tintPrimaryInk)
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }

    private func stat(_ label: String, _ value: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Image(systemName: icon).foregroundStyle(Theme.Palette.primary)
            Text(label).font(.caption).foregroundStyle(Theme.Palette.muted)
            Text(value).font(.title2.bold()).foregroundStyle(Theme.Palette.ink)
        }
        .padding(Theme.Space.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) { content() }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}
