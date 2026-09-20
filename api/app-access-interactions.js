import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };

const EPHEMERAL = 64;
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

function sendJson(res, status, value) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(value));
}

function ephemeral(content) {
  return {
    type: 4,
    data: {
      content,
      flags: EPHEMERAL,
      allowed_mentions: { parse: [] }
    }
  };
}

function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body, "utf8"));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function publicKeyFromHex(hex) {
  const raw = Buffer.from(String(hex || "").trim(), "hex");
  if (raw.length !== 32) throw new Error("Invalid Discord public key");
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return crypto.createPublicKey({
    key: Buffer.concat([prefix, raw]),
    format: "der",
    type: "spki"
  });
}

function verifyDiscord(rawBody, signature, timestamp, publicKeyHex) {
  if (!signature || !timestamp || !publicKeyHex) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  try {
    const key = publicKeyFromHex(publicKeyHex);
    const signed = Buffer.concat([Buffer.from(String(timestamp), "utf8"), rawBody]);
    return crypto.verify(null, signed, key, Buffer.from(String(signature), "hex"));
  } catch {
    return false;
  }
}

function perms(interaction) {
  try { return BigInt(String(interaction?.member?.permissions || "0")); }
  catch { return 0n; }
}

function hasManageGuild(interaction) {
  const p = perms(interaction);
  return (p & ADMINISTRATOR) === ADMINISTRATOR || (p & MANAGE_GUILD) === MANAGE_GUILD;
}

function allowedRoleIds() {
  return String(process.env.APP_ACCESS_ALLOWED_ROLE_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^\d{16,22}$/.test(v));
}

function hasAppAccess(interaction) {
  if (hasManageGuild(interaction)) return true;
  const allowed = allowedRoleIds();
  if (!allowed.length) return false;
  const roles = new Set(Array.isArray(interaction?.member?.roles) ? interaction.member.roles.map(String) : []);
  return allowed.some((id) => roles.has(id));
}

function guildMatches(interaction) {
  const expected = String(process.env.DISCORD_GUILD_ID || "").trim();
  return !expected || expected === String(interaction?.guild_id || "");
}

function signingKey() {
  const dedicated = String(process.env.APP_ACCESS_SIGNING_SECRET || "").trim();
  if (dedicated) return Buffer.from(dedicated, "utf8");
  const botToken = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  if (!botToken) throw new Error("Missing DISCORD_BOT_TOKEN");
  return crypto.createHmac("sha256", botToken)
    .update("1st-mi:tactical-centre:app-access:v1")
    .digest();
}

function lifetimeSeconds() {
  const requested = Number(process.env.APP_ACCESS_KEY_DAYS || "30");
  const days = Number.isFinite(requested) ? Math.max(1, Math.min(365, Math.floor(requested))) : 30;
  return days * 86400;
}

function generateKey(interaction) {
  const userId = String(interaction?.member?.user?.id || interaction?.user?.id || "");
  const guildId = String(interaction?.guild_id || "");
  if (!/^\d{16,22}$/.test(userId) || !/^\d{16,22}$/.test(guildId)) {
    throw new Error("Could not identify Discord user/server");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    u: userId,
    g: guildId,
    i: now,
    e: now + lifetimeSeconds(),
    n: crypto.randomBytes(12).toString("base64url")
  };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", signingKey()).update(body).digest("base64url");
  return { key: "1MI1." + body + "." + sig, expires: payload.e };
}

function panelData() {
  const count = allowedRoleIds().length;
  const rule = count
    ? "Access is controlled by " + count + " configured Discord role" + (count === 1 ? "." : "s.")
    : "Access roles are not configured yet. Only members with Manage Server/Administrator can generate a key.";

  return {
    embeds: [{
      title: "1st M.I. Tactical Centre — App Access",
      description:
        "Generate your personal Tactical Centre access key here.\\n\\n" +
        "The key is created by the bot, tied to your Discord account and this server, and shown only to you.",
      color: 5793266,
      fields: [
        { name: "Access Control", value: rule, inline: false },
        { name: "Key Lifetime", value: Math.floor(lifetimeSeconds() / 86400) + " day(s)", inline: true },
        { name: "Security", value: "The app can re-check your live Discord roles whenever the key is used.", inline: true }
      ],
      footer: { text: "1st M.I. Tactical Centre" }
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 3, custom_id: "mi_app_access_generate", label: "Generate Access Key", emoji: { name: "🔑" } },
        { type: 2, style: 2, custom_id: "mi_app_access_check", label: "Check My Access", emoji: { name: "🛡️" } }
      ]
    }],
    allowed_mentions: { parse: [] }
  };
}

function setupPanel(interaction) {
  if (!hasManageGuild(interaction)) {
    return ephemeral("You need **Manage Server** or **Administrator** to create this panel.");
  }

  const channelType = Number(interaction?.channel?.type);
  if (![10, 11, 12].includes(channelType)) {
    return ephemeral("Run **/setup-app-access-panel** inside the Discord thread where you want the permanent panel.");
  }

  return { type: 4, data: panelData() };
}

function checkAccess(interaction) {
  if (!guildMatches(interaction)) return ephemeral("This panel is not in the configured Tactical Centre server.");
  if (hasAppAccess(interaction)) return ephemeral("✅ You currently have Tactical Centre app access.");

  if (!allowedRoleIds().length) {
    return ephemeral("❌ App access roles are not configured yet. Set **APP_ACCESS_ALLOWED_ROLE_IDS** first.");
  }

  return ephemeral("❌ You do not currently have a Discord role that grants Tactical Centre app access.");
}

function generateAccess(interaction) {
  if (!guildMatches(interaction)) return ephemeral("This panel is not in the configured Tactical Centre server.");

  if (!hasAppAccess(interaction)) {
    if (!allowedRoleIds().length) {
      return ephemeral("❌ App access roles are not configured yet. Set **APP_ACCESS_ALLOWED_ROLE_IDS** first.");
    }
    return ephemeral("❌ You do not currently have a Discord role that is allowed to generate a Tactical Centre key.");
  }

  try {
    const generated = generateKey(interaction);
    return ephemeral(
      "🔑 **Your Tactical Centre access key**\\n" +
      "\`\`\`\\n" + generated.key + "\\n\`\`\`\\n" +
      "Expires: <t:" + generated.expires + ":F>\\n\\n" +
      "Keep this private. The desktop app will use it to verify your Discord access."
    );
  } catch (error) {
    return ephemeral("Could not generate an access key: " + (error?.message || "unknown error"));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  let rawBody;
  try { rawBody = await readRawBody(req); }
  catch { return sendJson(res, 400, { error: "Could not read request body" }); }

  const valid = verifyDiscord(
    rawBody,
    req.headers["x-signature-ed25519"],
    req.headers["x-signature-timestamp"],
    process.env.DISCORD_PUBLIC_KEY
  );

  if (!valid) return sendJson(res, 401, { error: "Invalid Discord interaction signature" });

  let interaction;
  try { interaction = JSON.parse(rawBody.toString("utf8")); }
  catch { return sendJson(res, 400, { error: "Invalid JSON" }); }

  if (interaction.type === 1) return sendJson(res, 200, { type: 1 });

  if (interaction.type === 2 && interaction?.data?.name === "setup-app-access-panel") {
    return sendJson(res, 200, setupPanel(interaction));
  }

  if (interaction.type === 3) {
    const id = String(interaction?.data?.custom_id || "");
    if (id === "mi_app_access_generate") return sendJson(res, 200, generateAccess(interaction));
    if (id === "mi_app_access_check") return sendJson(res, 200, checkAccess(interaction));
  }

  return sendJson(res, 200, ephemeral("Unsupported Tactical Centre interaction."));
}
