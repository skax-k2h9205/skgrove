import SwiftUI

/// 커피 내기 게임 화면. 주최자는 진행자, 나머지는 관전자 — 같은 화면을 역할만 달리 쓴다.
///
/// 흐름
///  1. 주최자가 게임을 고른다 → phase .ready 로 올라가고, 참가자 폰에 "곧 시작합니다"
///  2. 돌리면 seed·시작시각 확정(phase .spinning) → 모든 폰이 같은 연출을 각자 그린다
///  3. 끝나면 주최자가 winner 를 확정(phase .done)하고 gatherings.coffee_pick 에도 남긴다
struct CoffeeGameSheet: View {
    let gatheringId: String
    let isHost: Bool
    /// 모임을 연 사람 이름 — 관전 화면의 "○○님이 곧 돌립니다" 문구에 쓴다.
    let hostName: String
    let participants: [CoffeeParticipant]
    /// 결과 확정 시 모임에 반영(coffee_pick).
    let onWinner: (String) -> Void

    @EnvironmentObject private var games: CoffeeGameStore
    @Environment(\.dismiss) private var dismiss

    /// 다시보기 시작 시각. 켜져 있는 동안은 서버 상태 대신 이 시각을 기준으로 그린다.
    @State private var replayStart: Date?

    private var game: CoffeeGame? { games.game(for: gatheringId) }

    /**
     화면에 그릴 게임. 다시보기 중이면 **시작 시각만 지금으로 바꾼 사본**을 넘긴다.
     연출은 전부 `시간 → 화면` 순수 계산이라, 시작 시각만 옮기면 같은 seed 로
     같은 그림이 처음부터 다시 흐른다. 게임 뷰는 한 줄도 고칠 필요가 없다.
     */
    private func displayed(_ g: CoffeeGame) -> CoffeeGame {
        guard let start = replayStart else { return g }
        var copy = g
        copy.phase = .spinning
        copy.startedAtMs = Int64(start.timeIntervalSince1970 * 1000)
        return copy
    }

    private func replay(_ g: CoffeeGame) {
        guard replayStart == nil else { return }
        Haptics.light()
        replayStart = Date()
        let seconds = g.kind == .wheel ? CoffeeSpin.wheelTotalDuration : CoffeeSpin.fingerSpinDuration
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64((seconds + 0.6) * 1_000_000_000))
            replayStart = nil
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Theme.Space.x5) {
                    if let game {
                        stage(game)
                        if game.phase == .done { doneFooter(game) }
                    } else if isHost {
                        picker
                    } else {
                        waiting
                    }
                }
                .padding(Theme.Space.x4)
            }
            .background(Theme.Palette.sunken)
            .navigationTitle("커피 내기").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
        .presentationDetents([.large])
        .task { await games.refresh(gatheringId) }
    }

    // MARK: 단계별 화면

    @ViewBuilder
    private func stage(_ game: CoffeeGame) -> some View {
        // 다시보기 중에는 isHost 를 끈다 — 진행자 버튼이 뜨거나 onFinish 가 다시 불리면 안 된다.
        let shown = displayed(game)
        let asHost = isHost && replayStart == nil
        switch game.kind {
        case .wheel:
            CoffeeWheelView(game: shown, isHost: asHost,
                            onSpin: { Task { await games.spin(gatheringId: gatheringId,
                                                              participants: participants) } },
                            onFinish: finish)
        case .finger:
            FingerRouletteView(game: shown, isHost: asHost,
                               onSpin: { picked in
                                   Task { await games.spin(gatheringId: gatheringId,
                                                           participants: picked) } },
                               onFinish: finish)
        }
    }

    private var picker: some View {
        VStack(spacing: Theme.Space.x3) {
            Text("어떤 걸로 정할까요?")
                .font(.title3.bold()).foregroundStyle(Theme.Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("확정 \(participants.count)명이 대상입니다")
                .font(.caption).foregroundStyle(Theme.Palette.muted)
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(CoffeeGameKind.allCases, id: \.self) { kind in
                Button {
                    Task { await games.open(gatheringId: gatheringId, kind: kind,
                                            host: hostName, participants: participants) }
                    Haptics.selection()
                } label: {
                    HStack(spacing: Theme.Space.x3) {
                        Image(systemName: kind.systemImage)
                            .font(.title2).frame(width: 40)
                            .foregroundStyle(Theme.Palette.primary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(kind.rawValue).font(.headline).foregroundStyle(Theme.Palette.ink)
                            Text(kind.blurb).font(.caption).foregroundStyle(Theme.Palette.muted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(Theme.Palette.muted)
                    }
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var waiting: some View {
        VStack(spacing: Theme.Space.x3) {
            ProgressView().tint(Theme.Palette.muted)
            Text("아직 시작 전이에요")
                .font(.headline).foregroundStyle(Theme.Palette.ink)
            Text("주최자가 게임을 시작하면 여기에서 같이 볼 수 있어요.")
                .font(.caption).foregroundStyle(Theme.Palette.muted)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, Theme.Space.x8)
    }

    private func doneFooter(_ game: CoffeeGame) -> some View {
        VStack(spacing: Theme.Space.x2) {
            Text("\(game.kind.rawValue) · 참가 \(game.participants.count)명")
                .font(.caption).foregroundStyle(Theme.Palette.muted)
            Button { replay(game) } label: {
                Label(replayStart == nil ? "다시보기" : "재생 중…", systemImage: "arrow.counterclockwise")
                    .font(.subheadline).frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.bordered).tint(Theme.Palette.primary)
            .disabled(replayStart != nil)
        }
    }

    private func finish() {
        Task {
            if let winner = await games.finish(gatheringId: gatheringId), !winner.isEmpty {
                onWinner(winner)
                Haptics.success()
            }
        }
    }
}
