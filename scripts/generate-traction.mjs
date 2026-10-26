// Generates assets/vellar-traction.svg: animated count-up strip for Vellar.
// Edit the numbers below, then run: node scripts/generate-traction.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFont, textEl, odometer, svgDoc } from './svgkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// ---- edit these ----
const TESTNET_TXS = '400+';
const DOWNLOADS = '2,000+';
// --------------------

// Stellar mark (Simple Icons, 24x24 viewBox)
const stellarPath = fs.readFileSync(path.join(root, 'scripts', 'stellar-path.txt'), 'utf8').trim();

const inter800 = loadFont('Inter-800.woff');
const inter500 = loadFont('Inter-500.woff');
const mono = loadFont('JetBrainsMono-500.woff');
const W = 960, H = 214;
const LIME = '#c6f24a', SOFT = '#d6e6df';
const lab = (t, x, y) => textEl(mono, t.toUpperCase(), x, y, 11, LIME, { ls: 0.16 });

const cols = [40, 360, 680];
let b = `<rect width="${W}" height="${H}" rx="12" fill="#0c4636"/>`;
b += `<rect x="333" y="40" width="1" height="134" fill="#2f7a62"/><rect x="653" y="40" width="1" height="134" fill="#2f7a62"/>`;

b += lab('Testnet transactions', cols[0], 56);
b += odometer(inter800, TESTNET_TXS, cols[0], 132, 68, { anchor: 'start', fill: '#ffffff', delay: 0.3 });
b += textEl(inter500, 'Settled on Stellar testnet', cols[0], 166, 14, SOFT);

b += lab('Downloads', cols[1], 56);
b += odometer(inter800, DOWNLOADS, cols[1], 132, 68, { anchor: 'start', fill: '#ffffff', delay: 0.3, baseDur: 1.5 });
b += textEl(inter500, 'SDK, CLI and MCP server combined', cols[1], 166, 14, SOFT);

b += lab('Recognition', cols[2], 56);
b += `<g transform="translate(${cols[2]} 74) scale(2.4)"><path fill="#fdda24" d="${stellarPath}"/></g>`;
b += textEl(inter800, 'Stellar', cols[2] + 72, 106, 30, '#ffffff');
b += textEl(inter500, 'community facilitator', cols[2] + 72, 130, 16, '#ffffff');
b += textEl(inter500, "Listed in Stellar's docs", cols[2], 166, 14, SOFT);

const out = path.join(root, 'assets', 'vellar-traction.svg');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svgDoc(W, H, `Vellar: ${TESTNET_TXS} testnet transactions, ${DOWNLOADS} downloads across SDK, CLI and MCP server, listed by Stellar as a community facilitator`, b));
console.log('wrote', out);
