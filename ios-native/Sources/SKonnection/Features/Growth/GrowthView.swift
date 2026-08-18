import SwiftUI

/// 성장 · 커리어 — 웹 GrowthCard 이식. 내 성장(목표·역량·곡선) + 팀 성장(리더 정렬).
struct GrowthView: View {
    @EnvironmentObject private var growth: GrowthStore
    @EnvironmentObject private var session: SessionStore
    @State private var tab = 0
    @State private var roster: [AuthApi.Account] = []

    private var email: String { session.currentUser?.email.lowercased() ?? "" }
    private var canLead: Bool { session.currentUser?.role.isLeader == true }

    var body: some View {
        ScreenScaffold(title: "성장 · 커리어", showUserChip: false) {
            Picker("보기", selection: $tab) {
                Text("내 성장").tag(0)
                if canLead { Text("팀 성장").tag(1) }
            }
            .pickerStyle(.segmented)

            if tab == 0 { MyGrowth(email: email) } else { TeamGrowth(roster: roster) }
        }
        .task { if canLead, roster.isEmpty { roster = await AuthLink.fetchRoster() } }
    }
}

// ── 내 성장 ──
private struct MyGrowth: View {
    @EnvironmentObject private var growth: GrowthStore
    let email: String
    @State private var title = ""
    @State private var detail = ""
    @State private var due = ""
    /// 프로젝트 경험으로 추천받기 시트.
    @State private var suggesting = false

    private var myGoals: [GrowthGoal] { growth.goals.filter { $0.ownerEmail.lowercased() == email } }

    var body: some View {
        // 빈 칸 세 개만 두면 "무엇을 어떻게 적으라는 건지" 알 수 없다 —
        // 먼저 경험으로 초안을 받고, 그걸 고치는 흐름이 훨씬 쉽다.
        Button { suggesting = true } label: {
            HStack(spacing: Theme.Space.x2) {
                Image(systemName: "sparkles")
                VStack(alignment: .leading, spacing: 2) {
                    Text("프로젝트 경험으로 추천받기").font(.subheadline.weight(.semibold))
                    Text("해온 일을 적으면 역량 레벨과 목표를 제안해요")
                        .font(.caption).foregroundStyle(Theme.Palette.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            .padding(Theme.Space.x3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            .foregroundStyle(Theme.Palette.tintPrimaryInk)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $suggesting) { GrowthSuggestSheet(email: email) }

        sectionHeader("성장 목표", "target")
        VStack(spacing: Theme.Space.x2) {
            field("이번 분기 성장 목표", $title)
            field("세부 내용 (선택)", $detail)
            field("기한 (YYYY-MM-DD, 선택)", $due)
            Button {
                let t = title.trimmingCharacters(in: .whitespaces)
                guard !t.isEmpty else { return }
                growth.addGoal(ownerEmail: email, title: t, detail: detail.trimmingCharacters(in: .whitespaces), due: due)
                title = ""; detail = ""; due = ""
            } label: { Label("목표 추가", systemImage: "plus").frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2) }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
        }
        if myGoals.isEmpty {
            Text("아직 성장 목표가 없어요. 이번 분기 목표를 하나 세워보세요.")
                .font(.footnote).foregroundStyle(Theme.Palette.muted)
        }
        ForEach(myGoals) { g in goalCard(g) }

        sectionHeader("역량 레벨", "chart.line.uptrend.xyaxis")
        // 숫자만 있으면 3과 4의 차이를 알 수 없어 아무도 못 고른다. 뜻을 같이 보여준다.
        VStack(alignment: .leading, spacing: 4) {
            ForEach(1...5, id: \.self) { n in
                HStack(alignment: .top, spacing: 6) {
                    Text("\(n)").font(.caption.weight(.bold)).frame(width: 14, alignment: .leading)
                    Text(GrowthLevelGuide.long[n] ?? "").font(.caption)
                }
                .foregroundStyle(Theme.Palette.muted)
            }
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))

        ForEach(growthCompetencies, id: \.self) { c in competencyRow(c) }
    }

    private func goalCard(_ g: GrowthGoal) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack {
                Text(g.title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                Spacer()
                StatusBadge(text: g.status, tint: g.status == "완료" ? Theme.Palette.tintSuccess : Theme.Palette.tintPrimary,
                            ink: g.status == "완료" ? Theme.Palette.tintSuccessInk : Theme.Palette.tintPrimaryInk)
            }
            if !g.detail.isEmpty { Text(g.detail).font(.footnote).foregroundStyle(Theme.Palette.muted) }
            HStack {
                Slider(value: Binding(
                    get: { Double(g.progress) },
                    set: { v in growth.updateGoal(g.id) { $0.progress = GrowthRules.clampProgress(Int(v)); $0.status = GrowthRules.nextStatus(Int(v)) } }
                ), in: 0...100, step: 5)
                Text("\(g.progress)%").font(.caption).foregroundStyle(Theme.Palette.muted).frame(width: 40)
            }
            if !g.leaderComment.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    Text("리더 코멘트").font(.caption.weight(.semibold)).foregroundStyle(Theme.Palette.tintPrimaryInk)
                    Text(g.leaderComment).font(.footnote).foregroundStyle(Theme.Palette.ink)
                }
                .padding(Theme.Space.x2).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
            }
        }
        .padding(Theme.Space.x3)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }

    private func competencyRow(_ c: String) -> some View {
        let lvl = growth.levelFor(email, c)
        let series = GrowthRules.curve(growth.log.filter { $0.ownerEmail.lowercased() == email }, c, by: "self")
        return VStack(alignment: .leading, spacing: Theme.Space.x2) {
            HStack {
                Text(c).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                Spacer()
                Sparkline(values: series).frame(width: 60, height: 20)
            }
            HStack(spacing: 6) {
                ForEach(1...5, id: \.self) { n in
                    Button { growth.setSelfLevel(ownerEmail: email, competency: c, level: n) } label: {
                        Text("\(n)").font(.subheadline.weight(.bold))
                            .frame(width: 34, height: 34)
                            .background(lvl?.selfLevel == n ? Theme.Palette.cta : Theme.Palette.surface,
                                        in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
                            .foregroundStyle(lvl?.selfLevel == n ? .white : Theme.Palette.ink)
                            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.sm).stroke(Theme.Palette.border))
                    }.buttonStyle(.plain)
                }
                if let ll = lvl?.leaderLevel {
                    Text("리더 합의 \(ll)").font(.caption).foregroundStyle(Theme.Palette.muted)
                }
                Spacer(minLength: 0)
                if let mine = lvl?.selfLevel, let word = GrowthLevelGuide.short[mine] {
                    Text(word).font(.caption).foregroundStyle(Theme.Palette.tintPrimaryInk)
                }
            }
            TextField("근거 한 줄 (예: A프로젝트 리드)", text: Binding(
                get: { lvl?.evidence ?? "" },
                set: { growth.setEvidence(ownerEmail: email, competency: c, evidence: $0) }
            ))
            .textFieldStyle(.roundedBorder)
        }
        .padding(Theme.Space.x3)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
    }
}

// ── 팀 성장(리더) ──
private struct TeamGrowth: View {
    @EnvironmentObject private var growth: GrowthStore
    let roster: [AuthApi.Account]
    @State private var email = ""

    private var members: [AuthApi.Account] { roster.filter { $0.status == "활성" } }

    var body: some View {
        if members.isEmpty {
            Text("팀원을 불러오는 중…").font(.footnote).foregroundStyle(Theme.Palette.muted)
        } else {
            Picker("팀원", selection: $email) {
                ForEach(members, id: \.id) { m in Text("\(m.name) · \(m.part)").tag(m.email.lowercased()) }
            }
            .pickerStyle(.menu)
            .onAppear { if email.isEmpty { email = members.first?.email.lowercased() ?? "" } }

            let goals = growth.goals.filter { $0.ownerEmail.lowercased() == email }
            let levels = growth.levels.filter { $0.ownerEmail.lowercased() == email }

            sectionHeader("성장 목표 · 정렬", "target")
            if goals.isEmpty { Text("이 팀원은 아직 성장 목표가 없어요.").font(.footnote).foregroundStyle(Theme.Palette.muted) }
            ForEach(goals) { g in
                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    Text("\(g.title) · \(g.status) \(g.progress)%").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                    if !g.detail.isEmpty { Text(g.detail).font(.footnote).foregroundStyle(Theme.Palette.muted) }
                    TextField("리더 코멘트로 성장을 정렬해요", text: Binding(
                        get: { g.leaderComment },
                        set: { v in growth.updateGoal(g.id) { $0.leaderComment = v } }
                    ), axis: .vertical)
                    .textFieldStyle(.roundedBorder).lineLimit(2...4)
                }
                .padding(Theme.Space.x3)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
            }

            sectionHeader("역량 합의", "chart.line.uptrend.xyaxis")
            if levels.isEmpty { Text("아직 자가 역량 평가가 없어요.").font(.footnote).foregroundStyle(Theme.Palette.muted) }
            ForEach(levels) { l in
                VStack(alignment: .leading, spacing: Theme.Space.x2) {
                    Text("\(l.competency) · 자가 \(l.selfLevel)\(l.leaderLevel != nil ? " · 합의 \(l.leaderLevel!)" : "")")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                    if !l.evidence.isEmpty { Text(l.evidence).font(.footnote).foregroundStyle(Theme.Palette.muted) }
                    HStack(spacing: 6) {
                        ForEach(1...5, id: \.self) { n in
                            Button { growth.setLeaderLevel(l, level: n) } label: {
                                Text("\(n)").font(.subheadline.weight(.bold))
                                    .frame(width: 34, height: 34)
                                    .background(l.leaderLevel == n ? Theme.Palette.cta : Theme.Palette.surface,
                                                in: RoundedRectangle(cornerRadius: Theme.Radius.sm))
                                    .foregroundStyle(l.leaderLevel == n ? .white : Theme.Palette.ink)
                                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.sm).stroke(Theme.Palette.border))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                .padding(Theme.Space.x3)
                .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
            }
        }
    }
}

// ── 조각 ──
private func sectionHeader(_ title: String, _ icon: String) -> some View {
    Label(title, systemImage: icon).font(.headline).foregroundStyle(Theme.Palette.ink)
        .frame(maxWidth: .infinity, alignment: .leading).padding(.top, Theme.Space.x2)
}
private func field(_ placeholder: String, _ text: Binding<String>) -> some View {
    TextField(placeholder, text: text).textFieldStyle(.roundedBorder).autocorrectionDisabled()
}

/// 레벨 1–5 추이 스파크라인.
private struct Sparkline: View {
    let values: [Int]
    var body: some View {
        GeometryReader { geo in
            if values.count >= 2 {
                Path { p in
                    let w = geo.size.width, h = geo.size.height
                    for (i, v) in values.enumerated() {
                        let x = w * CGFloat(i) / CGFloat(values.count - 1)
                        let y = h - h * CGFloat(v - 1) / 4
                        if i == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) }
                    }
                }
                .stroke(Theme.Palette.cta, style: StrokeStyle(lineWidth: 2, lineJoin: .round))
            } else {
                Text("추이 없음").font(.caption2).foregroundStyle(Theme.Palette.muted)
            }
        }
    }
}
