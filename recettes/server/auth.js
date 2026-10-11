import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "gm_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 jours

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeAuth({ password, secret }) {
  if (!password) throw new Error("APP_PASSWORD manquant : définis-le dans .env");
  if (!secret) throw new Error("SESSION_SECRET manquant : définis-le dans .env");

  const token = () => {
    const payload = String(Date.now());
    return payload + "." + sign(payload + "|" + password, secret);
  };
  const valid = (t) => {
    if (!t) return false;
    const [payload, sig] = String(t).split(".");
    if (!payload || !sig) return false;
    const expected = sign(payload + "|" + password, secret);
    if (expected.length !== sig.length) return false;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
    return Date.now() - Number(payload) < MAX_AGE * 1000;
  };
  const parseCookies = (h) => Object.fromEntries((h || "").split(";").map((c) => c.trim().split("=").map(decodeURIComponent)).filter((p) => p[0]));

  return {
    checkPassword: (p) => {
      const a = Buffer.from(String(p || "")), b = Buffer.from(password);
      return a.length === b.length && timingSafeEqual(a, b);
    },
    setCookie(res, secure) {
      res.setHeader("Set-Cookie", `${COOKIE}=${token()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? "; Secure" : ""}`);
    },
    clearCookie(res) { res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); },
    isAuthed: (req) => valid(parseCookies(req.headers.cookie)[COOKIE]),
    middleware: (req, res, next) => {
      if (valid(parseCookies(req.headers.cookie)[COOKIE])) return next();
      res.status(401).json({ error: "Connexion requise" });
    },
  };
}
