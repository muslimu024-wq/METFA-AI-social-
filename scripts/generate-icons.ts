import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * High-Precision Vector Generator for Metfa Social Official App Icon & Logos
 * Strictly matching the user's provided logo (file_00000000bdc482108fa02cd20becf6a7.png)
 *
 * Symmetrical 3D white continuous ribbon emblem:
 * - 2 upright teardrop leaf/crown loops at top
 * - Central V connection
 * - 2 wide M wings on left & right with loop cutouts
 * - Lower smiling cradle arch connecting the wings
 * - Deep royal blue squircle background with subtle top-to-bottom gradient
 */

function buildMetfaSvg(options: { isMaskable?: boolean; size?: number; emblemOnly?: boolean }) {
  const { isMaskable = false, size = 512, emblemOnly = false } = options;

  // Scale and translate for maskable vs standard
  const scale = isMaskable ? 0.72 : (emblemOnly ? 0.94 : 0.88);
  const translate = isMaskable ? 71.68 : (emblemOnly ? 15.36 : 30.72);

  return `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Royal Blue Background Gradient -->
    <linearGradient id="bgGrad" x1="256" y1="0" x2="256" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#143CE6" />
      <stop offset="30%" stop-color="#0A28BD" />
      <stop offset="70%" stop-color="#061C9E" />
      <stop offset="100%" stop-color="#020E6B" />
    </linearGradient>

    <!-- Top Ambient Radial Highlight -->
    <radialGradient id="topGlow" cx="256" cy="40" r="320" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4B77FF" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#143CE6" stop-opacity="0" />
    </radialGradient>

    <!-- 3D White/Pearl Gradient for Emblem -->
    <linearGradient id="pearlGrad" x1="256" y1="60" x2="256" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="#F6F8FC" />
      <stop offset="90%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>

    <!-- Deep Drop Shadow under 3D Ribbon -->
    <filter id="emblemShadow" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#010624" flood-opacity="0.65" />
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.35" />
    </filter>

    <!-- Top Bevel Highlight for 3D Tubular Look -->
    <filter id="bevelFilter" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#FFFFFF" flood-opacity="0.9" />
    </filter>
  </defs>

  ${
    emblemOnly
      ? ''
      : isMaskable
      ? `<rect width="512" height="512" fill="url(#bgGrad)" />`
      : `<rect width="512" height="512" rx="116" fill="url(#bgGrad)" />
         <rect width="512" height="512" rx="116" fill="url(#topGlow)" />
         <rect x="1.5" y="1.5" width="509" height="509" rx="114.5" fill="none" stroke="#4A75FF" stroke-width="2" stroke-opacity="0.35" />`
  }

  <!-- Emblem Centered Group -->
  <g transform="translate(${translate}, ${translate}) scale(${scale})" filter="url(#emblemShadow)">

    <!-- MAIN UNIFIED 3D WHITE EMBLEM PATH (Exact Contours matching the user's logo) -->
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="
        /* OUTER BOUNDARY OF CONTINUOUS EMBLEM */
        M 256 292
        /* Central V to Left Crown Leaf Tip */
        L 204 76
        C 200 66 186 66 182 76
        C 166 112 152 168 184 212
        /* Left Leaf to Left M-Wing Mountain Peak */
        C 164 204 136 196 112 208
        C 76 226 44 274 44 332
        C 44 374 76 394 116 394
        C 160 394 204 356 238 304
        /* Lower Center Cradle Arch */
        C 246 294 266 294 274 304
        C 308 356 352 394 396 394
        C 436 394 468 374 468 332
        C 468 274 436 226 400 208
        C 376 196 348 204 328 212
        C 360 168 346 112 330 76
        C 326 66 312 66 308 76
        /* Right Crown Leaf Tip to Central V */
        L 256 292 Z

        /* LEFT TOP LEAF HOLE (TEARDROP) */
        M 194 112
        C 206 142 206 172 192 188
        C 180 174 176 146 188 116
        C 190 110 192 110 194 112 Z

        /* RIGHT TOP LEAF HOLE (TEARDROP) */
        M 318 112
        C 324 110 326 110 328 116
        C 340 146 336 174 324 188
        C 310 172 310 142 322 112 Z

        /* LEFT WING HOLE (ANGLED TRIANGLE/OVAL) */
        M 106 244
        C 134 244 154 266 170 292
        C 142 324 118 344 96 344
        C 76 344 68 326 68 302
        C 68 272 84 244 106 244 Z

        /* RIGHT WING HOLE (ANGLED TRIANGLE/OVAL) */
        M 406 244
        C 428 244 444 272 444 302
        C 444 326 436 344 416 344
        C 394 344 370 324 342 292
        C 358 266 378 244 406 244 Z

        /* CENTRAL CRADLE VALLEY CUTOUT */
        M 256 316
        C 246 316 232 332 216 352
        C 230 366 244 372 256 372
        C 268 372 282 366 296 352
        C 280 332 266 316 256 316 Z
      "
      fill="url(#pearlGrad)"
    />

    <!-- 3D Ribbon Continuous Tubular Stroke Overlay for Silky Smooth Organic Curves -->
    <!-- 1. Central V and Top Leaves -->
    <path
      d="M 256 290 L 194 72 C 188 62 176 66 172 78 C 154 126 156 186 196 216 L 256 290 L 316 216 C 356 186 358 126 340 78 C 336 66 324 62 318 72 L 256 290 Z"
      fill="url(#pearlGrad)"
      stroke="url(#pearlGrad)"
      stroke-width="12"
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <!-- 2. Left Wing Loop -->
    <path
      d="M 190 216 C 158 198 126 198 102 214 C 68 238 52 284 52 334 C 52 366 74 384 104 384 C 144 384 186 350 224 298"
      fill="none"
      stroke="url(#pearlGrad)"
      stroke-width="26"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- 3. Right Wing Loop -->
    <path
      d="M 322 216 C 354 198 386 198 410 214 C 444 238 460 284 460 334 C 460 366 438 384 408 384 C 368 384 326 350 288 298"
      fill="none"
      stroke="url(#pearlGrad)"
      stroke-width="26"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- 4. Lower Center Connecting Cradle Arch -->
    <path
      d="M 104 384 C 154 384 206 348 256 348 C 306 348 358 384 408 384"
      fill="none"
      stroke="url(#pearlGrad)"
      stroke-width="24"
      stroke-linecap="round"
    />

    <!-- 5. Inner Leaf Cutout Strokes for Perfect Organic Hole Definition -->
    <path
      d="M 194 92 C 182 130 178 164 190 184 C 198 164 198 130 194 92 Z"
      fill="#0A28BD"
      opacity="0.95"
    />
    <path
      d="M 318 92 C 330 130 334 164 322 184 C 314 164 314 130 318 92 Z"
      fill="#0A28BD"
      opacity="0.95"
    />

    <!-- 6. Side Loop Cutout Holes -->
    <path
      d="M 104 246 C 76 270 76 312 96 334 C 126 334 156 298 164 274 C 146 252 124 242 104 246 Z"
      fill="#0A28BD"
      opacity="0.95"
    />
    <path
      d="M 408 246 C 436 270 436 312 416 334 C 386 334 356 298 348 274 C 366 252 388 242 408 246 Z"
      fill="#0A28BD"
      opacity="0.95"
    />

    <!-- 7. Center Cradle Hollow -->
    <path
      d="M 230 318 C 242 344 250 354 256 354 C 262 354 270 344 282 318 C 268 336 244 336 230 318 Z"
      fill="#0A28BD"
      opacity="0.95"
    />

  </g>
</svg>
`;
}

async function main() {
  const publicDir = path.resolve('public');
  const distDir = path.resolve('dist');

  [publicDir, distDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  console.log('✨ Generating Official Metfa Social App Icons from exact vector specification...');

  // 1. Standard full icon SVG (512x512)
  const standardSvg = buildMetfaSvg({ size: 512, isMaskable: false });
  // 2. Safe-zone maskable icon SVG (512x512 with safe margin)
  const maskableSvg = buildMetfaSvg({ size: 512, isMaskable: true });
  // 3. Transparent emblem SVG
  const emblemSvg = buildMetfaSvg({ size: 512, emblemOnly: true });

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardSvg);

  const targets = [
    { name: 'logo.png', svg: standardSvg, size: 512 },
    { name: 'icon-512.png', svg: standardSvg, size: 512 },
    { name: 'icon-192.png', svg: standardSvg, size: 192 },
    { name: 'icon-maskable-512.png', svg: maskableSvg, size: 512 },
    { name: 'icon-maskable-192.png', svg: maskableSvg, size: 192 },
    { name: 'playstore-icon-512.png', svg: standardSvg, size: 512 },
    { name: 'apple-touch-icon.png', svg: standardSvg, size: 180 },
    { name: 'apple-touch-icon-180x180.png', svg: standardSvg, size: 180 },
    { name: 'apple-touch-icon-152x152.png', svg: standardSvg, size: 152 },
    { name: 'apple-touch-icon-precomposed.png', svg: standardSvg, size: 180 },
    { name: 'favicon-64.png', svg: standardSvg, size: 64 },
    { name: 'favicon-48.png', svg: standardSvg, size: 48 },
    { name: 'favicon-32.png', svg: standardSvg, size: 32 },
    { name: 'favicon-16.png', svg: standardSvg, size: 16 },
    { name: 'icon.png', svg: standardSvg, size: 192 },
    { name: 'metfa-emblem.png', svg: emblemSvg, size: 512 },
    { name: 'metfa-emblem-128.png', svg: emblemSvg, size: 128 },
  ];

  for (const t of targets) {
    const buf = await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toBuffer();
    fs.writeFileSync(path.join(publicDir, t.name), buf);
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(path.join(distDir, t.name), buf);
    }
    console.log(` ✅ Rendered: /public/${t.name} (${t.size}x${t.size})`);
  }

  // Also update Android mipmap drawables
  const androidResDir = path.resolve('android/app/src/main/res');
  const publicAndroidDir = path.resolve('public/android');

  const densities = [
    { folder: 'mipmap-mdpi', size: 48 },
    { folder: 'mipmap-hdpi', size: 72 },
    { folder: 'mipmap-xhdpi', size: 96 },
    { folder: 'mipmap-xxhdpi', size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const d of densities) {
    const p1 = path.join(publicAndroidDir, d.folder);
    const p2 = path.join(androidResDir, d.folder);
    [p1, p2].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    const launcherBuf = await sharp(Buffer.from(standardSvg)).resize(d.size, d.size).png().toBuffer();
    const roundBuf = await sharp(Buffer.from(standardSvg)).resize(d.size, d.size).png().toBuffer();

    fs.writeFileSync(path.join(p1, 'ic_launcher.png'), launcherBuf);
    fs.writeFileSync(path.join(p1, 'ic_launcher_round.png'), roundBuf);
    fs.writeFileSync(path.join(p2, 'ic_launcher.png'), launcherBuf);
    fs.writeFileSync(path.join(p2, 'ic_launcher_round.png'), roundBuf);
  }

  console.log('🎉 All Metfa Social logo assets generated successfully!');
}

main().catch(console.error);
