(function () {
  'use strict';

  // ===== DARK MODE TOGGLE =====
  const html = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');

  function getStoredTheme() {
    return localStorage.getItem('theme');
  }

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getEffectiveTheme() {
    return getStoredTheme() || getSystemTheme();
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
      themeToggle.setAttribute('aria-label', themeToggle.dataset[theme === 'dark' ? 'labelLight' : 'labelDark']);
    }
  }

  function toggleTheme() {
    const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  }

  applyTheme(getEffectiveTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!getStoredTheme()) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // ===== TOC ACTIVE HIGHLIGHT =====
  var tocLinks = document.querySelectorAll('.toc a');
  if (tocLinks.length > 0) {
    var headings = Array.from(
      document.querySelectorAll('.post-content h2, .post-content h3, .post-content h4, .post-content h5, .post-content h6')
    );

    if (headings.length > 0 && 'IntersectionObserver' in window) {
      var activeId = null;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) activeId = entry.target.id;
        });
        updateTocActive();
      }, { rootMargin: '-' + (parseInt(getComputedStyle(html).getPropertyValue('--header-height')) || 56) + 'px 0px -60% 0px' });

      headings.forEach(function (h) { if (h.id) observer.observe(h); });

      function updateTocActive() {
        tocLinks.forEach(function (link) {
          var isActive = link.getAttribute('href') === '#' + activeId;
          link.classList.toggle('active', isActive);
          isActive ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current');
        });
      }
    }
  }

  // ===== READING PROGRESS BAR =====
  var progressBar = document.getElementById('reading-progress');
  if (progressBar && document.querySelector('.post-content')) {
    function updateProgress() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = (docHeight > 0 ? Math.min(100, scrollTop / docHeight * 100) : 0) + '%';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  // ===== CODE COPY BUTTONS =====
  document.querySelectorAll('.code-copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var codeEl = btn.closest('.code-block') && btn.closest('.code-block').querySelector('pre code');
      if (!codeEl) return;
      var text = codeEl.textContent.replace(/\n$/, '');

      function onCopied() {
        btn.dataset.state = 'copied';
        setTimeout(function () { delete btn.dataset.state; }, 2000);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onCopied).catch(function () { fallbackCopy(text, onCopied); });
      } else {
        fallbackCopy(text, onCopied);
      }
    });
  });

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ===== WEB SHARE API =====
  var shareBtn = document.querySelector('.share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var title = shareBtn.dataset.title;
      var url = shareBtn.dataset.url;
      var text = shareBtn.dataset.text;
      var feedback = document.querySelector('.share-feedback');

      if (navigator.share) {
        navigator.share({ title: title, url: url, text: text }).catch(function () {});
      } else {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { showShareFeedback(feedback); });
        } else {
          fallbackCopy(url, function () { showShareFeedback(feedback); });
        }
      }
    });

    function showShareFeedback(el) {
      if (!el) return;
      el.hidden = false;
      setTimeout(function () { el.hidden = true; }, 2500);
    }
  }

  // ===== VIDEO CLICK-TO-LOAD =====
  document.querySelectorAll('.video-embed[data-src]').forEach(function (embed) {
    var btn = embed.querySelector('.video-embed-trigger');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var iframe = document.createElement('iframe');
      iframe.src = embed.dataset.src;
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
      embed.innerHTML = '';
      embed.appendChild(iframe);
    });
  });

  // ===== WEBMENTIONS =====
  var wmSection = document.getElementById('webmentions');
  if (wmSection) {
    var wmLoadBtn = wmSection.querySelector('.webmentions-load-btn');
    if (wmLoadBtn) {
      wmLoadBtn.addEventListener('click', function () {
        wmLoadBtn.disabled = true;
        wmLoadBtn.textContent = '…';
        var target = encodeURIComponent(wmSection.dataset.target);
        fetch('https://webmention.io/api/mentions.jf2?target=' + target + '&per-page=50&sort-dir=up')
          .then(function (r) { return r.json(); })
          .then(function (data) { renderWebmentions(wmSection, data.children || []); })
          .catch(function () { wmSection.querySelector('.webmentions-content').innerHTML = ''; });
      });
    }
  }

  function renderWebmentions(section, mentions) {
    var content = section.querySelector('.webmentions-content');
    if (!mentions.length) {
      content.innerHTML = '<p class="webmentions-empty">Noch keine Reaktionen.</p>';
      return;
    }

    var likes = mentions.filter(function (m) { return m['wm-property'] === 'like-of'; });
    var reposts = mentions.filter(function (m) { return m['wm-property'] === 'repost-of'; });
    var replies = mentions.filter(function (m) { return m['wm-property'] === 'in-reply-to' || m['wm-property'] === 'mention-of'; });

    var html = '';

    if (likes.length || reposts.length) {
      html += '<div class="webmentions-counts">';
      if (likes.length) html += '<span>' + likes.length + ' ♥</span>';
      if (reposts.length) html += '<span>' + reposts.length + ' ↩</span>';
      html += '</div>';
    }

    if (replies.length) {
      html += '<ol class="webmentions-list">';
      replies.forEach(function (m) {
        var author = m.author || {};
        var name = author.name || 'Anonym';
        var photo = author.photo ? '<img src="' + escHtml(author.photo) + '" alt="" width="32" height="32" loading="lazy">' : '';
        var url = m.url || '#';
        var date = m['wm-received'] ? new Date(m['wm-received']).toLocaleDateString('de-DE') : '';
        var content = m.content && m.content.text ? escHtml(m.content.text).slice(0, 280) : '';
        html += '<li class="webmention-item"><div class="webmention-author">' + photo + '<a href="' + escHtml(url) + '" rel="noopener noreferrer" target="_blank">' + escHtml(name) + '</a>' + (date ? ' <time>' + date + '</time>' : '') + '</div>' + (content ? '<p class="webmention-content">' + content + '</p>' : '') + '</li>';
      });
      html += '</ol>';
    }

    content.innerHTML = html;
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
