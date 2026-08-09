import SwiftUI
import UIKit

/// 화면 위 여러 손가락을 안정적 id 와 함께 추적한다(fun-game Core/MultiTouchView 이식).
///
/// 원본과 다른 점: 원본은 id 해시로 정렬해 색 인덱스만 안정시켰다. 여기서는
/// **닿은 순서**가 곧 참가자 배정 순서라서, 먼저 닿은 손가락이 항상 앞에 오도록
/// 순번(seq)을 따로 매겨 정렬한다.
struct TouchPoint: Identifiable, Equatable {
    let id: ObjectIdentifier   // ObjectIdentifier(UITouch) 기반 안정 식별자
    let seq: Int               // 닿은 순서(0부터)
    var point: CGPoint
}

struct MultiTouchView: UIViewRepresentable {
    @Binding var fingers: [TouchPoint]

    func makeUIView(context: Context) -> TrackingView {
        let v = TrackingView()
        v.backgroundColor = .clear
        v.isMultipleTouchEnabled = true
        v.onChange = { fingers = $0 }
        return v
    }

    func updateUIView(_ uiView: TrackingView, context: Context) {
        uiView.onChange = { fingers = $0 }
    }

    final class TrackingView: UIView {
        var onChange: (([TouchPoint]) -> Void)?
        private var active: [ObjectIdentifier: UITouch] = [:]
        private var order: [ObjectIdentifier: Int] = [:]
        private var nextSeq = 0

        override func touchesBegan(_ t: Set<UITouch>, with e: UIEvent?) {
            for x in t {
                let key = ObjectIdentifier(x)
                active[key] = x
                if order[key] == nil { order[key] = nextSeq; nextSeq += 1 }
            }
            emit()
        }
        override func touchesMoved(_ t: Set<UITouch>, with e: UIEvent?) { emit() }
        override func touchesEnded(_ t: Set<UITouch>, with e: UIEvent?) { drop(t) }
        override func touchesCancelled(_ t: Set<UITouch>, with e: UIEvent?) { drop(t) }

        private func drop(_ t: Set<UITouch>) {
            for x in t {
                let key = ObjectIdentifier(x)
                active.removeValue(forKey: key)
                order.removeValue(forKey: key)
            }
            if active.isEmpty { nextSeq = 0 }   // 전원 손 떼면 순번 초기화
            emit()
        }

        private func emit() {
            let pts: [TouchPoint] = active.compactMap { id, touch in
                // ended/cancelled 잔여 터치 제외
                guard touch.phase != .ended, touch.phase != .cancelled else { return nil }
                return TouchPoint(id: id, seq: order[id] ?? 0, point: touch.location(in: self))
            }
            onChange?(pts.sorted { $0.seq < $1.seq })
        }
    }
}

/// 참가자 얼굴 원. 사진이 없거나 못 불러오면 이니셜로 떨어진다.
///
/// 사진은 사내 telinfo 서버라서 사외망에서는 안 열릴 수 있다 — 그때도 화면이
/// 비지 않도록 이니셜 폴백을 항상 깔아둔다.
struct CoffeeFace: View {
    let participant: CoffeeParticipant
    var size: CGFloat = 76
    var highlighted: Bool = false

    var body: some View {
        ZStack {
            Circle().fill(Theme.Palette.primary.opacity(0.18))
            Text(String(participant.name.prefix(1)))
                .font(.system(size: size * 0.4, weight: .bold))
                .foregroundStyle(Theme.Palette.primaryStrong)
            if let url = URL(string: participant.photoURL), !participant.photoURL.isEmpty {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
                .clipShape(Circle())
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(
            Circle().stroke(highlighted ? Theme.Palette.heart : .white,
                            lineWidth: highlighted ? 5 : 3)
        )
        .shadow(color: .black.opacity(highlighted ? 0.32 : 0.16),
                radius: highlighted ? 14 : 6, y: 3)
    }
}
