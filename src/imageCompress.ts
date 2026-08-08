// 업로드 전에 사진을 줄여 Supabase 저장 용량을 아낀다.
// 폰 사진 3~5MB 원본을 긴 변 1600px · JPEG 82%로 다시 그리면 보통 300~600KB로 줄어,
// 무료 1GB로도 사진 수천 장을 담을 수 있다. 캔버스로 다시 그리는 김에 EXIF 회전도 반영된다.
//
// 손대지 않는 경우(원본 그대로 반환):
//   - 이미지가 아닌 파일(영상 등) — 압축 대상이 아니다.
//   - GIF — 캔버스로 그리면 애니메이션이 첫 프레임만 남아 깨진다.
//   - 이미 충분히 작은 사진(리사이즈 불필요 + 1MB 이하) — 재인코딩 이득이 없다.
//   - 재인코딩 결과가 원본보다 커지는 경우 — 원본이 낫다.
// 캔버스/디코딩이 실패하면 원본을 그대로 업로드하도록 폴백한다(사진을 잃지 않는 게 우선).

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;
const SKIP_UNDER_BYTES = 1_000_000;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIMENSION / longestSide);

    if (scale === 1 && file.size <= SKIP_UNDER_BYTES) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    const jpgName = `${file.name.replace(/\.[^/.]+$/, '')}.jpg`;
    return new File([blob], jpgName, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
