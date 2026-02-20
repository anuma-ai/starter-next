/**
 * Client-side image compression to reduce payload size for vision models.
 * Images are resized to fit within maxDimension and compressed as JPEG.
 */

const DEFAULT_MAX_DIMENSION = 1024;
const DEFAULT_QUALITY = 0.8;
const MAX_FILE_SIZE_KB = 500;

function getBase64SizeKB(dataUrl: string): number {
  // Remove the data URL prefix to get pure base64
  const base64 = dataUrl.split(",")[1] || "";
  return (base64.length * 3) / 4 / 1024;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image file to a smaller data URL.
 * - Resizes to fit within maxDimension (default 1024px)
 * - Converts to JPEG at quality 0.8
 * - Iteratively reduces quality if still above 500KB
 * - Skips compression for images already under 100KB
 */
export async function compressImage(
  file: File,
  options: { maxDimension?: number; quality?: number; maxFileSizeKB?: number } = {}
): Promise<string> {
  const {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    maxFileSizeKB = MAX_FILE_SIZE_KB,
  } = options;

  if (!file.type.startsWith("image/")) {
    return fileToDataUrl(file);
  }

  // Small images don't need compression
  if (file.size < 100 * 1024) {
    return fileToDataUrl(file);
  }

  const img = await loadImage(file);

  // Calculate scaled dimensions preserving aspect ratio
  let { naturalWidth: w, naturalHeight: h } = img;
  if (w > maxDimension || h > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  // Revoke the object URL we created for loading
  URL.revokeObjectURL(img.src);

  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  // Iteratively reduce quality if still too large
  let currentQuality = quality;
  while (getBase64SizeKB(dataUrl) > maxFileSizeKB && currentQuality > 0.3) {
    currentQuality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", currentQuality);
  }

  return dataUrl;
}
