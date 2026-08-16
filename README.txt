v1.6.3 — Checkbox fix + Discord export

FIXES
- Instant Fails checkboxes look like normal checkboxes again
  (previous CSS styled all inputs as full-width bars)
- Cert sections still ordered 1,2,3... on mobile
- No license key on web

DISCORD EXPORT
- discord-export.js is included and loaded from index.html
- On Export Save you get Download + Send to Discord options
- Full "Send to Discord" posting needs the api/ routes on Vercel
  (or Discord Activity) with env:
    DISCORD_CLIENT_ID
    DISCORD_BOT_TOKEN
- Static GitHub Pages alone can download JSON; posting to Discord
  needs those API routes hosted (Vercel recommended)

INSTALL
1. Overwrite website files:
   index.html
   assets/index-D8SEAL-n.js
   assets/index-DJKkv6Nr.css
   discord-export.js
   version.txt
2. If using Vercel: also upload api/ folder and set env vars
3. clear-cache.html or hard-refresh
