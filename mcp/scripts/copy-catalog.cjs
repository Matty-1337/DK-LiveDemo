// Copies the canonical catalog from repo root into mcp/config/
// so it's available in Railway's mcp/ build context.
const fs = require('fs');
const path = require('path');

const sources = [
  path.join(__dirname, '..', '..', 'config', 'products.json'),
  path.join(__dirname, '..', 'config', 'products.json'),
];

const dest = path.join(__dirname, '..', 'config', 'products.json');

let sourceFound = null;
for (const src of sources) {
  if (fs.existsSync(src) && src !== dest) {
    sourceFound = src;
    break;
  }
}

if (!sourceFound) {
  if (fs.existsSync(dest)) {
    console.log(`[copy-catalog] dest already present at ${dest}, no copy needed`);
    process.exit(0);
  }

  console.error('[copy-catalog] FAILED: no catalog found at any of:');
  sources.forEach((src) => console.error(`  - ${src}`));
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(sourceFound, dest);
console.log(`[copy-catalog] copied ${sourceFound} -> ${dest}`);
