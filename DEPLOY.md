# Deploy Litter Crusaders Maps to GitHub Pages (windigo98)

Target (same pattern as Sip & Spill / Net Pulse):
- Repo: https://github.com/windigo98/Litter-Crusaders-Maps (public)
- Pages URL: https://windigo98.github.io/Litter-Crusaders-Maps/
- Pages source: Deploy from branch `main` / `/ (root)`

## One-time clicks (GitHub web UI)

1. Open https://github.com/new
2. Owner: **windigo98** · Repository name: **Litter-Crusaders-Maps** · Public
3. Do **not** add README/license/.gitignore (empty repo)
4. Create repository
5. On the empty repo page: **uploading an existing file** (or drag-and-drop)
6. Upload **everything inside** this folder (or unzip `litter-map-pages.zip` first):
   - index.html, manifest.webmanifest, sw.js, .nojekyll
   - css/, js/, icons/, vendor/
   - README.md (optional)
7. Commit directly to `main`
8. Settings → Pages → Build and deployment:
   - Source: **Deploy from a branch**
   - Branch: **main** / ** / (root)** → Save
9. Wait ~1–2 minutes, then open https://windigo98.github.io/Litter-Crusaders-Maps/

## Hub card (WingsCrew)

After Pages is live, edit https://github.com/windigo98/WingsCrew/blob/main/assets/apps.js
and add this object to `window.WINGS_APPS` (see also `/workspace/wingscrew-litter-map-card.js`):

```js
  {
    name: "Litter Crusaders Maps",
    blurb: "Catch-'em-all litter cleanup for kids and families. Map, Litter-dex, park bosses, and local play.",
    url: "https://windigo98.github.io/Litter-Crusaders-Maps/",
    badge: "Family cleanup game",
  },
```

## CLI alternative (if `gh` is logged in as windigo98)

```bash
cd /workspace/litter-map-pages
gh repo create windigo98/Litter-Crusaders-Maps --public --source=. --remote=origin --push
# then enable Pages: Settings → Pages → main / root
# or: gh api -X POST repos/windigo98/Litter-Crusaders-Maps/pages -f build_type=legacy -f source[branch]=main -f source[path]=/
```

## Why the agent could not finish this alone

Cursor GitHub tools can read/admin-list repos and open issues/PRs, but have **no create-repository or push-file** APIs. `gh` on this box is not logged in, and the browser has no GitHub session. No new accounts were created.
