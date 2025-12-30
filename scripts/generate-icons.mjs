import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// SVG with bold monospace Q - white on black
const createSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <text
    x="${size / 2}"
    y="${size * 0.76}"
    font-family="ui-monospace, 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace"
    font-weight="700"
    font-size="${size * 0.82}"
    fill="#FFFFFF"
    text-anchor="middle">Q</text>
</svg>`;

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateIcons() {
  for (const { name, size } of sizes) {
    const svg = Buffer.from(createSvg(size));
    const png = await sharp(svg).png().toBuffer();
    const outputPath = join(rootDir, 'public', name);
    writeFileSync(outputPath, png);
    console.log(`Generated: ${name}`);
  }

  // Generate favicon.ico from 32x32
  const svg32 = Buffer.from(createSvg(32));
  const ico = await sharp(svg32).png().toBuffer();
  writeFileSync(join(rootDir, 'app', 'favicon.ico'), ico);
  console.log('Generated: favicon.ico (as PNG, renamed)');
}

generateIcons().catch(console.error);
