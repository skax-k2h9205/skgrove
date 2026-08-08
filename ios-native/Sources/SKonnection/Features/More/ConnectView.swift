import SwiftUI

/// 조 뽑기 — 파트를 골고루 섞어 조를 짠다(웹 Connect 이식). 공유 ProfileStore 의 팀원으로 배치.
struct ConnectView: View {
    @EnvironmentObject private var profiles: ProfileStore
    @State private var mix = "파트 골고루"
    @State private var groupCount = 2
    @State private var result: [[TeamProfile]] = []
    @State private var savedToast: String?

    private var people: [TeamProfile] { profiles.profiles }

    var body: some View {
        ScreenScaffold(title: "조 뽑기", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            card {
                Label("\(people.count)명 참여", systemImage: "person.3.fill").font(.headline).foregroundStyle(Theme.Palette.ink)
                Text("파트를 골고루 섞어 같은 파트원이 여러 조로 흩어지게 짜요.")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
            }

            card {
                labeled("섞기 조건") {
                    Picker("섞기 조건", selection: $mix) {
                        ForEach(["파트 골고루", "완전 랜덤"], id: \.self) { Text($0).tag($0) }
                    }.pickerStyle(.segmented)
                }
                labeled("조 개수") {
                    Stepper("\(groupCount)개 조", value: $groupCount, in: 2...max(2, people.count))
                }
                Button(action: draw) {
                    Label("조 뽑기", systemImage: "shuffle").font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                }.buttonStyle(.borderedProminent).tint(Theme.Palette.cta)
            }

            if !result.isEmpty {
                if let savedToast {
                    Label(savedToast, systemImage: "checkmark.circle.fill")
                        .font(.footnote.weight(.semibold)).foregroundStyle(Theme.Palette.tintSuccessInk)
                        .padding(Theme.Space.x3).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Palette.tintSuccess, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                }
                HStack(spacing: Theme.Space.x2) {
                    Button { saveResult() } label: {
                        Label("결과 저장", systemImage: "square.and.arrow.down").font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }.buttonStyle(.bordered).tint(Theme.Palette.cta)
                    ShareLink(item: shareText) {
                        Label("공유", systemImage: "square.and.arrow.up").font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, Theme.Space.x2)
                    }.buttonStyle(.bordered).tint(Theme.Palette.primary)
                }
                ForEach(Array(result.enumerated()), id: \.offset) { idx, group in
                    card {
                        HStack {
                            Text("\(idx + 1)조").font(.subheadline.bold()).foregroundStyle(Theme.Palette.primary)
                            Spacer()
                            Text("\(group.count)명").font(.caption).foregroundStyle(Theme.Palette.muted)
                        }
                        ForEach(group) { p in
                            HStack(spacing: Theme.Space.x2) {
                                Avatar(name: p.name, size: 28)
                                Text(p.name).font(.subheadline).foregroundStyle(Theme.Palette.ink)
                                Text(p.part).font(.caption).foregroundStyle(Theme.Palette.muted)
                                Spacer()
                            }
                        }
                    }
                }
            }
        }
    }

    /// 섞기 조건에 따라 순서를 만든 뒤 스네이크(1→n→1)로 배분해 조 인원과 파트를 고르게 한다.
    private func draw() {
        let ordered: [TeamProfile]
        if mix == "완전 랜덤" {
            ordered = people.shuffled()
        } else {
            // 파트별 버킷을 라운드로빈으로 뽑아 같은 파트가 이어지지 않게 인터리브.
            var buckets: [String: [TeamProfile]] = [:]
            for p in people.shuffled() { buckets[p.part, default: []].append(p) }
            var lists = Array(buckets.values)
            var interleaved: [TeamProfile] = []
            var i = 0
            while lists.contains(where: { !$0.isEmpty }) {
                if !lists[i % lists.count].isEmpty { interleaved.append(lists[i % lists.count].removeFirst()) }
                i += 1
            }
            ordered = interleaved
        }

        var groups = Array(repeating: [TeamProfile](), count: groupCount)
        var g = 0, forward = true
        for p in ordered {
            groups[g].append(p)
            if forward { if g == groupCount - 1 { forward = false } else { g += 1 } }
            else { if g == 0 { forward = true } else { g -= 1 } }
        }
        result = groups
        savedToast = nil
        Haptics.success()
    }

    /// 뽑은 조 편성을 공유용 텍스트로.
    private var shareText: String {
        result.enumerated().map { idx, g in
            "\(idx + 1)조: " + g.map(\.name).joined(separator: ", ")
        }.joined(separator: "\n")
    }

    /// 결과를 웹과 같은 connect_results 에 저장(팀 공유·이력).
    private func saveResult() {
        let id = "CR-\(Int(Date().timeIntervalSince1970))"
        let now = ISO8601DateFormatter().string(from: Date())
        let title = "\(groupCount)개 조 · \(people.count)명 (\(mix))"
        Task { try? await Supabase.insert("connect_results",
            ["id": id, "mode": mix == "완전 랜덤" ? "random" : "balanced", "title": title,
             "created_at": now, "summary": title, "share_text": shareText, "share_url": ""]) }
        savedToast = "결과를 저장했어요 — 팀과 공유됩니다."
        Haptics.success()
    }

    private func labeled(_ title: String, @ViewBuilder _ control: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
            control()
        }
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) { content() }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}
