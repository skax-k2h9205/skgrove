import SwiftUI

/// 글/항목 작성용 공용 시트 — 텍스트 한 줄+본문 입력 후 등록. 여러 화면이 공유한다.
struct ComposeSheet: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    let action: String
    let onSubmit: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Space.x4) {
                TextField(placeholder, text: $text, axis: .vertical)
                    .lineLimit(4...10)
                    .padding(Theme.Space.x3)
                    .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.Palette.border))
                Spacer()
            }
            .padding(Theme.Space.x4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.sunken)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action) { onSubmit(); dismiss() }
                        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}
