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

    private var people: [CoffeeParticipant] { game.participants }
    private var winnerIndex: Int { game.winnerIndex }

    private let palette: [Color] = [
        Color(hex: 0x006BB8), Color(hex: 0xED4956), Color(hex: 0x047857),
        Color(hex: 0xE8A33D), Color(hex: 0x7C3AED), Color(hex: 0x0EA5A5),
        Color(hex: 0xDB2777), Color(hex: 0x2563EB),
    ]

    var body: some View {
        VStack(spacing: Theme.Space.x5) {
            headline

            TimelineView(.animation) { context in
                let t = game.phase == .spinning ? game.elapsed(now: context.date)
                      : (game.phase == .done ? CoffeeSpin.wheelTotalDuration : 0)
                let rot = CoffeeSpin.wheelRotation(at: t, winnerIndex: winnerIndex, count: people.count)
                wheelStack(rotation: rot)
                    .onChange(of: t >= CoffeeSpin.wheelTotalDuration) { _, ended in
                        if ended, isHost, game.phase == .spinning { onFinish() }
                    }
            }
            .frame(width: 300, height: 300)

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
                    .fill(palette[i % palette.count])
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
