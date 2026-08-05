/**
 * Discord Activity bootstrap for 1st M.I. Tactical Centre
 * 
 * Load this AFTER the Discord Embedded App SDK script.
 * It safely detects if the app is running inside Discord and
 * performs the authorize → token → authenticate flow.
 *
 * Usage in index.html (recommended order):
 *   1. Your normal app scripts
 *   2. <script type="module" src="/discord-activity.js"></script>
 */

(async function () {
  // Only run inside Discord Activity iframe
  const isDiscord =
    window.location.hostname.includes("discordsays.com") ||
    window.location.search.includes("frame_id") ||
    !!window.DiscordSDK;

  if (!isDiscord) {
    console.log("[1st MI] Running outside Discord – skipping Activity setup");
    return;
  }

  console.log("[1st MI] Detected Discord Activity environment");

  try {
    // Dynamic import so it doesn't break when loaded outside Discord
    const { DiscordSDK } = await import("https://cdn.jsdelivr.net/npm/@discord/embedded-app-sdk@2/+esm");

    // ⚠️ Replace this with your real Client ID from the Discord Developer Portal
    const CLIENT_ID = "YOUR_DISCORD_CLIENT_ID_HERE";

    if (CLIENT_ID === "YOUR_DISCORD_CLIENT_ID_HERE") {
      console.error("[1st MI] Please set your real Discord Client ID in discord-activity.js");
      return;
    }

    const discordSdk = new DiscordSDK(CLIENT_ID);

    await discordSdk.ready();
    console.log("[1st MI] Discord SDK ready");

    // Request authorization
    const { code } = await discordSdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "guilds"],
    });

    // Exchange code for access token via your Vercel API route
    const tokenRes = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err.error || "Token exchange failed");
    }

    const { access_token } = await tokenRes.json();

    // Authenticate with Discord
    const auth = await discordSdk.commands.authenticate({ access_token });

    if (!auth) {
      throw new Error("Authenticate command returned null");
    }

    console.log("[1st MI] Authenticated as:", auth.user?.username || "unknown");

    // Make the SDK available globally if you want to use it later
    window.miDiscordSdk = discordSdk;
    window.miDiscordAuth = auth;

    // Optional: dispatch a custom event so your app can react
    window.dispatchEvent(
      new CustomEvent("mi-discord-ready", {
        detail: { sdk: discordSdk, auth },
      })
    );
  } catch (err) {
    console.error("[1st MI] Discord Activity setup failed:", err);
  }
})();
