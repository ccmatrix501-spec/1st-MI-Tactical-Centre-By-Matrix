# Tactical Centre Discord App Access

## Discord-side flow

1. An administrator runs /setup-app-access-panel inside the Discord thread.
2. The bot posts a permanent access panel in that thread.
3. An allowed member presses Generate Access Key.
4. The bot creates a signed personal key and returns it ephemerally so nobody else in the thread sees it.
5. The desktop app can later send the key to /api/app-access-verify.
6. Verification checks the key signature, expiry, current Discord membership, and current roles.

## Required Vercel environment variables

DISCORD_BOT_TOKEN
DISCORD_CLIENT_ID
DISCORD_PUBLIC_KEY
DISCORD_GUILD_ID
APP_ACCESS_ALLOWED_ROLE_IDS

APP_ACCESS_ALLOWED_ROLE_IDS is a comma-separated list of Discord role IDs that are allowed to use the Tactical Centre app.

Optional:

APP_ACCESS_KEY_DAYS
Default: 30
Minimum: 1
Maximum: 365

APP_ACCESS_SIGNING_SECRET
Optional dedicated signing secret. If omitted, the server derives a signing key from DISCORD_BOT_TOKEN.

## Discord Developer Portal

Set the application's Interactions Endpoint URL to:

https://YOUR-HOST/api/app-access-interactions

Discord will verify the endpoint using its Ed25519 request signature.

## Register the setup command

Run:

node scripts/register-app-access-command.mjs

This creates or updates the guild-only command:

/setup-app-access-panel

Only members with Manage Server or Administrator can use it.

## Post the panel

Open the Discord thread where the panel belongs and run:

/setup-app-access-panel

The panel contains:

Generate Access Key
Check My Access

Generated access keys are shown only to the member who pressed the button.

## Safe default

If APP_ACCESS_ALLOWED_ROLE_IDS has not been configured, normal members cannot generate keys. Discord members with Manage Server or Administrator can still test the panel.
