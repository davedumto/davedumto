// Tiny helpers for building self-contained animated SVGs.
// GitHub renders README images in <img>, which blocks web fonts and JavaScript,
// so all text is converted to vector outlines and all motion uses SMIL <animate>.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadFont(name) {
  const buf = fs.readFileSync(path.join(here, 'fonts', name));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export const f2 = (n) => Math.round(n * 100) / 100;

export function adv(font, ch, size) {
  return (font.charToGlyph(ch).advanceWidth * size) / font.unitsPerEm;
}

export function textWidth(font, text, size, ls = 0) {
  const chars = [...text];
  if (!chars.length) return 0;
  return chars.reduce((w, ch) => w + adv(font, ch, size) + ls * size, 0) - ls * size;
}

// Text as a single <path> d string. anchor: start | middle | end. ls = letter-spacing in em.
export function textPath(font, text, x, y, size, { ls = 0, anchor = 'start' } = {}) {
  const w = textWidth(font, text, size, ls);
  let cx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  let d = '';
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    d += g.getPath(cx, y, size).toPathData(2);
    cx += (g.advanceWidth * size) / font.unitsPerEm + ls * size;
  }
  return d;
}

export const textEl = (font, text, x, y, size, fill, opts) =>
  `<path fill="${fill}" d="${textPath(font, text, x, y, size, opts)}"/>`;

let uid = 0;
export const nextId = (p = 'id') => `${p}${uid++}`;

// Count-up as an odometer: each digit is a strip 0..9,0..9 that rolls to its final value.
// Leftmost digits roll longest. Non-digits (commas, +) stay still.
export function odometer(font, text, x, y, size, { fill = '#fff', anchor = 'middle', delay = 0.3, baseDur = 1.3, step = 0.3 } = {}) {
  const lineH = size * 1.45;
  const digitW = Math.max(...[...'0123456789'].map((c) => adv(font, c, size)));
  const chars = [...text];
  const widths = chars.map((c) => (/\d/.test(c) ? digitW : adv(font, c, size)));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  const nDigits = chars.filter((c) => /\d/.test(c)).length;
  let di = 0;
  let out = '';
  chars.forEach((c, i) => {
    const w = widths[i];
    if (/\d/.test(c)) {
      const d = Number(c);
      const id = nextId('odo');
      const top = y - size * 0.86;
      const h = size * 1.12;
      let strip = '';
      for (let r = 0; r <= 10 + d; r++) {
        const ch = String(r % 10);
        const gx = cx + (w - adv(font, ch, size)) / 2;
        strip += font.charToGlyph(ch).getPath(gx, y + r * lineH, size).toPathData(2);
      }
      const dur = f2(baseDur + step * (nDigits - 1 - di));
      out += `<clipPath id="${id}"><rect x="${f2(cx)}" y="${f2(top)}" width="${f2(w)}" height="${f2(h)}"/></clipPath>` +
        `<g clip-path="url(#${id})"><path fill="${fill}" d="${strip}">` +
        `<animateTransform attributeName="transform" type="translate" from="0 0" to="0 ${f2(-(10 + d) * lineH)}" dur="${dur}s" begin="${delay}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.7 0.1 1"/>` +
        `</path></g>`;
      di++;
    } else {
      out += `<path fill="${fill}" d="${font.charToGlyph(c).getPath(cx, y, size).toPathData(2)}"/>`;
    }
    cx += w;
  });
  return out;
}

export function svgDoc(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">` +
    `<title>${title}</title>${body}</svg>\n`;
}

export const fmtMD = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const fmtFull = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
