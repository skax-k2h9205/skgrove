import SwiftUI

/// 커피룰렛 — 확정 명단 수만큼 칸으로 나뉜 원판.
///
/// fun-game 원본은 "멈춰"라고 외쳐서 세웠지만, 그러면 기기마다 멈추는 순간이 달라져
/// 다 같이 보는 게 불가능하다. 여기서는 **정해진 시간 동안 돌고 스스로 멈춘다** —
/// 시작 시각과 seed 만 공유하면 모든 폰이 같은 순간 같은 칸에서 멈춘다.
struct CoffeeWheelView: View {
    let game: CoffeeGame
    let isHost: Bool
    let onSpin: () -> Void
    let onFinish: () -> Void

    @State private var celebrate = false

    private var people: [CoffeeParticipant] { game.participants }
    private var winnerIndex: Int { game.winnerIndex }

    // 12색. 8색이면 9명부터 원판을 한 바퀴 돌아 인접 칸이 같은 색이 된다.
    private let palette: [Color] = [
        Color(hex: 0x006BB8), Color(hex: 0xED4956), Color(hex: 0x047857),
        Color(hex: 0xE8A33D), Color(hex: 0x7C3AED), Color(hex: 0x0EA5A5),
        Color(hex: 0xDB2777), Color(hex: 0x2563EB), Color(hex: 0xF97316),
        Color(hex: 0x0891B2), Color(hex: 0x65A30D), Color(hex: 0x9333EA),
    ]

    /// 마지막 칸이 첫 칸과 붙어 있으므로, 한 바퀴 도는 경우 색이 이어지지 않게 건너뛴다.
    private func segmentColor(_ i: Int, count: Int) -> Color {
        let n = palette.count
        if count > 1, count % n == 1, i == count - 1 { return palette[1 % n] }
        return palette[i % n]
    }

    var body: some View {
        VStack(spacing: Theme.Space.x5) {
            headline

            TimelineView(.animation(paused: game.phase != .spinning)) { context in
                let t = game.phase == .spinning ? game.elapsed(now: context.date)
                      : (game.phase == .done ? CoffeeSpin.wheelTotalDuration : 0)
                let rot = CoffeeSpin.wheelRotation(at: t, winnerIndex: winnerIndex, count: people.count)
                let ended = t >= CoffeeSpin.wheelTotalDuration
                wheelStack(rotation: rot)
                    // 칸 하나가 바늘을 지날 때마다 딸깍. 실제 룰렛의 손맛이 여기서 나온다.
                    // 각도로 세면 감속하면서 간격이 저절로 벌어져 긴장감이 붙는다.
                    .onChange(of: Int(rot / (360.0 / Double(max(people.count, 1))))) { _, _ in
                        if game.phase == .spinning, !ended { Haptics.light() }
                    }
                    .onChange(of: ended) { _, done in
                        guard done, game.phase == .spinning else { return }
                        Haptics.success()
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.5)) { celebrate = true }
                        if isHost { onFinish() }
                    }
            }
            .frame(width: 300, height: 300)
            .overlay { if celebrate || game.phase == .done { CoffeeConfetti(seed: game.seed) } }

            footer
            Spacer(minLength: 0)
        }
        .padding(.top, Theme.Space.x5)
        .frame(maxWidth: .infinity)
    }

    // MARK: 조각

    @ViewBuilder
    private var headline: some View {
        switch game.phase {
        case .ready:
            Text(isHost ? "돌려서 커피 쏠 사람을 정하세요" : "\(game.startedBy)님이 곧 돌립니다")
                .font(.headline).foregroundStyle(Theme.Palette.ink)
        case .spinning:
            Text("두구두구…").font(.title2.bold()).foregroundStyle(Theme.Palette.primary)
        case .done:
            VStack(spacing: Theme.Space.x1) {
                Label("오늘 커피는", systemImage: "cup.and.saucer.fill")
                    .font(.subheadline).foregroundStyle(Theme.Palette.muted)
                Text("\(game.winnerName)님!")
                    .font(.largeTitle.bold()).foregroundStyle(Theme.Palette.heart)
            }
        }
    }

    private func wheelStack(rotation: Double) -> some View {
        ZStack {
            wheel(visibleRotation: rotation)
                .rotationEffect(.degrees(rotation))
            Circle().fill(.white).frame(width: 44, height: 44)
                .overlay(Circle().stroke(Theme.Palette.border, lineWidth: 3))
                .shadow(radius: 2)
            // 위쪽 고정 바늘(아래를 가리킴)
            CoffeeTriangle()
                .fill(Theme.Palette.heart)
                .frame(width: 26, height: 22)
                .rotationEffect(.degrees(180))
                .offset(y: -140)
                .shadow(radius: 2)
        }
    }

    private func wheel(visibleRotation: Double) -> some View {
        let n = max(people.count, 1)
        let delta = 360.0 / Double(n)
        return ZStack {
            ForEach(0..<n, id: \.self) { i in
                CoffeeSector(start: .degrees(-90 + Double(i) * delta),
                             end: .degrees(-90 + Double(i + 1) * delta))
                    .fill(segmentColor(i, count: n))
            }
            ForEach(0..<n, id: \.self) { i in
                Text(people.indices.contains(i) ? people[i].name : "?")
                    .font(.system(size: n > 8 ? 12 : 14, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .frame(width: 86)
                    .shadow(color: .black.opacity(0.35), radius: 1, y: 1)
                    // 원판이 돌아도 글자는 똑바로 보이게 역회전 보정
                    .rotationEffect(.degrees(-visibleRotation))
                    .offset(labelOffset(i: i, delta: delta, radius: 88))
            }
        }
        .frame(width: 276, height: 276)
        .clipShape(Circle())
        .overlay(Circle().stroke(.white, lineWidth: 4))
        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
    }

    private func labelOffset(i: Int, delta: Double, radius: Double) -> CGSize {
        let mid = (-90 + (Double(i) + 0.5) * delta) * .pi / 180
        return CGSize(width: radius * cos(mid), height: radius * sin(mid))
    }

    @ViewBuilder
    private var footer: some View {
        if game.phase == .ready {
            if isHost {
                Button(action: onSpin) {
                    Label("돌리기", systemImage: "arrow.triangle.2.circlepath")
                        .font(.headline).frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x3)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.heart)
                .padding(.horizontal, Theme.Space.x6)
            } else {
                ProgressView().tint(Theme.Palette.muted)
            }
        }
    }
}

/// 원판 한 칸(부채꼴).
struct CoffeeSector: Shape {
    let start: Angle
    let end: Angle
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let r = min(rect.width, rect.height) / 2
        var p = Path()
        p.move(to: c)
        p.addArc(center: c, radius: r, startAngle: start, endAngle: end, clockwise: false)
        p.closeSubpath()
        return p
    }
}

/// 바늘용 삼각형.
struct CoffeeTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}
