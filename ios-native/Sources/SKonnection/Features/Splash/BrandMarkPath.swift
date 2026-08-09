import SwiftUI

// 브랜드 마크(Lucide heart-handshake, ISC)의 실제 패스.
// 손으로 옮기면 원호가 틀어져 앱 아이콘과 미묘하게 달라진다 —
// scratchpad/logo2swift.py 로 원본 SVG 를 파싱해 생성했다.
// 24x24 viewBox 기준. s = 배율, o = 원점 오프셋.
enum BrandMarkPath {
    private static func pt(_ p: CGPoint, _ s: CGFloat, _ o: CGPoint) -> CGPoint {
        CGPoint(x: o.x + p.x * s, y: o.y + p.y * s)
    }

    /// heart
    static func heart(_ s: CGFloat, _ o: CGPoint) -> Path {
        var p = Path()
        p.move(to: pt(CGPoint(x: 19.0000, y: 14.0000), s, o))
        p.addCurve(to: pt(CGPoint(x: 22.0000, y: 8.5000), s, o), control1: pt(CGPoint(x: 20.4900, y: 12.5400), s, o), control2: pt(CGPoint(x: 22.0000, y: 10.7900), s, o))
        p.addCurve(to: pt(CGPoint(x: 20.3891, y: 4.6109), s, o), control1: pt(CGPoint(x: 22.0000, y: 7.0601), s, o), control2: pt(CGPoint(x: 21.4072, y: 5.6291), s, o))
        p.addCurve(to: pt(CGPoint(x: 16.5000, y: 3.0000), s, o), control1: pt(CGPoint(x: 19.3709, y: 3.5928), s, o), control2: pt(CGPoint(x: 17.9399, y: 3.0000), s, o))
        p.addCurve(to: pt(CGPoint(x: 12.0000, y: 5.0000), s, o), control1: pt(CGPoint(x: 14.7400, y: 3.0000), s, o), control2: pt(CGPoint(x: 13.5000, y: 3.5000), s, o))
        p.addCurve(to: pt(CGPoint(x: 7.5000, y: 3.0000), s, o), control1: pt(CGPoint(x: 10.5000, y: 3.5000), s, o), control2: pt(CGPoint(x: 9.2600, y: 3.0000), s, o))
        p.addCurve(to: pt(CGPoint(x: 3.6109, y: 4.6109), s, o), control1: pt(CGPoint(x: 6.0601, y: 3.0000), s, o), control2: pt(CGPoint(x: 4.6291, y: 3.5928), s, o))
        p.addCurve(to: pt(CGPoint(x: 2.0000, y: 8.5000), s, o), control1: pt(CGPoint(x: 2.5928, y: 5.6291), s, o), control2: pt(CGPoint(x: 2.0000, y: 7.0601), s, o))
        p.addCurve(to: pt(CGPoint(x: 5.0000, y: 14.0000), s, o), control1: pt(CGPoint(x: 2.0000, y: 10.8000), s, o), control2: pt(CGPoint(x: 3.5000, y: 12.5500), s, o))
        p.addLine(to: pt(CGPoint(x: 12.0000, y: 21.0000), s, o))
        p.addLine(to: pt(CGPoint(x: 19.0000, y: 14.0000), s, o))
        p.closeSubpath()
        return p
    }

    /// clasp
    static func clasp(_ s: CGFloat, _ o: CGPoint) -> Path {
        var p = Path()
        p.move(to: pt(CGPoint(x: 12.0000, y: 5.0000), s, o))
        p.addLine(to: pt(CGPoint(x: 9.0400, y: 7.9600), s, o))
        p.addCurve(to: pt(CGPoint(x: 8.3988, y: 9.5000), s, o), control1: pt(CGPoint(x: 8.6350, y: 8.3621), s, o), control2: pt(CGPoint(x: 8.3988, y: 8.9293), s, o))
        p.addCurve(to: pt(CGPoint(x: 9.0400, y: 11.0400), s, o), control1: pt(CGPoint(x: 8.3988, y: 10.0707), s, o), control2: pt(CGPoint(x: 8.6350, y: 10.6379), s, o))
        p.addCurve(to: pt(CGPoint(x: 12.0400, y: 11.1100), s, o), control1: pt(CGPoint(x: 9.8600, y: 11.8600), s, o), control2: pt(CGPoint(x: 11.1700, y: 11.8900), s, o))
        p.addLine(to: pt(CGPoint(x: 14.1100, y: 9.2100), s, o))
        p.addCurve(to: pt(CGPoint(x: 17.9000, y: 9.2100), s, o), control1: pt(CGPoint(x: 15.1359, y: 8.2791), s, o), control2: pt(CGPoint(x: 16.8741, y: 8.2791), s, o))
        p.addLine(to: pt(CGPoint(x: 20.8600, y: 11.8700), s, o))
        return p
    }

    /// finger1
    static func finger1(_ s: CGFloat, _ o: CGPoint) -> Path {
        var p = Path()
        p.move(to: pt(CGPoint(x: 18.0000, y: 15.0000), s, o))
        p.addLine(to: pt(CGPoint(x: 16.0000, y: 13.0000), s, o))
        return p
    }

    /// finger2
    static func finger2(_ s: CGFloat, _ o: CGPoint) -> Path {
        var p = Path()
        p.move(to: pt(CGPoint(x: 15.0000, y: 18.0000), s, o))
        p.addLine(to: pt(CGPoint(x: 13.0000, y: 16.0000), s, o))
        return p
    }

}
