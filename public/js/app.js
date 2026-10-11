import { parseIngredientLine, ingredientToLine, scaleIngredient, fmtQty, norm } from "./ingredients.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pluralPersons = (n) => n + (n > 1 ? " personnes" : " personne");

// ---------- État ----------
const S = {
  tab: "recipes", sub: "cats", filter: "all", query: "",
  recipes: [], categories: [], items: [], shoppingMeta: null, version: 0,
  selection: {}, openCards: new Set(), editingId: null, claude: false, extracted: null,
};
try { const s = JSON.parse(localStorage.getItem("gm.sel") || "{}"); if (s && typeof s === "object") S.selection = s; } catch {}
try { const t = localStorage.getItem("gm.tab"); if (t) S.tab = t; } catch {}
const saveSel = () => { try { localStorage.setItem("gm.sel", JSON.stringify(S.selection)); } catch {} };

// ---------- API ----------
class ApiError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.code === "auth_required") { const me = await fetch("/api/me").then((r) => r.json()).catch(() => ({})); showLogin(!!me.needsSetup); throw new ApiError("Connexion requise", 401); }
  if (!res.ok) throw new ApiError(data.error || "Erreur serveur", res.status, data.code);
  return data;
}
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400); };
async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r ?? true; }
  catch (e) { if (e.status !== 401) toast(e.message || "Échec, réessaie."); return false; }
}

// ---------- Connexion ----------
function showLogin(needsSetup = false) {
  $("#login").hidden = false; $("#app").hidden = true;
  $("#form-login").hidden = needsSetup; $("#form-setup").hidden = !needsSetup;
  (needsSetup ? $("#s-name") : $("#l-name")).focus();
}
$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-status").textContent = "";
  try { await api("/api/login", { method: "POST", body: { name: $("#l-name").value, password: $("#l-pass").value } }); $("#l-pass").value = ""; await boot(); }
  catch (err) { $("#login-status").textContent = err.message; }
});
$("#form-setup").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#setup-status").textContent = "";
  try { await api("/api/setup", { method: "POST", body: { name: $("#s-name").value, password: $("#s-pass").value } }); $("#s-pass").value = ""; await boot(); }
  catch (err) { $("#setup-status").textContent = err.message; }
});
$("#btn-logout").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); es?.close(); location.reload(); });
$("#btn-logout-all").addEventListener("click", async () => {
  if (!(await confirmDlg("Déconnecter tous tes appareils ?", "Il faudra te reconnecter partout, y compris ici.", "Déconnecter"))) return;
  await api("/api/account/logout-all", { method: "POST" }).catch(() => {}); es?.close(); location.reload();
});

// ---------- Synchro ----------
let es = null;
async function refresh() {
  const st = await api("/api/state");
  Object.assign(S, { recipes: st.recipes, categories: st.categories, items: st.items, shoppingMeta: st.shoppingMeta, version: st.version });
  renderAll();
}
function connectEvents() {
  es?.close();
  es = new EventSource("/api/events");
  const sync = $("#sync");
  es.addEventListener("hello", () => { sync.textContent = "synchronisé"; sync.className = "sync on"; });
  es.addEventListener("change", (ev) => { const v = JSON.parse(ev.data).version; if (v !== S.version) refresh().catch(() => {}); });
  es.onerror = () => { sync.textContent = "reconnexion…"; sync.className = "sync off"; };
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#app").hidden) refresh().catch(() => {}); });

async function boot() {
  const me = await api("/api/me");
  S.claude = me.claude; S.user = me.user;
  if (!me.authed) return showLogin(me.needsSetup);
  $("#login").hidden = true; $("#app").hidden = false;
  $("#acc-name").textContent = me.user.name;
  $("#acc-role").textContent = me.user.role === "admin" ? "Administrateur : tu peux créer les comptes des autres dans l'onglet « Comptes »." : "Membre.";
  $$("[data-admin]").forEach((el) => (el.hidden = me.user.role !== "admin"));
  $("#share-url").value = location.origin;
  renderInstallHelp();
  await refresh();
  connectEvents();
  setTab(S.tab);
}

// ---------- Onglets ----------
function setTab(tab) {
  S.tab = tab;
  try { localStorage.setItem("gm.tab", tab); } catch {}
  $$("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== tab));
  $$("[role=tab][data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  renderSelbar();
  if (tab === "settings" && S.sub === "status") loadStatus();
  if (tab === "settings" && S.sub === "users") loadUsers();
}
$$("[role=tab][data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
$("#btn-goto-recipes").addEventListener("click", () => setTab("recipes"));
$$("[data-sub]").forEach((b) => b.addEventListener("click", () => {
  S.sub = b.dataset.sub;
  $$("[data-sub]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  $$("[data-sub-view]").forEach((v) => (v.hidden = v.dataset.subView !== S.sub));
  if (S.sub === "status") loadStatus();
  if (S.sub === "users") loadUsers();
}));

// ---------- Confirmation ----------
function confirmDlg(title, text, yesLabel = "Confirmer", altLabel = null, yesClass = "btn danger") {
  return new Promise((res) => {
    const d = $("#dlg-confirm");
    $("#confirm-title").textContent = title; $("#confirm-text").textContent = text; $("#confirm-yes").textContent = yesLabel; $("#confirm-yes").className = yesClass;
    const alt = $("#confirm-alt"); alt.hidden = !altLabel; if (altLabel) alt.textContent = altLabel;
    const done = (v) => { d.onclose = null; d.close(); res(v); };
    $("#confirm-yes").onclick = () => done(true); $("#confirm-no").onclick = () => done(false); alt.onclick = () => done("alt");
    d.onclose = () => res(false);
    d.showModal();
  });
}

// ---------- Recettes ----------
function allCategories() {
  const used = S.recipes.map((r) => r.category).filter(Boolean);
  return [...new Set([...S.categories.map((c) => c.name), ...used])];
}
function renderChips() {
  const all = allCategories();
  if (S.filter !== "all" && !all.includes(S.filter)) S.filter = "all";
  $("#chips").innerHTML = [["all", "Toutes"], ...all.map((c) => [c, c])].map(([v, l]) =>
    `<button class="chip" data-cat="${esc(v)}" aria-pressed="${String(S.filter === v)}">${esc(l)}</button>`).join("");
  $$("#chips .chip").forEach((b) => b.addEventListener("click", () => { S.filter = b.dataset.cat; renderRecipes(); }));
  $("#cat-options").innerHTML = all.map((c) => `<option value="${esc(c)}">`).join("");
}
function renderRecipes() {
  renderChips();
  const q = norm(S.query);
  const list = S.recipes
    .filter((r) => S.filter === "all" || r.category === S.filter)
    .filter((r) => !q || norm(r.title).includes(q) || (r.ingredients || []).some((i) => norm(i.name).includes(q)));
  const n = S.recipes.length;
  $("#recipes-count").textContent = n === 0 ? "Aucune recette pour l'instant" : `${n} recette${n > 1 ? "s" : ""}${list.length !== n ? ` · ${list.length} affichée${list.length > 1 ? "s" : ""}` : ""} · coche celles à cuisiner`;
  const box = $("#recipes");
  if (!n) {
    box.innerHTML = `<div class="empty"><h3>Le carnet est vide</h3><p>Trouve une recette sur Internet, colle son lien ici : le serveur en extrait les ingrédients. Vous la retrouverez tous les deux, sur tous vos appareils.</p><button class="btn primary" id="btn-add-empty">+ Ajouter la première recette</button></div>`;
    $("#btn-add-empty").addEventListener("click", openAdd);
    renderSelbar(); return;
  }
  if (!list.length) { box.innerHTML = `<div class="empty"><p>Aucune recette ne correspond.</p></div>`; renderSelbar(); return; }
  box.innerHTML = list.map((r) => {
    const sel = S.selection[r.id] != null;
    const persons = S.selection[r.id] ?? r.servings ?? 4;
    let host = ""; try { host = r.url ? new URL(r.url).hostname.replace(/^www\./, "") : ""; } catch {}
    const ingr = r.ingredients || [];
    return `<article class="card ${sel ? "selected" : ""} ${S.openCards.has(r.id) ? "open" : ""}" data-id="${esc(r.id)}">
      <input type="checkbox" class="pick" aria-label="Sélectionner ${esc(r.title)}" ${sel ? "checked" : ""}>
      <div class="body">
        <h3>${esc(r.title)}</h3>
        <div class="meta">
          ${r.category ? `<span class="cat">${esc(r.category)}</span>` : ""}
          <span>${pluralPersons(r.servings || 1)} à l'origine</span>
          <span>${ingr.length} ingrédient${ingr.length > 1 ? "s" : ""}</span>
          ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(host || "lien")} ↗</a>` : ""}
        </div>
      </div>
      ${r.image ? `<img class="thumb" src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "<span></span>"}
      <div class="row2">
        <div class="stepper" aria-label="Nombre de personnes">
          <button type="button" data-act="minus" aria-label="Moins">−</button>
          <output>${persons} <small>pers.</small></output>
          <button type="button" data-act="plus" aria-label="Plus">+</button>
        </div>
        <div class="acts">
          <button class="iconbtn" data-act="toggle" aria-label="Voir les ingrédients" title="Ingrédients"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>
          <button class="iconbtn" data-act="edit" aria-label="Modifier" title="Modifier"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button class="iconbtn" data-act="del" aria-label="Supprimer" title="Supprimer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
        </div>
      </div>
      <div class="ingr-preview">Ingrédients pour ${pluralPersons(persons)} :<ul>${ingr.map((i) => `<li>${esc(ingredientToLine(scaleIngredient(i, persons, r.servings)))}</li>`).join("")}</ul>${r.notes ? `<p style="margin:6px 0 0"><em>${esc(r.notes)}</em></p>` : ""}</div>
    </article>`;
  }).join("");
  renderSelbar();
}
$("#search").addEventListener("input", (e) => { S.query = e.target.value; renderRecipes(); });
$("#recipes").addEventListener("click", async (e) => {
  const card = e.target.closest(".card"); if (!card) return;
  const id = card.dataset.id; const r = S.recipes.find((x) => x.id === id); if (!r) return;
  const act_ = e.target.closest("[data-act]")?.dataset.act;
  if (e.target.classList.contains("pick")) {
    if (e.target.checked) S.selection[id] = S.selection[id] ?? (r.servings || 4); else delete S.selection[id];
    saveSel(); renderRecipes(); return;
  }
  if (act_ === "minus" || act_ === "plus") {
    const cur = S.selection[id] ?? r.servings ?? 4;
    S.selection[id] = Math.max(1, cur + (act_ === "plus" ? 1 : -1));
    saveSel(); renderRecipes(); return;
  }
  if (act_ === "toggle") { S.openCards.has(id) ? S.openCards.delete(id) : S.openCards.add(id); card.classList.toggle("open"); return; }
  if (act_ === "edit") { openEdit(r); return; }
  if (act_ === "del") {
    if (!(await confirmDlg("Supprimer la recette ?", `« ${r.title} » sera retirée du carnet pour vous deux.`, "Supprimer"))) return;
    delete S.selection[id]; saveSel();
    await act(() => api("/api/recipes/" + id, { method: "DELETE" }), "Recette supprimée");
  }
});
function renderSelbar() {
  const ids = Object.keys(S.selection).filter((id) => S.recipes.some((r) => r.id === id));
  Object.keys(S.selection).forEach((id) => { if (!ids.includes(id) && S.recipes.length) delete S.selection[id]; });
  $("#selbar").hidden = !(S.tab === "recipes" && ids.length);
  if (!ids.length) return;
  const tot = ids.reduce((a, id) => a + S.selection[id], 0);
  $("#sel-count").textContent = `${ids.length} recette${ids.length > 1 ? "s" : ""} sélectionnée${ids.length > 1 ? "s" : ""}`;
  $("#sel-detail").textContent = ids.map((id) => `${S.recipes.find((r) => r.id === id).title} ×${S.selection[id]}`).join(" · ") + ` (${tot} couverts)`;
}
$("#btn-unselect").addEventListener("click", () => { S.selection = {}; saveSel(); renderRecipes(); });
$("#btn-generate").addEventListener("click", async () => {
  const selection = Object.entries(S.selection).filter(([id]) => S.recipes.some((r) => r.id === id)).map(([recipeId, persons]) => ({ recipeId, persons }));
  if (!selection.length) return;
  let mode = "add";
  if (S.items.length) {
    const r = await confirmDlg("La liste contient déjà des articles",
      `Ajouter les ingrédients de ${selection.length > 1 ? "ces recettes" : "cette recette"} à la liste actuelle (les quantités d'un même ingrédient s'additionnent), ou repartir d'une liste neuve ? Les articles saisis à la main sont conservés dans les deux cas.`,
      "Ajouter à la liste", "Remplacer la liste", "btn primary");
    if (!r) return; if (r === "alt") mode = "replace";
  }
  const btn = $("#btn-generate"); btn.disabled = true; btn.textContent = "Ajout…";
  const r = await act(() => api("/api/shopping/generate", { method: "POST", body: { selection, mode } }));
  btn.disabled = false; btn.textContent = "Ajouter aux courses";
  if (r) { S.selection = {}; saveSel(); toast(mode === "add" ? `${r.count} ingrédient${r.count > 1 ? "s" : ""} ajouté${r.count > 1 ? "s" : ""} aux courses` : `Liste générée : ${r.count} articles`); await refresh(); setTab("list"); }
});

// ---------- Liste de courses ----------
let listRenderPending = false;
function renderList() {
  const body = $("#list-body");
  const ae = document.activeElement;
  if (body.contains(ae) && ae.tagName === "INPUT" && ae.type !== "checkbox") { listRenderPending = true; return; }
  listRenderPending = false;
  const items = S.items.slice().sort((a, b) => (a.checked - b.checked) || (a.position - b.position) || norm(a.name).localeCompare(norm(b.name)));
  const todo = items.filter((i) => !i.checked), done = items.filter((i) => i.checked);
  $$("[data-badge]").forEach((b) => { b.hidden = !todo.length; b.textContent = todo.length; });
  const m = S.shoppingMeta;
  $("#listmeta").innerHTML = m && m.sources?.length
    ? `<span>Dernier ajout le ${new Date(m.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${new Date(m.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} pour :</span>` + m.sources.map((s) => `<span class="src">${esc(s.title)} · ${s.persons} pers.</span>`).join("")
    : "";
  $("#listacts").hidden = !items.length;
  $("#btn-clear-done").disabled = !done.length;
  if (!items.length) {
    body.innerHTML = `<div class="empty"><h3>Rien à acheter pour l'instant</h3><p>Coche des recettes dans l'onglet Recettes, règle le nombre de personnes et génère la liste. Tu peux aussi ajouter des articles à la main ci-dessus.</p></div>`;
    return;
  }
  const row = (i) => `<li class="${i.checked ? "done" : ""}" data-id="${esc(i.id)}">
    <input type="checkbox" ${i.checked ? "checked" : ""} aria-label="Acheté : ${esc(i.name)}">
    <div class="fields">
      <input class="n" value="${esc(i.name)}" aria-label="Nom" id="n-${esc(i.id)}">
      <input class="q" value="${esc([fmtQty(i.qty), i.unit].filter(Boolean).join(" "))}" placeholder="qté" aria-label="Quantité" id="q-${esc(i.id)}">
    </div>
    <button class="iconbtn" data-act="del" aria-label="Retirer ${esc(i.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    ${i.src === "recipe" && i.recipes?.length ? `<div class="from">${esc(i.recipes.join(", "))}</div>` : ""}
  </li>`;
  body.innerHTML = `<div class="group-title">À acheter · ${todo.length}</div><ul class="items">${todo.map(row).join("") || `<li><div class="fields" style="grid-column:1/-1;color:var(--muted)">Tout est dans le panier.</div></li>`}</ul>`
    + (done.length ? `<div class="group-title">Dans le panier · ${done.length}</div><ul class="items">${done.map(row).join("")}</ul>` : "");
}
$("#list-body").addEventListener("change", async (e) => {
  const li = e.target.closest("li[data-id]"); if (!li) return;
  const id = li.dataset.id; const it = S.items.find((x) => x.id === id); if (!it) return;
  const patch = (body) => act(() => api("/api/shopping/items/" + id, { method: "PATCH", body }));
  if (e.target.type === "checkbox") { it.checked = e.target.checked; renderList(); await patch({ checked: e.target.checked }); return; }
  if (e.target.classList.contains("n")) { const v = e.target.value.trim(); if (v && v !== it.name) await patch({ name: v }); return; }
  if (e.target.classList.contains("q")) await patch({ qtyText: e.target.value });
});
$("#list-body").addEventListener("focusout", () => { if (listRenderPending) setTimeout(() => { if (!$("#list-body").contains(document.activeElement)) renderList(); }, 50); });
$("#list-body").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); e.target.blur(); } });
$("#list-body").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act=del]"); if (!b) return;
  await act(() => api("/api/shopping/items/" + b.closest("li").dataset.id, { method: "DELETE" }));
});
$("#form-additem").addEventListener("submit", async (e) => {
  e.preventDefault();
  const inp = $("#additem"); if (!inp.value.trim()) return;
  if (await act(() => api("/api/shopping/items", { method: "POST", body: { line: inp.value } }))) inp.value = "";
});
$("#btn-clear-done").addEventListener("click", () => act(() => api("/api/shopping/clear", { method: "POST", body: { onlyChecked: true } }), "Articles cochés retirés"));
$("#btn-clear-all").addEventListener("click", async () => {
  if (!S.items.length) return;
  if (!(await confirmDlg("Vider la liste ?", "Tous les articles seront supprimés pour vous deux.", "Vider"))) return;
  await act(() => api("/api/shopping/clear", { method: "POST", body: {} }), "Liste vidée");
});

// ---------- Catégories ----------
function renderCats() {
  const counts = {}; S.recipes.forEach((r) => { if (r.category) counts[r.category] = (counts[r.category] || 0) + 1; });
  const cats = S.categories;
  $("#catlist").innerHTML = cats.length ? cats.map((c, i) => `<li data-id="${esc(c.id)}">
      <input value="${esc(c.name)}" aria-label="Nom de la catégorie">
      <span class="n">${counts[c.name] || 0} recette${(counts[c.name] || 0) > 1 ? "s" : ""}</span>
      <button class="iconbtn" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Monter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg></button>
      <button class="iconbtn" data-act="down" ${i === cats.length - 1 ? "disabled" : ""} aria-label="Descendre"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>
      <button class="iconbtn" data-act="del" aria-label="Supprimer ${esc(c.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </li>`).join("") : `<li><span style="color:var(--muted)">Aucune catégorie. Crée-en une ci-dessus, ou écris-la directement dans une recette.</span></li>`;
}
$("#form-addcat").addEventListener("submit", async (e) => {
  e.preventDefault(); const v = $("#addcat").value.trim(); if (!v) return;
  if (await act(() => api("/api/categories", { method: "POST", body: { name: v } }))) $("#addcat").value = "";
});
$("#catlist").addEventListener("change", async (e) => {
  const li = e.target.closest("li[data-id]"); if (!li || e.target.tagName !== "INPUT") return;
  const c = S.categories.find((x) => x.id === li.dataset.id); const nv = e.target.value.trim();
  if (!c || !nv || nv === c.name) { if (c) e.target.value = c.name; return; }
  await act(() => api("/api/categories/" + c.id, { method: "PUT", body: { name: nv } }), "Catégorie renommée");
});
$("#catlist").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const id = b.closest("li").dataset.id; const c = S.categories.find((x) => x.id === id); if (!c) return;
  if (b.dataset.act === "del") {
    const n = S.recipes.filter((r) => r.category === c.name).length;
    if (!(await confirmDlg("Supprimer la catégorie ?", n ? `${n} recette(s) resteront dans le carnet, sans catégorie.` : `« ${c.name} » sera supprimée.`, "Supprimer"))) return;
    await act(() => api("/api/categories/" + id, { method: "DELETE" }), "Catégorie supprimée"); return;
  }
  const ids = S.categories.map((x) => x.id); const i = ids.indexOf(id); const j = b.dataset.act === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await act(() => api("/api/categories/reorder", { method: "POST", body: { ids } }));
});

// ---------- Compte, comptes, installation ----------
$("#form-password").addEventListener("submit", async (e) => {
  e.preventDefault(); const st = $("#password-status"); st.className = "status"; st.textContent = "";
  try { await api("/api/account/password", { method: "POST", body: { current: $("#p-cur").value, next: $("#p-new").value } }); st.textContent = "Mot de passe changé."; $("#p-cur").value = $("#p-new").value = ""; }
  catch (err) { st.className = "status err"; st.textContent = err.message; }
});
async function loadUsers() {
  const users = await api("/api/admin/users").catch(() => null); if (!users) return;
  const fmt = (t) => (t ? new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "jamais");
  $("#userlist").innerHTML = users.map((u) => `<li data-id="${esc(u.id)}">
      <span class="name">${esc(u.name)}</span>
      <span class="role">${u.role === "admin" ? "admin" : "membre"}</span>
      <span class="n">connexion : ${fmt(u.last_login)}</span>
      <button class="btn sm" data-act="pwd">Nouveau mot de passe</button>
      ${u.id !== S.user.id ? `<button class="iconbtn" data-act="del" aria-label="Supprimer ${esc(u.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ""}
    </li>`).join("");
}
$("#form-adduser").addEventListener("submit", async (e) => {
  e.preventDefault(); const st = $("#adduser-status"); st.className = "status"; st.textContent = "";
  try {
    const u = await api("/api/admin/users", { method: "POST", body: { name: $("#u-name").value, password: $("#u-pass").value } });
    st.textContent = `Compte « ${u.name} » créé. Communique-lui son prénom, le mot de passe provisoire et l'adresse ${location.origin}.`;
    $("#u-name").value = ""; $("#u-pass").value = ""; loadUsers();
  } catch (err) { st.className = "status err"; st.textContent = err.message; }
});
$("#userlist").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const li = b.closest("li"); const id = li.dataset.id; const name = li.querySelector(".name").textContent;
  if (b.dataset.act === "del") {
    if (!(await confirmDlg("Supprimer ce compte ?", `« ${name} » ne pourra plus se connecter. Les recettes restent.`, "Supprimer"))) return;
    if (await act(() => api("/api/admin/users/" + id, { method: "DELETE" }), "Compte supprimé")) loadUsers();
  }
  if (b.dataset.act === "pwd") {
    const pwd = Math.random().toString(36).slice(2, 8) + "-" + Math.random().toString(36).slice(2, 6);
    if (!(await confirmDlg(`Nouveau mot de passe pour ${name}`, `Le mot de passe provisoire sera : ${pwd}  (note-le, il ne sera plus affiché). Ses appareils seront déconnectés.`, "Appliquer"))) return;
    if (await act(() => api(`/api/admin/users/${id}/password`, { method: "POST", body: { password: pwd } }), "Mot de passe remplacé")) loadUsers();
  }
});
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; renderInstallHelp(); });
window.addEventListener("appinstalled", () => { installPrompt = null; renderInstallHelp(); });
function renderInstallHelp() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ua = navigator.userAgent; const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  $("#install-done").hidden = !standalone;
  $("#install-ready").hidden = standalone || !installPrompt;
  $("#install-ios").hidden = standalone || !ios;
  $("#install-android").hidden = standalone || ios || !!installPrompt;
}
$("#btn-install").addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice.catch(() => {}); installPrompt = null; renderInstallHelp(); });
$("#btn-copy-url").addEventListener("click", async () => {
  const inp = $("#share-url");
  try { await navigator.clipboard.writeText(inp.value); toast("Adresse copiée"); } catch { inp.select(); toast("Sélectionne et copie l'adresse"); }
});

// ---------- Sauvegarde / statut ----------
$("#import-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const st = $("#import-status"); st.className = "status"; st.textContent = "Import en cours…";
  try {
    const data = JSON.parse(await f.text());
    const r = await api("/api/admin/import", { method: "POST", body: data });
    st.textContent = `${r.imported} recette(s) importée(s).`;
  } catch (err) { st.className = "status err"; st.textContent = err.message || "Fichier illisible."; }
  e.target.value = "";
});
async function loadStatus() {
  const s = await api("/api/admin/status").catch(() => null); if (!s) return;
  const fmtDate = (t) => new Date(t).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  $("#status-kv").innerHTML = `
    <dt>Extraction par Claude</dt><dd>${s.claude ? `<span class="pill ok">activée</span> ${esc(s.model)} · effort ${esc(s.effort)}` : `<span class="pill ko">désactivée</span> ajoute ANTHROPIC_API_KEY dans .env`}</dd>
    <dt>Recettes</dt><dd>${s.counts.recipes}</dd>
    <dt>Catégories</dt><dd>${s.counts.categories}</dd>
    <dt>Comptes</dt><dd>${s.counts.users}</dd>
    <dt>Articles de courses</dt><dd>${s.counts.items}</dd>
    <dt>Base de données</dt><dd>${esc(s.dbPath)}</dd>
    <dt>Node</dt><dd>${esc(s.node)} · en ligne depuis ${Math.round(s.uptime / 60)} min</dd>`;
  $("#import-log").innerHTML = `<tr><th>Date</th><th>Lien</th><th>Méthode</th><th>Résultat</th></tr>` +
    (s.imports.length ? s.imports.map((l) => `<tr><td>${fmtDate(l.created_at)}</td><td class="u" title="${esc(l.url)}">${esc(l.url)}</td><td>${esc(l.method)}</td><td>${l.ok ? "✓ " : "✗ "}${esc(l.message)}</td></tr>`).join("") : `<tr><td colspan="4" style="color:var(--muted)">Aucun import pour l'instant.</td></tr>`);
}

// ---------- Ajout / modification ----------
const dlg = $("#dlg-add");
function showStep(n) {
  $("#f-url-wrap").hidden = false;
  $("#step1-acts").hidden = n !== 1; $("#step2").hidden = n !== 2; $("#dlg-add-hint").hidden = n !== 1;
  if (n !== 1) $("#f-paste-wrap").hidden = true;
}
function fillForm(r) {
  $("#f-title").value = r.title || ""; $("#f-serv").value = r.servings || 4; $("#f-cat").value = r.category || "";
  $("#f-ingr").value = (r.ingredients || []).map(ingredientToLine).join("\n"); $("#f-notes").value = r.notes || "";
  if (r.url) $("#f-url").value = r.url;
  const img = $("#f-image"); img.hidden = !r.image; if (r.image) img.src = r.image;
  S.extracted = { image: r.image || "" };
}
let photos = []; // [{data(base64), mediaType, previewUrl}]
async function compressPhoto(file) {
  // Redimensionne côté client (max 1600 px, JPEG) pour limiter l'envoi.
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) { const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(file); }); return { data, mediaType: file.type || "image/jpeg" }; }
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mediaType: "image/jpeg", previewUrl: url };
}
$("#f-photo").addEventListener("change", async (e) => {
  const files = [...e.target.files].slice(0, 4 - photos.length);
  const st = $("#add-status"); st.className = "status"; st.textContent = files.length ? "Préparation des photos…" : "";
  for (const f of files) { const p = await compressPhoto(f); p.previewUrl ||= URL.createObjectURL(f); photos.push(p); }
  e.target.value = ""; renderThumbs();
  st.textContent = photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} prête${photos.length > 1 ? "s" : ""}. Clique sur « Importer ».` : "";
});
function renderThumbs() {
  $("#f-thumbs").innerHTML = photos.map((p, i) => `<img src="${p.previewUrl}" alt="Photo ${i + 1}" title="Cliquer pour retirer" data-i="${i}">`).join("");
}
$("#f-thumbs").addEventListener("click", (e) => { const i = e.target.dataset?.i; if (i == null) return; photos.splice(Number(i), 1); renderThumbs(); });
$("#btn-toggle-photo").addEventListener("click", () => {
  const w = $("#f-photo-wrap"); w.hidden = !w.hidden;
  if (!w.hidden && !S.claude) { $("#add-status").className = "status err"; $("#add-status").textContent = "La lecture de photos demande une clé API Claude sur le serveur (voir Réglages > Serveur)."; }
  if (!w.hidden && !photos.length) $("#f-photo").click();
});

function openAdd() {
  S.editingId = null; S.extracted = null; photos = []; renderThumbs(); $("#f-photo-wrap").hidden = true;
  $("#dlg-add-title").textContent = "Ajouter une recette";
  ["#f-url", "#f-paste", "#f-title", "#f-ingr", "#f-cat", "#f-notes"].forEach((s) => ($(s).value = ""));
  $("#f-serv").value = 4; $("#f-image").hidden = true; $("#f-paste-wrap").hidden = true;
  $("#btn-toggle-paste").textContent = "Coller un texte à la place";
  $("#add-status").textContent = ""; $("#add-status").className = "status";
  $("#btn-back").hidden = false;
  showStep(1); dlg.showModal(); $("#f-url").focus();
}
function openEdit(r) {
  S.editingId = r.id;
  $("#dlg-add-title").textContent = "Modifier la recette";
  $("#f-url").value = ""; fillForm(r);
  $("#add-status").textContent = ""; $("#add-status").className = "status";
  showStep(2); $("#btn-back").hidden = true; dlg.showModal();
}
$("#btn-add").addEventListener("click", openAdd);
$("#btn-toggle-paste").addEventListener("click", () => {
  const w = $("#f-paste-wrap"); w.hidden = !w.hidden;
  $("#btn-toggle-paste").textContent = w.hidden ? "Coller un texte à la place" : "Masquer le texte";
  if (!w.hidden) $("#f-paste").focus();
});
$("#btn-manual").addEventListener("click", () => { $("#btn-back").hidden = false; showStep(2); $("#f-title").focus(); });
$("#btn-back").addEventListener("click", () => showStep(1));
$("#btn-cancel").addEventListener("click", () => dlg.close());
$("#btn-analyze").addEventListener("click", async () => {
  const url = $("#f-url").value.trim(), text = $("#f-paste").value.trim();
  const st = $("#add-status"); st.className = "status";
  const usePhotos = !$("#f-photo-wrap").hidden && photos.length > 0;
  if (!url && !text && !usePhotos) { st.className = "status err"; st.textContent = "Colle un lien, un texte, ou ajoute une photo."; $("#f-url").focus(); return; }
  const btn = $("#btn-analyze"); btn.disabled = true; btn.textContent = "Lecture…";
  st.textContent = usePhotos ? "Claude lit la photo… (10 à 30 secondes)" : text ? "Analyse du texte…" : "Lecture de la page…" + (S.claude ? " (quelques secondes avec Claude)" : "");
  try {
    const r = usePhotos
      ? await api("/api/extract/photo", { method: "POST", body: { photos: photos.map((p) => ({ data: p.data, mediaType: p.mediaType })) } })
      : await api("/api/extract", { method: "POST", body: { url, text } });
    if (usePhotos && url) r.url = url;
    fillForm(r);
    const how = { "photo+claude": "photo lue par Claude", jsonld: "données structurées du site", "jsonld+claude": "données du site, normalisées par Claude", claude: "lecture de la page par Claude", "claude-text": "texte analysé par Claude", "local-text": "texte analysé localement" }[r.method] || r.method;
    st.textContent = `${r.ingredients.length} ingrédient${r.ingredients.length > 1 ? "s" : ""} (${how}). Vérifie, puis enregistre.`;
    showStep(2); $("#f-title").focus();
  } catch (e) {
    st.className = "status err";
    st.textContent = e.status === 422 ? e.message + " Tu peux aussi coller le texte de la recette, ou la saisir à la main." : e.status === 413 ? "Photos trop lourdes : réessaie avec moins de photos." : e.message;
  } finally { btn.disabled = false; btn.textContent = "Importer"; }
});
$("#form-add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    title: $("#f-title").value.trim(), servings: Math.max(1, parseInt($("#f-serv").value, 10) || 4),
    category: $("#f-cat").value.trim(), url: $("#f-url").value.trim(), notes: $("#f-notes").value.trim(),
    image: S.extracted?.image || "",
    ingredients: $("#f-ingr").value.split(/\r?\n/).map(parseIngredientLine).filter((i) => i && i.name),
  };
  if (!body.title) { $("#f-title").focus(); return; }
  const ok = await act(() => S.editingId ? api("/api/recipes/" + S.editingId, { method: "PUT", body }) : api("/api/recipes", { method: "POST", body }),
    S.editingId ? "Recette modifiée" : "Recette enregistrée");
  if (ok) dlg.close();
});
dlg.addEventListener("close", () => { S.editingId = null; });

// ---------- Démarrage ----------
function renderAll() { renderRecipes(); renderList(); renderCats(); }
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const w = reg.installing; w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast("Nouvelle version disponible : rouvre l'application pour l'appliquer."); });
    });
  }).catch(() => {});
}
boot().catch((e) => { if (e.status !== 401) { $("#login").hidden = false; $("#login-status").textContent = "Serveur injoignable : " + e.message; } });
