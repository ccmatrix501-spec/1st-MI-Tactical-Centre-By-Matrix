const API = "https://discord.com/api/v10";

const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
const applicationId = String(process.env.DISCORD_CLIENT_ID || "").trim();
const guildId = String(process.env.DISCORD_GUILD_ID || "").trim();

if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");
if (!/^\d{16,22}$/.test(applicationId)) throw new Error("Missing or invalid DISCORD_CLIENT_ID");
if (!/^\d{16,22}$/.test(guildId)) throw new Error("Missing or invalid DISCORD_GUILD_ID");

const command = {
  name: "setup-app-access-panel",
  description: "Post the Tactical Centre app-access panel in this thread",
  type: 1,
  default_member_permissions: "32",
  dm_permission: false
};

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: "Bot " + token,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = text; }

  if (!response.ok) {
    throw new Error("Discord " + response.status + ": " + JSON.stringify(data));
  }

  return data;
}

const base = "/applications/" + applicationId + "/guilds/" + guildId + "/commands";
const current = await request(base);
const existing = Array.isArray(current)
  ? current.find((item) => item?.name === command.name)
  : null;

if (existing?.id) {
  await request(base + "/" + existing.id, {
    method: "PATCH",
    body: JSON.stringify(command)
  });
  console.log("Updated /" + command.name);
} else {
  await request(base, {
    method: "POST",
    body: JSON.stringify(command)
  });
  console.log("Registered /" + command.name);
}
