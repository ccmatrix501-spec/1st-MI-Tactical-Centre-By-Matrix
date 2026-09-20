import crypto from "node:crypto";

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;
const VIEW_CHANNEL = 1n << 10n;

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
    !/^\d{16,22}$/.test(String(payload?.c || "")) ||
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

function bits(value) {
  try { return BigInt(String(value || "0")); }
  catch { return 0n; }
}

function guildPermissions(member, roles, guildId) {
  const roleMap = new Map(Array.isArray(roles) ? roles.map((r) => [String(r.id), r]) : []);
  let permissions = bits(roleMap.get(String(guildId))?.permissions);

  const memberRoleIds = new Set(Array.isArray(member?.roles) ? member.roles.map(String) : []);
  for (const roleId of memberRoleIds) {
    permissions |= bits(roleMap.get(roleId)?.permissions);
  }

  return permissions;
}

function isAdmin(member, roles, guildId) {
  const p = guildPermissions(member, roles, guildId);
  return (p & ADMINISTRATOR) === ADMINISTRATOR || (p & MANAGE_GUILD) === MANAGE_GUILD;
}

function channelPermissions(channel, guildId, member, roles) {
  let permissions = guildPermissions(member, roles, guildId);

  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) {
    return (1n << 63n) - 1n;
  }

  const memberRoleIds = new Set(Array.isArray(member?.roles) ? member.roles.map(String) : []);
  const overwrites = Array.isArray(channel?.permission_overwrites) ? channel.permission_overwrites : [];

  const everyone = overwrites.find((o) => String(o.id) === String(guildId) && Number(o.type) === 0);
  if (everyone) {
    permissions &= ~bits(everyone.deny);
    permissions |= bits(everyone.allow);
  }

  let roleDeny = 0n;
  let roleAllow = 0n;
  for (const overwrite of overwrites) {
    if (Number(overwrite.type) !== 0 || !memberRoleIds.has(String(overwrite.id))) continue;
    roleDeny |= bits(overwrite.deny);
    roleAllow |= bits(overwrite.allow);
  }

  permissions &= ~roleDeny;
  permissions |= roleAllow;

  const userId = String(member?.user?.id || "");
  const memberOverwrite = overwrites.find(
    (o) => String(o.id) === userId && Number(o.type) === 1
  );

  if (memberOverwrite) {
    permissions &= ~bits(memberOverwrite.deny);
    permissions |= bits(memberOverwrite.allow);
  }

  return permissions;
}

async function hasThreadAccess(threadId, guildId, userId, member, roles, botToken) {
  if (isAdmin(member, roles, guildId)) return true;

  const threadRes = await discord("/channels/" + encodeURIComponent(threadId), botToken);
  if (!threadRes.ok || String(threadRes.data?.guild_id || "") !== String(guildId)) {
    return false;
  }

  const type = Number(threadRes.data?.type);
  if (![10, 11, 12].includes(type)) return false;

  if (type === 12) {
    const membership = await discord(
      "/channels/" + encodeURIComponent(threadId) + "/thread-members/" + encodeURIComponent(userId),
      botToken
    );
    return membership.ok;
  }

  const parentId = String(threadRes.data?.parent_id || "");
  if (!/^\d{16,22}$/.test(parentId)) return false;

  const channelsRes = await discord("/guilds/" + encodeURIComponent(guildId) + "/channels", botToken);
  if (!channelsRes.ok || !Array.isArray(channelsRes.data)) return false;

  const parent = channelsRes.data.find((channel) => String(channel.id) === parentId);
  if (!parent) return false;

  const permissions = channelPermissions(parent, guildId, member, roles);
  return (permissions & VIEW_CHANNEL) === VIEW_CHANNEL;
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
  const threadId = String(verified.payload.c);

  const [memberRes, rolesRes] = await Promise.all([
    discord("/guilds/" + encodeURIComponent(guildId) + "/members/" + encodeURIComponent(userId), botToken),
    discord("/guilds/" + encodeURIComponent(guildId) + "/roles", botToken)
  ]);

  if (!memberRes.ok || !rolesRes.ok || !Array.isArray(rolesRes.data)) {
    return res.status(403).json({
      ok: false,
      error: "Discord membership or roles could not be verified."
    });
  }

  const requiredRoles = allowedRoleIds();
  const memberRoles = new Set(Array.isArray(memberRes.data?.roles) ? memberRes.data.roles.map(String) : []);
  const adminAccess = isAdmin(memberRes.data, rolesRes.data, guildId);

  let granted = false;
  let source = null;

  if (requiredRoles.length) {
    const roleAccess = requiredRoles.some((roleId) => memberRoles.has(roleId));
    granted = roleAccess || adminAccess;
    source = roleAccess ? "role" : (adminAccess ? "discord_admin" : null);
  } else {
    const threadAccess = await hasThreadAccess(
      threadId,
      guildId,
      userId,
      memberRes.data,
      rolesRes.data,
      botToken
    );
    granted = threadAccess || adminAccess;
    source = threadAccess ? "thread" : (adminAccess ? "discord_admin" : null);
  }

  if (!granted) {
    return res.status(403).json({
      ok: false,
      error: requiredRoles.length
        ? "Your Discord roles no longer grant Tactical Centre access."
        : "You no longer have access to the Discord thread that issued this key."
    });
  }

  return res.status(200).json({
    ok: true,
    user_id: userId,
    guild_id: guildId,
    thread_id: threadId,
    expires_at: Number(verified.payload.e),
    access_source: source
  });
}
