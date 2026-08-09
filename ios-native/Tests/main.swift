// 커피 내기 연출의 수학 검증. 시뮬레이터 없이 `Tests/run.sh` 로 돌린다.
// (top-level 코드는 파일 이름이 main.swift 여야 해서 이 이름이다)
//
// 이 게임은 프레임을 중계하지 않는다. 각 기기가 seed 와 시작 시각만 받아
// "시간 → 화면"을 각자 계산해 그린다. 그래서 연출이 결과와 어긋나면
// 화면마다 다른 사람이 뽑힌 것처럼 보이고, 눈으로는 잡히지 않는다.
// 아래 네 가지가 그 어긋남을 잡는다.
//
// SplitMix64 는 앱 코드(Models/CoffeeGame.swift)에서 그대로 옮겨 온 것이다.
// 그 파일은 SwiftUI 를 끌고 들어와 단독 컴파일이 안 된다.

import Foundation

struct SplitMix64: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}

var fails = 0
func check(_ ok: Bool, _ msg: @autoclosure () -> String) {
    if !ok { fails += 1; print("  ✗ \(msg())") }
}

// 1) 원판이 실제로 당첨 칸에서 멈추는가 — 연출과 결과가 어긋나면 게임이 거짓말을 한다.
for count in 2...24 {
    let delta = 360.0 / Double(count)
    for w in 0..<count {
        let end = CoffeeSpin.wheelRotation(at: CoffeeSpin.wheelTotalDuration, winnerIndex: w, count: count)
        // CoffeeWheelView 는 칸 i 를 -90°+i*delta 부터 그린다. 화면각 = -90 + i*delta + R.
        // 바늘은 위(-90°)에 있으므로 -90 = -90 + i*delta + R  →  i = (-R)/delta.
        let underPointer = Int(floor(CoffeeSpin.mod360(-end) / delta)) % count
        check(underPointer == w, "count=\(count) winner=\(w): 바늘 아래는 \(underPointer)")
    }
}
print(fails == 0 ? "1. 원판 정렬 (2~24명 × 전 인덱스): 통과" : "1. 원판 정렬: 실패 \(fails)")

// 2) 각도가 뒤로 가지 않는가 — 등속→감속 이음매에서 튀면 눈에 바로 보인다.
var f2 = 0
for count in [2, 5, 9, 12, 31] {
    for w in 0..<count {
        var prev = -1.0
        var t = 0.0
        while t <= CoffeeSpin.wheelTotalDuration + 0.5 {
            let r = CoffeeSpin.wheelRotation(at: t, winnerIndex: w, count: count)
            if r < prev - 1e-9 { f2 += 1; print("  ✗ count=\(count) w=\(w) t=\(t): \(prev)→\(r) 역주행"); break }
            prev = r; t += 1.0/120.0
        }
        // 이음매 연속성
        let a = CoffeeSpin.wheelRotation(at: CoffeeSpin.wheelFastDuration - 1e-6, winnerIndex: w, count: count)
        let b = CoffeeSpin.wheelRotation(at: CoffeeSpin.wheelFastDuration, winnerIndex: w, count: count)
        if abs(a - b) > 0.01 { f2 += 1; print("  ✗ count=\(count) w=\(w) 이음매 점프 \(abs(a-b))°") }
    }
}
print(f2 == 0 ? "2. 단조 증가 + 이음매 연속: 통과" : "2. 단조/연속: 실패 \(f2)")

// 3) 손가락룰렛이 당첨자에서 멈추고, 한 칸씩만 움직이는가.
var f3 = 0
for count in 2...12 {
    for w in 0..<count {
        let end = CoffeeSpin.fingerFocus(at: CoffeeSpin.fingerSpinDuration, winnerIndex: w, count: count)
        if end != w { f3 += 1; print("  ✗ count=\(count) w=\(w): 끝 포커스 \(end)") }
        var prev = CoffeeSpin.fingerFocus(at: 0, winnerIndex: w, count: count)
        var t = 0.0
        while t <= CoffeeSpin.fingerSpinDuration {
            let cur = CoffeeSpin.fingerFocus(at: t, winnerIndex: w, count: count)
            let step = ((cur - prev) % count + count) % count
            if step != 0 && step != 1 { f3 += 1; print("  ✗ count=\(count) w=\(w) t=\(t): \(prev)→\(cur) 건너뜀"); break }
            prev = cur; t += 1.0/120.0
        }
    }
}
print(f3 == 0 ? "3. 손가락룰렛 착지 + 한 칸씩 이동: 통과" : "3. 손가락룰렛: 실패 \(f3)")

// 4) seed → 당첨자가 결정적이고 치우치지 않는가.
var f4 = 0
for count in [2, 3, 5, 9, 31] {
    var hist = [Int](repeating: 0, count: count)
    for s in UInt64(1)...20000 {
        var r1 = SplitMix64(seed: s); var r2 = SplitMix64(seed: s)
        let a = Int(r1.next() % UInt64(count)), b = Int(r2.next() % UInt64(count))
        if a != b { f4 += 1; print("  ✗ seed=\(s) 비결정적") ; break }
        hist[a] += 1
    }
    // 최대편차 대신 카이제곱. 버킷이 늘면 최대편차는 당연히 커져서 기준이 못 된다.
    let expect = 20000.0 / Double(count)
    let chi2 = hist.reduce(0.0) { $0 + pow(Double($1) - expect, 2) / expect }
    let df = Double(count - 1)
    let bound = df + 4 * sqrt(2 * df) + 6      // 대략 상위 0.1% 컷
    if chi2 > bound { f4 += 1; print("  ✗ count=\(count) 카이제곱 \(String(format: "%.1f", chi2)) > \(String(format: "%.1f", bound))") }
    else { print("   count=\(count) 카이제곱 \(String(format: "%.1f", chi2)) (df=\(Int(df)), 한계 \(String(format: "%.1f", bound)))") }
}
print(f4 == 0 ? "4. seed 결정성 + 균등성: 통과" : "4. seed: 실패 \(f4)")

exit(fails + f2 + f3 + f4 == 0 ? 0 : 1)
