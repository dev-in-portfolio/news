// ============================================================================
// Historical Newspaper Archives — shared UI
// Client-side search, result thumbnails, and an accessible scan lightbox.
// ============================================================================
(function () {
  'use strict';

  var searchIndex = [];
  var thumbs = {};
  var debounceTimer = null;
  var lastLightboxTrigger = null;

  function esc(html) {
    return String(html == null ? '' : html)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function thumbFor(id) {
    var t = thumbs[id];
    if (!t || !t.src) return null;
    return t;
  }

  function setStatus(label, count) {
    var labelEl = document.getElementById('count-label');
    var countEl = document.getElementById('result-count');
    if (labelEl) labelEl.textContent = label;
    if (countEl) countEl.textContent = count;
  }

  function renderResults(query, results) {
    var container = document.getElementById('results');
    if (!container) return;
    container.innerHTML = '';

    if (!query) {
      container.innerHTML = '<div class="results-empty">' +
        '<p class="results-empty-title">Start with a year, a newspaper, or a name.</p>' +
        '<p>Try <a href="/search.html?q=1916">1916</a>, <a href="/search.html?q=Black+Tom">Black Tom</a>, ' +
        '<a href="/search.html?q=assassination">assassination</a>, or an HN number.</p>' +
        '</div>';
      return;
    }
    if (results.length === 0) {
      container.innerHTML = '<p class="empty">No records match that search. Try a broader term.</p>';
      return;
    }

    results.forEach(function (r, index) {
      var item = document.createElement('article');
      item.className = 'result-item';

      // Full-resolution archive scans are large; illustrate the first screenful
      // of results and keep the rest as compact text rows.
      var t = index < 12 ? thumbFor(r.id) : null;
      var thumb = t
        ? '<a class="result-thumb" href="stories/' + esc(r.id) + '.html" tabindex="-1" aria-hidden="true">' +
          '<img src="/' + esc(t.src) + '" alt="" loading="lazy">' +
          '</a>'
        : '<span class="result-thumb result-thumb-empty" aria-hidden="true">' + esc(r.id) + '</span>';

      var snip = esc(r.s || '');
      var term = escapeRegExp(esc(query));
      var highlighted = term ? snip.replace(new RegExp('(' + term + ')', 'gi'), '<mark>$1</mark>') : snip;
      var badge = r.cls ? '<span class="badge ' + (r.cls === 'V' ? 'cls-v' : r.cls === 'R' ? 'cls-r' : r.cls === 'P' ? 'cls-p' : r.cls === 'M' ? 'cls-m' : r.cls === 'F' ? 'cls-f' : 'cls-q') + '">' + esc(r.cls) + '</span>' : '';

      item.innerHTML = thumb +
        '<div class="result-body">' +
        '<div class="result-meta"><span class="r-id">' + esc(r.id) + '</span>' +
        '<span>' + esc(r.d) + '</span>' +
        '<span>' + esc(r.root || '(none)') + '</span>' + badge +
        '</div>' +
        '<h3 class="r-head"><a href="stories/' + esc(r.id) + '.html">' + esc(r.h) + '</a></h3>' +
        '<p class="r-snip">' + highlighted + '</p>' +
        '<a class="result-link" href="stories/' + esc(r.id) + '.html">Open record <span aria-hidden="true">&rarr;</span></a>' +
        '</div>';
      container.appendChild(item);
    });
  }

  function runSearch() {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('.js-search-input'));
    if (!inputs.length) return;
    var q = (inputs[0].value || '').trim();
    inputs.forEach(function (input) {
      if (input.value !== q) input.value = q;
    });
    var query = q.toLowerCase();

    if (!query) {
      setStatus('records in index', searchIndex.length);
      renderResults('', []);
      return;
    }

    var results = searchIndex.filter(function (r) {
      var haystack = (
        (r.id || '') + ' ' + (r.h || '') + ' ' + (r.d || '') +
        ' ' + (r.root || '') + ' ' + (r.sub || '') + ' ' + (r.leaf || '') +
        ' ' + (r.tier || '') + ' ' + (r.cls || '') + ' ' + (r.s || '')
      ).toLowerCase();
      return haystack.indexOf(query) !== -1;
    });

    setStatus(results.length === 1 ? 'record matches' : 'records match', results.length);
    renderResults(q, results);
  }

  function initSearch() {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('.js-search-input'));
    if (!inputs.length) return;

    Promise.all([
      fetch('data/search.json').then(function (r) { return r.json(); }).catch(function () { return []; }),
      fetch('data/thumbs.json').then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]).then(function (values) {
      searchIndex = values[0] || [];
      thumbs = values[1] || {};

      var params = new URLSearchParams(window.location.search);
      var qParam = params.get('q');
      if (qParam) {
        inputs.forEach(function (input) { input.value = qParam; });
      }

      inputs.forEach(function (input) {
        input.addEventListener('input', function () {
          inputs.forEach(function (other) {
            if (other !== input) other.value = input.value;
          });
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(runSearch, 120);
        });
      });

      runSearch();
    });
  }

  // --------------------------------------------------------------- Lightbox
  function getLightbox() {
    var box = document.getElementById('scan-lightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'scan-lightbox';
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Archive image viewer');
    box.hidden = true;
    box.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close image viewer">&times;</button>' +
      '<figure class="lightbox-figure"><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(box);

    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.lightbox-close')) closeLightbox();
    });
    return box;
  }

  function openLightbox(src, caption) {
    var box = getLightbox();
    var img = box.querySelector('img');
    var cap = box.querySelector('figcaption');
    lastLightboxTrigger = document.activeElement;
    img.src = src;
    img.alt = caption || 'Archive newspaper scan';
    cap.textContent = caption || '';
    box.hidden = false;
    document.body.classList.add('lightbox-open');
    box.querySelector('.lightbox-close').focus();
  }

  function closeLightbox() {
    var box = document.getElementById('scan-lightbox');
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove('lightbox-open');
    var img = box.querySelector('img');
    if (img) img.removeAttribute('src');
    if (lastLightboxTrigger && typeof lastLightboxTrigger.focus === 'function') {
      lastLightboxTrigger.focus();
    }
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-lightbox]');
    if (!trigger) return;
    e.preventDefault();
    openLightbox(trigger.getAttribute('href'), trigger.getAttribute('data-caption') || '');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  document.addEventListener('DOMContentLoaded', function () {
    initSearch();

    // External links open in a new tab with rel protections.
    document.querySelectorAll('a[href^="http"]').forEach(function (a) {
      if (!a.target) a.target = '_blank';
      if (!a.rel) a.rel = 'noopener noreferrer';
    });

    // ------------------------------------------------------------ Typewriter
    (function typewriter() {
      var heads = document.querySelectorAll('.typewriter-headline');
      heads.forEach(function (head) {
        var text = head.textContent;
        head.textContent = '';
        var cursor = document.createElement('span');
        cursor.className = 'type-cursor';
        head.appendChild(cursor);
        var i = 0;
        var interval = setInterval(function () {
          if (i < text.length) {
            cursor.insertAdjacentText('beforebegin', text[i]);
            i += 1;
          } else {
            clearInterval(interval);
          }
        }, 28);
      });
    })();

    // ------------------------------------------------------------ Parallax
    (function parallax() {
      var items = document.querySelectorAll('.desk-item');
      if (!items.length) return;
      var move = function (e) {
        var x = (e.clientX / window.innerWidth - 0.5) * 2;
        var y = (e.clientY / window.innerHeight - 0.5) * 2;
        items.forEach(function (item, idx) {
          var strength = (idx + 1) * 4;
          var tx = x * strength;
          var ty = y * strength;
          item.style.transform = 'rotate(' + ((idx % 2 === 0 ? -2.2 : 1.8) + tx * 0.15) + 'deg) translate(' + tx + 'px,' + ty + 'px)';
        });
      };
      document.addEventListener('mousemove', move);
    })();

    // ----------------------------------------------------------- Scroll reveal
    (function reveal() {
      var els = document.querySelectorAll('.reveal');
      if (!els.length || !window.IntersectionObserver) {
        els.forEach(function (el) { el.classList.add('revealed'); });
        return;
      }
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      els.forEach(function (el) { obs.observe(el); });
    })();
  });
})();
