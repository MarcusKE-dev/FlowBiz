// scripts/android/generate-assets.mjs
//
// Builds the Android launcher icon and splash SOURCES from the existing
// FlowBiz brand icon (public/icons/icon-512.png), then `npm run
// android:assets` hands them to @capacitor/assets, which writes every
// density into android/app/src/main/res.
//
// The brand icon is a blue rounded square with a white wordmark. An
// Android ADAPTIVE icon wants those as two layers, because the launcher
// applies its own mask (circle, squircle, teardrop):
//
//   background  solid FlowBiz blue, full bleed
//   foreground  the white wordmark only, on transparency, scaled into the
//               central safe zone so no mask ever clips a letter
//
// The wordmark is lifted out by brightness: white pixels stay, blue ones
// become transparent, with the antialiased edge kept as partial alpha.
// Re-run this if the brand icon changes; the output is committed.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SOURCE = 'public/icons/icon-512.png';
const OUT = 'resources';
const BRAND_BLUE = { r: 40, g: 110, b: 182 };
const CANVAS = { r: 244, g: 246, b: 249 }; // #F4F6F9, the app's canvas colour

mkdirSync(OUT, { recursive: true });

// 1. The wordmark as white-on-transparent, from brightness.
const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const mark = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < info.width * info.height; i += 1) {
  const r = data[i * 4];
  const g = data[i * 4 + 1];
  const b = data[i * 4 + 2];
  const a = data[i * 4 + 3];
  // Distance from brand blue toward white, 0..1, on the red channel (the
  // one that differs most: 40 in the blue, 255 in the white).
  const t = Math.max(0, Math.min(1, (r - BRAND_BLUE.r - 25) / (255 - BRAND_BLUE.r - 25)));
  const whiteish = g > 180 && b > 180 ? 1 : t;
  mark[i * 4] = 255;
  mark[i * 4 + 1] = 255;
  mark[i * 4 + 2] = 255;
  mark[i * 4 + 3] = Math.round(whiteish * (a / 255) * 255);
}
const markPng = await sharp(mark, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 1 })
  .png()
  .toBuffer();

// 2. Adaptive foreground: 1024², wordmark well inside the 66dp safe-zone circle.
const fg = await sharp(markPng).resize({ width: 470, height: 470, fit: 'inside' }).toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fg, gravity: 'center' }])
  .png()
  .toFile(`${OUT}/icon-foreground.png`);

// 3. Adaptive background: solid brand blue.
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: BRAND_BLUE } })
  .png()
  .toFile(`${OUT}/icon-background.png`);

// 4. Legacy / Play listing icon: the full brand icon, square, at 1024.
const legacyMark = await sharp(markPng).resize({ width: 780, height: 780, fit: 'inside' }).toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: BRAND_BLUE } })
  .composite([{ input: legacyMark, gravity: 'center' }])
  .png()
  .toFile(`${OUT}/icon-only.png`);

// 5. Splash: the brand icon small and centred on the app's canvas colour,
// so the hand-off from splash to the first screen is not a colour flash.
const splashIcon = await sharp(SOURCE).resize(420, 420).toBuffer();
for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: 2732, height: 2732, channels: 3, background: CANVAS } })
    .composite([{ input: splashIcon, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${name}`);
}

console.log('Android asset sources written to resources/');
