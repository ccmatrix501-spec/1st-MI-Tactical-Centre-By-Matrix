v1.8.0 — Discord Activity + desktop Discord routing sync

Current web/Discord Activity changes:
- Discord Activity bootstrap is loaded before the Tactical Centre app.
- Detects Discord iframe/activity context and exposes Activity metadata.
- Discord export forum list matches the current desktop routing.
- Hell Hound certifications (HLL:V) forum is available.
- Builder certifications default to Build reports.
- Squad / PL / company certification exports default to the matching company forum when metadata is available.
- Static bundle is cache-busted as v1.8.0.

Discord export uses the Railway bot API:
https://1st-mi-matrix-r-d-production.up.railway.app

Available report forums:
- Demon SL/PL reports
- Nightmare SL/PL reports
- Cerberus SL/PL reports
- Hellfire SL/PL reports
- Build reports
- Hell Hound certifications (HLL:V)

Deployment:
- GitHub Pages serves index.html and assets/ directly.
- Open clear-cache.html once if a browser or Discord client keeps an older cached build.
