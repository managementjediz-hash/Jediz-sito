#!/usr/bin/env node
// JEDIZ — generatore statico senza dipendenze.
// Uso:  node build.mjs            → dist/ con URL puliti (/musica/)
//       node build.mjs --preview  → preview/ con pagine piatte (musica.html), CSS/JS in linea
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PREVIEW = process.argv.includes("--preview");

// ---------- lingue ----------
// L'italiano è la lingua di partenza (pagine alla radice). Le altre lingue stanno in /en/, /es/, /fr/, /pt-br/
// e prendono le traduzioni da content/i18n/<codice>.json: "ui" = testi fissi del sito, "content" = testi dei file in content/.
// Le chiavi sono il testo italiano esatto: se un testo italiano cambia e la traduzione non viene aggiornata, compare l'italiano.
const LANGS = [
  { code: "it", dir: "", html: "it", og: "it_IT", short: "IT", name: "Italiano", intl: "it-IT" },
  { code: "en", dir: "en/", html: "en", og: "en_GB", short: "EN", name: "English", intl: "en-GB" },
  { code: "es", dir: "es/", html: "es", og: "es_ES", short: "ES", name: "Español", intl: "es-ES" },
  { code: "fr", dir: "fr/", html: "fr", og: "fr_FR", short: "FR", name: "Français", intl: "fr-FR" },
  { code: "pt-br", dir: "pt-br/", html: "pt-BR", og: "pt_BR", short: "PT", name: "Português (Brasil)", intl: "pt-BR" },
];
const langArg = (process.argv.find((a) => a.startsWith("--lang=")) || "").slice(7);
const L = (!PREVIEW && LANGS.find((l) => l.code === langArg)) || LANGS[0];
const IS_IT = L.code === "it";
const OUT = join(ROOT, PREVIEW ? "preview" : "dist", L.dir);
const DICT = IS_IT ? { ui: {}, content: {} } : JSON.parse(readFileSync(join(ROOT, "content", "i18n", `${L.code}.json`), "utf8"));
const MISSING = new Set();
// T("testo italiano", { var: valore }) → testo nella lingua della pagina
const T = (s, vars) => {
  let out = s;
  if (!IS_IT && s) { if (Object.prototype.hasOwnProperty.call(DICT.ui, s)) out = DICT.ui[s]; else MISSING.add(`ui: ${s}`); }
  if (vars) for (const k in vars) out = out.split(`{${k}}`).join(vars[k]);
  return out;
};
// campi che il sito usa anche come "chiavi" (filtri, categorie): restano in italiano nei dati e si traducono solo quando si mostrano
const KEEP = new Set(["category", "categories", "type", "role", "project", "release", "title", "url", "file", "slug", "id", "email", "youtube", "date", "audio", "src", "image", "poster", "thumb", "cover", "full", "excerpt", "preview", "outlet", "name", "code", "handle", "venue", "context", "address", "shape", "person", "credit", "pdf_code", "feat", "_help", "_note", "_logo_help", "_cover_note"]);
const TRANSLATE_TITLES = new Set(["documents.json", "cinema.json", "live.json"]); // titoli tradotti solo qui (documenti, schede); i titoli dei brani no
function trContent(o, file, key = "") {
  if (IS_IT) return o;
  if (typeof o === "string") {
    if (!o.trim() || (KEEP.has(key) && !(key === "title" && TRANSLATE_TITLES.has(file))) || (key === "status" && /^(ready|draft)$/.test(o))) return o;
    if (Object.prototype.hasOwnProperty.call(DICT.content, o)) return DICT.content[o];
    if (/(^|[\s(])[a-zà-ù]{4,}/.test(o) && !/^https?:|^assets\//.test(o)) MISSING.add(`content (${file}): ${o.slice(0, 70)}`);
    return o;
  }
  if (Array.isArray(o)) return o.map((x) => trContent(x, file, key));
  if (o && typeof o === "object") { const r = {}; for (const k in o) r[k] = trContent(o[k], file, k); return r; }
  return o;
}
const load = (f) => trContent(JSON.parse(readFileSync(join(ROOT, "content", f), "utf8")), f);
const site = load("site.json");
const { releases } = load("releases.json");
const live = load("live.json");
const cinema = load("cinema.json");
const docsData = load("documents.json");
const videosData = load("videos.json");
const photosData = load("photos.json");
const textsData = load("texts.json");
const bio = load("bio.json");
const media = load("media.json");

// ---------- utilità ----------
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ph = (label = "da inserire") => `<span class="ph">${esc(T(label))}</span>`;
const phBlock = (label) => `<div class="ph-block" role="img" aria-label="${esc(T("Segnaposto"))}: ${esc(label)}">${esc(label)}</div>`;
const val = (v, label) => (v && String(v).trim() ? esc(v) : ph(label));
const isExt = (u) => /^https?:\/\//.test(u || "");
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MESI_L = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const parts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
const dDot = (iso) => { if (!iso) return ""; if (/^\d{4}$/.test(iso)) return iso; const { y, m, d } = parts(iso); return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`; };
const dLong = (iso) => { const { y, m, d } = parts(iso); if (!IS_IT) return new Intl.DateTimeFormat(L.intl, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d))); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${GIORNI[wd]} ${d} ${MESI_L[m - 1]} ${y}`; };
const mShort = (m) => (IS_IT ? MESI[m - 1] : new Intl.DateTimeFormat(L.intl, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 15))).replace(".", ""));
const year = (iso) => (iso || "").slice(0, 4);
const todayRome = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
const toSec = (mmss) => { const [m, s] = mmss.split(":").map(Number); return m * 60 + s; };
const fmtTotal = (sec) => `${Math.floor(sec / 60)}′${String(sec % 60).padStart(2, "0")}″`;
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const ytId = (s = "") => { const m = String(s).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : ""; };
const dmId = (s = "") => { const m = String(s).match(/dailymotion\.com\/video\/([a-z0-9]+)|dai\.ly\/([a-z0-9]+)/i); return m ? m[1] || m[2] : ""; };
const abs = (p) => site.url.replace(/\/$/, "") + "/" + p.replace(/^\//, "");

// ---------- dati derivati ----------
const album = releases.find((r) => r.featured) || releases[0];
const albumSec = album.tracks.reduce((a, t) => a + toSec(t.duration), 0);
const datesSorted = [...live.dates].sort((a, b) => a.date.localeCompare(b.date));
const upcoming = datesSorted.filter((d) => d.date >= todayRome);
const past = datesSorted.filter((d) => d.date < todayRome).reverse();
const next = upcoming[0];
const featuredDates = datesSorted.filter((d) => d.featured).reverse();
const docs = docsData.documents;
const docByCode = (c) => docs.find((d) => d.code === c);
const MAKING = "Making of";
const makingProjects = ["Dr. Jediz & Mr. I", "Hikikomori (La mia quarantena)", "BurnOut in Barna"];
const makingVideos = videosData.videos.filter((v) => v.category === MAKING);
const mainVideos = videosData.videos.filter((v) => v.category !== MAKING);
// in apertura va il primo video orizzontale (il formato verticale sta meglio nella griglia)
{ const k = mainVideos.findIndex((v) => !v.vertical); if (k > 0) mainVideos.unshift(...mainVideos.splice(k, 1)); }
const projectsWithClips = [...new Set(makingVideos.map((v) => v.project).filter(Boolean))];
const makingList = [...makingProjects.filter((p) => !projectsWithClips.length || projectsWithClips.includes(p)), ...projectsWithClips.filter((p) => !makingProjects.includes(p))];
const relByTitle = (t) => releases.find((r) => r.title === t && r.tracks && r.tracks.length) || releases.find((r) => r.title === t);

// ---------- pagine e percorsi ----------
const PAGES = [
  { id: "home", path: "", label: T("Home") },
  { id: "musica", path: "musica", label: T("Musica"), n: T("{n} brani", { n: releases.reduce((a, r) => a + (r.tracks || []).length, 0) }) },
  { id: "live", path: "live", label: T("Live"), n: next ? dDot(next.date).slice(0, 5) : "" },
  { id: "video", path: "video", label: T("Video") },
  { id: "archivio", path: "archivio", label: T("Archivio"), n: T("{n} doc.", { n: docs.length }) },
  { id: "media", path: "media", label: T("Media"), n: T("{n} uscite", { n: media.items.length }) },
  { id: "cinema", path: "cinema", label: T("Cinema") },
  { id: "testi", path: "testi", label: T("Testi") },
  { id: "foto", path: "foto", label: T("Foto") },
  { id: "bio", path: "bio", label: T("Bio") },
  { id: "contatti", path: "contatti", label: T("Contatti") },
];
const NAV = PAGES.filter((p) => p.id !== "home");

function ctx(pageId) {
  const depth = PREVIEW ? 0 : (IS_IT ? 0 : 1) + (pageId === "home" || pageId === "404" ? 0 : 1);
  const pre = "../".repeat(depth); // dalla pagina alla radice del sito
  const pathOf = (id) => { const p = PAGES.find((x) => x.id === id); return id === "home" || !p ? "" : `${p.path}/`; };
  const to = (id, hash = "") => {
    const p = PAGES.find((x) => x.id === id);
    if (PREVIEW) return (id === "home" ? "index.html" : `${p.path}.html`) + hash;
    return (pre + L.dir + pathOf(id) || "./") + hash;
  };
  // stessa pagina in un'altra lingua
  const inLang = (l, id = pageId) => pre + l.dir + (id === "404" ? "" : pathOf(id)) || "./";
  const asset = (p) => (isExt(p) ? p : pre + p.replace(/^\//, ""));
  return { to, asset, pre, inLang };
}

// ---------- componenti ----------
const ICON = {
  play: '<svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v10H3zM13 3v10L6 8z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3h2v10h-2zM3 3v10l7-5z"/></svg>',
};

function extLink(url, label, cls = "link-arrow ext") {
  if (!url) return `<span class="ph-link"><span class="mono">${esc(label)}</span> ${ph("link da inserire")}</span>`;
  return `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

// logo: se in content/site.json è indicato un file, sostituisce la scritta JEDIZ
function logo(c, onLight = false) {
  if (!site.logo && !site.logo_on_light) return "JEDIZ";
  const src = onLight ? site.logo_on_light || site.logo : site.logo || site.logo_on_light;
  const invert = (onLight && !site.logo_on_light) || (!onLight && !site.logo) ? " auto-invert" : "";
  if (PREVIEW) { // anteprima: SVG in linea (l'anteprima non carica file esterni)
    const raw = readFileSync(join(ROOT, src), "utf8").replace("<svg ", `<svg class="logo-img${invert}" `);
    return raw.trim();
  }
  return `<img class="logo-img${invert}" src="${esc(c.asset(src))}" alt="JEDIZ" width="1000" height="851">`;
}

// Immagini: si usano le versioni leggere in assets/_r/ (create da "node tools/resize.mjs" o a mano),
// scegliendo la più piccola larga almeno quanto serve. Se non ci sono, si usa il file originale.
const RW = [480, 960, 1600];
const USED_IMAGES = new Set();
// versione del file nell'URL: se un'immagine cambia mantenendo lo stesso nome, il browser scarica quella nuova
const VER = new Map();
function fileVer(f) {
  if (!VER.has(f)) VER.set(f, createHash("md5").update(readFileSync(join(ROOT, f))).digest("hex").slice(0, 8));
  return VER.get(f);
}
function img(c, path, w) {
  if (!path) return "";
  if (PREVIEW || isExt(path) || /\.svg$/i.test(path)) return c.asset(path);
  const p = path.replace(/^\//, "");
  USED_IMAGES.add(p);
  const base = p.replace(/\.[^./]+$/, "");
  for (const rw of [...RW.filter((x) => x >= w), RW[RW.length - 1]]) {
    const f = `assets/_r/${base}-${rw}.webp`;
    if (existsSync(join(ROOT, f))) return c.asset(f) + "?v=" + fileVer(f);
  }
  return c.asset(p);
}

function cover(rel, c, size = "") {
  const t = esc(rel.title).replace(/ &amp; /, " &amp;<em> ") + (rel.title.includes(" & ") ? "</em>" : "");
  const fallback = `<div class="cover-fallback" aria-hidden="true"><span class="mono">${esc(T(rel.type))} · ${year(rel.date)}</span><span class="cf-title">${t}</span><span class="cf-meta mono"><span>Jediz</span><span>${rel.cover ? "" : T("copertina da inserire")}</span></span></div>`;
  const img = rel.cover ? `<img src="${esc(c.asset(rel.cover))}" alt="${esc(T("Copertina di {t}", { t: rel.title }))}" width="600" height="600" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('no-img')">` : "";
  return `<div class="cover ${size}${rel.cover ? "" : " no-img"}">${img}${fallback}</div>`;
}

function player(c, rels = [album]) {
  rels = rels.filter((r) => r.tracks && r.tracks.length);
  const multi = rels.length > 1;
  const tracks = [];
  rels.forEach((r, ri) => r.tracks.forEach((t) => tracks.push({ title: t.title, feat: t.feat || "", src: t.audio ? c.asset(t.audio) : t.preview || "", preview: !t.audio && !!t.preview, duration: t.duration, r: ri })));
  const relData = rels.map((r) => ({ type: T(r.type), date: dDot(r.date), links: r.links.filter((l) => l.url) }));
  let k = 0;
  const groups = rels.map((r, ri) => {
    const rows = r.tracks.map((t, j) => { const i = k++; return `<li><button class="track" type="button" data-i="${i}" aria-current="${i === 0}"><span class="n">${String(j + 1).padStart(2, "0")}</span><span class="t">${esc(t.title)}${t.feat ? `<small>feat. ${esc(t.feat)}</small>` : ""}</span><span class="d">${t.duration}</span></button></li>`; }).join("");
    return `${multi ? `<p class="tracks-head mono"><span>${esc(r.title)}</span><span class="mute">${esc(T(r.type))} · ${year(r.date)}</span></p>` : ""}<ol class="tracks">${rows}</ol>`;
  }).join("");
  const totalSec = tracks.reduce((a, t) => a + toSec(t.duration), 0);
  const covers = rels.map((r, ri) => `<div data-cover="${ri}"${ri ? " hidden" : ""}>${cover(r, c)}</div>`).join("");
  const first = tracks[0], r0 = rels[0];
  return `<div class="player${multi ? " multi" : ""}" data-player>
  <div class="player-cover">${covers}</div>
  <div class="now">
    <div class="now-sub mono"><span data-rtype>${esc(T(r0.type))}</span><span data-rdate>${dDot(r0.date)}</span><span data-kind>${first.preview ? T("Anteprima 30″") : ""}</span></div>
    <p class="now-title" data-title aria-live="polite">${esc(first.title)}</p>
    <div class="controls">
      <button class="ctl" type="button" data-prev aria-label="${T("Brano precedente")}">${ICON.prev}</button>
      <button class="ctl play" type="button" data-play aria-label="${T("Riproduci")}">${ICON.play}${ICON.pause}</button>
      <button class="ctl" type="button" data-next aria-label="${T("Brano successivo")}">${ICON.next}</button>
    </div>
    <div class="progress"><span data-cur>0:00</span><input class="seek" type="range" id="seek-${multi ? "all" : "album"}" min="0" max="1000" value="0" step="1" aria-label="${T("Posizione nel brano")}" data-seek><span data-dur>${first.preview ? "0:30" : first.duration}</span></div>
    <p class="player-msg" data-msg></p>
    <div class="tracks-scroll">${groups}</div>
    <div class="tracks-total mono mute"><span>${T("{n} brani", { n: tracks.length })}${multi ? ` · ${T("{n} uscite", { n: rels.length })}` : ""}</span><span class="num">${fmtTotal(totalSec)}</span></div>
    <div class="links-row" data-rlinks>${r0.links.map((l) => extLink(l.url, l.label)).join("")}</div>
  </div>
  <script type="application/json" data-tracks>${JSON.stringify({ tracks, rels: relData }).replace(/</g, "\\u003c")}</script>
</div>`;
}

function slate(d, c, withLink = true) {
  if (!d) return `<div class="slate"><span class="label mono">${T("Prossima data")}</span><span>${T("Nuove date in arrivo.")} ${withLink ? `<a class="link-arrow" href="${c.to("live")}">${T("Live")}</a>` : ""}</span></div>`;
  const { d: day, m, y } = parts(d.date);
  return `<div class="slate" data-expires="${d.date}">
  <div class="slate-date"><span class="d num">${day}</span><span class="m mono"><span>${mShort(m)} ${y}</span><span class="mute">${d.time ? T("ore {t}", { t: esc(d.time) }) : ""}</span></span></div>
  <div class="slate-where"><span class="label mono">${T("Prossima data")}${d.context ? ` · ${esc(d.context)}` : ""}</span><span class="v">${esc(d.venue)}, ${esc(d.city)}</span></div>
  <div class="slate-cta">${extLink(d.ticket_url, d.ticket_label || T("Biglietti"))}${d.info_url ? extLink(d.info_url, d.info_label || T("Informazioni")) : ""}${withLink ? `<a class="link-arrow" href="${c.to("live")}">${T("Tutte le date")}</a>` : ""}</div>
</div>`;
}

function dateRow(d, isPast = false) {
  const links = [!isPast && (d.ticket_url || d.ticket_label !== "") ? extLink(d.ticket_url, d.ticket_label || T("Biglietti")) : "", d.info_url ? extLink(d.info_url, d.info_label || T("Informazioni")) : ""].join("");
  return `<li class="date-row${isPast ? " past" : ""}">
  <span class="when">${dDot(d.date)}${d.time ? ` · ${esc(d.time)}` : ""}</span>
  <span class="what"><b>${esc(d.title)}</b>${d.context ? `<span class="mono mute">${esc(d.context)}</span>` : ""}${d.description ? `<span class="mute">${esc(d.description)}</span>` : ""}${d.lineup && isPast ? `<span class="mute small">${T("Con {x}", { x: esc(d.lineup) })}</span>` : ""}${!isPast && d.price ? `<span class="mono">${T("Ingresso {x}", { x: esc(d.price) })}</span>` : ""}${links ? `<span class="links-row" style="margin-top:8px">${links}</span>` : ""}</span>
  <span class="where">${d.venue ? esc(d.venue) : ph("luogo")}${d.address ? `<br>${esc(d.address)}` : ""}<br>${esc(d.city)}</span>
</li>`;
}

// locandina + dati essenziali (home e pagina Live)
function gigCard(d, c) {
  const up = d.date >= todayRome;
  const cap = `${dDot(d.date)} · ${d.city} — ${d.title}`;
  const poster = d.poster
    ? `<button class="pf gig-poster" type="button" data-lb="${esc(img(c, d.poster, 1600))}" data-cap="${esc(cap)}" aria-label="${esc(T("Apri la locandina: {t}", { t: d.title }))}"><img src="${esc(d.poster_thumb ? c.asset(d.poster_thumb) : img(c, d.poster, 600))}" alt="${esc(T("Locandina: {t}, {c}", { t: d.title, c: d.city }))}" loading="lazy" decoding="async"></button>`
    : `<div class="pf gig-poster">${phBlock(T("Locandina da inserire"))}</div>`;
  return `<article class="gig${up ? " is-next" : ""}"${up ? ` data-expires="${d.date}" data-keep` : ""}>${poster}<div class="gig-meta mono"><span>${dDot(d.date)}</span><span>${esc(d.city)}</span></div><h3>${esc(d.title)}</h3><p class="mute">${d.venue ? esc(d.venue.split(" — ")[0]) : ""}${up ? ` <span class="tag mono">${T("Prossima")}</span>` : ""}</p></article>`;
}

function lineup() {
  return `<ul class="lineup">${live.band.map((b) => `<li><span class="who">${esc(b.name)}</span><span class="ins mono">${esc(T(b.role))}</span></li>`).join("")}</ul>`;
}

// Un link può finire in qualunque campo (file, youtube, url): qui si rimette in ordine.
const isUrl = (s = "") => /^https?:\/\//i.test(String(s).trim());
function normVideo(v) {
  const raw = [v.youtube, v.url, v.file].map((x) => String(x || "").trim());
  const yt = raw.map((x) => ytId(x)).find(Boolean) || "";
  const file = raw[2] && !isUrl(raw[2]) && !ytId(raw[2]) ? raw[2] : "";
  const url = yt ? "" : raw.find((x) => isUrl(x)) || "";
  return { ...v, youtube: yt, url, file };
}
const clip = (s = "", n = 220) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, s.lastIndexOf(" ", n)) + "…" : s; };
function videoCard(v, c) {
  v = normVideo(v);
  const title = v.title ? esc(v.title) : ph("titolo");
  const label = esc(v.title || T("Video"));
  let frame;
  if (v.file) {
    // video caricato sul sito (mp4): si carica solo quando si preme play
    frame = `<div class="vframe"><video controls playsinline preload="none"${v.poster ? ` poster="${esc(img(c, v.poster, 1200))}"` : ""} aria-label="${label}"><source src="${esc(c.asset(v.file))}" type="video/mp4"></video></div>`;
  } else if (v.youtube) {
    const thumb = v.thumb ? img(c, v.thumb, 960) : `https://i.ytimg.com/vi/${esc(v.youtube)}/hqdefault.jpg`;
    frame = `<div class="vframe"><img src="${thumb}" alt="" loading="lazy" decoding="async" width="480" height="360"><a class="vplay" href="https://www.youtube.com/watch?v=${esc(v.youtube)}" target="_blank" rel="noopener" data-yt="${esc(v.youtube)}" aria-label="${T("Guarda: {t}", { t: label })}"><span>${ICON.play.replace('class="i-play" ', "")}</span></a></div>`;
  } else if (v.url) {
    // video su un'altra piattaforma (Instagram, Facebook, Vimeo…): anteprima e link esterno
    const bg = v.poster || v.thumb;
    const plat = (v.url.match(/instagram|facebook|vimeo|tiktok|dailymotion/i) || [""])[0];
    frame = `<div class="vframe">${bg ? `<img src="${esc(img(c, bg, 960))}" alt="" loading="lazy" decoding="async">` : `<div class="vframe-bg"><span class="vplat mono">${esc(plat ? plat[0].toUpperCase() + plat.slice(1).toLowerCase() : "Video")}</span></div>`}<a class="vplay" href="${esc(v.url)}" target="_blank" rel="noopener" aria-label="${T("Guarda: {t}", { t: label })}"><span>${ICON.play.replace('class="i-play" ', "")}</span></a></div>`;
  } else frame = `<div class="vframe">${phBlock(`${T("Video")} · ${T(v.category)} · ${T("da inserire")}`)}</div>`;
  if (v.vertical) frame = frame.replace('<div class="vframe">', '<div class="vframe vertical">');
  else if (v.square) frame = frame.replace('<div class="vframe">', '<div class="vframe square">');
  return `<article class="vcard${v.vertical ? " is-vertical" : ""}" data-cat="${esc(v.category)}">${frame}<div class="vmeta mono"><span>${esc(T(v.category))}</span><span>${v.date ? dDot(v.date) : ""}</span></div><h3>${title}</h3>${v.description ? `<p>${esc(clip(v.description))}</p>` : ""}</article>`;
}

function filters(cats, group) {
  return `<div class="filters" role="group" aria-label="${T("Filtra per categoria")}" data-filter="${group}"><button class="chip" type="button" aria-pressed="true" data-f="*">${T("Tutti")}</button>${cats.map((k) => `<button class="chip" type="button" aria-pressed="false" data-f="${esc(k)}">${esc(T(k))}</button>`).join("")}</div>`;
}

// Anteprima dei PDF: immagini delle pagine in assets/docs/preview/<nome-del-pdf>/ (p-01.jpg, p-02.jpg…).
// Se la cartella non c'è, il sito usa la copertina tipografica e il PDF si apre normalmente.
function docPages(file) {
  if (!file || isExt(file)) return [];
  const base = file.split("/").pop().replace(/\.pdf$/i, "");
  const dir = join(ROOT, "assets/docs/preview", base);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort((a, b) => (parseInt(a.match(/\d+/)) || 0) - (parseInt(b.match(/\d+/)) || 0)).map((f) => `assets/docs/preview/${base}/${f}`);
}
const readerAttrs = (d, c, start = 0) => {
  const pg = docPages(d.file);
  return pg.length ? ` data-reader-open data-title="${esc(d.title)}" data-pdf="${esc(c.asset(d.file))}" data-start="${start}" data-pages="${esc(JSON.stringify(pg.map((x) => img(c, x, 1100))))}"` : "";
};
function docCard(d, c) {
  const ready = d.status !== "draft";
  const pg = docPages(d.file);
  const thumb = d.thumb ? c.asset(d.thumb) : pg.length ? img(c, pg[0], 640) : "";
  const sheet = thumb
    ? (pg.length && ready ? `<button class="sheet has-thumb" type="button"${readerAttrs(d, c)} aria-label="${esc(T("Sfoglia: {t}", { t: d.title }))}"><img src="${esc(thumb)}" alt="" loading="lazy" decoding="async"></button>` : `<div class="sheet has-thumb"><img src="${esc(thumb)}" alt="" loading="lazy"></div>`)
    : `<div class="sheet" aria-hidden="true"><div class="s-top"><span>${esc(d.code)}</span><span>Jediz</span></div><div class="s-title">${esc(d.title)}<span>${esc(d.kind)}</span></div><div class="s-lines"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
  const npg = d.pages || (pg.length > 1 ? pg.length : "");
  const meta = [d.version && `v. ${d.version}`, d.date && dDot(d.date), npg && `${npg} pp.`].filter(Boolean).join(" · ");
  let actions;
  if (!ready) actions = `<span class="status">${T("In preparazione")}</span>`;
  else if (!d.file) actions = ph("PDF da caricare");
  else actions = `${pg.length ? `<button class="link-arrow" type="button"${readerAttrs(d, c)}>${T("Sfoglia")}</button>` : ""}<a class="link-arrow ext" href="${esc(c.asset(d.file))}" target="_blank" rel="noopener">${pg.length ? "PDF" : T("Apri")}</a><a class="link-arrow" href="${esc(c.asset(d.file))}" download>${T("Scarica")}</a>`;
  return `<article class="doc" id="${slug(d.code)}">${sheet}<div class="d-head mono"><span>${esc(d.code)}</span><span>${meta || esc(d.kind)}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.description)}</p>${!IS_IT && d.file && ready ? `<p class="mono mute doc-lang">${T("Documento in italiano")}</p>` : ""}<div class="actions">${actions}</div></article>`;
}

function photoItem(p, c) {
  const inner = p.src
    ? `<button class="pf" type="button" data-lb="${esc(img(c, p.src, 2000))}" data-cap="${esc(p.caption)}${p.credit ? ` — ${T("foto")} ` + esc(p.credit) : ""}" aria-label="${esc(T("Apri foto: {t}", { t: p.alt || p.caption }))}"><img src="${esc(p.thumb ? c.asset(p.thumb) : img(c, p.src, 900))}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></button>`
    : `<div class="pf">${phBlock(`${T("Foto")} · ${T(p.category)}`)}</div>`;
  return `<figure class="ph-item ${esc(p.shape || "square")}" data-cat="${esc(p.category)}">${inner}<figcaption class="mono"><span>${p.caption ? esc(p.caption) : esc(T(p.category))}</span><span>${p.credit ? "© " + esc(p.credit) : ""}</span></figcaption></figure>`;
}

function portrait(p, c, cls = "") {
  return `<figure class="portrait ${cls}"><img src="${esc(img(c, p.src, 960))}" alt="${esc(p.alt)}" loading="lazy" decoding="async"><figcaption class="mono">${p.credit ? `${T("foto")} ${esc(p.credit)}` : ""}</figcaption></figure>`;
}

function secHead({ label, meta = [], title, lede }) {
  return `<div class="rail sec-head"><div class="rail-meta"><span class="mono">${label}</span>${meta.map((m) => `<span class="mono mute">${m}</span>`).join("")}</div><div class="stack" style="--s:16px"><h2>${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ""}</div></div>`;
}

function pageHead({ label, title, lede, c }) {
  return `<header class="page-head wrap"><nav class="crumbs mono" aria-label="${T("Percorso")}"><a href="${c.to("home")}">Jediz</a><span aria-hidden="true">/</span><span>${label}</span></nav><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</header>`;
}

// ---------- layout ----------
const css = readFileSync(join(ROOT, "src", "site.css"), "utf8");
const js = readFileSync(join(ROOT, "src", "site.js"), "utf8");
// versione dei file: cambia a ogni modifica, così il browser non usa la copia vecchia
const ver = (t) => createHash("sha1").update(t).digest("hex").slice(0, 8);
const OG_VER = ver(readFileSync(join(ROOT, "assets/img/og.png")));

function layout(pageId, { title, description, theme = "t-paper", body, jsonld, ogPath = "" }) {
  const c = ctx(pageId);
  const page = PAGES.find((p) => p.id === pageId);
  const rel = (l) => l.dir + (page ? (page.path ? page.path + "/" : "") : ogPath);
  const canonical = abs(rel(L));
  const alternates = page ? LANGS.map((l) => `<link rel="alternate" hreflang="${l.html}" href="${abs(rel(l))}">`).join("") + `<link rel="alternate" hreflang="x-default" href="${abs(rel(LANGS[0]))}">` : "";
  const fullTitle = pageId === "home" ? `${site.name} — ${T("Musica, live, materiali")}` : `${title} — ${site.name}`;
  const langMenu = PREVIEW ? "" : `<details class="lang-sw"><summary class="mono" aria-label="${T("Lingua")}: ${L.name}">${L.short}</summary><ul>${LANGS.map((l) => `<li><a href="${c.inLang(l)}" hreflang="${l.html}" lang="${l.html}"${l === L ? ' aria-current="true"' : ""}><span class="mono">${l.short}</span>${l.name}</a></li>`).join("")}</ul></details>`;
  const uiJs = { preview: T("Anteprima 30″"), noAudio: T("Audio non ancora caricato per questo brano."), playErr: T("Riproduzione non disponibile qui. Ascolta il brano sulle piattaforme qui sotto."), pause: T("Pausa"), play: T("Riproduci"), copied: T("Copiato"), page: T("Pagina"), menu: T("Menu"), close: T("Chiudi") };
  const nav = NAV.map((p) => `<li><a href="${c.to(p.id)}" data-n="${esc(p.n || "")}"${p.id === pageId ? ' aria-current="page"' : ""}>${p.label}</a></li>`).join("");
  const socials = site.social.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : `<span>${esc(s.label)} ${ph("link")}</span>`}</li>`).join("");
  const styles = PREVIEW
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=IBM+Plex+Mono:wght@400;500&display=swap"><style>${css.replace(/@font-face\s*{[^}]*}\s*/g, "")}</style>`
    : `<link rel="preload" href="${c.asset("assets/fonts/bodoni-moda.woff2")}" as="font" type="font/woff2" crossorigin><link rel="preload" href="${c.asset("assets/fonts/archivo.woff2")}" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${c.asset("assets/css/site.css")}?v=${ver(css)}">`;
  const script = PREVIEW ? `<script>${js}</script>` : `<script src="${c.asset("assets/js/site.js")}?v=${ver(js)}" defer></script>`;
  return `<!doctype html>
<html lang="${L.html}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.description)}">
<link rel="canonical" href="${canonical}">
${alternates}
<meta name="theme-color" content="#0E0F12">
<meta property="og:type" content="${pageId === "musica" ? "music.album" : "website"}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${abs("assets/img/og.png")}?v=${OG_VER}">
<meta property="og:image:alt" content="JEDIZ">
<meta name="twitter:image" content="${abs("assets/img/og.png")}?v=${OG_VER}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="${L.og}">${LANGS.filter((l) => l !== L).map((l) => `<meta property="og:locale:alternate" content="${l.og}">`).join("")}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${c.asset("assets/img/favicon.svg")}" type="image/svg+xml">
<link rel="icon" href="${c.asset("assets/img/favicon-32.png")}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${c.asset("assets/img/apple-touch-icon.png")}">
${styles}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${IS_IT ? "" : `<script>window.JDZ_T=${JSON.stringify(uiJs).replace(/</g, "\\u003c")}</script>`}
</head>
<body class="${theme}">
<a class="skip" href="#main">${T("Vai al contenuto")}</a>
<header class="site-header ${theme}">
  <div class="wrap">
    <a class="mark" href="${c.to("home")}" aria-label="${T("Jediz, home")}"><span class="mark-a">${logo(c, theme === "t-paper")}</span></a>
    <div class="head-r"><nav class="nav" id="nav" aria-label="${T("Principale")}"><ul>${nav}</ul></nav>${langMenu}<button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav">${T("Menu")}</button></div>
  </div>
</header>
<main id="main">
${body(c)}
</main>
<footer class="site-footer t-night">
  <div class="wrap">
    <div class="foot-grid">
      <div class="stack" style="--s:18px"><p class="foot-mark">${logo(c)}</p><p class="mono mute">${esc(site.city)}</p></div>
      <div class="stack" style="--s:14px"><p class="mono mute">${T("Canali")}</p><ul class="foot-list">${socials}</ul></div>
      <div class="stack" style="--s:14px"><p class="mono mute">${T("Sito")}</p><ul class="foot-list">${NAV.map((p) => `<li><a href="${c.to(p.id)}">${p.label}</a></li>`).join("")}</ul></div>
    </div>
    <div class="foot-base mono"><span>© ${todayRome.slice(0, 4)} Jediz</span>${PREVIEW ? "" : `<span class="foot-langs">${LANGS.map((l) => (l === L ? `<b>${l.short}</b>` : `<a href="${c.inLang(l)}" hreflang="${l.html}" lang="${l.html}" title="${l.name}">${l.short}</a>`)).join("")}</span>`}</div>
  </div>
</footer>
<div class="lightbox" hidden data-lightbox role="dialog" aria-modal="true" aria-label="${T("Immagine")}">
  <div class="lb-top mono"><span data-lb-count></span><button type="button" class="copy" data-lb-close>${T("Chiudi")} ✕</button></div>
  <div class="lb-stage"><img alt="" data-lb-img></div>
  <p class="lb-cap mono" data-lb-cap></p>
</div>
<div class="reader" hidden data-reader role="dialog" aria-modal="true" aria-label="${T("Documento")}">
  <div class="rd-top mono"><span data-reader-title></span><span class="rd-act"><span class="mute" data-reader-count></span><a class="copy" data-reader-pdf target="_blank" rel="noopener">PDF</a><button type="button" class="copy" data-reader-close>${T("Chiudi")} ✕</button></span></div>
  <div class="rd-pages" data-reader-pages tabindex="0"></div>
</div>
<div class="mini t-night" data-mini aria-hidden="true">
  <button class="ctl play" type="button" data-mini-play aria-label="${T("Riproduci o metti in pausa")}">${ICON.play}${ICON.pause}</button>
  <div class="mini-t"><b data-mini-title></b><div class="mini-bar"><i data-mini-bar></i></div></div>
  <button class="close" type="button" data-mini-close aria-label="${T("Chiudi il lettore")}">${T("Chiudi")}</button>
</div>
${script}
</body>
</html>`;
}

// ---------- JSON-LD ----------
const sameAs = site.social.filter((s) => s.url).map((s) => s.url);
const ldArtist = { "@context": "https://schema.org", "@type": "MusicGroup", name: "Jediz", alternateName: site.person, url: site.url, genre: ["Hip-hop", "Rap"], foundingLocation: { "@type": "Place", name: "Roma" }, sameAs, member: live.band.filter((b) => b.name !== "Jediz").map((b) => ({ "@type": "Person", name: b.name, roleName: b.role })) };
const ldEvents = upcoming.map((d) => ({ "@context": "https://schema.org", "@type": "MusicEvent", name: `${d.title}`, startDate: `${d.date}${d.time ? "T" + d.time + ":00+02:00" : ""}`, eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: { "@type": "Place", name: d.venue, address: { "@type": "PostalAddress", addressLocality: d.city, addressCountry: "IT" } }, performer: { "@type": "MusicGroup", name: "Jediz" }, ...(d.ticket_url ? { offers: { "@type": "Offer", url: d.ticket_url } } : {}) }));
const ldAlbum = { "@context": "https://schema.org", "@type": "MusicAlbum", name: album.title, byArtist: { "@type": "MusicGroup", name: "Jediz" }, datePublished: album.date, numTracks: album.tracks.length, track: album.tracks.map((t, i) => ({ "@type": "MusicRecording", position: i + 1, name: t.title, duration: `PT${t.duration.replace(":", "M")}S` })) };

// ---------- pagine ----------
const pages = {};

// Novità in home: le uscite di Media segnate "highlight", dalla più recente (max 4)
const newsItems = media.items.filter((it) => it.highlight).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 4);
const nDate = (d) => (d ? d.split("-").reverse().join(".") : "");
function newsCard(it, c) {
  const yt = ytId(it.youtube) || ytId(it.url);
  const dm = dmId(it.url);
  const pic = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : dm ? `https://www.dailymotion.com/thumbnail/video/${dm}` : it.image ? img(c, it.image, 960) : it.thumb ? img(c, it.thumb, 960) : "";
  const play = `<span>${ICON.play.replace('class="i-play" ', "")}</span>`;
  const media = yt
    ? `<div class="vframe"><img src="${esc(pic)}" alt="" loading="lazy" decoding="async" width="480" height="360"><a class="vplay" href="https://www.youtube.com/watch?v=${esc(yt)}" target="_blank" rel="noopener" data-yt="${esc(yt)}" aria-label="${esc(T("Guarda: {t}", { t: it.title }))}">${play}</a></div>`
    : `<a class="vframe n-pic" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="${esc(T("Leggi: {t}", { t: it.title }))}">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}${dm ? `<span class="vplay" aria-hidden="true">${play}</span>` : `<span class="n-outlet">${esc(it.outlet)}</span>`}</a>`;
  return `<article class="n-card">${media}<p class="n-src mono">${esc(it.outlet)} · ${esc(T(it.type))} · ${nDate(it.date)}</p><h3 class="n-t"><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a></h3></article>`;
}
function newsCarousel(c) {
  return `<div class="hero-news" aria-labelledby="h-news"><div class="n-head"><p class="mono mute" id="h-news">${T("Novità")}</p><div class="n-nav"><button type="button" class="n-btn" data-news="-1" aria-label="${T("Precedente")}">←</button><button type="button" class="n-btn" data-news="1" aria-label="${T("Successiva")}">→</button></div></div><div class="n-track" data-news-track tabindex="0">${newsItems.map((it) => newsCard(it, c)).join("")}</div><a class="link-arrow" href="${c.to("media")}">${T("Tutta la rassegna")}</a></div>`;
}
function newsBlock(c) {
  if (!newsItems.length) return "";
  return `<section class="band t-paper news-band" aria-labelledby="h-news">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-news">${T("Novità")}</span><span class="mono mute">${T("Stampa e interviste")}</span></div>
    <div class="stack" style="--s:20px">
      <ul class="news">${newsItems.map((it) => `<li><a href="${esc(it.url)}" target="_blank" rel="noopener"><span class="n-src mono">${esc(it.outlet)} · ${esc(T(it.type))}</span><span class="n-t">${esc(it.title)}</span><span class="n-d mono">${nDate(it.date)}</span></a></li>`).join("")}</ul>
      <div class="links-row"><a class="link-arrow" href="${c.to("media")}">${T("Tutta la rassegna")}</a></div>
    </div>
  </div>
</section>`;
}
pages.home = layout("home", {
  theme: "t-night",
  description: site.description,
  jsonld: [ldArtist, ...ldEvents],
  body: (c) => `
<section class="hero t-night" aria-labelledby="h-jediz">
  <div class="wrap">
    <div class="hero-main">
      <h1 class="wordmark" id="h-jediz">${logo(c)}${site.logo ? '<span class="sr-only">JEDIZ</span>' : ""}</h1>
      <div class="hero-claim">
        ${newsItems.length ? newsCarousel(c) : `<p class="claim">${esc(site.claim)}</p><p class="mono mute">${esc(site.subclaim)}</p>`}
        <div class="hero-actions"><a class="link-arrow" href="#ascolta">${T("Ascolta")}</a><a class="link-arrow" href="${c.to("live")}">${T("Live")}</a><a class="link-arrow" href="${c.to("video")}">${T("Video")}</a><a class="link-arrow" href="${c.to("archivio")}">${T("Archivio")}</a></div>
      </div>
    </div>
    ${slate(next, c)}
  </div>
</section>

<section class="band t-paper ident" aria-labelledby="h-ident">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-ident">${T("Chi è")}</span><span class="mono mute">Jediz</span></div>
    <div class="ident-wrap"><div class="ident-body"><p>${esc(bio.short)}</p><div class="links-row"><a class="link-arrow" href="${c.to("bio")}">${T("Bio")}</a><a class="link-arrow" href="${c.to("foto")}">${T("Foto")}</a><a class="link-arrow" href="${c.to("contatti")}">${T("Contatti")}</a></div></div>${bio.photo && bio.photo.src ? portrait(bio.photo, c, "ident-photo") : ""}</div>
  </div>
</section>

<section class="band t-night" id="ascolta" aria-labelledby="h-ascolta">
  <div class="wrap">
    ${secHead({ label: T("Ascolta"), meta: [`${T(album.type)} · ${year(album.date)}`, `${T("{n} brani", { n: album.tracks.length })} · ${fmtTotal(albumSec)}`], title: `<span id="h-ascolta">Dr. Jediz <span class="it">&amp; Mr. I</span></span>`, lede: esc(album.intro) })}
    ${player(c)}
    <div class="sec-foot"><a class="link-arrow" href="${c.to("musica")}">${T("Discografia")}</a><a class="link-arrow" href="${c.to("testi")}">${T("Testi")}</a></div>
  </div>
</section>

<section class="band t-paper" aria-labelledby="h-live">
  <div class="wrap">
    ${secHead({ label: T("Live"), meta: [T("{n} date", { n: datesSorted.length }), `${year(datesSorted[0]?.date)}–${year(datesSorted[datesSorted.length - 1]?.date)}`], title: `<span id="h-live">${T("Dal vivo")}</span>`, lede: esc(live.intro) })}
    <div class="gigs">${featuredDates.slice(0, 6).map((d) => gigCard(d, c)).join("")}</div>
    <div class="rail" style="margin-top:clamp(40px,6vw,72px)"><div class="rail-meta"><span class="mono mute">${T("Formazione")}</span></div>${lineup()}</div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("live")}">${T("Tutte le date e il live")}</a></div>
  </div>
</section>

<section class="band t-night" aria-labelledby="h-video">
  <div class="wrap">
    ${secHead({ label: T("Video"), meta: videosData.categories.slice(0, 3).map((k) => esc(T(k))), title: `<span id="h-video">${T("Video")}</span>`, lede: T("Live, session, videoclip.") })}
    <div class="vgrid">${videosData.videos.slice(0, 3).map((v) => videoCard(v, c)).join("")}</div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("video")}">${T("Tutti i video")}</a></div>
  </div>
</section>

<section class="band t-paper" aria-labelledby="h-arch">
  <div class="wrap">
    ${secHead({ label: T("Archivio"), meta: [T("{n} documenti", { n: docs.length }), "PDF"], title: `<span id="h-arch">${T("Materiali")}</span>`, lede: T("Presentazione, cinema, testi, bio, scheda tecnica. Per chi lavora con il progetto.") })}
    <div class="rail"><div class="rail-meta"><span class="mono mute">${T("In evidenza")}</span></div><div class="docs">${docs.slice(0, 3).map((d) => docCard(d, c)).join("")}</div></div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("archivio")}">${T("Tutto l'archivio")}</a></div>
  </div>
</section>

<div class="split">
  <section class="t-night" aria-labelledby="h-cin">
    <p class="mono mute">${T("Cinema")}</p>
    <h2 id="h-cin"><span class="it">Straordinaria</span></h2>
    <p>${esc(cinema.works[0].description)} ${T("Regia di {r}, produzione {p}.", { r: esc(cinema.works[0].credits.find((x) => x.role === "Regia")?.value), p: esc(cinema.works[0].credits.find((x) => x.role === "Produzione")?.value) })}</p>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("cinema")}">${T("Cinema")}</a></div>
  </section>
  <section class="t-paper" aria-labelledby="h-testi">
    <p class="mono mute">${T("Scrittura")}</p>
    <h2 id="h-testi">${T("Testi")}</h2>
    <p>${esc(textsData.intro)}</p>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("testi")}">${T("Leggi")}</a></div>
  </section>
</div>`,
});

pages.musica = layout("musica", {
  theme: "t-night",
  title: T("Musica"),
  description: T("{a}, il primo album di Jediz ({d}), e la discografia completa.", { a: album.title, d: dDot(album.date) }),
  jsonld: [ldAlbum],
  body: (c) => `
${pageHead({ c, label: T("Musica"), title: `Dr. Jediz <span class="it">&amp; Mr. I</span>`, lede: `${esc(album.intro)} ${T("Uscito il {d}.", { d: dLong(album.date) })}` })}
<section class="band t-night" style="padding-top:0" id="ascolta" aria-label="${T("Lettore")}">
  <div class="wrap">${player(c, releases)}</div>
</section>
<section class="band t-night" style="padding-top:0" aria-labelledby="h-cred">
  <div class="wrap rail"><div class="rail-meta"><span class="mono" id="h-cred">${T("Crediti")}</span></div>
  <dl class="credits">${album.credits.map((x) => `<dt>${esc(T(x.role))}</dt><dd>${val(x.value, "da inserire")}</dd>`).join("")}</dl></div>
</section>
<section class="band t-paper" aria-labelledby="h-disco">
  <div class="wrap">
    ${secHead({ label: T("Discografia"), meta: [T("{n} uscite", { n: releases.length }), `${year(releases[releases.length - 1].date)}–${year(releases[0].date)}`], title: `<span id="h-disco">${T("Uscite")}</span>`, lede: T("Dal 2020 a oggi. Ogni uscita porta alle piattaforme.") })}
    <div class="disco">${releases.filter((r) => r !== album).map((r) => `<article class="rel">${cover(r, c, "sm")}<div class="meta mono"><span>${esc(T(r.type))}</span><span>${dDot(r.date)}</span></div><h3>${esc(r.title)}</h3>${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}<div class="links-row">${r.links.length ? r.links.map((l) => extLink(l.url, l.label)).join("") : ph("link da inserire")}${makingVideos.some((v) => v.project === r.title) ? `<a class="link-arrow" href="${c.to("video", "#making-" + slug(r.title))}">${T("Making of")}</a>` : ""}</div></article>`).join("")}</div>
    <div class="sec-foot">${site.social.filter((s) => ["Spotify", "Apple Music"].includes(s.label)).map((s) => extLink(s.url, T("Jediz su {p}", { p: s.label }))).join("")}</div>
  </div>
</section>`,
});

pages.live = layout("live", {
  theme: "t-paper",
  title: T("Live"),
  description: `${T("Concerti di Jediz con la band.")} ${next ? T("Prossima data: {d}, {v}, {c}.", { d: dDot(next.date), v: next.venue, c: next.city }) : ""}`,
  jsonld: ldEvents.length ? ldEvents : undefined,
  body: (c) => `
${pageHead({ c, label: T("Live"), title: T("Dal vivo"), lede: esc(live.intro) })}
${next ? `<section class="band t-night" aria-labelledby="h-next" data-expires="${next.date}">
  <div class="wrap big-date">
    <div><p class="mono mute">${T("Prossima data")}</p><p class="dd num">${dDot(next.date).slice(0, 5)}</p></div>
    <div class="info">
      <p class="mono mute">${dLong(next.date)}${next.time ? ` · ${T("ore {t}", { t: esc(next.time) })}` : ""}${next.context ? ` · ${esc(next.context)}` : ""}</p>
      <h3 id="h-next">${next.venue.split(" — ").map(esc).join("<br>")}</h3>
      <p class="mono">${esc(next.city)}</p>
      ${next.description ? `<p class="measure">${esc(next.description)}</p>` : ""}
      <div class="links-row">${extLink(next.ticket_url, next.ticket_label || T("Biglietti"))}${next.info_url ? extLink(next.info_url, next.info_label || T("Informazioni")) : ""}</div>
    </div>
  </div>
</section>` : ""}
<section class="band t-paper" aria-labelledby="h-dates">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-dates">${T("Prossime date")}</span><span class="mono mute">${upcoming.length}</span></div>
    <div class="stack" style="--s:16px">${upcoming.length ? `<ol class="dates">${upcoming.map((d) => dateRow(d)).join("")}</ol>` : `<p>${T("Nuove date in arrivo.")}</p>`}</div>
  </div>
</section>
<section class="band t-paper" style="padding-top:0" aria-labelledby="h-band">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-band">${T("Formazione")}</span><span class="mono mute">${T("{n} elementi", { n: live.band.length })}</span></div>
    <div class="stack" style="--s:16px">${lineup()}${live.formation_note ? `<p class="mute">${esc(live.formation_note)}</p>` : ""}<div class="links-row"><a class="link-arrow" href="${c.to("archivio", "#jdz-05")}">${T("Scheda tecnica")}</a><a class="link-arrow" href="${c.to("contatti", "#booking")}">Booking</a></div></div>
  </div>
</section>
<section class="band t-night" aria-labelledby="h-lmedia">
  <div class="wrap">
    ${secHead({ label: T("Dal palco"), meta: [T("Foto e video")], title: `<span id="h-lmedia">${T("Immagini dal live")}</span>` })}
    <div class="vgrid">${videosData.videos.filter((v) => v.category === "Live").map((v) => videoCard(v, c)).join("")}${photosData.photos.filter((p) => p.category === "Live" && p.src).sort((a, b) => (b.feature ? 1 : 0) - (a.feature ? 1 : 0)).slice(0, 2).map((p) => photoItem({ ...p, shape: "wide" }, c)).join("")}</div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("foto")}">${T("Tutte le foto")}</a></div>
  </div>
</section>
<section class="band t-paper" aria-labelledby="h-past">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-past">${T("Date passate")}</span><span class="mono mute">${past.length}</span></div>
    <div class="stack" style="--s:16px"><ol class="dates">${past.map((d) => dateRow(d, true)).join("")}</ol>${live.tour_note ? `<p>${ph(live.tour_note)}</p>` : ""}</div>
  </div>
</section>
<section class="band t-night" aria-labelledby="h-posters">
  <div class="wrap">
    ${secHead({ label: T("Locandine"), meta: [T("{n} locandine", { n: datesSorted.filter((d) => d.poster).length })], title: `<span id="h-posters">${T("Le date")}</span>` })}
    <div class="gigs">${[...datesSorted].reverse().map((d) => gigCard(d, c)).join("")}</div>
  </div>
</section>`,
});

pages.video = layout("video", {
  theme: "t-night",
  title: T("Video"),
  description: T("Video di Jediz: live, session, videoclip, making of."),
  body: (c) => `
${pageHead({ c, label: T("Video"), title: T("Video"), lede: T("Live, session, videoclip e making of.") })}
<section class="band t-night" style="padding-top:0" aria-label="${T("Elenco video")}">
  <div class="wrap">
    ${filters(videosData.categories.filter((k) => k !== MAKING), "video")}
    <div class="vgrid feature" data-filterable="video">${mainVideos.map((v) => videoCard(v, c)).join("")}</div>
    <div class="sec-foot"><a class="link-arrow" href="#making-of">${T("Making of")}</a>${extLink(site.social.find((s) => s.label === "YouTube")?.url, T("Canale YouTube"))}</div>
  </div>
</section>
<section class="band t-paper" id="making-of" aria-labelledby="h-making">
  <div class="wrap">
    ${secHead({ label: T("Making of"), meta: [makingVideos.length ? T("{n} clip", { n: makingVideos.length }) : "", makingList.length === 1 ? T("1 progetto") : T("{n} progetti", { n: makingList.length })].filter(Boolean), title: `<span id="h-making">${T("Come sono nati")}</span>`, lede: T("Studio, provini, set, prove. Il dietro le quinte dei dischi.") })}
    ${makingList.map((p) => {
      const clips = makingVideos.filter((v) => v.project === p);
      const r = relByTitle(p);
      return `<div class="rail making" id="making-${slug(p)}">
      <div class="rail-meta making-meta">${r ? cover(r, c, "sm") : ""}<span class="mono">${esc(p)}</span><span class="mono mute">${r ? `${esc(T(r.type))} · ${year(r.date)}` : ""}${clips.length ? ` · ${T("{n} clip", { n: clips.length })}` : ""}</span></div>
      <div class="making-strip">${clips.length ? clips.map((v) => videoCard(v, c)).join("") : `<div class="vcard is-vertical"><div class="vframe vertical">${phBlock(T("Clip da inserire"))}</div></div><div class="vcard is-vertical"><div class="vframe vertical">${phBlock(T("Clip da inserire"))}</div></div><div class="vcard is-vertical"><div class="vframe vertical">${phBlock(T("Clip da inserire"))}</div></div>`}</div>
    </div>`;
    }).join("")}
  </div>
</section>`,
});

pages.archivio = layout("archivio", {
  theme: "t-paper",
  title: T("Archivio"),
  description: T("Materiali professionali di Jediz: presentazione, dossier cinema, testi, bio, scheda tecnica, rassegna stampa."),
  body: (c) => `
${pageHead({ c, label: T("Archivio"), title: T("Archivio"), lede: `${T("Documenti per chi lavora con il progetto: booking, cinema, stampa, festival. Si aprono nel browser; si possono scaricare.")}${IS_IT ? "" : ` ${T("I documenti sono in italiano.")}`}` })}
<section class="band t-paper" style="padding-top:0" aria-label="${T("Documenti")}">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Documenti")}</span><span class="mono mute">${T("{n} disponibili", { n: docs.filter((d) => d.status !== "draft").length })} · ${T("{n} in preparazione", { n: docs.filter((d) => d.status === "draft").length })}</span></div><div class="docs">${docs.map((d) => docCard(d, c)).join("")}</div></div>
</section>
<section class="band t-paper" style="padding-top:0" aria-label="Media">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Rassegna stampa")}</span></div><div class="links-row"><a class="link-arrow" href="${c.to("media")}">${T("Articoli, interviste e radio")}</a></div></div>
</section>
<section class="band t-night" aria-labelledby="h-need">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Altro")}</span></div>
  <div class="stack" style="--s:20px"><h2 class="serif" style="font-size:var(--step-3);line-height:1.05" id="h-need">${T("Serve qualcos'altro?")}</h2><p class="measure mute">${T("Foto in alta risoluzione, rider, materiali per un bando o per la stampa: scrivete ai contatti.")}</p><a class="link-arrow" href="${c.to("contatti")}">${T("Contatti")}</a></div></div>
</section>`,
});

const typeOrder = ["Intervista", "Video", "Radio", "Podcast", "Articolo", "Social", "Segnalazione"];
// anteprima video: YouTube (link o ID), Dailymotion, oppure immagine "thumb"
const mediaPreview = (it) => {
  const yt = ytId(it.youtube) || ytId(it.url);
  if (yt) return { yt, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` };
  const dm = dmId(it.url);
  if (dm) return { thumb: `https://www.dailymotion.com/thumbnail/video/${dm}` };
  if (it.thumb) return { thumb: it.thumb, local: true };
  return null;
};
const mediaVideos = media.items.filter((it) => mediaPreview(it));
const mediaList = media.items.filter((it) => !mediaPreview(it));
const mediaGroups = [];
[...mediaList].sort((a, b) => (b.date || "").localeCompare(a.date || "")).forEach((it) => {
  const key = it.topic || T("Altre uscite");
  let g = mediaGroups.find((x) => x.key === key);
  if (!g) mediaGroups.push((g = { key, items: [] }));
  g.items.push(it);
});
mediaGroups.forEach((g) => g.items.sort((a, b) => (typeOrder.indexOf(a.type) + 1 || 99) - (typeOrder.indexOf(b.type) + 1 || 99) || (b.date || "").localeCompare(a.date || "")));
const mDate = (d) => (d ? d.split("-").reverse().join(".") : "");
function mediaVideoCard(it, c) {
  const pv = mediaPreview(it);
  const thumb = pv.local ? img(c, pv.thumb, 960) : pv.thumb;
  const play = `<span>${ICON.play.replace('class="i-play" ', "")}</span>`;
  const link = pv.yt
    ? `<a class="vplay" href="https://www.youtube.com/watch?v=${esc(pv.yt)}" target="_blank" rel="noopener" data-yt="${esc(pv.yt)}" aria-label="${esc(T("Guarda: {t}", { t: it.title }))}">${play}</a>`
    : `<a class="vplay" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="${esc(T("Guarda: {t}", { t: it.title }))}">${play}</a>`;
  return `<article class="vcard"><div class="vframe"><img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">${link}</div><div class="vmeta mono"><span>${esc(it.outlet)} · ${esc(T(it.type))}</span><span>${mDate(it.date)}</span></div><h3>${esc(it.title)}</h3>${it.topic ? `<p>${esc(it.topic)}</p>` : ""}</article>`;
}
const hasInterviews = media.items.some((it) => ["Intervista", "Radio", "Podcast"].includes(it.type));
pages.media = layout("media", {
  theme: "t-paper",
  title: T("Media"),
  description: T("Jediz sulla stampa: interviste, articoli, video, segnalazioni."),
  body: (c) => `
${pageHead({ c, label: T("Media"), title: T("Media"), lede: `${esc(media.intro)}${IS_IT ? "" : ` ${T("Gli articoli sono in italiano.")}`}` })}
${mediaVideos.length ? `<section class="band t-night" aria-labelledby="h-mvideo">
  <div class="wrap">
    ${secHead({ label: T("Video"), meta: [`${mediaVideos.length} video`], title: `<span id="h-mvideo">${T("Video e interviste")}</span>` })}
    <div class="vgrid">${mediaVideos.map((it) => mediaVideoCard(it, c)).join("")}</div>
  </div>
</section>` : ""}
${mediaGroups.map((g, gi) => `<section class="band t-paper"${gi === 0 && !mediaVideos.length ? ' style="padding-top:0"' : gi > 0 ? ' style="padding-top:0"' : ""} aria-label="${esc(g.key)}">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono">${esc(g.key)}</span><span class="mono mute">${g.items.length === 1 ? T("1 uscita") : T("{n} uscite", { n: g.items.length })}</span></div>
    <ul class="press">${g.items.map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><span class="o">${esc(p.outlet)}<br><span class="mute">${esc(T(p.type))}</span></span><span class="t">${esc(p.title)}</span><span class="dt">${mDate(p.date)}</span></a></li>`).join("")}</ul>
  </div>
</section>`).join("")}
${hasInterviews ? "" : `<section class="band t-paper" style="padding-top:0" aria-label="${T("Da aggiungere")}">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Interviste")}</span></div><p>${ph("interviste, radio e podcast da inserire")}</p></div>
</section>`}
<section class="band t-night" aria-labelledby="h-forpress">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Per la stampa")}</span></div>
  <div class="stack" style="--s:20px"><h2 class="serif" style="font-size:var(--step-3);line-height:1.05" id="h-forpress">${T("Materiali e contatti")}</h2><p class="measure mute">${T("Bio, foto stampa e presentazione del progetto sono nell'archivio.")}</p><div class="links-row"><a class="link-arrow" href="${c.to("archivio")}">${T("Archivio")}</a><a class="link-arrow" href="${c.to("contatti", "#press")}">Press / Media</a></div></div></div>
</section>`,
});

const w0 = cinema.works[0];
const cinemaDoc = docByCode("JDZ/02");
pages.cinema = layout("cinema", {
  theme: "t-night",
  title: T("Cinema"),
  description: T("Jediz e il cinema: {t}, {k} con la colonna sonora Tempo al tempo.", { t: w0.title, k: w0.kind.toLowerCase() }),
  body: (c) => `
${pageHead({ c, label: T("Cinema"), title: T("Cinema"), lede: esc(cinema.intro) })}
<section class="band t-night" style="padding-top:0" aria-labelledby="h-w0">
  <div class="wrap stack" style="--s:40px">
    <div class="frame-169">${w0.image ? `<img src="${esc(c.asset(w0.image))}" alt="${esc(w0.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : phBlock(`${T("Fotogramma")} · ${w0.title} · ${T("da inserire")}`)}</div>
    <div class="work">
      <div class="stack" style="--s:16px"><p class="kind mono">${esc(w0.kind)} · ${esc(w0.year)}</p><h3 id="h-w0">${esc(w0.title)}</h3><p class="measure" style="font-size:var(--step-1)">${esc(w0.description)}</p><div class="links-row">${extLink(w0.listen_url, T("Ascolta Tempo al tempo"))}</div></div>
      <dl class="credits">${w0.credits.map((x) => `<dt>${esc(T(x.role))}</dt><dd>${val(x.value)}</dd>`).join("")}</dl>
    </div>
  </div>
</section>
${cinema.works.length > 1 ? `<section class="band t-night" style="padding-top:0"><div class="wrap"><ol class="dates">${cinema.works.slice(1).map((w) => `<li class="date-row work-row"><span class="when">${esc(w.year)}${w.status ? `<small class="mono mute">${esc(w.status)}</small>` : ""}</span><span class="what"><b>${w.title ? esc(w.title) : ph("titolo da confermare")}</b><span class="mute">${esc(w.description)}</span>${w.credits?.length ? `<span class="wcred mono mute">${w.credits.filter((x) => x.role !== "Uscita").map((x) => `${esc(T(x.role))} ${esc(x.value)}`).join(" · ")}</span>` : ""}${w.url ? extLink(w.url, w.url_label || T("Scheda")) : ""}</span><span class="where">${esc(w.kind)}</span></li>`).join("")}</ol></div></section>` : ""}
${cinema.future_note ? `<section class="band t-night" style="padding-top:0"><div class="wrap rail"><div class="rail-meta"><span class="mono">${T("In arrivo")}</span></div><p>${esc(cinema.future_note)}</p></div></section>` : ""}
<section class="band t-paper" aria-labelledby="h-cd">
  <div class="wrap grid-2">
    <div class="docs" style="grid-template-columns:minmax(0,320px)">${cinemaDoc ? docCard(cinemaDoc, c) : ""}</div>
    <div class="stack" style="--s:18px"><p class="mono mute">${T("Per registi, produzioni, music supervisor")}</p><h2 class="serif" style="font-size:var(--step-3);line-height:1.05" id="h-cd">${T("Colonne sonore e sincronizzazioni")}</h2><p class="measure">${T("Per usare un brano esistente o parlare di musica originale per un progetto, il contatto è unico.")}</p><a class="link-arrow" href="${c.to("contatti", "#collab")}">${T("Collaborazioni")}</a></div>
  </div>
</section>`,
});

const featured = textsData.texts.filter((t) => t.featured && t.excerpt);
const textsDoc = docByCode(textsData.pdf_code);
const textsPages = textsDoc && textsDoc.status !== "draft" ? docPages(textsDoc.file) : [];
const textGroups = [];
textsData.texts.forEach((t) => { let g = textGroups.find((x) => x.release === t.release); if (!g) textGroups.push((g = { release: t.release, kind: t.kind, year: t.year, items: [] })); g.items.push(t); });
const pageLink = (t, c) => (textsPages.length && t.page ? `<button class="tr mono rd-link" type="button"${readerAttrs(textsDoc, c, t.page - 1)}>${T("Leggi · p. {n}", { n: esc(t.page) })}</button>` : "");
pages.testi = layout("testi", {
  theme: "t-paper",
  title: T("Testi"),
  description: T("I testi di Jediz dal 2020 a oggi: la raccolta completa da sfogliare o scaricare in PDF."),
  body: (c) => `
${pageHead({ c, label: T("Testi"), title: `<span class="it">${T("Testi")}</span>`, lede: `${esc(textsData.intro)}${IS_IT ? "" : ` ${T("I testi sono in italiano, la lingua in cui sono stati scritti.")}`}` })}
${textsDoc ? `<section class="band t-paper" style="padding-top:0" aria-labelledby="h-book">
  <div class="wrap book">
    ${textsPages.length ? `<button class="book-cover" type="button"${readerAttrs(textsDoc, c)} aria-label="${esc(T("Sfoglia: {t}", { t: textsDoc.title }))}"><img src="${esc(img(c, textsPages[0], 900))}" alt="${esc(T("Copertina di {t}", { t: textsDoc.title }))}" loading="lazy" decoding="async"></button>` : ""}
    <div class="stack" style="--s:18px">
      <p class="mono mute">${esc(textsDoc.code)} · ${esc(textsDoc.kind)}${textsPages.length ? ` · ${T("{n} pagine", { n: textsPages.length })}` : ""}</p>
      <h2 class="serif" id="h-book" style="font-size:var(--step-3);line-height:1.02">${esc(textsDoc.title)}</h2>
      <p class="measure">${esc(textsDoc.description)}</p>
      <div class="links-row">${textsPages.length ? `<button class="link-arrow" type="button"${readerAttrs(textsDoc, c)}>${T("Sfoglia")}</button>` : ""}${textsDoc.file && textsDoc.status !== "draft" ? `<a class="link-arrow ext" href="${esc(c.asset(textsDoc.file))}" target="_blank" rel="noopener">PDF</a>` : ph("PDF da caricare")}</div>
      ${textsPages.length > 2 ? `<div class="book-strip" aria-label="${T("Pagine")}">${textsPages.slice(1, 7).map((pg, i) => `<button type="button"${readerAttrs(textsDoc, c, i + 1)} aria-label="${T("Pagina")} ${i + 2}"><img src="${esc(img(c, pg, 320))}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>` : ""}
    </div>
  </div>
</section>` : ""}
${featured.length ? `<section class="band t-paper" style="padding-top:0" aria-label="${T("Estratti")}">
  <div class="wrap">
    ${featured.map((t) => `<article class="verse" id="${slug(t.title)}"><div class="rail-meta stack" style="--s:6px"><p class="mono">${esc(t.title)}</p><p class="mono mute">${esc(t.release)} · ${esc(t.year)}</p></div><blockquote>${esc(t.excerpt)}</blockquote></article>`).join("")}
  </div>
</section>` : ""}
${textGroups.map((g, gi) => `<section class="band t-paper"${gi ? ' style="padding-top:0"' : ""} aria-label="${esc(g.release)}">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono">${esc(g.release)}</span><span class="mono mute">${[T(g.kind || ""), g.year].filter(Boolean).map(esc).join(" · ")}</span></div>
    <ol class="tindex">${g.items.map((t) => `<li id="t-${slug(t.title)}">${t.full ? `<details><summary><span class="tt">${esc(t.title)}</span><span class="tr mono">${T("Leggi il testo")}</span></summary><div class="lyric">${esc(t.full)}</div></details>` : `<div class="row"><span class="tt">${esc(t.title)}</span>${pageLink(t, c) || `<span class="tr mono">${esc(t.year)}</span>`}</div>`}</li>`).join("")}</ol>
  </div>
</section>`).join("")}`,
});

pages.foto = layout("foto", {
  theme: "t-night",
  title: T("Foto"),
  description: T("Fotografie di Jediz: ritratti, lo shooting di Dr. Jediz & Mr. I, i concerti."),
  body: (c) => `
${pageHead({ c, label: T("Foto"), title: T("Foto"), lede: T("Ritratti, lo shooting del disco, i concerti. Sotto ogni foto, chi l'ha scattata.") })}
<section class="band t-night" style="padding-top:0" aria-label="${T("Fotografie")}">
  <div class="wrap">
    ${filters(photosData.categories, "foto")}
    <div class="pgrid" data-filterable="foto">${photosData.photos.map((p) => photoItem(p, c)).join("")}</div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("archivio", "#jdz-06")}">${T("Foto stampa in alta risoluzione")}</a></div>
  </div>
</section>
`,
});

const bioDoc = docByCode(bio.pdf_code);
pages.bio = layout("bio", {
  theme: "t-paper",
  title: T("Bio"),
  description: bio.short,
  jsonld: [ldArtist],
  body: (c) => `
${pageHead({ c, label: T("Bio"), title: T("Bio") })}
<section class="band t-paper" style="padding-top:0" aria-label="${T("Bio breve")}">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Breve")}</span><span class="mono mute">${T("{n} battute", { n: bio.short.length })}</span></div><p class="bio-short">${esc(bio.short)}</p></div>
</section>
${[bio.photo, bio.photo_alt].some((x) => x && x.src) ? `<section class="band t-paper" style="padding-top:0" aria-label="${T("Fotografie")}">
  <div class="wrap rail"><div class="rail-meta"><span class="mono mute">${T("Foto")}</span></div><div class="bio-pair">${[bio.photo, bio.photo_alt].filter((x) => x && x.src).map((x) => portrait(x, c)).join("")}</div></div>
</section>` : ""}
<section class="band t-paper" style="padding-top:0" aria-label="${T("Bio estesa")}">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Estesa")}</span>${bioDoc ? `<a class="link-arrow" style="margin-top:12px;align-self:start" href="${c.to("archivio", "#" + slug(bioDoc.code))}">${T("Bio in PDF")}</a>` : ""}</div>
  <div class="bio-long">${bio.long.map((p) => `<p>${esc(p)}</p>`).join("")}</div></div>
</section>
<section class="band t-night" aria-label="${T("Collegamenti")}">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">${T("Vedi anche")}</span></div>
  <div class="links-row"><a class="link-arrow" href="${c.to("musica")}">${T("Musica")}</a><a class="link-arrow" href="${c.to("live")}">${T("Live")}</a><a class="link-arrow" href="${c.to("foto")}">${T("Foto")}</a><a class="link-arrow" href="${c.to("contatti", "#press")}">Press</a></div></div>
</section>`,
});

// Contatti: se tutte le voci hanno la stessa email, un solo indirizzo grande e le voci diventano "oggetti" della mail
const mails = [...new Set(site.contacts.map((k) => k.email).filter(Boolean))];
const oneMail = mails.length === 1 && site.contacts.every((k) => k.email === mails[0]);
function contactSingle() {
  const m = mails[0];
  const who = site.contacts[0].name;
  const subj = (k) => encodeURIComponent(`${k.label.split(" /")[0]} — Jediz`);
  return `<div class="cmail">
    <p class="mono mute">${T("Un solo indirizzo")}${who ? ` · ${esc(who)}` : ""}</p>
    <a class="cmail-addr" href="mailto:${esc(m)}">${esc(m.replace("@", "\u200b@"))}</a>
    <div class="links-row"><a class="link-arrow" href="mailto:${esc(m)}">${T("Scrivi")}</a><button class="copy" type="button" data-copy="${esc(m)}">${T("Copia indirizzo")}</button></div>
  </div>
  <div class="rail csubj"><div class="rail-meta"><span class="mono">${T("Nell'oggetto")}</span><span class="mono mute">${T("Così arriva prima a chi deve")}</span></div>
    <ol class="csubj-list">${site.contacts.map((k, i) => `<li id="${esc(k.id)}"><a href="mailto:${esc(m)}?subject=${subj(k)}"><span class="n mono mute">${String(i + 1).padStart(2, "0")}</span><span class="t">${esc(k.label)}</span><span class="d mute">${esc(k.note)}</span><span class="go mono">${T("Scrivi")} →</span></a></li>`).join("")}</ol>
  </div>`;
}
pages.contatti = layout("contatti", {
  theme: "t-paper",
  title: T("Contatti"),
  description: T("Contatti di Jediz: booking e live, press, collaborazioni, informazioni generali."),
  body: (c) => `
${pageHead({ c, label: T("Contatti"), title: T("Contatti"), lede: oneMail ? T("Un indirizzo per tutto. Indicate nell'oggetto di cosa si tratta.") : T("Scrivete direttamente all'indirizzo giusto.") })}
<section class="band t-paper" style="padding-top:0" aria-label="${T("Indirizzi")}">
  <div class="wrap">${oneMail ? contactSingle() : `<div class="contacts">${site.contacts.map((k) => `<article class="contact" id="${esc(k.id)}"><p class="mono mute">${esc(k.label)}</p><h3>${k.name ? esc(k.name) : esc(k.label.split(" /")[0])}</h3><p class="mute">${esc(k.note)}</p><div class="addr">${k.email ? `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a><button class="copy" type="button" data-copy="${esc(k.email)}">${T("Copia")}</button>` : ph("email da inserire")}</div></article>`).join("")}</div>`}</div>
</section>
<section class="band t-night" aria-labelledby="h-soc">
  <div class="wrap rail"><div class="rail-meta"><span class="mono" id="h-soc">${T("Canali")}</span></div>
  <ul class="social-list">${site.social.map((s) => `<li><span>${esc(s.label)}</span>${s.url ? `<a class="link-arrow ext" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.handle || T("Apri"))}</a>` : ph("link da inserire")}</li>`).join("")}</ul></div>
</section>`,
});

const page404 = layout("404", {
  theme: "t-night",
  title: T("Pagina non trovata"),
  ogPath: "404.html",
  body: (c) => `<section class="band t-night"><div class="wrap stack" style="--s:24px"><p class="mono mute">404</p><h1 class="serif" style="font-size:var(--step-4);line-height:.95">${T("<span class=\"it\">Qui</span> non c'è niente.")}</h1><div class="links-row"><a class="link-arrow" href="${c.to("home")}">${T("Home")}</a><a class="link-arrow" href="${c.to("musica")}">${T("Musica")}</a><a class="link-arrow" href="${c.to("contatti")}">${T("Contatti")}</a></div></div></section>`,
});

// ---------- scrittura ----------
// L'italiano (lingua principale) ripulisce dist/ e scrive radice, file comuni e sitemap; poi rigenera le altre lingue nelle loro cartelle.
if (IS_IT && existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
for (const p of PAGES) {
  const file = PREVIEW ? (p.id === "home" ? "index.html" : `${p.path}.html`) : join(p.path, "index.html");
  mkdirSync(dirname(join(OUT, file)), { recursive: true });
  writeFileSync(join(OUT, file), pages[p.id]);
}
if (!PREVIEW) writeFileSync(join(OUT, "404.html"), page404);
if (!PREVIEW && IS_IT) {
  cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
  mkdirSync(join(OUT, "assets/css"), { recursive: true });
  mkdirSync(join(OUT, "assets/js"), { recursive: true });
  writeFileSync(join(OUT, "assets/css/site.css"), css);
  writeFileSync(join(OUT, "assets/js/site.js"), js);
  if (existsSync(join(ROOT, "admin"))) cpSync(join(ROOT, "admin"), join(OUT, "admin"), { recursive: true });
  writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${abs("sitemap.xml")}\n`);
  // sitemap con tutte le lingue: ogni pagina indica le sue versioni tradotte
  const loc = (l, p) => abs(l.dir + (p.path ? p.path + "/" : ""));
  writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${LANGS.flatMap((l) => PAGES.map((p) => `  <url><loc>${loc(l, p)}</loc><lastmod>${todayRome}</lastmod>${LANGS.map((a) => `<xhtml:link rel="alternate" hreflang="${a.html}" href="${loc(a, p)}"/>`).join("")}</url>`)).join("\n")}\n</urlset>\n`);
  // cache: font e immagini ridimensionate non cambiano mai; PDF e caricamenti possono essere sostituiti con lo stesso nome
  writeFileSync(join(OUT, "_headers"), [
    "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin",
    "/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable",
    "/assets/_r/*\n  Cache-Control: public, max-age=31536000, immutable",
    "/assets/img/*\n  Cache-Control: public, max-age=604800",
    "/assets/uploads/*\n  Cache-Control: public, max-age=86400",
    "/assets/video/*\n  Cache-Control: public, max-age=86400",
    "/assets/docs/*\n  Cache-Control: public, max-age=3600",
    "/assets/css/*\n  Cache-Control: public, max-age=3600",
    "/assets/js/*\n  Cache-Control: public, max-age=3600",
  ].join("\n") + "\n");
  writeFileSync(join(ROOT, ".used-images.txt"), [...USED_IMAGES].sort().join("\n") + "\n");
}
console.log(`✓ ${L.short}  ${PAGES.length} pagine in ${OUT.replace(ROOT + "/", "")}${IS_IT ? `  (oggi: ${todayRome}, prossima data: ${next ? next.date : "nessuna"})` : ""}${MISSING.size ? `  · ${MISSING.size} testi senza traduzione (vedi .i18n-mancanti-${L.code}.txt)` : ""}`);
if (!IS_IT) writeFileSync(join(ROOT, `.i18n-mancanti-${L.code}.txt`), [...MISSING].sort().join("\n") + "\n");
if (!PREVIEW && IS_IT) {
  const { execFileSync } = await import("node:child_process");
  for (const l of LANGS.slice(1)) execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--lang=${l.code}`], { stdio: "inherit" });
}
