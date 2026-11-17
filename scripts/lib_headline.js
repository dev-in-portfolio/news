// Extract quoted article-headline candidates from a canonical research record.
//
// Why this exists: many batch-report lines describe an article without quoting
// its headline, so hn_url_meta.json has no headline for those pages and the
// acquisition scripts fall back to a full-page image only. Some records do quote
// the headline in their own text (usually bold-quoted, e.g. **"Dillinger Dies
// Reaching for Gun"**). Those quotes are usable, but only as *candidates*: the
// caller must still match the candidate against the archive's own OCR at
// >= 0.6 before cropping. Nothing here is treated as a headline on its own.
//
// Read-only helper. No network access.

// The source files were extracted from PDFs and contain mojibake for curly
// quotes, e.g. "â€œ" / "â€™". Normalise those before quote matching.
function normaliseQuotes(s) {
  return String(s || '')
    .replace(/\u00e2\u20ac[\u009c\u0153]/g, '"')
    .replace(/\u00e2\u20ac[\u009d\u009d]/g, '"')
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u00ab\u00bb]/g, '"')
    .replace(/\u00e2\u20ac\u201d/g, '--')
    .replace(/\u00e2\u20ac\u201c/g, '--')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(('the a an of and in on to for from with by at as is was were be been it its ' +
  'this that which his her their they he she we you i not but or all any no nor so if then than ' +
  'too very can will just now had has have been').split(' '));

// Records separate the article's content (**Report:**) from the researcher's
// analysis (**Assessment:**). A quoted phrase in the assessment is the author's
// paraphrase or a hypothetical ("an unqualified 'World War II ended May 8' would
// be false"), never the article's headline. Keep only the report portion.
function reportPortion(text) {
  const t = normaliseQuotes(text);
  const i = t.search(/\*\*Assessment:\*\*/i);
  return i >= 0 ? t.slice(0, i) : t;
}

function looksLikeHeadline(s) {
  const t = s.trim().replace(/^["'\s]+|["'\s]+$/g, '').replace(/[,;:]+$/, '');
  if (t.length < 8 || t.length > 110) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 14) return false;
  if (/[.!?]$/.test(t) && words.length > 6) return false;
  const content = words.filter(w => !STOP.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  if (content.length < 2) return false;
  // Reject long sentence-like prose that happens to be quoted.
  if (words.length > 9 && /\b(that|which|because|while|although|however|according|reported|said)\b/i.test(t)) return false;
  return true;
}

// Returns ranked [{ text, field, kind, score }] candidates.
function recordHeadlineCandidates(record) {
  const out = [];
  for (const field of ['discovery_body', 'audit_finding']) {
    const text = reportPortion(record && record[field]);
    if (!text) continue;
    for (const m of text.matchAll(/\*\*"([^"]{6,110})"\*\*/g)) out.push({ text: m[1], field, kind: 'bold-quote' });
    for (const m of text.matchAll(/"([^"]{6,110})"/g)) out.push({ text: m[1], field, kind: 'quote' });
  }
  const seen = new Set();
  const ranked = [];
  for (const c of out) {
    const text = c.text.replace(/^["'\s]+|["'\s]+$/g, '').replace(/[,;:]+$/, '').trim();
    if (!looksLikeHeadline(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const words = text.split(/\s+/);
    // A plain (non-bold) all-lowercase 2-3 word phrase is usually a descriptive
    // fragment ("torpedo tactics"), not a headline. Bold-quoted and longer
    // phrases are still allowed, because some real banners are lowercase.
    if (c.kind === 'quote' && words.length <= 3 && !/[A-Z0-9]/.test(text)) continue;
    const content = words.filter(w => !STOP.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
    // Prefer bold-quoted, longer, distinctive phrases. Digits and all-caps
    // words are strong headline signals.
    let score = content.length * 2 + text.length / 20;
    if (c.kind === 'bold-quote') score += 3;
    if (/\d/.test(text)) score += 1;
    if (words.some(w => w.length > 2 && w === w.toUpperCase())) score += 1;
    ranked.push({ text, field: c.field, kind: c.kind, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

module.exports = { recordHeadlineCandidates, normaliseQuotes, reportPortion, looksLikeHeadline, STOP };
