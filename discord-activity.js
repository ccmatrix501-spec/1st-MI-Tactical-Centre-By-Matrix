(function () {
  "use strict";

  const ACTIVITY_BUILD = "1.8.1";

  function getParam(name) {
    try {
      const direct = new URLSearchParams(window.location.search).get(name);
      if (direct) return direct;
    } catch (_) {}

    try {
      const hash = String(window.location.hash || "");
      const queryIndex = hash.indexOf("?");
      if (queryIndex >= 0) {
        const value = new URLSearchParams(hash.slice(queryIndex + 1)).get(name);
        if (value) return value;
      }
    } catch (_) {}

    try {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = String(window.location.href || "").match(
        new RegExp("(?:[?&#])" + escaped + "=([^&#]+)", "i")
      );
      if (match && match[1]) return decodeURIComponent(match[1]);
    } catch (_) {}

    return null;
  }

  const instanceId = getParam("instance_id");
  const frameId = getParam("frame_id");
  const channelId = getParam("channel_id");
  const guildId = getParam("guild_id");
  const hostname = String(window.location.hostname || "").toLowerCase();
  const referrer = String(document.referrer || "").toLowerCase();
  const inFrame = window.parent !== window;

  const isDiscord = Boolean(
    instanceId ||
    frameId ||
    channelId ||
    guildId ||
    hostname.endsWith(".discordsays.com") ||
    hostname === "discordsays.com" ||
    referrer.includes("discord.com") ||
    referrer.includes("discordapp.com") ||
    inFrame
  );

  const detail = {
    activity: isDiscord,
    build: ACTIVITY_BUILD,
    instance_id: instanceId || null,
    frame_id: frameId || null,
    channel_id: channelId || null,
    guild_id: guildId || null
  };

  window.miDiscordActivity = isDiscord;
  window.miDiscordActivityBuild = ACTIVITY_BUILD;
  window.miDiscordInstanceId = instanceId || null;
  window.miDiscordFrameId = frameId || null;
  window.miDiscordChannelId = channelId || null;
  window.miDiscordGuildId = guildId || null;
  window.miDiscordReady = Promise.resolve(detail);

  try {
    document.documentElement.classList.toggle("discord-activity", isDiscord);
  } catch (_) {}

  if (isDiscord) {
    try {
      window.dispatchEvent(new CustomEvent("mi-discord-ready", { detail }));
    } catch (_) {}

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: "1st-mi-tactical-centre-ready", detail },
          "*"
        );
      }
    } catch (_) {}
  }
})();
