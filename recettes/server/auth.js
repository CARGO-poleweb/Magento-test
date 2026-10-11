// Comptes nommés, mots de passe hachés (scrypt), sessions en base révocables,
// limitation des tentatives de connexion.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const COOKIE = "gm_session";
const MAX_AGE_S = 60 * 60 * 24 * 180; // 180 jours sans activité
const ATTEMPTS = 6, WINDOW_MS = 15 * 60_000;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export function verifyPassword(password, stored) {
  const [algo, saltB, keyB] = String(stored || "").split("$");
  if (algo !== "scrypt" || !saltB || !keyB) return false;
  const key = Buffer.from(keyB, "base64url");
  const calc = scryptSync(String(password), Buffer.from(saltB, "base64url"), key.length, { N: 16384, r: 8, p: 1 });
  return calc.length === key.length && timingSafeEqual(calc, key);
}
export function passwordProblem(p) {
  if (typeof p !== "string" || p.length < 8) return "Le mot de passe doit faire au moins 8 caractères.";
  if (p.length > 200) return "Mot de passe trop long.";
  return null;
}
const tokenHash = (t) => createHash("sha256").update(String(t)).digest("base64url");
const parseCookies = (h) => Object.fromEntries((h || "").split(";").map((c) => c.trim().split("=").map((x) => { try { return decodeURIComponent(x); } catch { return x; } })).filter((p) => p[0]));

export function makeAuth(store) {
  const attempts = new Map(); // ip -> [timestamps]
  setInterval(() => { for (const [ip, ts] of attempts) if (!ts.some((t) => Date.now() - t < WINDOW_MS)) attempts.delete(ip); }, WINDOW_MS).unref();
  setInterval(() => store.purgeSessions(MAX_AGE_S * 1000), 6 * 3600_000).unref();

  const tooMany = (ip) => (attempts.get(ip) || []).filter((t) => Date.now() - t < WINDOW_MS).length >= ATTEMPTS;
  const recordFail = (ip) => attempts.set(ip, [...(attempts.get(ip) || []).filter((t) => Date.now() - t < WINDOW_MS), Date.now()]);

  function sessionOf(req) {
    if (req._session !== undefined) return req._session;
    const t = parseCookies(req.headers.cookie)[COOKIE];
    req._session = t ? store.getSession(tokenHash(t)) : null;
    return req._session;
  }
  return {
    needsSetup: () => store.countUsers() === 0,
    login(req, res, name, password) {
      const ip = req.ip || "?";
      if (tooMany(ip)) return { error: "Trop de tentatives. Réessaie dans un quart d'heure.", status: 429 };
      const u = store.getUserByName(name || "");
      if (!u || !verifyPassword(password || "", u.password_hash)) { recordFail(ip); return { error: "Nom ou mot de passe incorrect.", status: 401 }; }
      attempts.delete(ip);
      const token = randomBytes(32).toString("base64url");
      store.createSession(tokenHash(token), u.id, req.headers["user-agent"]);
      store.touchLogin(u.id);
      res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${req.secure ? "; Secure" : ""}`);
      return { user: store.getUser(u.id) };
    },
    logout(req, res) {
      const t = parseCookies(req.headers.cookie)[COOKIE];
      if (t) store.deleteSession(tokenHash(t));
      res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    },
    currentUser(req) { const s = sessionOf(req); return s ? { id: s.user_id, name: s.name, role: s.role } : null; },
    middleware: (req, res, next) => {
      const s = sessionOf(req);
      if (!s) return res.status(401).json({ error: "Connexion requise", code: "auth_required" });
      req.user = { id: s.user_id, name: s.name, role: s.role };
      next();
    },
    adminOnly: (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Réservé à l'administrateur." })),
  };
}
