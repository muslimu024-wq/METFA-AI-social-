import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { generateMasterMetfaSvg } from './generate-icons.js';

/**
 * Generate all PWA, web, and Android assets from the Master METFA approved artwork.
 */
async function generateAllAssets() {
  const publicDir = path.resolve('public');
  const distDir = path.resolve('dist');

  [publicDir, distDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const masterStandardSvg = generateMasterMetfaSvg({ isMaskable: false, size: 1024 });
  const masterMaskableSvg = generateMasterMetfaSvg({ isMaskable: true, size: 1024 });
  const masterEmblemSvg = generateMasterMetfaSvg({ emblemOnly: true, size: 1024 });

  fs.writeFileSync(path.join(publicDir, 'logo.svg'), masterStandardSvg, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), masterMaskableSvg, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'metfa-emblem.svg'), masterEmblemSvg, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), masterStandardSvg, 'utf-8');

  const targets = [
    { name: 'logo.png', svg: masterStandardSvg, size: 512 },
    { name: 'icon.png', svg: masterStandardSvg, size: 512 },
    { name: 'playstore-icon-512.png', svg: masterStandardSvg, size: 512 },
    { name: 'icon-512.png', svg: masterStandardSvg, size: 512 },
    { name: 'icon-192.png', svg: masterStandardSvg, size: 192 },
    { name: 'icon-maskable-512.png', svg: masterMaskableSvg, size: 512 },
    { name: 'icon-maskable-192.png', svg: masterMaskableSvg, size: 192 },
    { name: 'apple-touch-icon.png', svg: masterStandardSvg, size: 180 },
    { name: 'apple-touch-icon-180x180.png', svg: masterStandardSvg, size: 180 },
    { name: 'apple-touch-icon-152x152.png', svg: masterStandardSvg, size: 152 },
    { name: 'apple-touch-icon-precomposed.png', svg: masterStandardSvg, size: 180 },
    { name: 'favicon-64.png', svg: masterStandardSvg, size: 64 },
    { name: 'favicon-48.png', svg: masterStandardSvg, size: 48 },
    { name: 'favicon-32.png', svg: masterStandardSvg, size: 32 },
    { name: 'favicon-16.png', svg: masterStandardSvg, size: 16 },
    { name: 'metfa-emblem.png', svg: masterEmblemSvg, size: 512 },
    { name: 'metfa-emblem-128.png', svg: masterEmblemSvg, size: 128 },
  ];

  for (const t of targets) {
    const pubPath = path.join(publicDir, t.name);
    await sharp(Buffer.from(t.svg))
      .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ quality: 100 })
      .toFile(pubPath);

    if (fs.existsSync(distDir)) {
      fs.copyFileSync(pubPath, path.join(distDir, t.name));
    }
  }

  console.log('✅ Generated all brand assets successfully.');
}

generateAllAssets().catch(console.error);
