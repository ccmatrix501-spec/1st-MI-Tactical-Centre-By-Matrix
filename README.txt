v1.9.0 — Guild-locked Discord Activity access

Discord Activity access:
- Activity launches are accepted only from 1st M.I. guild 1256977709884641382.
- DM launches and launches from any other Discord server are denied.
- The Activity authenticates the current Discord user before loading the Tactical Centre.
- The Railway bot verifies that user is a current member of the 1st M.I. server.
- Admin access is granted to roles 1257030835542949939 and 1418416362136670388.
- User 295215176372846592 has explicit full admin access.
- The legacy shareable web admin-key panel is disabled.

OAuth:
- Railway uses TACTICAL_ACTIVITY_APPLICATION_ID for the Activity application.
- Preferred: set TACTICAL_ACTIVITY_CLIENT_SECRET in Railway.
- PKCE public-client exchange is also supported when the Discord application has Public Client enabled.

Web browser version:
- Direct browser access continues to load the normal web Tactical Centre.
- The guild lock applies specifically when the page is running as a Discord Activity.

Discord export routing:
- Demon / Nightmare / Cerberus / Hellfire report forums
- Build reports
- Hell Hound certifications (HLL:V)

Railway API:
https://1st-mi-matrix-r-d-production.up.railway.app
