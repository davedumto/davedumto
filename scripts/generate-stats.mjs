// Generates assets/stats.svg: animated contribution count-up, streak ring and language bar.
//   node scripts/generate-stats.mjs            live data (needs GH_TOKEN, optional GH_USER)
//   node scripts/generate-stats.mjs --sample   offline, uses scripts/sample-stats.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFont, textEl, textWidth, odometer, svgDoc, f2, nextId, fmtMD, fmtFull } from './svgkit.mjs';
import { computeStreaks } from './streaks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const USER = process.env.GH_USER || 'davedumto';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

const LANG_COLORS = { CSS: '#a371f7', C: '#8b949e', Shell: '#89e051', TypeScript: '#3178c6', HTML: '#e34c26', Swift: '#f05138', Rust: '#dea584', JavaScript: '#f1e05a' };

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-stats' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchLive() {
  if (!TOKEN) throw new Error('GH_TOKEN is not set');
  const { user } = await gql('query($l:String!){user(login:$l){createdAt}}', { l: USER });
  const created = new Date(user.createdAt);
  const now = new Date();
  const days = [];
  let total = 0;
  for (let y = created.getUTCFullYear(); y <= now.getUTCFullYear(); y++) {
    const from = new Date(Math.max(created, Date.UTC(y, 0, 1)));
    const to = new Date(Math.min(now, Date.UTC(y, 11, 31, 23, 59, 59)));
    const d = await gql(
      'query($l:String!,$f:DateTime!,$t:DateTime!){user(login:$l){contributionsCollection(from:$f,to:$t){contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}',
      { l: USER, f: from.toISOString(), t: to.toISOString() },
    );
    const cal = d.user.contributionsCollection.contributionCalendar;
    total += cal.totalContributions;
    for (const w of cal.weeks) for (const day of w.contributionDays) days.push({ date: day.date, count: day.contributionCount });
  }
  // calendar weeks overlap year boundaries; de-duplicate by date
  const byDate = new Map();
  for (const d of days) byDate.set(d.date, Math.max(byDate.get(d.date) ?? 0, d.count));
  const { current, longest } = computeStreaks([...byDate].map(([date, count]) => ({ date, count })));

  const bytes = new Map();
  let after = null;
  for (;;) {
    const r = await gql(
      'query($l:String!,$a:String){user(login:$l){repositories(first:100,after:$a,ownerAffiliations:OWNER,isFork:false){pageInfo{hasNextPage endCursor} nodes{languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}}}',
      { l: USER, a: after },
    );
    const repos = r.user.repositories;
    for (const n of repos.nodes) for (const e of n.languages.edges) {
      const cur = bytes.get(e.node.name) ?? { size: 0, color: e.node.color };
      cur.size += e.size;
      bytes.set(e.node.name, cur);
    }
    if (!repos.pageInfo.hasNextPage) break;
    after = repos.pageInfo.endCursor;
  }
  const top = [...bytes].sort((a, b) => b[1].size - a[1].size).slice(0, 8);
  const sum = top.reduce((s, [, v]) => s + v.size, 0) || 1;
  const langs = top.map(([name, v]) => ({ name, color: LANG_COLORS[name] || v.color || '#8b949e', pct: (v.size / sum) * 100 }));
  return { total, since: created.toISOString().slice(0, 10), current, longest, langs };
}

function loadSample() {
  const s = JSON.parse(fs.readFileSync(path.join(here, 'sample-stats.json'), 'utf8'));
  s.langs = s.langs.map((l) => ({ ...l, color: LANG_COLORS[l.name] || '#8b949e' }));
  return s;
}

export function buildStatsSvg(data) {
  const inter800 = loadFont('Inter-800.woff');
  const inter500 = loadFont('Inter-500.woff');
  const mono = loadFont('JetBrainsMono-500.woff');
  const W = 960, H = 452;
  const LS = 0.16;
  const label = (t, x, y, fill, anchor = 'middle') => textEl(mono, t.toUpperCase(), x, y, 11, fill, { ls: LS, anchor });
  const range = (r) => (r.start ? (r.start === r.end ? fmtMD(r.start) : `${fmtMD(r.start)} - ${fmtMD(r.end)}`) : 'No streak yet');
  const fmtNum = (n) => n.toLocaleString('en-US');

  let b = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="#08090b" stroke="#23262b"/>`;

  // header
  const hw = textWidth(mono, 'GITHUB STATS', 11, LS);
  b += label('GitHub stats', 40, 46, '#9aa0a6', 'start');
  b += `<rect x="${f2(40 + hw + 16)}" y="42" width="${f2(W - 80 - hw - 16)}" height="1" fill="#2b2f35"/>`;

  // columns
  const cx = [190, 480, 770];
  b += `<rect x="335" y="96" width="1" height="190" fill="#2b2f35"/><rect x="625" y="96" width="1" height="190" fill="#2b2f35"/>`;

  // 1: total contributions
  b += odometer(inter800, fmtNum(data.total), cx[0], 178, 56, { delay: 0.2 });
  b += label('Total contributions', cx[0], 252, '#ffffff');
  b += textEl(inter500, `${fmtFull(data.since)} - Present`, cx[0], 278, 14, '#9aa0a6', { anchor: 'middle' });

  // 2: current streak ring
  const R = 66, C = 2 * Math.PI * R, cy = 160;
  b += `<circle cx="${cx[1]}" cy="${cy}" r="${R}" fill="none" stroke="#23262b" stroke-width="5"/>`;
  b += `<circle cx="${cx[1]}" cy="${cy}" r="${R}" fill="none" stroke="#c6f24a" stroke-width="5" stroke-linecap="round" stroke-dasharray="${f2(C)}" stroke-dashoffset="${f2(C)}" transform="rotate(-90 ${cx[1]} ${cy})">` +
    `<animate attributeName="stroke-dashoffset" from="${f2(C)}" to="0" dur="1.8s" begin="0.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.7 0.1 1"/></circle>`;
  // flame
  b += `<g transform="translate(${cx[1] - 10} ${cy - 56}) scale(.83)"><path fill="#ff6a00" d="M12 1c1.2 4-3 5.6-3 9.5a3.6 3.6 0 0 0 7.2 0c0-1.7-.8-2.9-.8-4.4C17.6 7.6 20 11 20 14.8A8 8 0 0 1 4 14.8C4 8.4 8.6 6 12 1z"/></g>`;
  b += odometer(inter800, String(data.current.n), cx[1], 182, 52, { delay: 0.2 });
  b += label('Current streak', cx[1], 252, '#c6f24a');
  b += textEl(inter500, range(data.current), cx[1], 278, 14, '#9aa0a6', { anchor: 'middle' });

  // 3: longest streak
  b += odometer(inter800, String(data.longest.n), cx[2], 178, 56, { delay: 0.2 });
  b += label('Longest streak', cx[2], 252, '#ffffff');
  b += textEl(inter500, range(data.longest), cx[2], 278, 14, '#9aa0a6', { anchor: 'middle' });

  // languages
  b += `<rect x="40" y="306" width="880" height="1" fill="#2b2f35"/>`;
  b += label('Language distribution', 40, 336, '#9aa0a6', 'start');
  const barId = nextId('bar');
  b += `<clipPath id="${barId}"><rect x="40" y="350" width="0" height="10"><animate attributeName="width" from="0" to="880" dur="1.4s" begin="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.7 0.1 1"/></rect></clipPath>`;
  let x = 40;
  const totalPct = data.langs.reduce((s, l) => s + l.pct, 0) || 100;
  b += `<g clip-path="url(#${barId})">`;
  data.langs.forEach((l, i) => {
    const w = (l.pct / totalPct) * 880;
    b += `<rect x="${f2(x)}" y="350" width="${f2(Math.max(w - (i < data.langs.length - 1 ? 2 : 0), 1))}" height="10" fill="${l.color}"/>`;
    x += w;
  });
  b += `</g>`;
  data.langs.forEach((l, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const lx = 40 + col * 220, ly = 392 + row * 28;
    b += `<rect x="${lx}" y="${ly - 10}" width="10" height="10" fill="${l.color}"/>`;
    b += textEl(inter500, l.name, lx + 18, ly, 13, '#ffffff');
    b += textEl(inter500, `${l.pct.toFixed(2)}%`, lx + 18 + textWidth(inter500, l.name, 13) + 8, ly, 13, '#9aa0a6');
  });

  return svgDoc(W, H, `GitHub stats for ${USER}: ${fmtNum(data.total)} contributions, ${data.current.n} day current streak, ${data.longest.n} day longest streak`, b);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = process.argv.includes('--sample') ? loadSample() : await fetchLive();
  const out = path.join(root, 'assets', 'stats.svg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildStatsSvg(data));
  console.log(`wrote ${out}: ${data.total} contributions, streak ${data.current.n}, longest ${data.longest.n}`);
}
