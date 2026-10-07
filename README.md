# Litter Crusaders Maps 🗺️🧤 — catch 'em all, clean 'em all!

A Pokémon-Go-style litter clean-up game for kids and families. Every kind of litter is a
collectible creature (Bottle Blob, Can Crab, Butt Bug, Glass Gremlin…). Pick up litter, log it on
the map, fill your Litter-dex, finish quests and earn badges.

Mobile-first PWA, plain HTML/CSS/JS, Leaflet + OpenStreetMap. No build step, no backend: all data
lives in `localStorage` on the device.

## Run it
```bash
./serve.sh            # or: python3 -m http.server 8090
open http://localhost:8090
```
Geolocation needs **HTTPS or localhost**. To try it on a phone, use a tunnel (see below), or
tap ✋ and then tap the map to set your spot by hand.

Quick public URL with no account (good for demos, the URL changes every time):
```bash
ssh -R 80:localhost:8090 nokey@localhost.run        # prints https://<random>.lhr.life
# or: cloudflared tunnel --url http://localhost:8090  (trycloudflare.com, may be rate-limited)
```

## Features
- **Safety first-run screen** (gloves, grown-up helper, no sharp things/needles, roads/water, wash hands) + pledge → *Glove Guardian* badge.
- **Map**: GPS location, falls back to a default spot, and you can tap the map to set your position (✋). Creature pins for every catch, with popups (photo, time, remove).
- **Catch flow**: big Catch! button → pick creature → how many → optional photo (`capture=environment`, shrunk to ≤640px JPEG) → celebration with confetti, sound, facts.
  - Butt Bug / Mask Moth need a "I used gloves" tick; Glass Gremlin is **grown-ups only** and needs "A grown-up picked this up".
  - Permanent "found a needle? Don't touch, tell a grown-up" note.
- **Litter-dex**: 12 creatures, rarity stars, silhouettes + hints for undiscovered ones, counts & fun facts.
- **Progress**: points, levels with titles, daily streak, 27 badges in 7 groups (getting started, catch counts, collection, streaks & exploring, quests, story, crew), progress bars on locked badges, unlock celebrations.
- **Quests**: 3 daily + 2 weekly quests that rotate (deterministic per player per day/week) with progress bars and bonus points; 4 chapter-based **story quests** (The Park Rescue, Ocean Friends, The Great Explorer, Legend of the Mystery Mimic) that award points + story badges.
- **Park auto-detect**: looks up nearby OSM parks/playgrounds/nature reserves via Overpass (~1.2 km), draws a soft green fence, and shows "You're in …!". Bosses prefer the park polygon when you are inside; falls back to ~220 m cells. Caches ~30 min. Golden Gate Park fixture used if Overpass fails (demo/offline).
- **On the way — I Spy**: car-ride camera game with rotating kid-safe prompts (red car, stop sign, bird…). Grown-up drives; photos stay on-device; Road Trip Scout badge.
- **At home — What's different?**: snap a clean-room baseline, later snap again and mark differences (sock, toy moved…). Room Ranger badge.
- **Park bosses**: after enough catches in an area (~220 m cell), a big cleanup challenge appears (Park Pest, Trash Titan, Beach Blob, Playground Pile, Picnic Phantom, Street Sweep Scourge). Shared HP bar the whole crew can chip away at by catching the right litter nearby. Defeat = bonus points + unique badge; **Boss Buster** for clearing 3 different bosses. Tone is fun & non-violent ("send packing" / "recycle away").
- **Crew mode**: multiple kids on one device, "Play as", leaderboard, "Just me / Whole crew" map filter, crew badges.
- **Settings**: sound, re-show safety rules, export/import JSON, load/remove **demo data**, reset everything.
- PWA: manifest, icons, service worker (app shell offline; map tiles load live).

## Files
- `index.html`, `css/styles.css`
- `js/creatures.js` creature definitions + SVG art
- `js/bosses.js` park boss definitions + SVG art
- `js/parks.js` Overpass park lookup + fence helpers
- `js/activities.js` I Spy + What's different? prompts
- `js/game.js` rules: points/levels/stats/badges/quests/stories/bosses (pure functions)
- `js/app.js` UI, map, persistence, demo data
- `sw.js`, `manifest.webmanifest`, `icons/`
- `tools/screenshots.js` Playwright script used for `screenshots/` (needs `playwright-core`; see `/workspace/litter-map-tools`)

The app starts clean. Demo data is only added via ⚙️ → *Load demo data*, is tagged, and
*Remove demo data* deletes demo catches/crew and any badges/quest rewards earned while it was on.
