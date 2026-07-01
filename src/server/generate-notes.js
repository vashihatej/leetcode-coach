import fs from 'node:fs';
import path from 'node:path';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightPython(raw) {
  const escaped = esc(raw);
  const slots = [];
  const park = (html) => { const i = slots.length; slots.push(html); return `\x01${i}\x01`; };
  // Apply regex only to text segments, leaving \x01N\x01 placeholders untouched
  const onText = (s, re, rep) =>
    s.replace(/(\x01\d+\x01|[\s\S]+?(?=\x01|$))/g,
      ch => ch.startsWith('\x01') ? ch : ch.replace(re, rep));

  let s = escaped;
  // Park comments and strings so later regexes never see them
  s = s.replace(/(#[^\n]*)/g, (m) => park(`<span class="c">${m}</span>`));
  s = s.replace(/(&#39;&#39;&#39;[\s\S]*?&#39;&#39;&#39;|&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;|&#39;(?:\\.|[^&#39;\\])*&#39;|&quot;(?:\\.|[^&quot;\\])*&quot;)/g,
    (m) => park(`<span class="s">${m}</span>`));
  // Keywords and numbers only applied to real text segments
  s = onText(s, /\b(def|class|return|for|while|if|elif|else|in|not|and|or|True|False|None|import|from|with|as|pass|break|continue|try|except|finally|raise|lambda|yield|del|global|nonlocal|assert|self)\b/g, '<span class="k">$1</span>');
  s = onText(s, /\b(\d+)\b/g, '<span class="n">$1</span>');
  // Restore parked spans
  return s.replace(/\x01(\d+)\x01/g, (_, i) => slots[+i]);
}

function badge(difficulty) {
  const map = { easy: '#3fb950', medium: '#d29922', hard: '#f85149' };
  const color = map[(difficulty ?? '').toLowerCase()] ?? '#8b949e';
  return `<span style="background:${color}22;color:${color};border:1px solid ${color}55;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;">${esc(difficulty ?? 'Unknown')}</span>`;
}

function section(icon, title, content) {
  return `
  <section>
    <h2><span class="icon">${icon}</span>${esc(title)}</h2>
    ${content}
  </section>`;
}

function row(label, value, color = '#e6edf3') {
  if (!value) return '';
  return `<div class="row"><span class="label">${esc(label)}</span><span style="color:${color}">${esc(value)}</span></div>`;
}

function ul(csv) {
  if (!csv) return '';
  return '<ul>' + csv.split(',').map(s => `<li>${esc(s.trim())}</li>`).join('') + '</ul>';
}

function buildNotesHtml({ problem, attempt, code, patternWikis, date }) {
  const dateStr = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const hints = JSON.parse(attempt.hints_used || '[]');
  const RUNG = { 1: 'Rung 1 — which step you were stuck on', 2: 'Rung 2 — leading question', 3: 'Rung 3 — category of technique', 4: 'Rung 4 — specific pattern named', 5: 'Rung 5 — approach outlined' };

  // ── Sections ─────────────────────────────────────────────────────
  const codeSection = code ? section('⌨', 'Your Code', `
    <pre><code>${highlightPython(code)}</code></pre>`) : '';

  const approachSection = attempt.final_approach ? section('▶', 'Your Approach', `
    <p>${esc(attempt.final_approach)}</p>`) : '';

  const ahaSection = attempt.aha_moments ? section('✦', 'Aha Moments', `
    <p class="aha">${esc(attempt.aha_moments)}</p>`) : '';

  const struggledSection = (attempt.confusion_points || attempt.mistakes) ? section('⚠', 'Where You Struggled', `
    ${attempt.mistakes ? `<div class="row"><span class="label">Mistakes</span><span style="color:#f85149">${esc(attempt.mistakes)}</span></div>` : ''}
    ${attempt.confusion_points ? `<div class="row"><span class="label">Confusion</span><span style="color:#d29922">${esc(attempt.confusion_points)}</span></div>` : ''}`) : '';

  const analogySection = attempt.analogy_liked ? section('◈', 'The Analogy That Clicked', `
    <blockquote>${esc(attempt.analogy_liked)}</blockquote>`) : '';

  const hintsSection = hints.length ? section('○', 'Hints You Needed', `
    <ul>${hints.map(r => `<li>${esc(RUNG[r] ?? `Rung ${r}`)}</li>`).join('')}</ul>`) : '';

  const vizSection = attempt.viz_path ? section('▷', 'Visualization', `
    <a href="http://localhost:8765/${esc(attempt.viz_path)}" target="_blank">
      Open: ${esc(attempt.viz_path.split('/').pop())}
    </a>`) : '';

  // Pattern wiki sections
  const wikiSections = patternWikis.map(w => {
    const parts = [];
    if (w.description)      parts.push(`<p>${esc(w.description)}</p>`);
    if (w.invariant)        parts.push(`<div class="row"><span class="label">Core invariant</span><span style="color:#58a6ff">${esc(w.invariant)}</span></div>`);
    if (w.analogy)          parts.push(`<div class="row"><span class="label">Analogy</span><span>${esc(w.analogy)}</span></div>`);
    if (w.signals)          parts.push(`<div class="row"><span class="label">Spot it when</span></div>${ul(w.signals)}`);
    if (w.template_code)    parts.push(`<p class="label" style="margin-bottom:6px">Template</p><pre><code>${highlightPython(w.template_code.replace(/\\n/g, '\n'))}</code></pre>`);
    if (w.mistakes)         parts.push(`<div class="row"><span class="label">Common traps</span><span style="color:#f85149">${esc(w.mistakes)}</span></div>`);
    if (w.when_not)         parts.push(`<div class="row"><span class="label">When NOT to use</span><span style="color:#d29922">${esc(w.when_not)}</span></div>`);
    if (w.time_complexity || w.space_complexity) parts.push(`
      <table><tr><th>Time</th><th>Space</th></tr>
      <tr><td>${esc(w.time_complexity ?? '?')}</td><td>${esc(w.space_complexity ?? '?')}</td></tr></table>`);
    return section('◉', `Pattern: ${w.name}`, parts.join('\n'));
  }).join('');

  // Next time trigger — built from first pattern's signals
  const firstWiki = patternWikis[0];
  const triggerText = firstWiki?.signals
    ? 'When you see: ' + firstWiki.signals.split(',').slice(0, 2).map(s => s.trim()).join(' / ')
    : (attempt.final_approach ? attempt.final_approach.split(';')[0] : '');
  const nextTimeSection = triggerText ? section('⇒', 'Next Time', `
    <p class="trigger">${esc(triggerText)}</p>`) : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(problem.title ?? problem.slug)} — Study Note</title>
<style>
:root{--bg:#0d1117;--panel:#161b22;--line:#21262d;--fg:#e6edf3;--muted:#8b949e;--accent:#58a6ff;--green:#3fb950;--amber:#d29922;--purple:#bc8cff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:32px 24px;max-width:820px;margin:0 auto}
header{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:28px}
header h1{font-size:22px;font-weight:700;margin-bottom:10px}
header .meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--muted)}
section{margin-bottom:32px}
h2{font-size:13px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
h2 .icon{color:var(--accent);font-size:15px}
p{color:var(--fg);margin-bottom:10px;line-height:1.7}
pre{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;overflow-x:auto;font-size:13px;line-height:1.6;margin-bottom:12px}
code{font-family:inherit}
/* syntax */
.k{color:#ff7b72}.s{color:#a5d6ff}.c{color:var(--muted);font-style:italic}.n{color:#79c0ff}
blockquote{border-left:3px solid var(--accent);padding:10px 16px;color:var(--accent);font-style:italic;background:rgba(88,166,255,.07);border-radius:0 6px 6px 0;margin:8px 0}
.aha{color:var(--green);padding:10px 14px;background:rgba(63,185,80,.08);border-radius:6px;border:1px solid rgba(63,185,80,.2)}
.trigger{font-size:16px;font-weight:700;color:var(--accent);padding:14px 18px;background:rgba(88,166,255,.08);border-radius:8px;border:1px solid rgba(88,166,255,.2)}
.row{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;flex-wrap:wrap}
.label{color:var(--muted);font-size:12px;min-width:120px;padding-top:2px;flex-shrink:0}
ul{padding-left:20px;color:var(--fg)}
ul li{margin-bottom:6px;line-height:1.6}
a{color:var(--accent);text-decoration:underline}
table{border-collapse:collapse;font-size:13px;margin-top:8px}
th,td{border:1px solid var(--line);padding:6px 16px;text-align:left}
th{background:var(--panel);color:var(--muted);font-weight:600}
@media print{body{background:#fff;color:#111}pre{background:#f5f5f5;border-color:#ddd}.k{color:#d73a49}.s{color:#0366d6}.aha{background:#f0fff4;color:#276749;border-color:#a8e6c8}blockquote{color:#444;border-color:#888}.trigger{color:#0366d6;background:#f0f6ff;border-color:#c8d8f8}.label{color:#555}}
</style>
</head>
<body>
<header>
  <h1>${esc(problem.title ?? problem.slug)}</h1>
  <div class="meta">
    ${badge(problem.difficulty)}
    <span style="color:var(--green);font-weight:700">✓ Solved · ${esc(attempt.result_type ?? 'solved')}</span>
    <span>${dateStr}</span>
    ${problem.url ? `<a href="${esc(problem.url)}" target="_blank" style="color:var(--muted)">↗ LeetCode</a>` : ''}
  </div>
</header>

${codeSection}
${approachSection}
${ahaSection}
${struggledSection}
${analogySection}
${wikiSections}
${nextTimeSection}
${hintsSection}
${vizSection}
</body>
</html>`;
}

export function generateAndSaveNotes({ problem, attempt, code = '', patternWikis = [], publicDir }) {
  const html = buildNotesHtml({ problem, attempt, code, patternWikis, date: attempt.date ?? new Date() });
  const notesDir = path.join(publicDir, 'notes');
  if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });
  const filename = `${problem.slug}.html`;
  fs.writeFileSync(path.join(notesDir, filename), html, 'utf8');
  return `notes/${filename}`;
}
