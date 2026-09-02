// src/utils/imageOptimizer.js
//
// Shrinks a photo from a phone camera into something a shop on a Kenyan
// mobile connection can actually load. A 4MB camera JPEG becomes a
// ~60-90KB WebP at 800px on its longest edge.
//
// Everything happens in the browser on a canvas — nothing is uploaded
// until the caller decides to. The function never throws for an
// over-budget image: if it cannot get under the size budget even at the
// quality floor it returns the blob it managed, plus a warning, and lets
// the UI decide what to say. Silently shipping a 400KB file to every
// device that opens the counter is the failure mode this avoids.

export const MAX_EDGE = 800;          // px, longest edge
export const SIZE_BUDGET = 100 * 1024; // 100 KB
const START_QUALITY = 0.82;
const QUALITY_STEP = 0.07;
const QUALITY_FLOOR = 0.5;

// Safari only gained canvas WebP encoding in 16.4, and some Android
// WebViews still lack it. Detected once, by asking rather than by
// sniffing the user agent.
let webpSupport = null;
export function supportsWebP() {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) canvas.toBlob((b) => resolve(b), type, quality);
    else resolve(null);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{blob: Blob, type: string, extension: string,
 *                    width: number, height: number, quality: number,
 *                    bytes: number, originalBytes: number,
 *                    warning: string|null}>}
 */
export async function optimizeImage(file) {
  if (!file) throw new Error('No image was provided.');
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('That file is not an image. Choose a JPG, PNG or WebP.');
  }

  const img = await loadImage(file);
  const { width: srcW, height: srcH } = img;
  if (!srcW || !srcH) throw new Error('That image appears to be empty.');

  // Only ever scale down. A small image stays its own size rather than
  // being blown up to 800px and losing quality for no reason.
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');

  // White behind the image so a transparent PNG does not become black
  // once it is encoded as JPEG.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const useWebP = supportsWebP();
  const type = useWebP ? 'image/webp' : 'image/jpeg';
  const extension = useWebP ? 'webp' : 'jpg';

  // Step the quality down until the blob fits the budget, or until the
  // floor is reached. The floor is tried exactly once even when the
  // step would overshoot it.
  let quality = START_QUALITY;
  let blob = await toBlob(canvas, type, quality);
  if (!blob) throw new Error('This browser could not encode the image.');

  while (blob.size > SIZE_BUDGET && quality > QUALITY_FLOOR) {
    quality = Math.max(QUALITY_FLOOR, Number((quality - QUALITY_STEP).toFixed(2)));
    const next = await toBlob(canvas, type, quality);
    if (!next) break;
    blob = next;
  }

  const warning = blob.size > SIZE_BUDGET
    ? `This image is still ${formatBytes(blob.size)} after compression, over the ${formatBytes(SIZE_BUDGET)} target. It will work, but it will be slow to load on a weak connection. A more tightly cropped photo will compress better.`
    : null;

  return {
    blob,
    type,
    extension,
    width,
    height,
    quality,
    bytes: blob.size,
    originalBytes: file.size ?? 0,
    warning,
  };
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
