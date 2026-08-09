import SwiftUI

/// 앨범 상세 — 인스타 앨범처럼 헤더 + 사진 3열 그리드, 사진 탭 시 전체화면 뷰어.
struct AlbumView: View {
    let memory: TeamMemory
    let assets: [MemoryAsset]
    @Environment(\.dismiss) private var dismiss
    @State private var viewerIndex: Int?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 3)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.x4) {
                    header
                    photoGrid
                }
                .padding(Theme.Space.x4)
            }
            .background(Theme.Palette.sunken)
            .navigationTitle(memory.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("닫기") { dismiss() }
                }
            }
            .fullScreenCover(item: Binding(
                get: { viewerIndex.map { IndexBox(value: $0) } },
                set: { viewerIndex = $0?.value }
            )) { box in
                PhotoViewer(assets: assets.filter { !$0.previewURL.isEmpty }, startIndex: box.value)
            }
        }
    }

    @ViewBuilder private var photoGrid: some View {
        if assets.isEmpty {
            EmptyState(icon: "photo.on.rectangle.angled", title: "아직 사진이 없어요",
                       message: "웹·앱에서 이 앨범에 사진을 올리면 여기에 모여요.")
        } else {
            LazyVGrid(columns: columns, spacing: 3) {
                ForEach(Array(assets.enumerated()), id: \.element.id) { idx, asset in
                    Button {
                        Haptics.selection()
                        viewerIndex = idx
                    } label: {
                        photoCell(asset)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Space.x2) {
            Text(memory.title).font(.title3.bold()).foregroundStyle(Theme.Palette.ink)
            Text([memory.eventDate, memory.place].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.subheadline).foregroundStyle(Theme.Palette.muted)
            if !memory.host.isEmpty {
                Label("주최 \(memory.host)", systemImage: "person.fill")
                    .font(.caption).foregroundStyle(Theme.Palette.muted)
            }
            if !memory.summary.isEmpty {
                Text(memory.summary).font(.subheadline).foregroundStyle(Theme.Palette.ink.opacity(0.8))
                    .padding(.top, 2)
            }
            Label("사진·영상 \(assets.count)개", systemImage: "photo.stack")
                .font(.caption.bold()).foregroundStyle(Theme.Palette.primary)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Space.x4)
        .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.Palette.border))
    }

    private func photoCell(_ asset: MemoryAsset) -> some View {
        GeometryReader { geo in
            ZStack {
                if let url = asset.url, !asset.previewURL.isEmpty {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Theme.Palette.surfaceDark.overlay(ProgressView())
                    }
                    .frame(width: geo.size.width, height: geo.size.width)
                    .clipped()
                } else {
                    Theme.Palette.tintPrimary
                        .frame(width: geo.size.width, height: geo.size.width)
                        .overlay(Image(systemName: "photo").foregroundStyle(Theme.Palette.primary))
                }
                if asset.isVideo {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 26)).foregroundStyle(.white.opacity(0.9))
                        .shadow(radius: 3)
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.sm))
    }
}

/// fullScreenCover(item:) 용 Identifiable 인덱스 래퍼.
private struct IndexBox: Identifiable { let value: Int; var id: Int { value } }

/// 전체화면 사진 뷰어 — 좌우 스와이프(페이지). 탭하면 닫힌다.
private struct PhotoViewer: View {
    let assets: [MemoryAsset]
    let startIndex: Int
    @Environment(\.dismiss) private var dismiss
    @State private var index: Int = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            TabView(selection: $index) {
                ForEach(Array(assets.enumerated()), id: \.element.id) { idx, asset in
                    Group {
                        if let url = asset.url {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFit()
                            } placeholder: {
                                ProgressView().tint(.white)
                            }
                        } else {
                            Image(systemName: "photo").foregroundStyle(.white)
                        }
                    }
                    .tag(idx)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))
            .ignoresSafeArea()

            VStack {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 30)).foregroundStyle(.white.opacity(0.85))
                            .padding()
                    }
                }
                Spacer()
                if assets.indices.contains(index), !assets[index].title.isEmpty {
                    Text(assets[index].title)
                        .font(.footnote).foregroundStyle(.white.opacity(0.9))
                        .padding(.bottom, 40)
                }
            }
        }
        .onAppear { index = min(max(startIndex, 0), max(assets.count - 1, 0)) }
    }
}
