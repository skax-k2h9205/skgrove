import SwiftUI

/// 동료 성향 — 팀 성향 분포 + 동료 프로필(웹 Profiles 이식). 공유 ProfileStore 에서 실산출.
struct ProfilesView: View {
    @EnvironmentObject private var store: ProfileStore
    @State private var query = ""

    var body: some View {
        ScreenScaffold(title: "동료 성향", showUserChip: false,
                       onRefresh: { try? await Task.sleep(for: .seconds(0.6)) }) {
            distributionCard
            colleaguesCard
        }
    }

    private var distributionCard: some View {
        let dist = store.distribution()
        let maxV = max(dist.map { $0.1 }.max() ?? 1, 1)
        return card {
            Label("팀 성향 분포", systemImage: "chart.bar").font(.headline).foregroundStyle(Theme.Palette.ink)
            Text("작성한 \(store.writtenCount)명의 MBTI를 4대 기질로 묶었어요.")
                .font(.caption).foregroundStyle(Theme.Palette.muted)
            ForEach(dist, id: \.0) { temp, count in
                HStack(spacing: Theme.Space.x3) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(temp.rawValue).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.Palette.ink)
                        Text(temp.hint).font(.caption2).foregroundStyle(Theme.Palette.muted)
                    }.frame(width: 92, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.Palette.sunken)
                            Capsule().fill(Theme.Palette.primary)
                                .frame(width: max(count == 0 ? 0 : 8, geo.size.width * CGFloat(count) / CGFloat(maxV)))
                        }
                    }.frame(height: 12)
                    Text("\(count)").font(.caption.weight(.bold)).foregroundStyle(Theme.Palette.ink).frame(width: 20)
                }
            }
        }
    }

    private var colleaguesCard: some View {
        let list = store.profiles.filter {
            query.isEmpty || $0.name.contains(query) || $0.temperamentLabel.contains(query)
                || $0.part.contains(query) || $0.mbti.uppercased().contains(query.uppercased())
        }
        return card {
            Label("동료 프로필 찾기", systemImage: "person.2").font(.headline).foregroundStyle(Theme.Palette.ink)
            TextField("이름·성향·MBTI·파트로 찾기", text: $query)
                .padding(Theme.Space.x3)
                .background(Theme.Palette.sunken, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
            if list.isEmpty {
                Text("찾는 동료가 없어요.").font(.caption).foregroundStyle(Theme.Palette.muted)
            } else {
                ForEach(list) { c in colleagueRow(c) }
            }
        }
    }

    private func colleagueRow(_ c: TeamProfile) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x1) {
            HStack(spacing: Theme.Space.x3) {
                Avatar(name: c.name)
                VStack(alignment: .leading, spacing: 1) {
                    Text(c.name).font(.subheadline.bold()).foregroundStyle(Theme.Palette.ink)
                    Text("\(c.part) · \(c.temperamentLabel)").font(.caption).foregroundStyle(Theme.Palette.muted)
                }
                Spacer()
                if !c.mbti.isEmpty {
                    Text(c.mbti).font(.caption.weight(.bold)).foregroundStyle(Theme.Palette.primary)
                        .padding(.horizontal, Theme.Space.x2).padding(.vertical, 3)
                        .background(Theme.Palette.tintPrimary, in: Capsule())
                }
                if !c.disc.isEmpty {
                    Text(c.disc).font(.caption.weight(.bold)).foregroundStyle(Theme.Palette.tintSuccessInk)
                        .padding(.horizontal, Theme.Space.x2).padding(.vertical, 3)
                        .background(Theme.Palette.tintSuccess, in: Capsule())
                }
            }
            if !c.collabGuide.isEmpty {
                Text("💡 \(c.collabGuide)").font(.caption).foregroundStyle(Theme.Palette.muted)
                    .padding(.leading, 48)
            }
        }
        .padding(.vertical, Theme.Space.x1)
    }

    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Theme.Space.x3) { content() }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }
}
