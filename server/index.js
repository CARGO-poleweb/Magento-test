import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "./db.js";
import { makeAuth } from "./auth.js";
import { claudeAvailable } from "./extract.js";
import { createApp } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// .env minimal (sans dépendance)
const envFile = join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = Number(process.env.PORT || 3000);
const store = openDb(process.env.DB_PATH || join(root, "data", "garde-manger.db"));
const auth = makeAuth(store);
const app = createApp({ store, auth });

app.listen(PORT, () => {
  console.log(`Le Garde-Manger écoute sur http://localhost:${PORT}  (Claude : ${claudeAvailable() ? "activé, " + (process.env.CLAUDE_MODEL || "claude-opus-5-5") : "désactivé, pas de clé API"})`);
});
