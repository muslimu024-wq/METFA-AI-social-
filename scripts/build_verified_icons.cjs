const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

async function run() {
  const rootDir = path.resolve(__dirname, '..');
  const masterPath = path.join(rootDir, 'public', 'master-logo.png');

  if (!fs.existsSync(masterPath)) {
    console.error('ERROR: public/master-logo.png does not exist!');
    process.exit(1);
  }

  const fileBytes = fs.readFileSync(masterPath);
  const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');
  console.log('Master Logo verified:', masterPath);
  console.log('Size:', fileBytes.length, 'bytes');
  console.log('SHA-256:', sha256);

  const meta = await sharp(masterPath).metadata();
  console.log(`Master dimensions: ${meta.width} x ${meta.height}`);

  if (meta.width !== 1254 || meta.height !== 1254) {
    console.error(`ERROR: Expected 1254x1254, found ${meta.width}x${meta.height}`);
    process.exit(1);
  }

  // Load raw pixels from master image
  const { data, info } = await sharp(masterPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  // 1. Flood fill outer background from 4 corners
  const isOuter = new Uint8Array(w * h);
  const queue = [0, w - 1, (h - 1) * w, h * w - 1];
  queue.forEach(idx => isOuter[idx] = 1);
  let qHead = 0;
  while (qHead < queue.length) {
    const idx = queue[qHead++];
    const x = idx % w;
    const y = Math.floor(idx / w);
    const neighbors = [];
    if (x > 0) neighbors.push(idx - 1);
    if (x < w - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - w);
    if (y < h - 1) neighbors.push(idx + w);
    for (const n of neighbors) {
      if (!isOuter[n]) {
        const p = n * 3;
        const r = data[p], g = data[p+1], b = data[p+2];
        const isBlue = b > 140 && b > r + 40;
        if (!isBlue) {
          isOuter[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  // Find exact squircle bounding box
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!isOuter[idx]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`Squircle bounds: x[${minX}..${maxX}], y[${minY}..${maxY}] (${maxX - minX + 1} x ${maxY - minY + 1})`);

  // Create transparent RGBA master
  const transparentRgba = Buffer.alloc(w * h * 4);
  // Create maskable solid-blue master (outer canvas filled with royal blue #0056FD)
  const maskableRgb = Buffer.alloc(w * h * 3);

  const BLUE_R = 0, BLUE_G = 86, BLUE_B = 253;

  for (let i = 0; i < w * h; i++) {
    const srcP = i * 3;
    const dstRgba = i * 4;
    const r = data[srcP];
    const g = data[srcP + 1];
    const b = data[srcP + 2];

    // Transparent version: outer background is transparent, squircle + emblem are exact
    transparentRgba[dstRgba] = r;
    transparentRgba[dstRgba + 1] = g;
    transparentRgba[dstRgba + 2] = b;
    transparentRgba[dstRgba + 3] = isOuter[i] ? 0 : 255;

    // Maskable version: outer background is solid blue #0056FD
    if (isOuter[i]) {
      maskableRgb[srcP] = BLUE_R;
      maskableRgb[srcP + 1] = BLUE_G;
      maskableRgb[srcP + 2] = BLUE_B;
    } else {
      maskableRgb[srcP] = r;
      maskableRgb[srcP + 1] = g;
      maskableRgb[srcP + 2] = b;
    }
  }

  // Crop square containing the squircle: centered at cx: 626, cy: 626, size 1152
  const squircleCrop = {
    left: 51,
    top: 51,
    width: 1152,
    height: 1152,
  };

  const squircleBaseSharp = sharp(transparentRgba, { raw: { width: w, height: h, channels: 4 } })
    .extract(squircleCrop);

  const maskableBaseSharp = sharp(maskableRgb, { raw: { width: w, height: h, channels: 3 } });

  // Pre-generate buffers for common sizes
  async function renderSquircle(size) {
    return squircleBaseSharp.clone().resize(size, size, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  }

  async function renderMaskable(size) {
    return maskableBaseSharp.clone().resize(size, size, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  }

  console.log('Generating official icon assets...');

  // Standard squircle icons (transparent corners)
  const icon512 = await renderSquircle(512);
  const icon192 = await renderSquircle(192);
  const icon128 = await renderSquircle(128);
  const favicon64 = await renderSquircle(64);
  const favicon48 = await renderSquircle(48);
  const favicon32 = await renderSquircle(32);
  const favicon16 = await renderSquircle(16);

  // Maskable icons (solid blue outer background for OS safe zone clipping)
  const maskable512 = await renderMaskable(512);
  const maskable192 = await renderMaskable(192);
  const appleTouch180 = await renderMaskable(180);
  const appleTouch152 = await renderMaskable(152);

  // Helper to save to public/ and dist/
  function saveAsset(relPath, buffer) {
    const pubFile = path.join(rootDir, 'public', relPath);
    fs.mkdirSync(path.dirname(pubFile), { recursive: true });
    fs.writeFileSync(pubFile, buffer);

    const distFile = path.join(rootDir, 'dist', relPath);
    if (fs.existsSync(path.join(rootDir, 'dist'))) {
      fs.mkdirSync(path.dirname(distFile), { recursive: true });
      fs.writeFileSync(distFile, buffer);
    }
  }

  // 1. Primary app icons
  saveAsset('logo.png', icon512);
  saveAsset('icon.png', icon512);
  saveAsset('icon-512.png', icon512);
  saveAsset('icon-192.png', icon192);
  saveAsset('playstore-icon-512.png', icon512);
  saveAsset('metfa-emblem.png', icon512);
  saveAsset('metfa-emblem-128.png', icon128);

  // 2. Maskable icons
  saveAsset('icon-maskable-512.png', maskable512);
  saveAsset('icon-maskable-192.png', maskable192);

  // 3. Apple Touch Icons
  saveAsset('apple-touch-icon.png', appleTouch180);
  saveAsset('apple-touch-icon-180x180.png', appleTouch180);
  saveAsset('apple-touch-icon-152x152.png', appleTouch152);
  saveAsset('apple-touch-icon-precomposed.png', appleTouch180);

  // 4. Favicons
  saveAsset('favicon-64.png', favicon64);
  saveAsset('favicon-48.png', favicon48);
  saveAsset('favicon-32.png', favicon32);
  saveAsset('favicon-16.png', favicon16);

  // Multi-size favicon.ico
  function buildIco(pngBuffers, sizes) {
    const count = pngBuffers.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(count, 4);

    let offset = 6 + count * 16;
    const dirEntries = [];
    for (let i = 0; i < count; i++) {
      const s = sizes[i];
      const buf = pngBuffers[i];
      const entry = Buffer.alloc(16);
      entry.writeUInt8(s >= 256 ? 0 : s, 0);
      entry.writeUInt8(s >= 256 ? 0 : s, 1);
      entry.writeUInt8(0, 2);
      entry.writeUInt8(0, 3);
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(buf.length, 8);
      entry.writeUInt32LE(offset, 12);
      dirEntries.push(entry);
      offset += buf.length;
    }
    return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
  }

  const icoBuffer = buildIco([favicon16, favicon32, favicon48], [16, 32, 48]);
  saveAsset('favicon.ico', icoBuffer);

  // 5. Android Launcher Icons
  const androidMipmaps = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const m of androidMipmaps) {
    const standardIcon = await renderSquircle(m.size);
    const roundIcon = await renderMaskable(m.size);

    // Save to public/android/
    saveAsset(`android/${m.dir}/ic_launcher.png`, standardIcon);
    saveAsset(`android/${m.dir}/ic_launcher_round.png`, roundIcon);
    saveAsset(`android/${m.dir}/ic_launcher_foreground.png`, standardIcon);

    // Save to android/app/src/main/res/ if folder exists
    const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', m.dir);
    if (fs.existsSync(path.dirname(resDir))) {
      fs.mkdirSync(resDir, { recursive: true });
      fs.writeFileSync(path.join(resDir, 'ic_launcher.png'), standardIcon);
      fs.writeFileSync(path.join(resDir, 'ic_launcher_round.png'), roundIcon);
      fs.writeFileSync(path.join(resDir, 'ic_launcher_foreground.png'), standardIcon);
    }
  }

  // Android adaptive background/foreground in public/android/
  const adaptiveFg = await renderSquircle(432);
  const adaptiveBg = await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 3,
      background: { r: BLUE_R, g: BLUE_G, b: BLUE_B }
    }
  }).png().toBuffer();

  saveAsset('android/ic_launcher_foreground.png', adaptiveFg);
  saveAsset('android/ic_launcher_background.png', adaptiveBg);

  console.log('ALL METFA Official Logo assets generated directly from public/master-logo.png successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
