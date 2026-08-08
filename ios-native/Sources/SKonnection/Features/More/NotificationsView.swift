import SwiftUI

/// 하나의 알림 항목 — 여러 스토어에서 파생한다.
private struct AppAlert: Identifiable {
    enum Level { case info, warn, urgent }
    let id = UUID()
    let icon: String
    let title: String
    let detail: String
    let category: String
    let level: Level

    /// 읽음 추적용 안정 키(내용이 바뀌면 새 알림으로 다시 뜬다).
    var key: String { "\(category)|\(title)" }

    var tint: Color {
        switch level {
        case .info: return Theme.Palette.tintPrimary
        case .warn: return Theme.Palette.tintDanger
        case .urgent: return Theme.Palette.tintDanger
        }
    }
    var ink: Color {
        switch level {
        case .info: return Theme.Palette.primary
        case .warn, .urgent: return Theme.Palette.danger
        }
    }
}

/// 알림 센터 — 접수·안건·액션·모임·장터 현황에서 지금 챙길 일을 실시간으로 모아 보여준다.
/// (이벤트마다 알림 레코드를 쌓는 대신 라이브 데이터에서 파생 → 항상 정확하고 개인화됨.)
struct NotificationsView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var issues: IssueStore
    @EnvironmentObject private var agendas: AgendaStore
    @EnvironmentObject private var actions: ActionStore
    @EnvironmentObject private var gatherings: GatheringStore
    @EnvironmentObject private var market: MarketStore
    @State private var category: String = "전체"
    /// 읽은 알림 키들(기기 저장). 파생 알림이라 레코드 대신 '본 것'을 기억한다.
    @AppStorage("notif.seenKeys") private var seenRaw = ""

    private var seen: Set<String> { Set(seenRaw.split(separator: "\n").map(String.init)) }
    private var unreadCount: Int { alerts.filter { !seen.contains($0.key) }.count }
    private func markAllRead() { seenRaw = alerts.map(\.key).joined(separator: "\n"); Haptics.success() }

    private var myName: String { session.currentUser?.name ?? "나" }
    private var isLeader: Bool { session.currentUser?.role.isLeader == true }
    private let categories = ["전체", "안건", "액션", "모임", "장터", "리더"]

    private var visible: [AppAlert] {
        let all = alerts
        guard category != "전체" else { return all }
        return all.filter { $0.category == category }
    }

    var body: some View {
        ScreenScaffold(title: "알림", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            summary
            if unreadCount > 0 {
                Button { markAllRead() } label: {
                    Label("모두 읽음 (\(unreadCount))", systemImage: "checkmark.circle")
                        .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.bordered).tint(Theme.Palette.cta)
            }
            ChipRow(items: categories, selection: $category)
            if visible.isEmpty {
                EmptyState(icon: "bell.slash", title: "새 알림이 없어요",
                           message: "챙길 일이 생기면 여기에 모아드릴게요.")
            } else {
                ForEach(visible) { alert in row(alert) }
            }
        }
    }

    private var summary: some View {
        let urgent = alerts.filter { $0.level != .info }.count
        return HStack(spacing: Theme.Space.x2) {
            Image(systemName: "bell.badge.fill").foregroundStyle(Theme.Palette.primary)
            Text(unreadCount > 0 ? "안 읽은 알림 \(unreadCount)건 · 챙길 일 \(urgent)건"
                                 : (urgent > 0 ? "지금 챙길 일이 \(urgent)건 있어요." : "급한 알림은 없어요. 👍"))
                .font(.footnote.weight(.semibold)).foregroundStyle(Theme.Palette.tintPrimaryInk)
        }
        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.tintPrimary, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
    }

    private func row(_ a: AppAlert) -> some View {
        let unread = !seen.contains(a.key)
        return HStack(alignment: .top, spacing: Theme.Space.x3) {
            Image(systemName: a.icon).foregroundStyle(a.ink)
                .frame(width: 36, height: 36).background(a.tint, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(a.title).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                Text(a.detail).font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                if unread { Circle().fill(Theme.Palette.cta).frame(width: 8, height: 8) }
                Text(a.category).font(.caption2).foregroundStyle(Theme.Palette.muted)
            }
        }
        .padding(Theme.Space.x3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    /// 여러 스토어를 훑어 지금 사용자가 챙길 알림을 만든다.
    private var alerts: [AppAlert] {
        var out: [AppAlert] = []

        // 안건 — 아직 투표 안 한 진행중 안건 / 정족수 채운 안건
        let voting = agendas.agendas.filter { $0.status == .voting }
        let notVoted = voting.filter { $0.votedOptionId == nil }
        if !notVoted.isEmpty {
            out.append(.init(icon: "checkmark.square.fill", title: "투표하지 않은 안건 \(notVoted.count)건",
                             detail: notVoted.first!.title + (notVoted.count > 1 ? " 외" : ""),
                             category: "안건", level: .warn))
        }
        if isLeader {
            let ready = voting.filter { $0.quorumMet }
            if !ready.isEmpty {
                out.append(.init(icon: "flag.checkered", title: "마감할 수 있는 안건 \(ready.count)건",
                                 detail: "정족수를 채웠어요 — 결과를 확정할 수 있어요.",
                                 category: "안건", level: .info))
            }
        }

        // 액션 — 내 담당 지연 / 재검토
        let myOverdue = actions.items.filter { $0.owner == myName && $0.overdueDays != nil }
        if !myOverdue.isEmpty {
            out.append(.init(icon: "exclamationmark.triangle.fill", title: "지연된 내 액션 \(myOverdue.count)건",
                             detail: myOverdue.first!.title, category: "액션", level: .urgent))
        }
        let review = actions.items.filter { $0.status == .review }
        if !review.isEmpty {
            out.append(.init(icon: "arrow.uturn.left.circle.fill", title: "재검토 액션 \(review.count)건",
                             detail: review.first!.title, category: "액션", level: .warn))
        }

        // 모임 — 곧 시작하는 내 신청 모임 / 내가 연 모임 대기자
        for g in gatherings.gatherings where gatherings.status(g) == .open || gatherings.status(g) == .closed {
            if gatherings.mySeat(g, name: myName) != nil {
                out.append(.init(icon: "calendar.badge.clock", title: "곧 시작: \(g.title)",
                                 detail: "\(gatherings.timeUntil(g)) 시작 · 내 신청 \(gatherings.mySeat(g, name: myName) ?? "")",
                                 category: "모임", level: .info))
            }
            if g.host == myName {
                let waiting = gatherings.roster(g).waiting.count
                if waiting > 0 {
                    out.append(.init(icon: "person.2.wave.2.fill", title: "대기자 \(waiting)명: \(g.title)",
                                     detail: "정원이 차서 대기 중인 사람이 있어요.", category: "모임", level: .info))
                }
            }
        }

        // 장터 — 내 경매에 입찰 / 내가 최고 입찰자
        for item in market.items where item.kind == .auction && market.status(item) == .open {
            if item.seller == myName && market.bidCount(item) > 0 {
                out.append(.init(icon: "hammer.fill", title: "입찰 \(market.bidCount(item))건: \(item.title)",
                                 detail: "현재가 \(market.currentPrice(item).formatted())원", category: "장터", level: .info))
            } else if market.leadingBid(item)?.name == myName {
                out.append(.init(icon: "crown.fill", title: "최고 입찰 중: \(item.title)",
                                 detail: "현재가 \(market.currentPrice(item).formatted())원 · \(market.timeLeft(item))",
                                 category: "장터", level: .info))
            }
        }

        // 리더 — 응답 지연 접수
        if isLeader, let days = issues.oldestWaitingDays(today: Date()), days >= Issue.responseDueDays {
            out.append(.init(icon: "tray.full.fill", title: "답변 대기 접수",
                             detail: "\(days)일째 기다리는 접수가 있어요.", category: "리더", level: .urgent))
        }

        // 정렬: 긴급 > 경고 > 정보
        return out.sorted { rank($0.level) < rank($1.level) }
    }

    private func rank(_ l: AppAlert.Level) -> Int {
        switch l { case .urgent: return 0; case .warn: return 1; case .info: return 2 }
    }
}
