import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export const uid = () => randomBytes(6).toString("base64url") + Date.now().toString(36);

export function openDb(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT DEFAULT '', image TEXT DEFAULT '',
      category TEXT DEFAULT '', servings INTEGER NOT NULL DEFAULT 4,
      ingredients TEXT NOT NULL DEFAULT '[]', notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, qty REAL, unit TEXT DEFAULT '',
      checked INTEGER NOT NULL DEFAULT 0, src TEXT NOT NULL DEFAULT 'manual',
      recipes TEXT NOT NULL DEFAULT '[]', position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', created_at INTEGER NOT NULL, last_login INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, user_agent TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, method TEXT NOT NULL,
      ok INTEGER NOT NULL, message TEXT DEFAULT '', created_at INTEGER NOT NULL
    );
  `);
  return new Store(db);
}

const rowRecipe = (r) => r && { ...r, ingredients: JSON.parse(r.ingredients) };
const rowItem = (r) => r && { ...r, checked: !!r.checked, recipes: JSON.parse(r.recipes) };

export class Store {
  constructor(db) { this.db = db; }
  transaction(fn) {
    this.db.exec("BEGIN");
    try { const v = fn(); this.db.exec("COMMIT"); return v; }
    catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  // ----- kv -----
  getKv(key, fallback = null) {
    const r = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(key);
    return r ? JSON.parse(r.value) : fallback;
  }
  setKv(key, value) {
    this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, JSON.stringify(value));
  }
  bump() { const v = (this.getKv("version", 0) | 0) + 1; this.setKv("version", v); return v; }
  version() { return this.getKv("version", 0); }

  // ----- recipes -----
  listRecipes() { return this.db.prepare("SELECT * FROM recipes ORDER BY created_at DESC").all().map(rowRecipe); }
  getRecipe(id) { return rowRecipe(this.db.prepare("SELECT * FROM recipes WHERE id = ?").get(id)); }
  saveRecipe(r) {
    const now = Date.now();
    const prev = r.id ? this.getRecipe(r.id) : null;
    const rec = {
      id: r.id || uid(), title: r.title, url: r.url || "", image: r.image || "", category: r.category || "",
      servings: Math.max(1, r.servings | 0 || 4), ingredients: JSON.stringify(r.ingredients || []),
      notes: r.notes || "", created_at: prev?.created_at || now, updated_at: now,
    };
    this.db.prepare(`INSERT INTO recipes (id, title, url, image, category, servings, ingredients, notes, created_at, updated_at)
      VALUES (@id, @title, @url, @image, @category, @servings, @ingredients, @notes, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, url=excluded.url, image=excluded.image, category=excluded.category,
      servings=excluded.servings, ingredients=excluded.ingredients, notes=excluded.notes, updated_at=excluded.updated_at`).run(rec);
    if (rec.category) this.ensureCategory(rec.category);
    return this.getRecipe(rec.id);
  }
  deleteRecipe(id) { return this.db.prepare("DELETE FROM recipes WHERE id = ?").run(id).changes > 0; }

  // ----- categories -----
  listCategories() { return this.db.prepare("SELECT * FROM categories ORDER BY position, name").all(); }
  ensureCategory(name) {
    name = String(name).trim(); if (!name) return null;
    const ex = this.db.prepare("SELECT * FROM categories WHERE name = ? COLLATE NOCASE").get(name);
    if (ex) return ex;
    const pos = (this.db.prepare("SELECT COALESCE(MAX(position), 0) AS m FROM categories").get().m | 0) + 1;
    const c = { id: uid(), name, position: pos };
    this.db.prepare("INSERT INTO categories (id, name, position) VALUES (?, ?, ?)").run(c.id, c.name, c.position);
    return c;
  }
  renameCategory(id, name) {
    const c = this.db.prepare("SELECT * FROM categories WHERE id = ?").get(id); if (!c) return null;
    name = String(name).trim(); if (!name) return c;
    return this.transaction(() => {
      this.db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
      this.db.prepare("UPDATE recipes SET category = ?, updated_at = ? WHERE category = ?").run(name, Date.now(), c.name);
      return { ...c, name };
    });
  }
  deleteCategory(id) {
    const c = this.db.prepare("SELECT * FROM categories WHERE id = ?").get(id); if (!c) return false;
    this.transaction(() => {
      this.db.prepare("DELETE FROM categories WHERE id = ?").run(id);
      this.db.prepare("UPDATE recipes SET category = '', updated_at = ? WHERE category = ?").run(Date.now(), c.name);
    });
    return true;
  }
  reorderCategories(ids) {
    const st = this.db.prepare("UPDATE categories SET position = ? WHERE id = ?");
    this.transaction(() => ids.forEach((id, i) => st.run(i + 1, id)));
  }

  // ----- shopping -----
  listItems() { return this.db.prepare("SELECT * FROM shopping_items ORDER BY checked, position, name").all().map(rowItem); }
  getItem(id) { return rowItem(this.db.prepare("SELECT * FROM shopping_items WHERE id = ?").get(id)); }
  addItem(it) {
    const now = Date.now();
    const pos = it.position ?? (this.db.prepare("SELECT COALESCE(MAX(position), 0) AS m FROM shopping_items").get().m | 0) + 1;
    const row = { id: uid(), name: String(it.name).trim(), qty: it.qty ?? null, unit: it.unit || "", checked: it.checked ? 1 : 0,
      src: it.src || "manual", recipes: JSON.stringify(it.recipes || []), position: pos, created_at: now, updated_at: now };
    this.db.prepare(`INSERT INTO shopping_items (id, name, qty, unit, checked, src, recipes, position, created_at, updated_at)
      VALUES (@id, @name, @qty, @unit, @checked, @src, @recipes, @position, @created_at, @updated_at)`).run(row);
    return this.getItem(row.id);
  }
  updateItem(id, patch) {
    const cur = this.getItem(id); if (!cur) return null;
    const next = { ...cur, ...patch, updated_at: Date.now() };
    this.db.prepare("UPDATE shopping_items SET name = ?, qty = ?, unit = ?, checked = ?, position = ?, updated_at = ? WHERE id = ?")
      .run(String(next.name).trim(), next.qty ?? null, next.unit || "", next.checked ? 1 : 0, next.position | 0, next.updated_at, id);
    return this.getItem(id);
  }
  deleteItem(id) { return this.db.prepare("DELETE FROM shopping_items WHERE id = ?").run(id).changes > 0; }
  deleteItemsWhere(where, ...args) { return this.db.prepare("DELETE FROM shopping_items " + where).run(...args).changes; }
  replaceRecipeItems(items, sources) {
    return this.transaction(() => {
      this.deleteItemsWhere("WHERE src = 'recipe'");
      items.forEach((it, i) => this.addItem({ ...it, src: "recipe", position: i + 1 }));
      this.setKv("shopping_meta", { sources, generatedAt: Date.now() });
      return this.listItems();
    });
  }

  // ----- utilisateurs & sessions -----
  countUsers() { return this.db.prepare("SELECT COUNT(*) AS n FROM users").get().n; }
  listUsers() { return this.db.prepare("SELECT id, name, role, created_at, last_login FROM users ORDER BY created_at").all(); }
  getUser(id) { return this.db.prepare("SELECT id, name, role, created_at, last_login FROM users WHERE id = ?").get(id) || null; }
  getUserByName(name) { return this.db.prepare("SELECT * FROM users WHERE name = ? COLLATE NOCASE").get(String(name).trim()) || null; }
  createUser({ name, passwordHash, role = "member" }) {
    const u = { id: uid(), name: String(name).trim(), password_hash: passwordHash, role, created_at: Date.now() };
    this.db.prepare("INSERT INTO users (id, name, password_hash, role, created_at) VALUES (@id, @name, @password_hash, @role, @created_at)").run(u);
    return this.getUser(u.id);
  }
  setPassword(id, passwordHash) { this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id); }
  touchLogin(id) { this.db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(Date.now(), id); }
  deleteUser(id) { return this.db.prepare("DELETE FROM users WHERE id = ?").run(id).changes > 0; }
  createSession(tokenHash, userId, userAgent) {
    const now = Date.now();
    this.db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, last_seen, user_agent) VALUES (?, ?, ?, ?, ?)").run(tokenHash, userId, now, now, String(userAgent || "").slice(0, 200));
  }
  getSession(tokenHash) {
    const s = this.db.prepare("SELECT s.*, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE token_hash = ?").get(tokenHash);
    if (s && Date.now() - s.last_seen > 60_000) this.db.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ?").run(Date.now(), tokenHash);
    return s || null;
  }
  deleteSession(tokenHash) { this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash); }
  deleteUserSessions(userId) { this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId); }
  purgeSessions(maxAgeMs) { this.db.prepare("DELETE FROM sessions WHERE last_seen < ?").run(Date.now() - maxAgeMs); }

  // ----- log -----
  logImport(url, method, ok, message = "") {
    this.db.prepare("INSERT INTO import_log (url, method, ok, message, created_at) VALUES (?, ?, ?, ?, ?)").run(url, method, ok ? 1 : 0, message, Date.now());
    this.db.exec("DELETE FROM import_log WHERE id NOT IN (SELECT id FROM import_log ORDER BY id DESC LIMIT 200)");
  }
  listImports() { return this.db.prepare("SELECT * FROM import_log ORDER BY id DESC LIMIT 50").all().map((r) => ({ ...r, ok: !!r.ok })); }

  // ----- snapshot -----
  snapshot() {
    return {
      version: this.version(),
      recipes: this.listRecipes(),
      categories: this.listCategories(),
      items: this.listItems(),
      shoppingMeta: this.getKv("shopping_meta", null),
    };
  }
  exportAll() { return { exportedAt: new Date().toISOString(), ...this.snapshot() }; }
  importAll(data) {
    this.transaction(() => {
      for (const c of data.categories || []) this.ensureCategory(c.name);
      for (const r of data.recipes || []) this.saveRecipe(r);
    });
  }
}
