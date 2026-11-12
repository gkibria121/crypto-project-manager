const IMAGE_EXTENSION_REGEX =
  /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|heic|heif)$/i;

const MAX_AVATAR_DIMENSION = 512;

export function isSupportedImageFile(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) {
    return true;
  }
  return IMAGE_EXTENSION_REGEX.test(file.name);
}

export function readFileAsDataUrl(
  file: File,
  onLoaded: (dataUrl: string) => void,
  onError?: (message: string) => void
): void {
  if (!isSupportedImageFile(file)) {
    onError?.(
      "Please select a valid image file (PNG, JPG, SVG, WebP, GIF, or AVIF)."
    );
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    onError?.("Could not read the selected image file. Please try another file.");
  };

  reader.onload = () => {
    const rawDataUrl = reader.result;
    if (typeof rawDataUrl !== "string") {
      onError?.("Could not read the selected image file.");
      return;
    }

    const isSvgOrGif =
      file.type === "image/svg+xml" ||
      file.type === "image/gif" ||
      /\.(svg|gif)$/i.test(file.name);

    // Keep SVGs, GIFs, and compact images (< 200 KB) as-is
    if (isSvgOrGif || file.size < 200 * 1024 || typeof document === "undefined") {
      onLoaded(rawDataUrl);
      return;
    }

    // Optimize larger raster images onto a 512x512 max canvas for fast saving
    const img = new Image();
    img.onload = () => {
      try {
        const { naturalWidth, naturalHeight } = img;
        if (
          naturalWidth <= MAX_AVATAR_DIMENSION &&
          naturalHeight <= MAX_AVATAR_DIMENSION &&
          file.size <= 512 * 1024
        ) {
          onLoaded(rawDataUrl);
          return;
        }

        const scale = Math.min(
          1,
          MAX_AVATAR_DIMENSION / Math.max(naturalWidth || 1, naturalHeight || 1)
        );
        const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
        const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onLoaded(rawDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const compressedDataUrl = canvas.toDataURL("image/webp", 0.9);
        onLoaded(
          compressedDataUrl.startsWith("data:image/")
            ? compressedDataUrl
            : rawDataUrl
        );
      } catch {
        onLoaded(rawDataUrl);
      }
    };
    img.onerror = () => {
      onLoaded(rawDataUrl);
    };
    img.src = rawDataUrl;
  };

  reader.readAsDataURL(file);
}
