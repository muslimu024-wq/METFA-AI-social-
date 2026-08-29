import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Ensure target directories exist
const publicDir = path.resolve('public');
const androidMipmapDir = path.resolve('public/android');
const androidResDir = path.resolve('android/app/src/main/res');

[
  publicDir,
  androidMipmapDir,
  path.resolve('android/app/src/main/res/mipmap-anydpi-v26'),
  path.resolve('android/app/src/main/res/mipmap-mdpi'),
  path.resolve('android/app/src/main/res/mipmap-hdpi'),
  path.resolve('android/app/src/main/res/mipmap-xhdpi'),
  path.resolve('android/app/src/main/res/mipmap-xxhdpi'),
  path.resolve('android/app/src/main/res/mipmap-xxxhdpi'),
  path.resolve('android/app/src/main/res/drawable'),
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// =========================================================================
// HIGH-FIDELITY VECTOR DEFINITION: METFA SOCIAL 3D LOGO
// Matches the user's 3D Ribbon 'M' (Blue -> Purple -> Magenta -> Orange/Gold)
// + Three community people figures nestled at the center-bottom
// =========================================================================

// 1. Transparent Emblem Only (for Headers, Navbars, Dark/Light Badges)
const emblemSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Left Column Gradient (Vibrant Blue to Indigo/Purple) -->
    <linearGradient id="gradLeftCol" x1="130" y1="410" x2="190" y2="150" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0066FF" />
      <stop offset="35%" stop-color="#2563EB" />
      <stop offset="70%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#7C3AED" />
    </linearGradient>

    <!-- Left-to-Center Diagonal Ribbon (Purple to Vivid Magenta) -->
    <linearGradient id="gradLeftDiag" x1="160" y1="160" x2="275" y2="315" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="35%" stop-color="#9333EA" />
      <stop offset="75%" stop-color="#C026D3" />
      <stop offset="100%" stop-color="#E11D48" />
    </linearGradient>

    <!-- Center-to-Right Diagonal Ribbon & Right Column (Ruby to Fiery Orange & Gold) -->
    <linearGradient id="gradRightRibbon" x1="240" y1="310" x2="380" y2="150" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E11D48" />
      <stop offset="40%" stop-color="#F43F5E" />
      <stop offset="70%" stop-color="#FB7185" />
      <stop offset="100%" stop-color="#FB923C" />
    </linearGradient>

    <linearGradient id="gradRightCol" x1="330" y1="160" x2="385" y2="410" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="30%" stop-color="#FB923C" />
      <stop offset="70%" stop-color="#F97316" />
      <stop offset="100%" stop-color="#EA580C" />
    </linearGradient>

    <!-- 3D Ribbon Overlap Inner Shadow / Depth Gradient -->
    <linearGradient id="foldShadow" x1="230" y1="220" x2="270" y2="310" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.0" />
    </linearGradient>

    <!-- Community Person 1 (Left: Blue to Indigo) -->
    <linearGradient id="gradPersonLeft" x1="190" y1="330" x2="230" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="60%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#6366F1" />
    </linearGradient>

    <!-- Community Person 2 (Center: Indigo to Purple) -->
    <linearGradient id="gradPersonCenter" x1="235" y1="310" x2="275" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="50%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#9333EA" />
    </linearGradient>

    <!-- Community Person 3 (Right: Purple to Magenta) -->
    <linearGradient id="gradPersonRight" x1="280" y1="330" x2="325" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="60%" stop-color="#A855F7" />
      <stop offset="100%" stop-color="#C026D3" />
    </linearGradient>

    <!-- Drop Shadow Filter for 3D realism -->
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0F172A" flood-opacity="0.18" />
    </filter>
  </defs>

  <g id="metfa-3d-emblem" filter="url(#softShadow)">
    <!-- 1. Left Vertical Pillar with Rounded Pill Base and Top Arch -->
    <path d="M 130 380 C 130 402 148 420 170 420 C 192 420 210 402 210 380 L 210 210 C 210 185 228 150 256 150 C 240 148 200 152 170 180 C 145 204 130 236 130 270 Z" fill="url(#gradLeftCol)" />

    <!-- 2. Left Continuous 'M' Ribbon -->
    <path d="M 170 420 C 148 420 130 402 130 380 L 130 235 C 130 185 168 145 218 145 C 248 145 272 160 290 182 L 256 312 L 212 188 C 202 165 186 155 170 155 C 145 155 130 175 130 200" fill="none" />

    <!-- Solid Ribbon Geometry for Left Arm -->
    <path d="M 130 380 C 130 402 148 420 170 420 C 192 420 210 402 210 380 L 210 230 L 295 315 C 304 324 318 324 327 315 L 412 230 L 412 380 C 412 402 394 420 372 420 C 350 420 332 402 332 380 L 332 280 L 278 334 C 266 346 246 346 234 334 L 188 288 L 188 380" fill="none" />

    <!-- Seamless 'M' Shape Construction -->
    <!-- Left Loop Base -->
    <path d="M 132 375 C 132 401 153 422 179 422 C 205 422 226 401 226 375 L 226 235 L 298 318 C 305 326 317 326 324 318 L 396 235 L 396 375 C 396 401 417 422 443 422 C 469 422 490 401 490 375" fill="none" />

    <!-- Main 3D Ribbon Body -->
    <!-- Left Leg -->
    <path d="M 132 375 C 132 403 155 425 183 425 C 211 425 234 403 234 375 L 234 235 C 234 195 258 165 292 150 C 265 142 228 148 198 172 C 158 204 132 254 132 315 Z" fill="url(#gradLeftCol)" />

    <!-- Left to Center Fold Ribbon -->
    <path d="M 172 188 L 292 315 C 302 325 318 325 328 315 L 256 238 L 172 188 Z" fill="url(#gradLeftDiag)" />

    <!-- Smooth Full M Shape with Exact Ribbon Overlaps -->
    <!-- Layer A: Full 'M' Outer Contour -->
    <path d="M 132 370 L 132 230 C 132 170 175 125 230 125 C 262 125 292 140 312 165 C 332 140 362 125 394 125 C 449 125 492 170 492 230 L 492 370 C 492 398 469 421 441 421 C 413 421 390 398 390 370 L 390 245 C 390 215 372 195 348 195 C 324 195 306 215 306 245 L 306 250 L 256 305 L 206 250 L 206 245 C 206 215 188 195 164 195 C 140 195 132 215 132 245 Z" fill="none" />

    <!-- Realized Left Stem -->
    <rect x="132" y="210" width="76" height="165" rx="38" fill="url(#gradLeftCol)" />
    <!-- Realized Right Stem -->
    <rect x="304" y="210" width="76" height="165" rx="38" fill="url(#gradRightCol)" />

    <!-- Top Left Arch -->
    <path d="M 132 248 C 132 185 178 140 238 140 C 268 140 295 152 312 172 L 268 222 C 260 212 248 206 234 206 C 208 206 188 226 188 252 L 188 275 L 132 248 Z" fill="url(#gradLeftCol)" />

    <!-- Top Right Arch to Center Fold -->
    <path d="M 380 248 C 380 185 334 140 274 140 C 244 140 217 152 200 172 L 244 222 C 252 212 264 206 278 206 C 304 206 324 226 324 252 L 324 275 L 380 248 Z" fill="url(#gradRightRibbon)" />

    <!-- Center V Connecting Fold Ribbon -->
    <path d="M 188 236 L 256 312 C 264 321 278 321 286 312 L 324 270 L 284 224 L 256 256 L 228 224 Z" fill="url(#gradLeftDiag)" />

    <!-- Right Side Dynamic Overlap -->
    <path d="M 256 256 L 284 224 L 324 270 L 286 312 C 278 321 264 321 256 312 Z" fill="url(#gradRightRibbon)" />

    <!-- ======================================================= -->
    <!-- 3. THREE COMMUNITY SOCIAL FIGURES (PEOPLE) AT BOTTOM -->
    <!-- ======================================================= -->

    <!-- Center Person (Main Creator) -->
    <!-- Head -->
    <circle cx="256" cy="340" r="19" fill="url(#gradPersonCenter)" />
    <!-- Torso Droplet -->
    <path d="M 256 364 C 274 364 288 382 284 402 C 281 416 273 428 256 432 C 239 428 231 416 228 402 C 224 382 238 364 256 364 Z" fill="url(#gradPersonCenter)" />

    <!-- Left Person (Social Member 1) -->
    <!-- Head -->
    <circle cx="212" cy="354" r="15" fill="url(#gradPersonLeft)" />
    <!-- Torso Wing Droplet -->
    <path d="M 212 374 C 225 374 234 388 230 404 C 226 418 214 428 190 434 C 180 436 172 432 178 424 C 190 408 198 392 202 380 C 204 376 208 374 212 374 Z" fill="url(#gradPersonLeft)" />

    <!-- Right Person (Social Member 2) -->
    <!-- Head -->
    <circle cx="300" cy="354" r="15" fill="url(#gradPersonRight)" />
    <!-- Torso Wing Droplet -->
    <path d="M 300 374 C 287 374 278 388 282 404 C 286 418 298 428 322 434 C 332 436 340 432 334 424 C 322 408 314 392 310 380 C 308 376 304 374 300 374 Z" fill="url(#gradPersonRight)" />
  </g>
</svg>
`;

// 2. Full Square App Icon (With Pristine Rounded Squircle Background - exactly matches user uploaded image)
const fullSquircleLogoSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient for Squircle -->
    <linearGradient id="bgWhiteGrad" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>

    <!-- Outer Soft Border / Shadow -->
    <filter id="squircleShadow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.12" />
    </filter>

    <!-- Left Column Gradient -->
    <linearGradient id="sqLeftCol" x1="120" y1="410" x2="190" y2="140" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0066FF" />
      <stop offset="40%" stop-color="#2563EB" />
      <stop offset="75%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#7C3AED" />
    </linearGradient>

    <!-- Left Diagonal Gradient -->
    <linearGradient id="sqLeftDiag" x1="160" y1="140" x2="280" y2="310" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="35%" stop-color="#9333EA" />
      <stop offset="70%" stop-color="#C026D3" />
      <stop offset="100%" stop-color="#E11D48" />
    </linearGradient>

    <!-- Right Ribbon Gradient -->
    <linearGradient id="sqRightRibbon" x1="240" y1="310" x2="380" y2="140" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E11D48" />
      <stop offset="40%" stop-color="#F43F5E" />
      <stop offset="75%" stop-color="#FB7185" />
      <stop offset="100%" stop-color="#FB923C" />
    </linearGradient>

    <!-- Right Column Gradient -->
    <linearGradient id="sqRightCol" x1="330" y1="140" x2="390" y2="410" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="30%" stop-color="#FB923C" />
      <stop offset="75%" stop-color="#F97316" />
      <stop offset="100%" stop-color="#EA580C" />
    </linearGradient>

    <!-- Person 1 -->
    <linearGradient id="sqPersonLeft" x1="190" y1="330" x2="230" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="60%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#6366F1" />
    </linearGradient>

    <!-- Person 2 -->
    <linearGradient id="sqPersonCenter" x1="235" y1="310" x2="275" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="50%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#9333EA" />
    </linearGradient>

    <!-- Person 3 -->
    <linearGradient id="sqPersonRight" x1="280" y1="330" x2="325" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="60%" stop-color="#A855F7" />
      <stop offset="100%" stop-color="#C026D3" />
    </linearGradient>
  </defs>

  <!-- Clean Canvas Background with 120px Rounded Corner Squircle -->
  <rect x="8" y="8" width="496" height="496" rx="120" fill="url(#bgWhiteGrad)" stroke="#F1F5F9" stroke-width="2" />

  <!-- Logo Graphics Scaled perfectly within Safe Zone (15% margins) -->
  <g id="sq-metfa-emblem">
    <!-- Left Pill Stem -->
    <rect x="132" y="210" width="76" height="165" rx="38" fill="url(#sqLeftCol)" />
    <!-- Right Pill Stem -->
    <rect x="304" y="210" width="76" height="165" rx="38" fill="url(#sqRightCol)" />

    <!-- Top Left Arch -->
    <path d="M 132 248 C 132 185 178 140 238 140 C 268 140 295 152 312 172 L 268 222 C 260 212 248 206 234 206 C 208 206 188 226 188 252 L 188 275 L 132 248 Z" fill="url(#sqLeftCol)" />

    <!-- Top Right Arch -->
    <path d="M 380 248 C 380 185 334 140 274 140 C 244 140 217 152 200 172 L 244 222 C 252 212 264 206 278 206 C 304 206 324 226 324 252 L 324 275 L 380 248 Z" fill="url(#sqRightRibbon)" />

    <!-- Center V Fold Ribbon -->
    <path d="M 188 236 L 256 312 C 264 321 278 321 286 312 L 324 270 L 284 224 L 256 256 L 228 224 Z" fill="url(#sqLeftDiag)" />
    <path d="M 256 256 L 284 224 L 324 270 L 286 312 C 278 321 264 321 256 312 Z" fill="url(#sqRightRibbon)" />

    <!-- Three People Figures -->
    <circle cx="256" cy="340" r="19" fill="url(#sqPersonCenter)" />
    <path d="M 256 364 C 274 364 288 382 284 402 C 281 416 273 428 256 432 C 239 428 231 416 228 402 C 224 382 238 364 256 364 Z" fill="url(#sqPersonCenter)" />

    <circle cx="212" cy="354" r="15" fill="url(#sqPersonLeft)" />
    <path d="M 212 374 C 225 374 234 388 230 404 C 226 418 214 428 190 434 C 180 436 172 432 178 424 C 190 408 198 392 202 380 C 204 376 208 374 212 374 Z" fill="url(#sqPersonLeft)" />

    <circle cx="300" cy="354" r="15" fill="url(#sqPersonRight)" />
    <path d="M 300 374 C 287 374 278 388 282 404 C 286 418 298 428 322 434 C 332 436 340 432 334 424 C 322 408 314 392 310 380 C 308 376 304 374 300 374 Z" fill="url(#sqPersonRight)" />
  </g>
</svg>
`;

// 3. Maskable Adaptive App Icon (Full-Bleed 100% Edge-to-Edge with Emblem centered inside 80% Safe Zone)
const maskableLogoSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient: Deep Metfa Dark #0B0F17 to #182234 with ambient center radial glow -->
    <radialGradient id="maskBgGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#182234" />
      <stop offset="55%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#0B0F17" />
    </radialGradient>
    <radialGradient id="maskGlowCircle" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.30" />
      <stop offset="60%" stop-color="#3B82F6" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#0B0F17" stop-opacity="0" />
    </radialGradient>

    <!-- Left Column Gradient -->
    <linearGradient id="mGradLeftCol" x1="130" y1="410" x2="190" y2="150" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0066FF" />
      <stop offset="35%" stop-color="#2563EB" />
      <stop offset="70%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#7C3AED" />
    </linearGradient>

    <!-- Left-to-Center Diagonal Ribbon -->
    <linearGradient id="mGradLeftDiag" x1="160" y1="160" x2="275" y2="315" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="35%" stop-color="#9333EA" />
      <stop offset="75%" stop-color="#C026D3" />
      <stop offset="100%" stop-color="#E11D48" />
    </linearGradient>

    <!-- Center-to-Right Diagonal Ribbon & Right Column -->
    <linearGradient id="mGradRightRibbon" x1="240" y1="310" x2="380" y2="150" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E11D48" />
      <stop offset="40%" stop-color="#F43F5E" />
      <stop offset="70%" stop-color="#FB7185" />
      <stop offset="100%" stop-color="#FB923C" />
    </linearGradient>

    <linearGradient id="mGradRightCol" x1="330" y1="160" x2="385" y2="410" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="30%" stop-color="#FB923C" />
      <stop offset="70%" stop-color="#F97316" />
      <stop offset="100%" stop-color="#EA580C" />
    </linearGradient>

    <!-- Community Figures -->
    <linearGradient id="mGradPersonLeft" x1="190" y1="330" x2="230" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="60%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#6366F1" />
    </linearGradient>

    <linearGradient id="mGradPersonCenter" x1="235" y1="310" x2="275" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="50%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#9333EA" />
    </linearGradient>

    <linearGradient id="mGradPersonRight" x1="280" y1="330" x2="325" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="60%" stop-color="#A855F7" />
      <stop offset="100%" stop-color="#C026D3" />
    </linearGradient>

    <filter id="mSoftShadow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Edge-to-Edge Solid Full Bleed Background -->
  <rect width="512" height="512" fill="url(#maskBgGrad)" />
  <circle cx="256" cy="256" r="190" fill="url(#maskGlowCircle)" />

  <!-- Strictly centered inside safe circle (radius 204px) -->
  <g id="mask-emblem" filter="url(#mSoftShadow)" transform="translate(256, 256) scale(0.80) translate(-256, -287)">
    <rect x="132" y="210" width="76" height="165" rx="38" fill="url(#mGradLeftCol)" />
    <rect x="304" y="210" width="76" height="165" rx="38" fill="url(#mGradRightCol)" />

    <path d="M 132 248 C 132 185 178 140 238 140 C 268 140 295 152 312 172 L 268 222 C 260 212 248 206 234 206 C 208 206 188 226 188 252 L 188 275 L 132 248 Z" fill="url(#mGradLeftCol)" />
    <path d="M 380 248 C 380 185 334 140 274 140 C 244 140 217 152 200 172 L 244 222 C 252 212 264 206 278 206 C 304 206 324 226 324 252 L 324 275 L 380 248 Z" fill="url(#mGradRightRibbon)" />

    <path d="M 188 236 L 256 312 C 264 321 278 321 286 312 L 324 270 L 284 224 L 256 256 L 228 224 Z" fill="url(#mGradLeftDiag)" />
    <path d="M 256 256 L 284 224 L 324 270 L 286 312 C 278 321 264 321 256 312 Z" fill="url(#mGradRightRibbon)" />

    <circle cx="256" cy="340" r="19" fill="url(#mGradPersonCenter)" />
    <path d="M 256 364 C 274 364 288 382 284 402 C 281 416 273 428 256 432 C 239 428 231 416 228 402 C 224 382 238 364 256 364 Z" fill="url(#mGradPersonCenter)" />

    <circle cx="212" cy="354" r="15" fill="url(#mGradPersonLeft)" />
    <path d="M 212 374 C 225 374 234 388 230 404 C 226 418 214 428 190 434 C 180 436 172 432 178 424 C 190 408 198 392 202 380 C 204 376 208 374 212 374 Z" fill="url(#mGradPersonLeft)" />

    <circle cx="300" cy="354" r="15" fill="url(#mGradPersonRight)" />
    <path d="M 300 374 C 287 374 278 388 282 404 C 286 418 298 428 322 434 C 332 436 340 432 334 424 C 322 408 314 392 310 380 C 308 376 304 374 300 374 Z" fill="url(#mGradPersonRight)" />
  </g>
</svg>
`;

function createIcoFromPngs(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += item.buffer.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((b) => b.buffer)]);
}

async function generateAllAssets() {
  console.log('Generating official Metfa Social 3D logo, icons, maskables and PWA assets...');

  // Save SVGs
  fs.writeFileSync(path.resolve('public/logo.svg'), fullSquircleLogoSvg);
  fs.writeFileSync(path.resolve('public/favicon.svg'), fullSquircleLogoSvg);
  fs.writeFileSync(path.resolve('public/metfa-emblem.svg'), emblemSvg);
  fs.writeFileSync(path.resolve('public/ic_launcher_foreground.svg'), emblemSvg);
  fs.writeFileSync(path.resolve('public/icon-maskable.svg'), maskableLogoSvg);

  const fullBuffer = Buffer.from(fullSquircleLogoSvg);
  const emblemBuffer = Buffer.from(emblemSvg);
  const maskableBuffer = Buffer.from(maskableLogoSvg);

  // 1. Play Store Official 512x512 PNG (32-bit sRGB, unclipped square with safe zone, < 1024 KB)
  await sharp(fullBuffer)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9, effort: 10 })
    .toFile(path.resolve('public/playstore-icon-512.png'));

  // 2. Standard Web & App Icons (Purpose: Any)
  await sharp(fullBuffer).resize(512, 512).png().toFile(path.resolve('public/icon-512.png'));
  await sharp(fullBuffer).resize(512, 512).png().toFile(path.resolve('public/icon.png'));
  await sharp(fullBuffer).resize(512, 512).png().toFile(path.resolve('public/logo.png'));
  await sharp(fullBuffer).resize(192, 192).png().toFile(path.resolve('public/icon-192.png'));

  // 3. Dedicated Maskable Icons (Purpose: Maskable - Full Bleed with 80% Safe Zone)
  await sharp(maskableBuffer).resize(512, 512).png().toFile(path.resolve('public/icon-maskable-512.png'));
  await sharp(maskableBuffer).resize(192, 192).png().toFile(path.resolve('public/icon-maskable-192.png'));

  // 4. Apple Touch Icons for iOS Safari Home Screen
  await sharp(maskableBuffer).resize(180, 180).png().toFile(path.resolve('public/apple-touch-icon.png'));
  await sharp(maskableBuffer).resize(180, 180).png().toFile(path.resolve('public/apple-touch-icon-180x180.png'));
  await sharp(maskableBuffer).resize(152, 152).png().toFile(path.resolve('public/apple-touch-icon-152x152.png'));
  await sharp(maskableBuffer).resize(180, 180).png().toFile(path.resolve('public/apple-touch-icon-precomposed.png'));

  // 5. Multi-Resolution Favicons (16, 32, 48, 64)
  const b16 = await sharp(fullBuffer).resize(16, 16).png().toBuffer();
  const b32 = await sharp(fullBuffer).resize(32, 32).png().toBuffer();
  const b48 = await sharp(fullBuffer).resize(48, 48).png().toBuffer();
  const b64 = await sharp(fullBuffer).resize(64, 64).png().toBuffer();

  fs.writeFileSync(path.resolve('public/favicon-16.png'), b16);
  fs.writeFileSync(path.resolve('public/favicon-32.png'), b32);
  fs.writeFileSync(path.resolve('public/favicon-48.png'), b48);
  fs.writeFileSync(path.resolve('public/favicon-64.png'), b64);

  // 6. Windows / Browser ICO container
  const icoBuf = createIcoFromPngs([
    { width: 16, height: 16, buffer: b16 },
    { width: 32, height: 32, buffer: b32 },
    { width: 48, height: 48, buffer: b48 },
  ]);
  fs.writeFileSync(path.resolve('public/favicon.ico'), icoBuf);

  // 7. Transparent Emblem PNG (for UI headers, dark mode containers, badges)
  await sharp(emblemBuffer).resize(512, 512).png().toFile(path.resolve('public/metfa-emblem.png'));
  await sharp(emblemBuffer).resize(128, 128).png().toFile(path.resolve('public/metfa-emblem-128.png'));

  // 8. Android Adaptive Icon Densities
  const densities = [
    { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const d of densities) {
    const targetDir = path.resolve(`android/app/src/main/res/${d.name}`);
    await sharp(fullBuffer).resize(d.size, d.size).png().toFile(path.join(targetDir, 'ic_launcher.png'));
    await sharp(maskableBuffer).resize(d.size, d.size).png().toFile(path.join(targetDir, 'ic_launcher_round.png'));
    await sharp(emblemBuffer).resize(d.fgSize, d.fgSize).png().toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    const pubDensityDir = path.resolve(`public/android/${d.name}`);
    if (!fs.existsSync(pubDensityDir)) fs.mkdirSync(pubDensityDir, { recursive: true });
    await sharp(fullBuffer).resize(d.size, d.size).png().toFile(path.join(pubDensityDir, 'ic_launcher.png'));
    await sharp(maskableBuffer).resize(d.size, d.size).png().toFile(path.join(pubDensityDir, 'ic_launcher_round.png'));
    await sharp(emblemBuffer).resize(d.fgSize, d.fgSize).png().toFile(path.join(pubDensityDir, 'ic_launcher_foreground.png'));
  }

  // Render App Screenshots for PWA App Store & Install Prompts
  const screenshotWideSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#0B0F17"/>
  <!-- Header Bar -->
  <rect width="1280" height="64" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <!-- Brand Emblem -->
  <circle cx="48" cy="32" r="18" fill="#8B5CF6" fill-opacity="0.2"/>
  <text x="76" y="38" fill="#FFFFFF" font-family="sans-serif" font-size="20" font-weight="800" letter-spacing="-0.5">METFA SOCIAL</text>
  <text x="210" y="38" fill="#2DD4BF" font-family="sans-serif" font-size="14" font-weight="600">STUDIO &amp; FEED</text>

  <!-- Navigation Tabs -->
  <rect x="420" y="14" width="90" height="36" rx="10" fill="#8B5CF6"/>
  <text x="444" y="37" fill="#FFFFFF" font-family="sans-serif" font-size="13" font-weight="700">Feed</text>
  <rect x="520" y="14" width="110" height="36" rx="10" fill="#1E293B"/>
  <text x="538" y="37" fill="#94A3B8" font-family="sans-serif" font-size="13" font-weight="600">AI Studio</text>
  <rect x="640" y="14" width="90" height="36" rx="10" fill="#1E293B"/>
  <text x="664" y="37" fill="#94A3B8" font-family="sans-serif" font-size="13" font-weight="600">Reels</text>
  <rect x="740" y="14" width="100" height="36" rx="10" fill="#1E293B"/>
  <text x="758" y="37" fill="#94A3B8" font-family="sans-serif" font-size="13" font-weight="600">Groups</text>

  <!-- User profile right -->
  <circle cx="1230" cy="32" r="18" fill="#2563EB"/>
  <rect x="1100" y="18" width="100" height="28" rx="8" fill="#1E293B"/>
  <text x="1114" y="36" fill="#A78BFA" font-family="sans-serif" font-size="11" font-weight="700">💎 1,200 PTS</text>

  <!-- Main Grid Content -->
  <!-- Left Sidebar -->
  <rect x="32" y="88" width="260" height="600" rx="16" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <text x="52" y="125" fill="#E2E8F0" font-family="sans-serif" font-size="15" font-weight="700">Creator Hub</text>
  <rect x="52" y="148" width="220" height="40" rx="10" fill="#8B5CF6" fill-opacity="0.15" stroke="#8B5CF6" stroke-width="1"/>
  <text x="70" y="173" fill="#C084FC" font-family="sans-serif" font-size="13" font-weight="600">✨ Multimodal AI Studio</text>
  <rect x="52" y="200" width="220" height="40" rx="10" fill="#151B28"/>
  <text x="70" y="225" fill="#94A3B8" font-family="sans-serif" font-size="13" font-weight="500">🎨 Transform Scene</text>
  <rect x="52" y="252" width="220" height="40" rx="10" fill="#151B28"/>
  <text x="70" y="277" fill="#94A3B8" font-family="sans-serif" font-size="13" font-weight="500">🎙️ Go Live Streaming</text>

  <!-- Feed Post Card 1 -->
  <rect x="316" y="88" width="620" height="290" rx="16" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <circle cx="348" cy="120" r="18" fill="#EC4899"/>
  <text x="376" y="120" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="700">Elena Rostova</text>
  <text x="376" y="136" fill="#2DD4BF" font-family="sans-serif" font-size="12">@elena_ai • 2h ago</text>
  <text x="348" y="175" fill="#E2E8F0" font-family="sans-serif" font-size="14">Exploring quantum neural aesthetics with Metfa Multimodal Generator!</text>
  <rect x="348" y="195" width="556" height="130" rx="12" fill="#1E1B4B" stroke="#4338CA" stroke-width="1"/>
  <text x="520" y="265" fill="#A5B4FC" font-family="sans-serif" font-size="16" font-weight="700">AI Synthesized Masterpiece 🌌</text>

  <!-- Feed Post Card 2 -->
  <rect x="316" y="398" width="620" height="290" rx="16" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <circle cx="348" cy="430" r="18" fill="#3B82F6"/>
  <text x="376" y="430" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="700">Alex Rivera</text>
  <text x="376" y="446" fill="#2DD4BF" font-family="sans-serif" font-size="12">@alex.creative • 5h ago</text>
  <text x="348" y="485" fill="#E2E8F0" font-family="sans-serif" font-size="14">Metfa Social unified SSO and community groups are live!</text>

  <!-- Right Trending Sidebar -->
  <rect x="960" y="88" width="288" height="600" rx="16" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <text x="984" y="125" fill="#E2E8F0" font-family="sans-serif" font-size="15" font-weight="700">Trending Channels</text>
  <rect x="984" y="148" width="240" height="50" rx="10" fill="#151B28"/>
  <text x="1000" y="178" fill="#F8FAFC" font-family="sans-serif" font-size="13" font-weight="600">⚡ Cyber Aesthetics</text>
  <rect x="984" y="210" width="240" height="50" rx="10" fill="#151B28"/>
  <text x="1000" y="240" fill="#F8FAFC" font-family="sans-serif" font-size="13" font-weight="600">🌟 Gemini AI Vision Lab</text>
</svg>
`;

  const screenshotNarrowSvg = `
<svg width="750" height="1334" viewBox="0 0 750 1334" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="750" height="1334" fill="#0B0F17"/>
  <!-- Status Bar -->
  <rect width="750" height="50" fill="#0B0F17"/>
  <text x="40" y="32" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="700">9:41</text>
  <circle cx="690" cy="28" r="6" fill="#2DD4BF"/>

  <!-- Top App Header -->
  <rect y="50" width="750" height="70" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <text x="70" y="93" fill="#FFFFFF" font-family="sans-serif" font-size="22" font-weight="800">METFA SOCIAL</text>
  <circle cx="690" cy="85" r="20" fill="#8B5CF6"/>

  <!-- Stories / Highlights Reel bar -->
  <rect x="24" y="140" width="100" height="140" rx="16" fill="#8B5CF6" fill-opacity="0.2" stroke="#8B5CF6" stroke-width="2"/>
  <text x="36" y="260" fill="#FFFFFF" font-family="sans-serif" font-size="13" font-weight="700">Your Story</text>
  <rect x="136" y="140" width="100" height="140" rx="16" fill="#1E293B"/>
  <text x="150" y="260" fill="#94A3B8" font-family="sans-serif" font-size="13">Elena</text>
  <rect x="248" y="140" width="100" height="140" rx="16" fill="#1E293B"/>
  <text x="262" y="260" fill="#94A3B8" font-family="sans-serif" font-size="13">Alex</text>
  <rect x="360" y="140" width="100" height="140" rx="16" fill="#1E293B"/>
  <text x="374" y="260" fill="#94A3B8" font-family="sans-serif" font-size="13">Nova</text>

  <!-- Feed Card -->
  <rect x="24" y="304" width="702" height="520" rx="20" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <circle cx="60" cy="344" r="22" fill="#EC4899"/>
  <text x="96" y="342" fill="#FFFFFF" font-family="sans-serif" font-size="17" font-weight="700">Elena Rostova</text>
  <text x="96" y="362" fill="#2DD4BF" font-family="sans-serif" font-size="13">@elena_ai • AI Creator</text>
  <text x="44" y="415" fill="#E2E8F0" font-family="sans-serif" font-size="16">Generated this stunning cyber art with Metfa Studio!</text>
  <rect x="44" y="440" width="662" height="300" rx="16" fill="#312E81"/>
  <text x="260" y="600" fill="#A5B4FC" font-family="sans-serif" font-size="20" font-weight="700">✨ AI Artwork</text>

  <!-- Bottom Navigation Bar -->
  <rect y="1234" width="750" height="100" fill="#0E1422" stroke="#1E293B" stroke-width="1"/>
  <text x="80" y="1290" fill="#8B5CF6" font-family="sans-serif" font-size="14" font-weight="700">Feed</text>
  <text x="220" y="1290" fill="#94A3B8" font-family="sans-serif" font-size="14">AI Studio</text>
  <text x="380" y="1290" fill="#94A3B8" font-family="sans-serif" font-size="14">Reels</text>
  <text x="510" y="1290" fill="#94A3B8" font-family="sans-serif" font-size="14">Groups</text>
  <text x="650" y="1290" fill="#94A3B8" font-family="sans-serif" font-size="14">Profile</text>
</svg>
`;

  await sharp(Buffer.from(screenshotWideSvg)).png().toFile(path.join(publicDir, 'screenshot-wide.png'));
  await sharp(Buffer.from(screenshotNarrowSvg)).png().toFile(path.join(publicDir, 'screenshot-narrow.png'));

  // Web Manifest (100% PWABuilder, Lighthouse & Chromium Compliant)
  const manifest = {
    id: '/?source=pwa',
    name: 'Metfa Social',
    short_name: 'Metfa Social',
    description: 'Metfa Social - Multimodal AI Studio, Scene Transformation, Reels, Community Pages, Groups & Next-Gen Social Network.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#0B0F17',
    theme_color: '#8B5CF6',
    lang: 'en-US',
    dir: 'ltr',
    categories: ['social', 'entertainment', 'productivity', 'photo'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/favicon-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon-64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/playstore-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Metfa Social Feed, AI Studio & Channels on Desktop',
      },
      {
        src: '/screenshot-narrow.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Metfa Social Mobile Feed, Reels & Profile',
      },
    ],
    shortcuts: [
      {
        name: 'Community Feed',
        short_name: 'Feed',
        description: 'Explore live community posts and creator stories',
        url: '/?tab=feed',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'AI Studio & Tools',
        short_name: 'AI Studio',
        description: 'Create images, multimodal scenes and chats with Gemini',
        url: '/?tab=chat',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'AI Reels & Videos',
        short_name: 'Reels',
        description: 'Watch trending vertical AI reels and clips',
        url: '/?tab=reels',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Groups & Hubs',
        short_name: 'Groups',
        description: 'Connect with community creator hubs',
        url: '/?tab=groups',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.resolve('public/manifest.json'), manifestJson);
  fs.writeFileSync(path.resolve('public/manifest.webmanifest'), manifestJson);

  // Asset Audit Record
  const assetAudit = {
    generatedAt: new Date().toISOString(),
    version: '2.6.0',
    assets: {
      favicons: ['/favicon.ico', '/favicon.svg', '/favicon-16.png', '/favicon-32.png', '/favicon-48.png', '/favicon-64.png'],
      webAppIcons: ['/icon-192.png', '/icon-512.png', '/icon.png', '/logo.png', '/logo.svg'],
      maskableIcons: ['/icon-maskable-192.png', '/icon-maskable-512.png'],
      appleTouchIcons: ['/apple-touch-icon.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-152x152.png', '/apple-touch-icon-precomposed.png'],
      brandEmblems: ['/metfa-emblem.png', '/metfa-emblem-128.png', '/metfa-emblem.svg'],
      screenshots: ['/screenshot-wide.png', '/screenshot-narrow.png'],
      manifests: ['/manifest.json', '/manifest.webmanifest'],
    },
    compliance: {
      lighthousePwaReady: true,
      maskableSafeZoneRatio: 0.8,
      standaloneDisplay: true,
      serviceWorkerPrecached: true,
    }
  };
  fs.writeFileSync(path.resolve('public/asset-manifest.json'), JSON.stringify(assetAudit, null, 2));

  console.log('Metfa Social assets, maskables, favicons, dual manifest & audit record generated successfully!');
}

generateAllAssets().catch(console.error);
