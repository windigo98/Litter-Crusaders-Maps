# Deploy Litter Crusaders Maps to GitHub Pages (windigo98)

The static site is already on `main` at the repo root (`.nojekyll`, `index.html`, `css/`, `js/`, `icons/`, `vendor/`, `manifest.webmanifest`, `sw.js`).

- Repo: https://github.com/windigo98/Littler-Crusaders-Maps (public)
- Pages URL: https://windigo98.github.io/Littler-Crusaders-Maps/
- Pages source: Deploy from branch `main` / `/ (root)`

The repo name is **Littler**-Crusaders-Maps. That spelling is part of the Pages URL.

## Enable Pages (one click)

This agent can push to the repo, but the GitHub App token cannot change Pages settings (`pages=write` and `administration=write` returned 403).

1. Open https://github.com/windigo98/Littler-Crusaders-Maps/settings/pages
2. Build and deployment → Source: **Deploy from a branch**
3. Branch: **main** / ** / (root)** → Save
4. Wait a minute or two, then open https://windigo98.github.io/Littler-Crusaders-Maps/

Equivalent API call, from an account that can administer the repo:

```bash
gh api -X POST repos/windigo98/Littler-Crusaders-Maps/pages \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]=/
```

## Hub card (WingsCrew)

The tip link in the hub header stays `https://cash.app/$windigo98`. Only `assets/apps.js` needs this object added to `window.WINGS_APPS`:

```js
  {
    name: "Litter Crusaders Maps",
    blurb: "Catch litter creatures on the map, fill your Litter-dex, and send park bosses packing.",
    url: "https://windigo98.github.io/Littler-Crusaders-Maps/",
    badge: "Play",
  },
```
