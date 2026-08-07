import SwiftUI

/// 웹앱(styles.css :root)의 디자인 토큰을 SwiftUI 로 이식한 브랜드 시스템.
/// 색·간격·모서리를 한 곳에서 관리해 전 화면이 한 몸처럼 보이게 한다.
enum Theme {
    enum Palette {
        static let page = Color(hex: 0xFFFFFF)
        static let surface = Color(hex: 0xFFFFFF)
        static let sunken = Color(hex: 0xFAFAFA)
        static let ink = Color(hex: 0x262626)
        static let muted = Color(hex: 0x616161)

        static let primary = Color(hex: 0x006BB8)
        static let primaryStrong = Color(hex: 0x00376B)
        static let primarySoft = Color(hex: 0xB2DFFC)
        static let cta = Color(hex: 0x0073C9)

        static let success = Color(hex: 0x047857)
        static let danger = Color(hex: 0xB91C1C)
        static let heart = Color(hex: 0xED4956)

        static let tintPrimary = Color(hex: 0xE8F4FD)
        static let tintPrimaryInk = Color(hex: 0x00376B)
        static let tintSuccess = Color(hex: 0xECFDF5)
        static let tintSuccessInk = Color(hex: 0x065F46)
        static let tintDanger = Color(hex: 0xFDECEA)
        static let tintNeutral = Color(hex: 0xEFEFEF)

        static let border = Color(hex: 0xDBDBDB)
        static let borderStrong = Color(hex: 0xC7C7C7)
        static let surfaceDark = Color(hex: 0x000000)
    }

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let full: CGFloat = 999
    }

    enum Space {
        static let x1: CGFloat = 4
        static let x2: CGFloat = 8
        static let x3: CGFloat = 12
        static let x4: CGFloat = 16
        static let x5: CGFloat = 20
        static let x6: CGFloat = 24
        static let x8: CGFloat = 32
    }
}

extension Color {
    /// 0xRRGGBB 정수로 색을 만든다(웹 hex 토큰을 그대로 옮기기 위함).
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
