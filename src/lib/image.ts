// Client-side photo downscaling. A full-res phone photo is several MB, which
// overran the request-size limit and made Safari throw "The string did not
// match the expected pattern" (see commit 7443503). Shrinking the picture at
// capture time keeps every later step — preview, state, upload — small.

export const MAX_IMAGE_DIMENSION = 1024;
export const IMAGE_QUALITY = 0.8;

interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

// createImageBitmap honours EXIF orientation, so photos taken sideways aren't
// rotated in the result. Safari before 16.4 rejects the options argument, and
// older browsers lack the function entirely, hence the two fallbacks.
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const attempts: (ImageBitmapOptions | undefined)[] = [
      { imageOrientation: 'from-image' },
      undefined,
    ];

    for (const options of attempts) {
      try {
        const bitmap = options
          ? await createImageBitmap(file, options)
          : await createImageBitmap(file);
        return {
          image: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          release: () => bitmap.close(),
        };
      } catch {
        // Try the next strategy.
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode this image'));
      el.src = url;
    });
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Scale a picked image so its longest side is at most `maxDimension`, then
 * re-encode it as JPEG. Returns bare base64 with no `data:` prefix.
 *
 * The output is always JPEG, so callers can safely assume that MIME type
 * regardless of what the user picked.
 */
export async function downscaleImageToBase64(
  file: File,
  maxDimension: number = MAX_IMAGE_DIMENSION,
  quality: number = IMAGE_QUALITY
): Promise<string> {
  const { image, width, height, release } = await decodeImage(file);

  try {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL('image/jpeg', quality).split(',')[1];
  } finally {
    release();
  }
}
