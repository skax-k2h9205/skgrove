import Foundation

/// 두 게임의 연출 타임라인. **시간만 넣으면 화면이 정해지는** 순수 계산이라,
/// 주최자 폰과 관전자 폰이 각자 그려도 똑같은 그림이 나온다(동기화의 핵심).
enum CoffeeSpin {

    // MARK: 커피룰렛(원판)

    /// 1단계: 등속 회전. 2단계: 감속해서 당첨 칸이 바늘 아래 오도록 정렬.
    static let wheelFastDuration: Double = 1.4
    static let wheelSlowDuration: Double = 3.2
    static var wheelTotalDuration: Double { wheelFastDuration + wheelSlowDuration }

    private static let wheelFastSpeed: Double = 900     // deg/s

    /// 원판이 최종적으로 멈춰야 하는 각도(당첨 칸이 위쪽 바늘에 오는 각).
    static func wheelTotalRotation(winnerIndex: Int, count: Int) -> Double {
        guard count > 0 else { return 0 }
        let delta = 360.0 / Double(count)
        // 칸 i 의 중심이 위(-90°)로 오려면 R ≡ -(i+0.5)*delta (mod 360)
        let align = mod360(-(Double(winnerIndex) + 0.5) * delta)
        let fast = wheelFastSpeed * wheelFastDuration      // 1단계에서 이미 돈 각
        let base = fast + 360 * 3                          // 감속 구간에 최소 3바퀴
        return base + mod360(align - mod360(base))
    }

    /// 경과 시간 t 에서의 회전각.
    static func wheelRotation(at t: Double, winnerIndex: Int, count: Int) -> Double {
        let total = wheelTotalRotation(winnerIndex: winnerIndex, count: count)
        if t <= 0 { return 0 }
        if t < wheelFastDuration { return wheelFastSpeed * t }
        let fast = wheelFastSpeed * wheelFastDuration
        let p = min(1, (t - wheelFastDuration) / wheelSlowDuration)
        let eased = 1 - pow(1 - p, 3)                       // easeOutCubic
        return fast + (total - fast) * eased
    }

    // MARK: 손가락룰렛(두구두구)

    static let fingerSpinDuration: Double = 3.0

    /// 포커스가 사람 사이를 옮겨다니는 각 구간의 길이. 점점 느려진다.
    private static func fingerSteps() -> [Double] {
        var steps: [Double] = []
        var d = 0.075
        var sum = 0.0
        while sum < fingerSpinDuration {
            steps.append(d)
            sum += d
            d *= 1.16
        }
        return steps
    }

    /// 경과 시간 t 에 포커스된 참가자 인덱스. 마지막 칸이 당첨자가 되도록 거꾸로 배치한다.
    static func fingerFocus(at t: Double, winnerIndex: Int, count: Int) -> Int {
        guard count > 0 else { return 0 }
        let steps = fingerSteps()
        var acc = 0.0
        for (k, d) in steps.enumerated() {
            acc += d
            if t < acc {
                // 마지막 스텝이 winnerIndex 가 되도록 역산
                let fromEnd = steps.count - 1 - k
                return ((winnerIndex - fromEnd) % count + count) % count
            }
        }
        return winnerIndex
    }

    static func mod360(_ x: Double) -> Double {
        let m = x.truncatingRemainder(dividingBy: 360)
        return m < 0 ? m + 360 : m
    }
}
