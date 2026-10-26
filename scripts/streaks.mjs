// days: [{ date: 'YYYY-MM-DD', count: number }] in any order.
// Current streak may still be alive if today has no contributions yet but yesterday does.
export function computeStreaks(days) {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!sorted.length) {
    return { current: { n: 0, start: null, end: null }, longest: { n: 0, start: null, end: null } };
  }
  let longest = { n: 0, start: null, end: null };
  let run = { n: 0, start: null, end: null };
  for (const d of sorted) {
    if (d.count > 0) {
      if (run.n === 0) run = { n: 1, start: d.date, end: d.date };
      else run = { n: run.n + 1, start: run.start, end: d.date };
      if (run.n > longest.n) longest = { ...run };
    } else {
      run = { n: 0, start: null, end: null };
    }
  }
  // current: walk back from the last day (skip a zero-count final day)
  let i = sorted.length - 1;
  if (sorted[i].count === 0) i--;
  let current = { n: 0, start: null, end: null };
  while (i >= 0 && sorted[i].count > 0) {
    current = { n: current.n + 1, start: sorted[i].date, end: current.end ?? sorted[i].date };
    i--;
  }
  return { current, longest };
}
