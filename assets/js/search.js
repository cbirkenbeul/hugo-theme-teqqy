(function () {
  'use strict';

  var index    = [];
  var isLoaded = false;

  function getIndexUrl() {
    var input = document.getElementById('header-search-input') || document.getElementById('search-input');
    var prefix = (input && input.dataset.langPrefix) ||
                 (document.querySelector('meta[name="lang-prefix"]') || {}).content || '';
    return (prefix ? prefix + '/' : '/') + 'index.json';
  }

  function loadIndex(callback) {
    if (isLoaded) { callback(); return; }
    fetch(getIndexUrl())
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; isLoaded = true; callback(); })
      .catch(function (e) { console.warn('Search index failed to load', e); });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(text, query) {
    if (!text) return '';
    var safe    = escapeHtml(text);
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(escaped, 'gi'), '<mark>$&</mark>');
  }

  function runQuery(query, limit) {
    if (!query || query.length < 2) return [];
    var q = query.toLowerCase();
    return index.filter(function (item) {
      return (item.title   && item.title.toLowerCase().includes(q)) ||
             (item.content && item.content.toLowerCase().includes(q)) ||
             (item.tags    && item.tags.some(function (t) { return t.toLowerCase().includes(q); }));
    }).slice(0, limit || 8);
  }

  // ===== HEADER SEARCH =====
  var headerInput   = document.getElementById('header-search-input');
  var headerResults = document.getElementById('header-search-results');

  if (headerInput && headerResults) {
    var debounce;
    var selectedIndex = -1;

    function showResults(results, query) {
      selectedIndex = -1;

      if (!query || query.length < 2) {
        headerResults.hidden = true;
        headerInput.setAttribute('aria-expanded', 'false');
        return;
      }

      if (results.length === 0) {
        var noResultsMsg = headerInput.dataset.noResults || 'No results found.';
        headerResults.innerHTML = '<li class="header-search-empty">' + escapeHtml(noResultsMsg) + '</li>';
        headerResults.hidden = false;
        headerInput.setAttribute('aria-expanded', 'true');
        return;
      }

      headerResults.innerHTML = results.map(function (item, i) {
        return (
          '<li class="header-search-result" role="option" id="hsr-' + i + '">' +
            '<a href="' + escapeHtml(item.permalink) + '">' +
              '<span class="header-search-result-title">' + highlight(item.title, query) + '</span>' +
              (item.date ? '<span class="header-search-result-meta">' + escapeHtml(item.date) + '</span>' : '') +
            '</a>' +
          '</li>'
        );
      }).join('');

      headerResults.hidden = false;
      headerInput.setAttribute('aria-expanded', 'true');
    }

    function closeResults() {
      headerResults.hidden = true;
      headerInput.setAttribute('aria-expanded', 'false');
      selectedIndex = -1;
    }

    function updateSelection(items) {
      items.forEach(function (item, i) {
        item.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');
      });
      if (selectedIndex >= 0 && items[selectedIndex]) {
        headerInput.setAttribute('aria-activedescendant', 'hsr-' + selectedIndex);
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else {
        headerInput.removeAttribute('aria-activedescendant');
      }
    }

    headerInput.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        var q = headerInput.value.trim();
        loadIndex(function () { showResults(runQuery(q), q); });
      }, 180);
    });

    headerInput.addEventListener('keydown', function (e) {
      var items = Array.from(headerResults.querySelectorAll('.header-search-result'));
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection(items);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        var link = items[selectedIndex].querySelector('a');
        if (link) link.click();
      } else if (e.key === 'Escape') {
        closeResults();
        headerInput.blur();
      }
    });

    headerInput.addEventListener('focus', function () {
      loadIndex(function () {});
      if (headerInput.value.trim().length >= 2) {
        showResults(runQuery(headerInput.value.trim()), headerInput.value.trim());
      }
    });

    document.addEventListener('click', function (e) {
      if (!headerInput.closest('.header-search').contains(e.target)) {
        closeResults();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeResults();
    });
  }

  // ===== SEARCH PAGE (fallback) =====
  var pageInput   = document.getElementById('search-input');
  var pageResults = document.getElementById('search-results');
  var pageStatus  = document.getElementById('search-status');

  if (pageInput && pageResults) {
    var pageDebounce;

    function showPageResults(results, query) {
      if (!query || query.length < 2) {
        pageResults.innerHTML = '';
        if (pageStatus) pageStatus.textContent = '';
        return;
      }

      var noResultsMsg = pageInput.dataset.noResults || 'No results found.';
      var label        = pageInput.dataset.results    || '{n} result(s).';

      if (pageStatus) {
        pageStatus.textContent = results.length === 0
          ? noResultsMsg
          : label.replace('{n}', results.length);
      }

      pageResults.innerHTML = results.map(function (item) {
        return (
          '<li class="post-list-item"><article>' +
            '<h2 class="post-list-title"><a href="' + escapeHtml(item.permalink) + '">' +
              highlight(item.title, query) +
            '</a></h2>' +
            (item.summary
              ? '<p class="post-summary">' + highlight(item.summary, query) + '</p>'
              : '') +
          '</article></li>'
        );
      }).join('');
    }

    pageInput.addEventListener('input', function (e) {
      clearTimeout(pageDebounce);
      pageDebounce = setTimeout(function () {
        var q = e.target.value.trim();
        loadIndex(function () { showPageResults(runQuery(q, 20), q); });
      }, 200);
    });

    pageInput.addEventListener('focus', function () { loadIndex(function () {}); }, { once: true });

    var urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
      pageInput.value = urlQ;
      loadIndex(function () { showPageResults(runQuery(urlQ, 20), urlQ); });
    }
  }

})();
