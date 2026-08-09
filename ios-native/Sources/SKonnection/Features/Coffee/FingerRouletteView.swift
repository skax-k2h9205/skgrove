import SwiftUI

/// 손가락룰렛 — 주최자 폰 하나에 다 같이 손가락을 올린다.
///
/// 주최자 화면은 진짜 멀티터치다. 손가락이 닿는 **순서대로** 확정 명단이 배정되고,
/// 원 위에 얼굴·이름이 떠서 잘못 붙었으면 손을 뗐다 다시 대면 된다.
///
/// 관전자 화면은 손가락 좌표를 받지 않는다(그건 프레임 스트리밍이라 무겁다).
/// 대신 같은 참가자를 원형으로 늘어놓고, seed 로 정해진 **같은 두구두구**를 돌려
/// 같은 사람에서 멈춘다. 보는 사람 입장에선 같은 순간 같은 결과가 보인다.
struct FingerRouletteView: View {
    let game: CoffeeGame
    let isHost: Bool
    /// 손가락에 배정된 참가자들을 확정해 돌리기 시작한다(주최자 전용).
    let onSpin: ([CoffeeParticipant]) -> Void
    let onFinish: () -> Void

    @State private var fingers: [TouchPoint] = []
    @State private var settleTask: Task<Void, Never>?
    @State private var countdown: Int?

    /// 확정 명단(신청 순) — 손가락 닿는 순서대로 여기서 하나씩 가져다 붙인다.
    private var roster: [CoffeeParticipant] { game.participants }

    var body: some View {
        ZStack {
            if isHost, game.phase == .ready {
                hostStage
            } else {
                spectatorStage
            }
        }
        .frame(maxWidth: .infinity, minHeight: 420)
    }

    // MARK: 주최자 — 실제 멀티터치

    private var hostStage: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.Radius.lg)
                .fill(Theme.Palette.sunken)
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg)
                    .stroke(Theme.Palette.border))

            MultiTouchView(fingers: $fingers)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg))

            // 손가락 위 얼굴
            ForEach(assigned, id: \.participant.id) { item in
                CoffeeFace(participant: item.participant, size: 78)
                    .overlay(alignment: .bottom) {
                        Text(item.participant.name)
                            .font(.caption2.bold()).foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Theme.Palette.ink.opacity(0.75), in: Capsule())
                            .offset(y: 14)
                    }
                    .position(item.point)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: item.point)
            }
            .allowsHitTesting(false)

            centerGuide.allowsHitTesting(false)
        }
        .onChange(of: fingers.map(\.seq)) { _, _ in handleFingerChange() }
        .onDisappear { settleTask?.cancel() }
    }

    /// 손가락 ↔ 참가자 배정. 명단보다 손가락이 많으면 남는 손가락은 버린다.
    private var assigned: [(participant: CoffeeParticipant, point: CGPoint)] {
        fingers.enumerated().compactMap { idx, f in
            guard roster.indices.contains(idx) else { return nil }
            return (roster[idx], f.point)
        }
    }

    @ViewBuilder
    private var centerGuide: some View {
        if let countdown {
            Text("\(countdown)")
                .font(.system(size: 96, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.Palette.heart)
                .contentTransition(.numericText(countsDown: true))
        } else if fingers.isEmpty {
            VStack(spacing: Theme.Space.x3) {
                Image(systemName: "hand.point.up.left.fill")
                    .font(.system(size: 44)).foregroundStyle(Theme.Palette.primary)
                Text("다 같이 손가락을 올려주세요")
                    .font(.headline).foregroundStyle(Theme.Palette.ink)
                Text("확정 \(roster.count)명 · 닿는 순서대로 이름이 붙습니다")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
            }
        } else if assigned.count < 2 {
            Text("2명 이상 올려주세요")
                .font(.subheadline).foregroundStyle(Theme.Palette.muted)
        } else {
            Text("그대로 유지하세요…")
                .font(.subheadline.bold()).foregroundStyle(Theme.Palette.muted)
                .offset(y: -120)
        }
    }

    private func handleFingerChange() {
        settleTask?.cancel()
        countdown = nil
        let snapshot = assigned.map(\.participant)
        guard snapshot.count >= 2 else { return }

        settleTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 900_000_000)   // 손 구성 안정화
            guard !Task.isCancelled, assigned.count == snapshot.count else { return }
            for n in stride(from: 3, through: 1, by: -1) {
                withAnimation { countdown = n }
                Haptics.light()
                try? await Task.sleep(nanoseconds: 800_000_000)
                guard !Task.isCancelled, assigned.count == snapshot.count else { countdown = nil; return }
            }
            countdown = nil
            onSpin(snapshot)   // 이 순간의 사람들로 seed 확정 → 관전자에게 퍼진다
        }
    }

    // MARK: 관전(그리고 주최자의 돌리는 중·결과 화면)

    private var spectatorStage: some View {
        TimelineView(.animation) { context in
            let t = game.phase == .spinning ? game.elapsed(now: context.date)
                  : (game.phase == .done ? CoffeeSpin.fingerSpinDuration : 0)
            let focus = CoffeeSpin.fingerFocus(at: t, winnerIndex: game.winnerIndex,
                                               count: game.participants.count)
            let ended = t >= CoffeeSpin.fingerSpinDuration

            VStack(spacing: Theme.Space.x5) {
                Text(headlineText(ended: ended))
                    .font(ended ? .title2.bold() : .headline)
                    .foregroundStyle(ended ? Theme.Palette.heart : Theme.Palette.ink)

                ring(focus: ended ? game.winnerIndex : focus, settled: ended)
                    .frame(height: 300)
            }
            .onChange(of: ended) { _, done in
                if done, isHost, game.phase == .spinning { onFinish() }
            }
        }
    }

    private func headlineText(ended: Bool) -> String {
        if game.phase == .ready { return "\(game.startedBy)님이 준비 중입니다" }
        if ended { return "\(game.winnerName)님이 커피! ☕" }
        return "두구두구…"
    }

    private func ring(focus: Int, settled: Bool) -> some View {
        GeometryReader { geo in
            let n = max(game.participants.count, 1)
            let radius = min(geo.size.width, geo.size.height) / 2 - 52
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            ZStack {
                ForEach(Array(game.participants.enumerated()), id: \.element.id) { i, p in
                    let a = (Double(i) / Double(n)) * 2 * .pi - .pi / 2
                    let hit = i == focus
                    CoffeeFace(participant: p, size: hit ? 88 : 66, highlighted: hit)
                        .overlay(alignment: .bottom) {
                            Text(p.name).font(.caption2.bold())
                                .foregroundStyle(Theme.Palette.ink)
                                .offset(y: 16)
                        }
                        .opacity(settled && !hit ? 0.3 : 1)
                        .position(x: center.x + radius * cos(a), y: center.y + radius * sin(a))
                        .animation(.spring(response: 0.22, dampingFraction: 0.7), value: hit)
                }
            }
        }
    }
}
