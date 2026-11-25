export interface CompressImageResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
}

const COMPRESSIBLE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Kompresi gambar ringan sisi klien menggunakan HTML5 <canvas> sebelum diunggah.
 * Melewati PDF, SVG, atau gambar yang sudah kecil (< 120 KB) agar tetap tajam dan cepat.
 */
export async function compressImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; minBytes?: number } = {}
): Promise<CompressImageResult> {
  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 1600;
  const quality = options.quality ?? 0.82;
  const minBytes = options.minBytes ?? 120 * 1024;
  const originalSize = file.size;

  if (
    typeof document === 'undefined' ||
    !COMPRESSIBLE_MIME_TYPES.has((file.type || '').toLowerCase()) ||
    originalSize < minBytes
  ) {
    return { file, compressed: false, originalSize, finalSize: originalSize };
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Gagal memuat pratinjau gambar untuk kompresi.'));
        image.src = objectUrl;
      });

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (!width || !height) {
        return { file, compressed: false, originalSize, finalSize: originalSize };
      }

      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { file, compressed: false, originalSize, finalSize: originalSize };
      }

      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), outputType, quality)
      );

      if (!blob || blob.size >= originalSize) {
        return { file, compressed: false, originalSize, finalSize: originalSize };
      }

      const baseName = file.name.replace(/\.[^.]+$/, '');
      const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
      const compressedFile = new File([blob], `${baseName}.${ext}`, {
        type: outputType,
        lastModified: Date.now(),
      });

      return {
        file: compressedFile,
        compressed: true,
        originalSize,
        finalSize: compressedFile.size,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return { file, compressed: false, originalSize, finalSize: originalSize };
  }
}
