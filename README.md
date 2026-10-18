# Litter Crusaders Maps 🗺️🧤 : Clean 'em all!

*Keep it clean, crusader!*

A Pokémon-Go-style litter clean-up game for kids and families. Every kind of litter is a
collectible creature (Bottle Blob, Can Crab, Butt Bug, Glass Gremlin…). Pick up litter, log it on
the map, fill your Litter Log, finish quests and earn badges.

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
- **Litter Log**: 12 creatures, rarity stars, silhouettes + hints for undiscovered ones, counts & fun facts.
- **Progress**: points, levels with titles, daily streak, 27 badges in 7 groups (getting started, catch counts, collection, streaks & exploring, quests, story, crew), progress bars on locked badges, unlock celebrations.
- **Quests**: 3 daily + 2 weekly quests that rotate (deterministic per player per day/week) with progress bars and bonus points; 4 chapter-based **story quests** (The Park Rescue, Ocean Friends, The Great Explorer, Legend of the Mystery Mimic) that award points + story badges.
- **Park auto-detect**: looks up nearby OSM parks/playgrounds/nature reserves via Overpass (~1.2 km), draws a soft green fence, and shows "You're in …!". Bosses prefer the park polygon when you are inside; falls back to ~220 m cells. Caches ~30 min. Golden Gate Park fixture used if Overpass fails (demo/offline).
- **On the way — I Spy**: car-ride camera game with rotating kid-safe prompts (red car, stop sign, bird…). Grown-up drives; photos stay on-device; Road Trip Scout badge.
- **At home — What's different?**: snap a clean-room baseline, later snap again and mark differences (sock, toy moved…). Room Ranger badge.
- **Park bosses**: after enough catches in an area (~220 m cell), a big cleanup challenge appears (Park Pest, Trash Titan, Beach Blob, Playground Pile, Picnic Phantom, Street Sweep Scourge). Shared HP bar the whole crew can chip away at by catching the right litter nearby. Defeat = bonus points + unique badge; **Boss Buster** for clearing 3 different bosses. Tone is fun & non-violent ("send packing" / "recycle away").
- **Family / class crew linking**: grown-up/teacher creates a 6-letter code; kids join with nickname + emoji only. Shared blurred map pins + leaderboard when Firebase is configured (see CREW.md). Same-phone crew profiles still work offline.
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
- `js/crew-sync.js` family/class 6-letter codes, blurred shared pins, leaderboard sync
- `js/firebase-config.js` optional Firebase web config (empty stub until a grown-up pastes it)
- `CREW.md` grown-up setup for cross-phone crews
- `sw.js`, `manifest.webmanifest`, `icons/`
- `tools/screenshots.js` Playwright script used for `screenshots/` (needs `playwright-core`; see `/workspace/litter-map-tools`)

The app starts clean. Demo data is only added via ⚙️ → *Load demo data*, is tagged, and
*Remove demo data* deletes demo catches/crew and any badges/quest rewards earned while it was on.

## License

© 2026 WingsCrew. All rights reserved. This is proprietary software; the source is published for viewing only. See [LICENSE](LICENSE). Questions or permission requests: dovewingsbusiness@gmail.com.

## Litter Dungeon (runner mini game)
Tap 🏃 on the map. 3-lane endless runner, no GPS needed: swipe left/right to change lane, up to jump, down to slide (arrow keys on desktop). Grab litter bits and coins, hop cones/piles/puddles, slide under tape, run through green critters to tidy them up, then tidy the park boss. Finishing a run awards points, unlocks critters in the Litter Log, the **Dungeon Crusader** badge and the weekly "Finish a Litter Dungeon run" quest. Code: `js/dungeon.js` (canvas, fixed-step loop); tie-ins in `js/game.js` and `LMDungeonHost` in `js/app.js`.

### Coins, Closet and Trophy Room
Free to earn only (no real money, no ads). Coins come from real cleanups, Litter Dungeon runs and completed quests/badges, with small daily caps per source (`G.COIN_CAP` in `js/game.js`). Spend them in the Closet's Shop (`js/closet.js`) on hair, outfits/runner skins, trails, dungeon perks (Coin Magnet, Bonk Shield) and critter buddies; some gear is prize-only (won from trophies) and a few premium cosmetics cost more. The Trophy Room shows badges, boss wins, dungeon records and trophies. Data lives on each profile as `wallet`, `closet`, `records` and `trophies` (plain JSON, sync-friendly).
