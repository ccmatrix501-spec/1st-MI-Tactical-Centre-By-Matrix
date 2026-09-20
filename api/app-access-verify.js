import crypto from "node:crypto";

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
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

function allowedRoleIds() {
  return String(process.env.APP_ACCESS_ALLOWED_ROLE_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^\d{16,22}$/.test(v));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function decodeKey(accessKey) {
  const parts = String(accessKey || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "1MI1") {
    return { ok: false, error: "Invalid access key format." };
  }

  const body = parts[1];
  const sig = parts[2];
  const expected = crypto.createHmac("sha256", signingKey()).update(body).digest("base64url");

  if (!safeEqual(sig, expected)) {
    return { ok: false, error: "Invalid access key signature." };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid access key payload." };
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload?.v !== 1 ||
    !/^\d{16,22}$/.test(String(payload?.u || "")) ||
    !/^\d{16,22}$/.test(String(payload?.g || "")) ||
    !Number.isFinite(Number(payload?.e)) ||
    Number(payload.e) <= now
  ) {
    return { ok: false, error: "Access key is invalid or expired." };
  }

  const expectedGuild = String(process.env.DISCORD_GUILD_ID || "").trim();
  if (expectedGuild && expectedGuild !== String(payload.g)) {
    return { ok: false, error: "Access key belongs to a different Discord server." };
  }

  return { ok: true, payload };
}

async function discord(path, botToken) {
  const response = await fetch(DISCORD_API + path, {
    headers: { Authorization: "Bot " + botToken }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { message: text }; }

  return { ok: response.ok, status: response.status, data };
}

function adminByGuildRoles(member, roles, guildId) {
  const map = new Map(Array.isArray(roles) ? roles.map((r) => [String(r.id), r]) : []);
  let permissions = 0n;

  const everyone = map.get(String(guildId));
  if (everyone) {
    try { permissions |= BigInt(String(everyone.permissions || "0")); } catch {}
  }

  for (const roleId of Array.isArray(member?.roles) ? member.roles : []) {
    const role = map.get(String(roleId));
    if (!role) continue;
    try { permissions |= BigInt(String(role.permissions || "0")); } catch {}
  }

  return (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
    (permissions & MANAGE_GUILD) === MANAGE_GUILD;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const botToken = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  if (!botToken) {
    return res.status(500).json({ ok: false, error: "App access is not configured." });
  }

  let verified;
  try { verified = decodeKey(req.body?.key); }
  catch { return res.status(500).json({ ok: false, error: "App access verification is not configured." }); }

  if (!verified.ok) {
    return res.status(401).json({ ok: false, error: verified.error });
  }

  const userId = String(verified.payload.u);
  const guildId = String(verified.payload.g);

  const [memberRes, rolesRes] = await Promise.all([
    discord("/guilds/" + encodeURIComponent(guildId) + "/members/" + encodeURIComponent(userId), botToken),
    discord("/guilds/" + encodeURIComponent(guildId) + "/roles", botToken)
  ]);

  if (!memberRes.ok) {
    return res.status(403).json({
      ok: false,
      error: "Discord membership could not be verified."
    });
  }

  const required = allowedRoleIds();
  const memberRoles = new Set(Array.isArray(memberRes.data?.roles) ? memberRes.data.roles.map(String) : []);
  const roleAccess = required.some((roleId) => memberRoles.has(roleId));
  const adminAccess = rolesRes.ok ? adminByGuildRoles(memberRes.data, rolesRes.data, guildId) : false;

  if (!roleAccess && !adminAccess) {
    return res.status(403).json({
      ok: false,
      error: required.length
        ? "Your Discord roles no longer grant Tactical Centre access."
        : "Tactical Centre access roles have not been configured."
    });
  }

  return res.status(200).json({
    ok: true,
    user_id: userId,
    guild_id: guildId,
    expires_at: Number(verified.payload.e),
    access_source: roleAccess ? "role" : "discord_admin"
  });
}
