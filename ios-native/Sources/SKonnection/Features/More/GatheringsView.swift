import SwiftUI

struct Gathering: Identifiable {
    let id: String
    let title: String
    let host: String
    let when: String
    let kind: String     // 번개 / 공모
    var joined: Int
    var capacity: Int
    var place: String = ""
    var desc: String = ""
}

/// 모임 · 번개 — 인스타 3열 그리드. 타일 탭 시 상세 시트에서 신청. 모임 열기로 등록.
struct GatheringsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var filter = "모집중"
    @State private var composing = false
    private let filters = ["모집중", "내가 신청", "내가 연 것", "전체"]
    @State private var gatherings: [Gathering] = [
        .init(id: "GAT-1", title: "오늘 점심 김치찌개 번개 🍲", host: "김승현", when: "오늘 12:00", kind: "번개", joined: 3, capacity: 6),
        .init(id: "GAT-2", title: "금요일 보드게임 모임", host: "이두민", when: "8/9 (금) 19:00", kind: "공모", joined: 5, capacity: 8),
        .init(id: "GAT-3", title: "퇴근 후 클라이밍 번개 🧗", host: "김수정", when: "오늘 19:30", kind: "번개", joined: 2, capacity: 4),
        .init(id: "GAT-4", title: "주말 등산 모임", host: "이선민", when: "8/10 (토) 08:00", kind: "공모", joined: 6, capacity: 10),
    ]
    @State private var selected: Gathering?

    var body: some View {
        ScreenScaffold(title: "모임 · 번개", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            ChipRow(items: filters, selection: $filter)
            Button { composing = true } label: {
                Label("모임 열기", systemImage: "plus").font(.headline)
                    .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
            }
            .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)

            InstaGrid(items: gatherings) { g in
                Button { Haptics.selection(); selected = g } label: {
                    GridTile(icon: icon(g.kind), title: g.title, meta: "\(g.joined)/\(g.capacity)명",
                             tint: tint(g.kind), ink: ink(g.kind))
                }
                .buttonStyle(.plain)
                .contextMenu {
                    if g.host == session.currentUser?.name {
                        Button(role: .destructive) {
                            withAnimation(.snappy) { gatherings.removeAll { $0.id == g.id } }
                        } label: { Label("삭제", systemImage: "trash") }
                    }
                }
            }
        }
        .sheet(item: $selected) { g in
            DetailSheet(title: g.kind, heading: g.title, lines: detailLines(g),
                        action: g.kind == "커피" ? "커피 뽑기" : "신청하기")
        }
        .sheet(isPresented: $composing) {
            GatheringComposeSheet { kind, title, startAt, place, capacity, desc in
                open(kind: kind, title: title, startAt: startAt, place: place, capacity: capacity, desc: desc)
            }
        }
    }

    private func open(kind: String, title: String, startAt: Date, place: String, capacity: Int, desc: String) {
        let host = session.currentUser?.name ?? "나"
        withAnimation(.snappy) {
            gatherings.insert(.init(id: UUID().uuidString, title: title, host: host,
                                    when: Self.when.string(from: startAt), kind: kind,
                                    joined: 1, capacity: capacity, place: place, desc: desc), at: 0)
        }
        Haptics.success()
    }

    private static let when: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M/d(E) HH:mm"; return f
    }()

    private func detailLines(_ g: Gathering) -> [String] {
        var lines: [String] = []
        if !g.desc.isEmpty { lines.append(g.desc) }
        lines.append("\(g.host) · \(g.when)")
        if !g.place.isEmpty { lines.append("장소 \(g.place)") }
        lines.append("\(g.joined)/\(g.capacity)명 참여")
        return lines
    }

    private func icon(_ kind: String) -> String {
        switch kind {
        case "번개": return "bolt.fill"
        case "커피": return "cup.and.saucer.fill"
        default: return "calendar"
        }
    }
    private func tint(_ kind: String) -> Color {
        switch kind {
        case "번개": return Theme.Palette.tintSuccess
        case "커피": return Theme.Palette.tintDanger
        default: return Theme.Palette.tintPrimary
        }
    }
    private func ink(_ kind: String) -> Color {
        switch kind {
        case "번개": return Theme.Palette.tintSuccessInk
        case "커피": return Theme.Palette.danger
        default: return Theme.Palette.tintPrimaryInk
        }
    }
}

/// 가로 스크롤 필터 칩 줄 — 여러 화면에서 재사용.
struct ChipRow: View {
    let items: [String]
    @Binding var selection: String
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.x2) {
                ForEach(items, id: \.self) { item in
                    let active = item == selection
                    Button { selection = item } label: {
                        Text(item)
                            .font(.subheadline.weight(active ? .bold : .regular))
                            .foregroundStyle(active ? Theme.Palette.cta : Theme.Palette.muted)
                            .padding(.horizontal, Theme.Space.x3).padding(.vertical, Theme.Space.x2)
                            .background(active ? Theme.Palette.tintPrimary : Theme.Palette.surface, in: Capsule())
                            .overlay(Capsule().stroke(Theme.Palette.border))
                    }
                }
            }
        }
    }
}

/// 그리드 타일 탭 시 뜨는 공용 상세 시트(제목·본문·액션 버튼).
struct DetailSheet: View {
    let title: String
    let heading: String
    let lines: [String]
    let action: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                Text(heading).font(.title2.bold()).foregroundStyle(Theme.Palette.ink)
                ForEach(lines, id: \.self) { Text($0).font(.subheadline).foregroundStyle(Theme.Palette.muted) }
                Button { Haptics.success(); dismiss() } label: {
                    Text(action).font(.headline).frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }
                .buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
                Spacer()
            }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.sunken)
            .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }
}
