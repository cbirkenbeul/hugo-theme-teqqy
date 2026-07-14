# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is `hugo-theme-teqqy`, a minimalist, accessible Hugo theme, published as a Hugo Module at `github.com/cbirkenbeul/hugo-theme-teqqy`. It has no content of its own — it's consumed by a separate site repo (`blog-theme`, sibling checkout at `~/GitHub/blog-theme`) via `module.imports` in that site's `hugo.yaml`, pinned to a git tag. There is no build tooling beyond Hugo itself — no `package.json`, no CSS/JS bundler, no PostCSS pipeline; `assets/css/main.css` and `assets/js/*.js` are hand-written and served as-is via Hugo Pipes.

## Previewing changes against the real site

This repo has no content/pages of its own, so `hugo server` here won't render anything meaningful. To see a theme change live, run the site repo with a module replacement pointing here:
```
cd ~/GitHub/blog-theme
HUGO_MODULE_REPLACEMENTS="github.com/cbirkenbeul/hugo-theme-teqqy -> ../hugo-theme-teqqy" hugo server
```

## Releasing a change

The site repo resolves this theme at a pinned tag, not at `main`. After committing a change here:
```
git tag vX.Y.Z && git push origin main --tags
```
then in `blog-theme`: `hugo mod get github.com/cbirkenbeul/hugo-theme-teqqy@vX.Y.Z && hugo mod tidy`.

## Architecture

**Templates** (`layouts/`): `_default/baseof.html` defines the page skeleton (header/main/footer partials + a `main` block); `_default/single.html` and `_default/list.html` fill it in per content type. `_default/_markup/` holds Goldmark render hooks — most notably `render-image.html`, which implements the responsive image pipeline (see below), and `render-codeblock-mermaid.html`/`render-heading.html`/`render-link.html` for other markdown-element overrides.

**Responsive images** (`_markup/render-image.html`): only images resolved as a Hugo `Resources` object get processed — first tried as a page-bundle resource (`Page.Resources.GetMatch`), then as a fallback `assets/`-tree resource via `resources.Get`. Plain files referenced from the site's `static/` are *not* processed and fall through to a raw `<img>` tag. Generates a WebP srcset at 384/768/1536w breakpoints. The very first image rendered on a page is tracked via `Page.Store.Get "imageRendered"` and gets `loading="eager"` + `fetchpriority="high"` (treated as the likely LCP element); every subsequent image is `loading="lazy"`. SVGs are passed through unprocessed.

**Search**: `layouts/index.json` emits a per-language JSON search index at `/index.json` (and `/en/index.json` etc., depending on the consuming site's languages). `assets/js/search.js` fetches it client-side, resolving the language-prefixed URL from a `data-lang-prefix` attribute or a `<meta name="lang-prefix">` fallback, then does in-browser highlighting/matching — there is no server-side search.

**Theme toggle & storage**: `assets/js/main.js` toggles `data-theme` on `<html>` and persists the choice in `localStorage('theme')`, falling back to `prefers-color-scheme`. Consuming sites relying on a no-persistent-storage/cookie policy should treat this as the one deliberate exception (a UI preference, not tracking) — see the site repo's own `CLAUDE.md` for its specific privacy constraints.

**CSS**: everything lives in one file, `assets/css/main.css`, organized into `/* ===== SECTION ===== */` banner comments (fonts, custom properties, reset, header, post content, callouts, TOC, search, footer, homepage, archive, per-component sections, print). There's no CSS-in-JS or component-scoped styling — new component styles get a new banner section in this file.

**i18n strings**: UI copy (not content) lives in `i18n/de.yaml` and `en.yaml`, referenced via `{{ i18n "key" }}`. A consuming site's own content stays in its `content/` tree, not here.

## Editing care

Hugo template files (`.html`) use `{{/* */}}` for Go-template comments. After editing any `.html` template, re-check that tags opened are still properly closed before considering the edit done; a single stray missing `>` breaks the Hugo template parser for that file.
