// ============================================================================
// Historical Newspaper Archives — Shared UI
// Client-side search over data/search.json; accessibility helpers.
// ============================================================================
(function () {
  'use strict';

  let searchIndex = [];
  let debounceTimer = null;

  // Load search index (best-effort; search degrades gracefully if missing)
  fetch('data/search.json')
    .then(function (r) { return r.json(); })
    .then(function (data) { searchIndex = data || []; })
    .catch(function () { searchIndex = []; });

  function esc(html) {
    return String(html)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderResults(query, results, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!query) {
      container.innerHTML = '<p class="empty">Type a keyword, newspaper, place, year, or HN ID to search.</p>';
      return;
    }
    if (results.length === 0) {
      container.innerHTML = '<p class="empty">No records match your search.</p>';
      return;
    }
    results.forEach(function (r) {
      const item = document.createElement('article');
      item.className = 'result-item';
      const snip = esc(r.s || '');
      const term = esc(query);
      const highlighted = snip.replace(new RegExp('(' + term + ')', 'gi'), '<mark>$1</mark>');
      item.innerHTML =
        '<div class="r-meta">' +
        '<span class="r-id">' + esc(r.id) + '</span>' +
        ' <span style="opacity:0.7">·</span> ' +
        esc(r.d) + ' <span style="opacity:0.7">·</span> ' +
        esc(r.root || '(none)') +
        (r.cls ? ' <span style="opacity:0.7">·</span> <span class="badge cls-' + esc(r.cls) + '">' + esc(r.cls) + '</span>' : '') +
        '</div>' +
        '<div class="r-head"><a href="stories/' + esc(r.id) + '.html">' + esc(r.h) + '</a></div>' +
        '<div class="r-snip">' + highlighted + '</div>';
      container.appendChild(item);
    });
  }

  function runSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    const q = input.value.trim().toLowerCase();
    document.getElementById('count').textContent = searchIndex.length;
    if (!q) {
      renderResults('', [], 'results');
      document.getElementById('count-label').textContent = 'records in index';
      return;
    }
    const results = searchIndex.filter(function (r) {
      const haystack = (
        (r.id || '') + ' ' + (r.h || '') + ' ' + (r.d || '') +
        ' ' + (r.root || '') + ' ' + (r.sub || '') + ' ' + (r.leaf || '') +
        ' ' + (r.tier || '') + ' ' + (r.cls || '') + ' ' + (r.s || '')
      ).toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
    document.getElementById('count-label').textContent = 'records match';
    renderResults(q, results, 'results');
  }

  document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('search-input');
    if (input) {
      // Pre-fill from ?q= URL parameter (e.g. taxonomy leaf links)
      const params = new URLSearchParams(window.location.search);
      const qParam = params.get('q');
      if (qParam) input.value = qParam;
      input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runSearch, 120);
      });
      runSearch();
    }

    // Smooth skip link focus styling handled by CSS :focus-visible
    // External links open in new tab with rel
    document.querySelectorAll('a[href^="http"]').forEach(function (a) {
      if (!a.target) a.target = '_blank';
      if (!a.rel) a.rel = 'noopener noreferrer';
    });
  });
})();
