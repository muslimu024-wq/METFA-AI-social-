const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Exact master SVG definition of the official METFA Social logo
// Features:
// - Solid vibrant royal blue rounded-square (squircle rx="228" on 1024x1024)
// - Pure white METFA emblem in the center with subtle realistic drop shadow
// - Exact shape and proportions: two upright petal leaves with teardrop cutouts meeting at central V notch,
//   lower winged arch flourish with oval cutouts meeting at bottom cradle
// - No text, no letters, no extra symbols

const dOuter = `
  M 512 606
  C 492 550 454 445 432 328
  C 424 286 376 290 366 336
  C 342 418 362 504 394 544
  C 338 538 274 564 228 624
  C 192 670 202 706 242 712
  C 302 720 390 696 480 676
  C 498 672 526 672 544 676
  C 634 696 722 720 782 712
  C 822 706 832 670 796 624
  C 750 564 686 538 630 544
  C 662 504 682 418 658 336
  C 648 290 600 286 592 328
  C 570 445 532 550 512 606 Z
`.trim();

const dHoleLeftPetal = `
  M 436 352
  C 450 436 480 510 488 542
  C 442 506 412 448 404 378
  C 402 350 424 340 436 352 Z
`.trim();

const dHoleRightPetal = `
  M 588 352
  C 600 340 622 350 620 378
  C 612 448 582 506 536 542
  C 544 510 574 436 588 352 Z
`.trim();

const dHoleLeftWing = `
  M 374 576
  C 316 580 260 624 242 670
  C 246 682 264 686 288 680
  C 344 666 410 650 460 644
  C 426 608 398 578 374 576 Z
`.trim();

const dHoleRightWing = `
  M 650 576
  C 626 578 598 608 564 644
  C 614 650 680 666 736 680
  C 760 686 778 682 782 670
  C 764 624 708 580 650 576 Z
`.trim();

const masterEmblemPath = `${dOuter} ${dHoleLeftPetal} ${dHoleRightPetal} ${dHoleLeftWing} ${dHoleRightWing}`;

// 1. Master Standard Logo SVG (with squircle corner radius 228 on 1024)
const masterLogoSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="metfaBlueBg" x1="512" y1="0" x2="512" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0066FF" />
      <stop offset="100%" stop-color="#0055FF" />
    </linearGradient>
    <filter id="officialShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#001866" flood-opacity="0.4" />
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#001044" flood-opacity="0.25" />
    </filter>
  </defs>
  <!-- Squircle Blue Canvas -->
  <rect width="1024" height="1024" rx="228" fill="url(#metfaBlueBg)" />
  <!-- Official Center White Emblem -->
  <g filter="url(#officialShadow)">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="${masterEmblemPath}"
      fill="#FFFFFF"
    />
  </g>
</svg>`;

// 2. Maskable PWA SVG (full blue bleed to 1024x1024, emblem scaled to 80% to fit within safe zone circle)
const maskableSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="metfaMaskableBg" x1="512" y1="0" x2="512" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0066FF" />
      <stop offset="100%" stop-color="#0055FF" />
    </linearGradient>
    <filter id="officialShadowMaskable" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#001866" flood-opacity="0.4" />
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#001044" flood-opacity="0.25" />
    </filter>
  </defs>
  <!-- Full edge-to-edge bleed for adaptive icon masking -->
  <rect width="1024" height="1024" fill="url(#metfaMaskableBg)" />
  <!-- Scaled comfortably inside the 80% diameter safe circle -->
  <g transform="translate(512, 512) scale(0.82) translate(-512, -512)" filter="url(#officialShadowMaskable)">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="${masterEmblemPath}"
      fill="#FFFFFF"
    />
  </g>
</svg>`;

// 3. Android Foreground Only SVG (Transparent background, white emblem with shadow)
const foregroundSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="fgShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#001866" flood-opacity="0.45" />
    </filter>
  </defs>
  <g transform="translate(512, 512) scale(0.82) translate(-512, -512)" filter="url(#fgShadow)">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="${masterEmblemPath}"
      fill="#FFFFFF"
    />
  </g>
</svg>`;

// Helper to encode a 32x32 PNG into a standard Windows .ico file
function createIcoFromPng(pngBuffer, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(1, 4); // Count of images: 1

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(width >= 256 ? 0 : width, 0);
  dirEntry.writeUInt8(height >= 256 ? 0 : height, 1);
  dirEntry.writeUInt8(0, 2); // Color palette
  dirEntry.writeUInt8(0, 3); // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(pngBuffer.length, 8); // Image size in bytes
  dirEntry.writeUInt32LE(6 + 16, 12); // Offset to image data

  return Buffer.concat([header, dirEntry, pngBuffer]);
}

async function run() {
  console.log('Generating official master icons for METFA Social...');

  const publicDir = path.resolve(__dirname, '../public');
  const distDir = path.resolve(__dirname, '../dist');

  // Save master SVG files
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), masterLogoSvg);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), masterLogoSvg);
  fs.writeFileSync(path.join(publicDir, 'metfa-emblem.svg'), masterLogoSvg);
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), maskableSvg);
  fs.writeFileSync(path.join(publicDir, 'ic_launcher_foreground.svg'), foregroundSvg);

  const standardBuffer = Buffer.from(masterLogoSvg);
  const maskableBuffer = Buffer.from(maskableSvg);

  // Generate 1024x1024 base master
  const png1024 = await sharp(standardBuffer).resize(1024, 1024).png().toBuffer();
  const maskable1024 = await sharp(maskableBuffer).resize(1024, 1024).png().toBuffer();

  const targets = [
    { file: 'logo.png', size: 512, buf: standardBuffer },
    { file: 'icon.png', size: 512, buf: standardBuffer },
    { file: 'icon-512.png', size: 512, buf: standardBuffer },
    { file: 'playstore-icon-512.png', size: 512, buf: standardBuffer },
    { file: 'metfa-emblem.png', size: 512, buf: standardBuffer },
    { file: 'metfa-emblem-128.png', size: 128, buf: standardBuffer },
    { file: 'icon-192.png', size: 192, buf: standardBuffer },
    { file: 'apple-touch-icon.png', size: 180, buf: standardBuffer },
    { file: 'apple-touch-icon-180x180.png', size: 180, buf: standardBuffer },
    { file: 'apple-touch-icon-152x152.png', size: 152, buf: standardBuffer },
    { file: 'apple-touch-icon-precomposed.png', size: 180, buf: standardBuffer },
    { file: 'favicon-64.png', size: 64, buf: standardBuffer },
    { file: 'favicon-48.png', size: 48, buf: standardBuffer },
    { file: 'favicon-32.png', size: 32, buf: standardBuffer },
    { file: 'favicon-16.png', size: 16, buf: standardBuffer },
    // Maskable icons
    { file: 'icon-maskable-512.png', size: 512, buf: maskableBuffer },
    { file: 'icon-maskable-192.png', size: 192, buf: maskableBuffer },
  ];

  for (const t of targets) {
    const outBuf = await sharp(t.buf).resize(t.size, t.size).png().toBuffer();
    fs.writeFileSync(path.join(publicDir, t.file), outBuf);
    console.log(`✓ Wrote public/${t.file} (${t.size}x${t.size})`);
  }

  // Favicon.ico from 32x32 PNG
  const favicon32 = await sharp(standardBuffer).resize(32, 32).png().toBuffer();
  const icoBuf = createIcoFromPng(favicon32, 32, 32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);
  console.log('✓ Wrote public/favicon.ico');

  // Android mipmaps in public/android and android/app/src/main/res
  const androidSizes = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  const androidBases = [
    path.join(publicDir, 'android'),
    path.resolve(__dirname, '../android/app/src/main/res')
  ];

  for (const base of androidBases) {
    if (!fs.existsSync(base)) continue;
    for (const s of androidSizes) {
      const targetDir = path.join(base, s.dir);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const icPng = await sharp(standardBuffer).resize(s.size, s.size).png().toBuffer();
      const maskPng = await sharp(maskableBuffer).resize(s.size, s.size).png().toBuffer();

      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), icPng);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), icPng);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), maskPng);
    }
  }
  console.log('✓ Wrote Android launcher mipmap icons');

  console.log('All master icons generated successfully!');
}

run().catch(err => {
  console.error('Fatal error generating icons:', err);
  process.exit(1);
});
