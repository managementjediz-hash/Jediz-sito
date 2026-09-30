#!/usr/bin/env node
// JEDIZ — generatore statico senza dipendenze.
// Uso:  node build.mjs            → dist/ con URL puliti (/musica/)
//       node build.mjs --preview  → preview/ con pagine piatte (musica.html), CSS/JS in linea
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PREVIEW = process.argv.includes("--preview");
const OUT = join(ROOT, PREVIEW ? "preview" : "dist");

const load = (f) => JSON.parse(readFileSync(join(ROOT, "content", f), "utf8"));
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
const ph = (label = "da inserire") => `<span class="ph">${esc(label)}</span>`;
const phBlock = (label) => `<div class="ph-block" role="img" aria-label="Segnaposto: ${esc(label)}">${esc(label)}</div>`;
const val = (v, label) => (v && String(v).trim() ? esc(v) : ph(label));
const isExt = (u) => /^https?:\/\//.test(u || "");
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MESI_L = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const parts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
const dDot = (iso) => { if (!iso) return ""; if (/^\d{4}$/.test(iso)) return iso; const { y, m, d } = parts(iso); return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`; };
const dLong = (iso) => { const { y, m, d } = parts(iso); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${GIORNI[wd]} ${d} ${MESI_L[m - 1]} ${y}`; };
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
const projectsWithClips = [...new Set(makingVideos.map((v) => v.project).filter(Boolean))];
const makingList = [...makingProjects.filter((p) => !projectsWithClips.length || projectsWithClips.includes(p)), ...projectsWithClips.filter((p) => !makingProjects.includes(p))];
const relByTitle = (t) => releases.find((r) => r.title === t && r.tracks && r.tracks.length) || releases.find((r) => r.title === t);

// ---------- pagine e percorsi ----------
const PAGES = [
  { id: "home", path: "", label: "Home" },
  { id: "musica", path: "musica", label: "Musica", n: `${releases.reduce((a, r) => a + (r.tracks || []).length, 0)} brani` },
  { id: "live", path: "live", label: "Live", n: next ? dDot(next.date).slice(0, 5) : "" },
  { id: "video", path: "video", label: "Video" },
  { id: "archivio", path: "archivio", label: "Archivio", n: `${docs.length} doc.` },
  { id: "media", path: "media", label: "Media", n: `${media.items.length} uscite` },
  { id: "cinema", path: "cinema", label: "Cinema" },
  { id: "testi", path: "testi", label: "Testi" },
  { id: "foto", path: "foto", label: "Foto" },
  { id: "bio", path: "bio", label: "Bio" },
  { id: "contatti", path: "contatti", label: "Contatti" },
];
const NAV = PAGES.filter((p) => p.id !== "home");

function ctx(pageId) {
  const depth = PREVIEW || pageId === "home" || pageId === "404" ? 0 : 1;
  const pre = "../".repeat(depth);
  const to = (id, hash = "") => {
    const p = PAGES.find((x) => x.id === id);
    if (PREVIEW) return (id === "home" ? "index.html" : `${p.path}.html`) + hash;
    const target = id === "home" ? "" : `${p.path}/`;
    return (pre + target || "./") + hash;
  };
  const asset = (p) => (isExt(p) ? p : pre + p.replace(/^\//, ""));
  return { to, asset, pre };
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

// immagini caricate dal pannello: Netlify le ridimensiona al volo (niente foto da 8 MB in pagina)
function img(c, path, w) {
  if (!path) return "";
  if (PREVIEW || isExt(path) || /\.svg$/i.test(path)) return c.asset(path);
  return `/.netlify/images?url=/${encodeURI(path.replace(/^\//, ""))}&w=${w}&q=78`;
}

function cover(rel, c, size = "") {
  const t = esc(rel.title).replace(/ &amp; /, " &amp;<em> ") + (rel.title.includes(" & ") ? "</em>" : "");
  const fallback = `<div class="cover-fallback" aria-hidden="true"><span class="mono">${esc(rel.type)} · ${year(rel.date)}</span><span class="cf-title">${t}</span><span class="cf-meta mono"><span>Jediz</span><span>${rel.cover ? "" : "copertina da inserire"}</span></span></div>`;
  const img = rel.cover ? `<img src="${esc(c.asset(rel.cover))}" alt="Copertina di ${esc(rel.title)}" width="600" height="600" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('no-img')">` : "";
  return `<div class="cover ${size}${rel.cover ? "" : " no-img"}">${img}${fallback}</div>`;
}

function player(c, rels = [album]) {
  rels = rels.filter((r) => r.tracks && r.tracks.length);
  const multi = rels.length > 1;
  const tracks = [];
  rels.forEach((r, ri) => r.tracks.forEach((t) => tracks.push({ title: t.title, feat: t.feat || "", src: t.audio ? c.asset(t.audio) : t.preview || "", preview: !t.audio && !!t.preview, duration: t.duration, r: ri })));
  const relData = rels.map((r) => ({ type: r.type, date: dDot(r.date), links: r.links.filter((l) => l.url) }));
  let k = 0;
  const groups = rels.map((r, ri) => {
    const rows = r.tracks.map((t, j) => { const i = k++; return `<li><button class="track" type="button" data-i="${i}" aria-current="${i === 0}"><span class="n">${String(j + 1).padStart(2, "0")}</span><span class="t">${esc(t.title)}${t.feat ? `<small>feat. ${esc(t.feat)}</small>` : ""}</span><span class="d">${t.duration}</span></button></li>`; }).join("");
    return `${multi ? `<p class="tracks-head mono"><span>${esc(r.title)}</span><span class="mute">${esc(r.type)} · ${year(r.date)}</span></p>` : ""}<ol class="tracks">${rows}</ol>`;
  }).join("");
  const totalSec = tracks.reduce((a, t) => a + toSec(t.duration), 0);
  const covers = rels.map((r, ri) => `<div data-cover="${ri}"${ri ? " hidden" : ""}>${cover(r, c)}</div>`).join("");
  const first = tracks[0], r0 = rels[0];
  return `<div class="player${multi ? " multi" : ""}" data-player>
  <div class="player-cover">${covers}</div>
  <div class="now">
    <div class="now-sub mono"><span data-rtype>${esc(r0.type)}</span><span data-rdate>${dDot(r0.date)}</span><span data-kind>${first.preview ? "Anteprima 30″" : ""}</span></div>
    <p class="now-title" data-title aria-live="polite">${esc(first.title)}</p>
    <div class="controls">
      <button class="ctl" type="button" data-prev aria-label="Brano precedente">${ICON.prev}</button>
      <button class="ctl play" type="button" data-play aria-label="Riproduci">${ICON.play}${ICON.pause}</button>
      <button class="ctl" type="button" data-next aria-label="Brano successivo">${ICON.next}</button>
    </div>
    <div class="progress"><span data-cur>0:00</span><input class="seek" type="range" id="seek-${multi ? "all" : "album"}" min="0" max="1000" value="0" step="1" aria-label="Posizione nel brano" data-seek><span data-dur>${first.preview ? "0:30" : first.duration}</span></div>
    <p class="player-msg" data-msg></p>
    <div class="tracks-scroll">${groups}</div>
    <div class="tracks-total mono mute"><span>${tracks.length} brani${multi ? ` · ${rels.length} uscite` : ""}</span><span class="num">${fmtTotal(totalSec)}</span></div>
    <div class="links-row" data-rlinks>${r0.links.map((l) => extLink(l.url, l.label)).join("")}</div>
  </div>
  <script type="application/json" data-tracks>${JSON.stringify({ tracks, rels: relData }).replace(/</g, "\\u003c")}</script>
</div>`;
}

function slate(d, c, withLink = true) {
  if (!d) return `<div class="slate"><span class="label mono">Prossima data</span><span>Nuove date in arrivo. ${withLink ? `<a class="link-arrow" href="${c.to("live")}">Live</a>` : ""}</span></div>`;
  const { d: day, m, y } = parts(d.date);
  return `<div class="slate" data-expires="${d.date}">
  <div class="slate-date"><span class="d num">${day}</span><span class="m mono"><span>${MESI[m - 1]} ${y}</span><span class="mute">${d.time ? `ore ${esc(d.time)}` : ""}</span></span></div>
  <div class="slate-where"><span class="label mono">Prossima data${d.context ? ` · ${esc(d.context)}` : ""}</span><span class="v">${esc(d.venue)}, ${esc(d.city)}</span></div>
  <div class="slate-cta">${extLink(d.ticket_url, d.ticket_label || "Biglietti")}${d.info_url ? extLink(d.info_url, d.info_label || "Informazioni") : ""}${withLink ? `<a class="link-arrow" href="${c.to("live")}">Tutte le date</a>` : ""}</div>
</div>`;
}

function dateRow(d, isPast = false) {
  const links = [!isPast && (d.ticket_url || d.ticket_label !== "") ? extLink(d.ticket_url, d.ticket_label || "Biglietti") : "", d.info_url ? extLink(d.info_url, d.info_label || "Informazioni") : ""].join("");
  return `<li class="date-row${isPast ? " past" : ""}">
  <span class="when">${dDot(d.date)}${d.time ? ` · ${esc(d.time)}` : ""}</span>
  <span class="what"><b>${esc(d.title)}</b>${d.context ? `<span class="mono mute">${esc(d.context)}</span>` : ""}${d.description ? `<span class="mute">${esc(d.description)}</span>` : ""}${d.lineup && isPast ? `<span class="mute small">Con ${esc(d.lineup)}</span>` : ""}${!isPast && d.price ? `<span class="mono">Ingresso ${esc(d.price)}</span>` : ""}${links ? `<span class="links-row" style="margin-top:8px">${links}</span>` : ""}</span>
  <span class="where">${d.venue ? esc(d.venue) : ph("luogo")}${d.address ? `<br>${esc(d.address)}` : ""}<br>${esc(d.city)}</span>
</li>`;
}

// locandina + dati essenziali (home e pagina Live)
function gigCard(d, c) {
  const up = d.date >= todayRome;
  const cap = `${dDot(d.date)} · ${d.city} — ${d.title}`;
  const poster = d.poster
    ? `<button class="pf gig-poster" type="button" data-lb="${esc(img(c, d.poster, 1600))}" data-cap="${esc(cap)}" aria-label="Apri la locandina: ${esc(d.title)}"><img src="${esc(d.poster_thumb ? c.asset(d.poster_thumb) : img(c, d.poster, 600))}" alt="Locandina: ${esc(d.title)}, ${esc(d.city)}" loading="lazy" decoding="async"></button>`
    : `<div class="pf gig-poster">${phBlock("Locandina da inserire")}</div>`;
  return `<article class="gig${up ? " is-next" : ""}"${up ? ` data-expires="${d.date}" data-keep` : ""}>${poster}<div class="gig-meta mono"><span>${dDot(d.date)}</span><span>${esc(d.city)}</span></div><h3>${esc(d.title)}</h3><p class="mute">${d.venue ? esc(d.venue.split(" — ")[0]) : ""}${up ? ` <span class="tag mono">Prossima</span>` : ""}</p></article>`;
}

function lineup() {
  return `<ul class="lineup">${live.band.map((b) => `<li><span class="who">${esc(b.name)}</span><span class="ins mono">${esc(b.role)}</span></li>`).join("")}</ul>`;
}

function videoCard(v, c) {
  v = { ...v, youtube: ytId(v.youtube) || ytId(v.url) };
  if (v.youtube && ytId(v.url)) v.url = "";
  const title = v.title ? esc(v.title) : ph("titolo");
  const label = esc(v.title || "Video");
  let frame;
  if (v.file) {
    // video caricato sul sito (mp4): si carica solo quando si preme play
    frame = `<div class="vframe"><video controls playsinline preload="none"${v.poster ? ` poster="${esc(img(c, v.poster, 1200))}"` : ""} aria-label="${label}"><source src="${esc(c.asset(v.file))}" type="video/mp4"></video></div>`;
  } else if (v.youtube) {
    const thumb = v.thumb ? img(c, v.thumb, 960) : `https://i.ytimg.com/vi/${esc(v.youtube)}/hqdefault.jpg`;
    frame = `<div class="vframe"><img src="${thumb}" alt="" loading="lazy" decoding="async" width="480" height="360"><a class="vplay" href="https://www.youtube.com/watch?v=${esc(v.youtube)}" target="_blank" rel="noopener" data-yt="${esc(v.youtube)}" aria-label="Guarda: ${label}"><span>${ICON.play.replace('class="i-play" ', "")}</span></a></div>`;
  } else if (v.url) {
    // video su un'altra piattaforma (Instagram, Facebook, Vimeo…): anteprima e link esterno
    const bg = v.poster || v.thumb;
    frame = `<div class="vframe">${bg ? `<img src="${esc(img(c, bg, 960))}" alt="" loading="lazy" decoding="async">` : `<div class="vframe-bg"></div>`}<a class="vplay" href="${esc(v.url)}" target="_blank" rel="noopener" aria-label="Guarda: ${label}"><span>${ICON.play.replace('class="i-play" ', "")}</span></a></div>`;
  } else frame = `<div class="vframe">${phBlock(`Video · ${v.category} · da inserire`)}</div>`;
  if (v.vertical) frame = frame.replace('<div class="vframe">', '<div class="vframe vertical">');
  return `<article class="vcard${v.vertical ? " is-vertical" : ""}" data-cat="${esc(v.category)}">${frame}<div class="vmeta mono"><span>${esc(v.category)}</span><span>${v.date ? dDot(v.date) : ""}</span></div><h3>${title}</h3>${v.description ? `<p>${esc(v.description)}</p>` : ""}</article>`;
}

function filters(cats, group) {
  return `<div class="filters" role="group" aria-label="Filtra per categoria" data-filter="${group}"><button class="chip" type="button" aria-pressed="true" data-f="*">Tutti</button>${cats.map((k) => `<button class="chip" type="button" aria-pressed="false" data-f="${esc(k)}">${esc(k)}</button>`).join("")}</div>`;
}

function docCard(d, c) {
  const ready = d.status !== "draft";
  const sheet = d.thumb
    ? `<div class="sheet has-thumb"><img src="${esc(c.asset(d.thumb))}" alt="" loading="lazy"></div>`
    : `<div class="sheet" aria-hidden="true"><div class="s-top"><span>${esc(d.code)}</span><span>Jediz</span></div><div class="s-title">${esc(d.title)}<span>${esc(d.kind)}</span></div><div class="s-lines"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
  const meta = [d.version && `v. ${d.version}`, d.date && dDot(d.date), d.pages && `${d.pages} pp.`].filter(Boolean).join(" · ");
  let actions;
  if (!ready) actions = `<span class="status">In preparazione</span>`;
  else if (!d.file) actions = ph("PDF da caricare");
  else actions = `<a class="link-arrow ext" href="${esc(c.asset(d.file))}" target="_blank" rel="noopener">Apri</a><a class="link-arrow" href="${esc(c.asset(d.file))}" download>Scarica PDF</a>`;
  return `<article class="doc" id="${slug(d.code)}">${sheet}<div class="d-head mono"><span>${esc(d.code)}</span><span>${meta || esc(d.kind)}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.description)}</p><div class="actions">${actions}</div></article>`;
}

function photoItem(p, c) {
  const inner = p.src
    ? `<button class="pf" type="button" data-lb="${esc(img(c, p.src, 2000))}" data-cap="${esc(p.caption)}${p.credit ? " — foto " + esc(p.credit) : ""}" aria-label="Apri foto: ${esc(p.alt || p.caption)}"><img src="${esc(p.thumb ? c.asset(p.thumb) : img(c, p.src, 900))}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></button>`
    : `<div class="pf">${phBlock(`Foto · ${p.category}`)}</div>`;
  return `<figure class="ph-item ${esc(p.shape || "square")}" data-cat="${esc(p.category)}">${inner}<figcaption class="mono"><span>${p.caption ? esc(p.caption) : esc(p.category)}</span><span>${p.credit ? "© " + esc(p.credit) : ""}</span></figcaption></figure>`;
}

function secHead({ label, meta = [], title, lede }) {
  return `<div class="rail sec-head"><div class="rail-meta"><span class="mono">${label}</span>${meta.map((m) => `<span class="mono mute">${m}</span>`).join("")}</div><div class="stack" style="--s:16px"><h2>${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ""}</div></div>`;
}

function pageHead({ label, title, lede, c }) {
  return `<header class="page-head wrap"><nav class="crumbs mono" aria-label="Percorso"><a href="${c.to("home")}">Jediz</a><span aria-hidden="true">/</span><span>${label}</span></nav><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</header>`;
}

// ---------- layout ----------
const css = readFileSync(join(ROOT, "src", "site.css"), "utf8");
const js = readFileSync(join(ROOT, "src", "site.js"), "utf8");

function layout(pageId, { title, description, theme = "t-paper", body, jsonld, ogPath = "" }) {
  const c = ctx(pageId);
  const page = PAGES.find((p) => p.id === pageId);
  const canonical = abs(page ? (page.path ? page.path + "/" : "") : ogPath);
  const fullTitle = pageId === "home" ? `${site.name} — Musica, live, materiali` : `${title} — ${site.name}`;
  const nav = NAV.map((p) => `<li><a href="${c.to(p.id)}" data-n="${esc(p.n || "")}"${p.id === pageId ? ' aria-current="page"' : ""}>${p.label}</a></li>`).join("");
  const socials = site.social.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : `<span>${esc(s.label)} ${ph("link")}</span>`}</li>`).join("");
  const styles = PREVIEW
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=IBM+Plex+Mono:wght@400;500&display=swap"><style>${css.replace(/@font-face\s*{[^}]*}\s*/g, "")}</style>`
    : `<link rel="preload" href="${c.asset("assets/fonts/bodoni-moda.woff2")}" as="font" type="font/woff2" crossorigin><link rel="preload" href="${c.asset("assets/fonts/archivo.woff2")}" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${c.asset("assets/css/site.css")}">`;
  const script = PREVIEW ? `<script>${js}</script>` : `<script src="${c.asset("assets/js/site.js")}" defer></script>`;
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0E0F12">
<meta property="og:type" content="${pageId === "musica" ? "music.album" : "website"}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${abs("assets/img/og.png")}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="it_IT">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${c.asset("assets/img/favicon.svg")}" type="image/svg+xml">
<link rel="icon" href="${c.asset("assets/img/favicon-32.png")}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${c.asset("assets/img/apple-touch-icon.png")}">
${styles}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body class="${theme}">
<a class="skip" href="#main">Vai al contenuto</a>
<header class="site-header ${theme}">
  <div class="wrap">
    <a class="mark" href="${c.to("home")}" aria-label="Jediz, home"><span class="mark-a">${logo(c, theme === "t-paper")}</span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Principale"><ul>${nav}</ul></nav>
  </div>
</header>
<main id="main">
${body(c)}
</main>
<footer class="site-footer t-night">
  <div class="wrap">
    <div class="foot-grid">
      <div class="stack" style="--s:18px"><p class="foot-mark">${logo(c)}</p><p class="mono mute">${esc(site.city)}</p></div>
      <div class="stack" style="--s:14px"><p class="mono mute">Canali</p><ul class="foot-list">${socials}</ul></div>
      <div class="stack" style="--s:14px"><p class="mono mute">Sito</p><ul class="foot-list">${NAV.map((p) => `<li><a href="${c.to(p.id)}">${p.label}</a></li>`).join("")}</ul></div>
    </div>
    <div class="foot-base mono"><span>© ${todayRome.slice(0, 4)} Jediz</span><a href="${c.to("contatti")}">Contatti</a></div>
  </div>
</footer>
<div class="lightbox" hidden data-lightbox role="dialog" aria-modal="true" aria-label="Immagine">
  <div class="lb-top mono"><span data-lb-count></span><button type="button" class="copy" data-lb-close>Chiudi ✕</button></div>
  <div class="lb-stage"><img alt="" data-lb-img></div>
  <p class="lb-cap mono" data-lb-cap></p>
</div>
<div class="mini t-night" data-mini aria-hidden="true">
  <button class="ctl play" type="button" data-mini-play aria-label="Riproduci o metti in pausa">${ICON.play}${ICON.pause}</button>
  <div class="mini-t"><b data-mini-title></b><div class="mini-bar"><i data-mini-bar></i></div></div>
  <button class="close" type="button" data-mini-close aria-label="Chiudi il lettore">Chiudi</button>
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

pages.home = layout("home", {
  theme: "t-night",
  description: site.description,
  jsonld: [ldArtist, ...ldEvents],
  body: (c) => `
<section class="hero t-night" aria-labelledby="h-jediz">
  <div class="wrap">
    <div class="hero-top mono"><span>${esc(site.city)}</span><a href="#ascolta" style="text-decoration:none">Ultimo album — ${esc(album.title)}</a></div>
    <div class="hero-main">
      <h1 class="wordmark" id="h-jediz">${logo(c)}${site.logo ? '<span class="sr-only">JEDIZ</span>' : ""}</h1>
      <div class="hero-claim">
        <p class="claim">${esc(site.claim)}</p>
        <p class="mono mute">${esc(site.subclaim)}</p>
        <div class="hero-actions"><a class="link-arrow" href="#ascolta">Ascolta</a><a class="link-arrow" href="${c.to("live")}">Live</a><a class="link-arrow" href="${c.to("video")}">Video</a><a class="link-arrow" href="${c.to("archivio")}">Archivio</a></div>
      </div>
    </div>
    ${slate(next, c)}
  </div>
</section>

<section class="band t-paper ident" aria-labelledby="h-ident">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-ident">Chi è</span><span class="mono mute">Jediz</span></div>
    <div class="stack" style="--s:28px"><p class="big">${esc(bio.short)}</p><div class="links-row"><a class="link-arrow" href="${c.to("bio")}">Bio</a><a class="link-arrow" href="${c.to("contatti")}">Contatti</a></div></div>
  </div>
</section>

<section class="band t-night" id="ascolta" aria-labelledby="h-ascolta">
  <div class="wrap">
    ${secHead({ label: "Ascolta", meta: [`${album.type} · ${year(album.date)}`, `${album.tracks.length} brani · ${fmtTotal(albumSec)}`], title: `<span id="h-ascolta">Dr. Jediz <span class="it">&amp; Mr. I</span></span>`, lede: esc(album.intro) })}
    ${player(c)}
    <div class="sec-foot"><a class="link-arrow" href="${c.to("musica")}">Discografia</a><a class="link-arrow" href="${c.to("testi")}">Testi</a></div>
  </div>
</section>

<section class="band t-paper" aria-labelledby="h-live">
  <div class="wrap">
    ${secHead({ label: "Live", meta: [`${datesSorted.length} date`, `${year(datesSorted[0]?.date)}–${year(datesSorted[datesSorted.length - 1]?.date)}`], title: `<span id="h-live">Dal vivo</span>`, lede: esc(live.intro) })}
    <div class="gigs">${featuredDates.slice(0, 6).map((d) => gigCard(d, c)).join("")}</div>
    <div class="rail" style="margin-top:clamp(40px,6vw,72px)"><div class="rail-meta"><span class="mono mute">Formazione</span></div>${lineup()}</div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("live")}">Tutte le date e il live</a></div>
  </div>
</section>

<section class="band t-night" aria-labelledby="h-video">
  <div class="wrap">
    ${secHead({ label: "Video", meta: videosData.categories.slice(0, 3).map(esc), title: `<span id="h-video">Video</span>`, lede: "Live, session, videoclip, backstage." })}
    <div class="vgrid">${videosData.videos.slice(0, 3).map((v) => videoCard(v, c)).join("")}</div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("video")}">Tutti i video</a></div>
  </div>
</section>

<section class="band t-paper" aria-labelledby="h-arch">
  <div class="wrap">
    ${secHead({ label: "Archivio", meta: [`${docs.length} documenti`, "PDF"], title: `<span id="h-arch">Materiali</span>`, lede: "Presentazione, cinema, testi, bio, scheda tecnica. Per chi lavora con il progetto." })}
    <div class="rail"><div class="rail-meta"><span class="mono mute">In evidenza</span></div><div class="docs">${docs.slice(0, 3).map((d) => docCard(d, c)).join("")}</div></div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("archivio")}">Tutto l'archivio</a></div>
  </div>
</section>

<div class="split">
  <section class="t-night" aria-labelledby="h-cin">
    <p class="mono mute">Cinema</p>
    <h2 id="h-cin"><span class="it">Straordinaria</span></h2>
    <p>${esc(cinema.works[0].description)} Regia di ${esc(cinema.works[0].credits.find((x) => x.role === "Regia")?.value)}, produzione ${esc(cinema.works[0].credits.find((x) => x.role === "Produzione")?.value)}.</p>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("cinema")}">Cinema</a></div>
  </section>
  <section class="t-paper" aria-labelledby="h-testi">
    <p class="mono mute">Scrittura</p>
    <h2 id="h-testi">Testi</h2>
    <p>${esc(textsData.intro)}</p>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("testi")}">Leggi</a></div>
  </section>
</div>`,
});

pages.musica = layout("musica", {
  theme: "t-night",
  title: "Musica",
  description: `${album.title}, il primo album di Jediz (${dDot(album.date)}), e la discografia completa.`,
  jsonld: [ldAlbum],
  body: (c) => `
${pageHead({ c, label: "Musica", title: `Dr. Jediz <span class="it">&amp; Mr. I</span>`, lede: `${esc(album.intro)} Uscito il ${dLong(album.date)}.` })}
<section class="band t-night" style="padding-top:0" id="ascolta" aria-label="Lettore">
  <div class="wrap">${player(c, releases)}</div>
</section>
<section class="band t-night" style="padding-top:0" aria-labelledby="h-cred">
  <div class="wrap rail"><div class="rail-meta"><span class="mono" id="h-cred">Crediti</span></div>
  <dl class="credits">${album.credits.map((x) => `<dt>${esc(x.role)}</dt><dd>${val(x.value, "da inserire")}</dd>`).join("")}</dl></div>
</section>
<section class="band t-paper" aria-labelledby="h-disco">
  <div class="wrap">
    ${secHead({ label: "Discografia", meta: [`${releases.length} uscite`, `${year(releases[releases.length - 1].date)}–${year(releases[0].date)}`], title: `<span id="h-disco">Uscite</span>`, lede: "Dal 2020 a oggi. Ogni uscita porta alle piattaforme." })}
    <div class="disco">${releases.filter((r) => r !== album).map((r) => `<article class="rel">${cover(r, c, "sm")}<div class="meta mono"><span>${esc(r.type)}</span><span>${dDot(r.date)}</span></div><h3>${esc(r.title)}</h3>${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}<div class="links-row">${r.links.length ? r.links.map((l) => extLink(l.url, l.label)).join("") : ph("link da inserire")}${makingVideos.some((v) => v.project === r.title) ? `<a class="link-arrow" href="${c.to("video", "#making-" + slug(r.title))}">Making of</a>` : ""}</div></article>`).join("")}</div>
    <div class="sec-foot">${site.social.filter((s) => ["Spotify", "Apple Music"].includes(s.label)).map((s) => extLink(s.url, `Jediz su ${s.label}`)).join("")}</div>
  </div>
</section>`,
});

pages.live = layout("live", {
  theme: "t-paper",
  title: "Live",
  description: `Concerti di Jediz con la band. ${next ? `Prossima data: ${dDot(next.date)}, ${next.venue}, ${next.city}.` : ""}`,
  jsonld: ldEvents.length ? ldEvents : undefined,
  body: (c) => `
${pageHead({ c, label: "Live", title: "Dal vivo", lede: esc(live.intro) })}
${next ? `<section class="band t-night" aria-labelledby="h-next" data-expires="${next.date}">
  <div class="wrap big-date">
    <div><p class="mono mute">Prossima data</p><p class="dd num">${dDot(next.date).slice(0, 5)}</p></div>
    <div class="info">
      <p class="mono mute">${dLong(next.date)}${next.time ? ` · ore ${esc(next.time)}` : ""}${next.context ? ` · ${esc(next.context)}` : ""}</p>
      <h3 id="h-next">${next.venue.split(" — ").map(esc).join("<br>")}</h3>
      <p class="mono">${esc(next.city)}</p>
      ${next.description ? `<p class="measure">${esc(next.description)}</p>` : ""}
      <div class="links-row">${extLink(next.ticket_url, next.ticket_label || "Biglietti")}${next.info_url ? extLink(next.info_url, next.info_label || "Informazioni") : ""}</div>
    </div>
  </div>
</section>` : ""}
<section class="band t-paper" aria-labelledby="h-dates">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-dates">Prossime date</span><span class="mono mute">${upcoming.length}</span></div>
    <div class="stack" style="--s:16px">${upcoming.length ? `<ol class="dates">${upcoming.map((d) => dateRow(d)).join("")}</ol>` : "<p>Nuove date in arrivo.</p>"}</div>
  </div>
</section>
<section class="band t-paper" style="padding-top:0" aria-labelledby="h-band">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-band">Formazione</span><span class="mono mute">${live.band.length} elementi</span></div>
    <div class="stack" style="--s:16px">${lineup()}${live.formation_note ? `<p class="mute">${esc(live.formation_note)}</p>` : ""}<div class="links-row"><a class="link-arrow" href="${c.to("archivio", "#jdz-05")}">Scheda tecnica</a><a class="link-arrow" href="${c.to("contatti", "#booking")}">Booking</a></div></div>
  </div>
</section>
<section class="band t-night" aria-labelledby="h-lmedia">
  <div class="wrap">
    ${secHead({ label: "Dal palco", meta: ["Foto e video"], title: `<span id="h-lmedia">Immagini dal live</span>` })}
    <div class="vgrid">${videosData.videos.filter((v) => v.category === "Live").map((v) => videoCard(v, c)).join("")}${photosData.photos.filter((p) => p.category === "Live").slice(0, 2).map((p) => photoItem({ ...p, shape: "wide" }, c)).join("")}</div>
  </div>
</section>
<section class="band t-paper" aria-labelledby="h-past">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-past">Date passate</span><span class="mono mute">${past.length}</span></div>
    <div class="stack" style="--s:16px"><ol class="dates">${past.map((d) => dateRow(d, true)).join("")}</ol>${live.tour_note ? `<p>${ph(live.tour_note)}</p>` : ""}</div>
  </div>
</section>
<section class="band t-night" aria-labelledby="h-posters">
  <div class="wrap">
    ${secHead({ label: "Locandine", meta: [`${datesSorted.filter((d) => d.poster).length} locandine`], title: `<span id="h-posters">Le date</span>` })}
    <div class="gigs">${[...datesSorted].reverse().map((d) => gigCard(d, c)).join("")}</div>
  </div>
</section>`,
});

pages.video = layout("video", {
  theme: "t-night",
  title: "Video",
  description: "Video di Jediz: live, session, videoclip, making of, backstage, cinema.",
  body: (c) => `
${pageHead({ c, label: "Video", title: "Video", lede: "Live, session, videoclip, making of, backstage e lavori per il cinema." })}
<section class="band t-night" style="padding-top:0" aria-label="Elenco video">
  <div class="wrap">
    ${filters(videosData.categories.filter((k) => k !== MAKING), "video")}
    <div class="vgrid feature" data-filterable="video">${mainVideos.map((v) => videoCard(v, c)).join("")}</div>
    <div class="sec-foot"><a class="link-arrow" href="#making-of">Making of</a>${extLink(site.social.find((s) => s.label === "YouTube")?.url, "Canale YouTube")}</div>
  </div>
</section>
<section class="band t-paper" id="making-of" aria-labelledby="h-making">
  <div class="wrap">
    ${secHead({ label: "Making of", meta: [makingVideos.length ? `${makingVideos.length} clip` : "", `${makingList.length} progetti`].filter(Boolean), title: `<span id="h-making">Come sono nati</span>`, lede: "Studio, provini, set, prove. Il dietro le quinte dei dischi." })}
    ${makingList.map((p) => {
      const clips = makingVideos.filter((v) => v.project === p);
      const r = relByTitle(p);
      return `<div class="rail making" id="making-${slug(p)}">
      <div class="rail-meta making-meta">${r ? cover(r, c, "sm") : ""}<span class="mono">${esc(p)}</span><span class="mono mute">${r ? `${esc(r.type)} · ${year(r.date)}` : ""}${clips.length ? ` · ${clips.length} clip` : ""}</span></div>
      <div class="making-strip">${clips.length ? clips.map((v) => videoCard(v, c)).join("") : `<div class="vcard is-vertical"><div class="vframe vertical">${phBlock("Clip da inserire")}</div></div><div class="vcard is-vertical"><div class="vframe vertical">${phBlock("Clip da inserire")}</div></div><div class="vcard is-vertical"><div class="vframe vertical">${phBlock("Clip da inserire")}</div></div>`}</div>
    </div>`;
    }).join("")}
  </div>
</section>`,
});

pages.archivio = layout("archivio", {
  theme: "t-paper",
  title: "Archivio",
  description: "Materiali professionali di Jediz: presentazione, dossier cinema, testi, bio, scheda tecnica, rassegna stampa.",
  body: (c) => `
${pageHead({ c, label: "Archivio", title: "Archivio", lede: "Documenti per chi lavora con il progetto: booking, cinema, stampa, festival. Si aprono nel browser; si possono scaricare." })}
<section class="band t-paper" style="padding-top:0" aria-label="Documenti">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Documenti</span><span class="mono mute">${docs.filter((d) => d.status !== "draft").length} disponibili · ${docs.filter((d) => d.status === "draft").length} in preparazione</span></div><div class="docs">${docs.map((d) => docCard(d, c)).join("")}</div></div>
</section>
<section class="band t-paper" style="padding-top:0" aria-label="Media">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Rassegna stampa</span></div><div class="links-row"><a class="link-arrow" href="${c.to("media")}">Articoli, interviste e radio</a></div></div>
</section>
<section class="band t-night" aria-labelledby="h-need">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Altro</span></div>
  <div class="stack" style="--s:20px"><h2 class="serif" style="font-size:var(--step-3);line-height:1.05" id="h-need">Serve qualcos'altro?</h2><p class="measure mute">Foto in alta risoluzione, rider, materiali per un bando o per la stampa: scrivete ai contatti.</p><a class="link-arrow" href="${c.to("contatti")}">Contatti</a></div></div>
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
  const key = it.topic || "Altre uscite";
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
    ? `<a class="vplay" href="https://www.youtube.com/watch?v=${esc(pv.yt)}" target="_blank" rel="noopener" data-yt="${esc(pv.yt)}" aria-label="Guarda: ${esc(it.title)}">${play}</a>`
    : `<a class="vplay" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="Guarda: ${esc(it.title)}">${play}</a>`;
  return `<article class="vcard"><div class="vframe"><img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">${link}</div><div class="vmeta mono"><span>${esc(it.outlet)} · ${esc(it.type)}</span><span>${mDate(it.date)}</span></div><h3>${esc(it.title)}</h3>${it.topic ? `<p>${esc(it.topic)}</p>` : ""}</article>`;
}
const hasInterviews = media.items.some((it) => ["Intervista", "Radio", "Podcast"].includes(it.type));
pages.media = layout("media", {
  theme: "t-paper",
  title: "Media",
  description: "Jediz sulla stampa: interviste, articoli, video, segnalazioni.",
  body: (c) => `
${pageHead({ c, label: "Media", title: "Media", lede: esc(media.intro) })}
${mediaVideos.length ? `<section class="band t-night" aria-labelledby="h-mvideo">
  <div class="wrap">
    ${secHead({ label: "Video", meta: [`${mediaVideos.length} ${mediaVideos.length === 1 ? "video" : "video"}`], title: `<span id="h-mvideo">Video e interviste</span>` })}
    <div class="vgrid">${mediaVideos.map((it) => mediaVideoCard(it, c)).join("")}</div>
  </div>
</section>` : ""}
${mediaGroups.map((g, gi) => `<section class="band t-paper"${gi === 0 && !mediaVideos.length ? ' style="padding-top:0"' : gi > 0 ? ' style="padding-top:0"' : ""} aria-label="${esc(g.key)}">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono">${esc(g.key)}</span><span class="mono mute">${g.items.length} ${g.items.length === 1 ? "uscita" : "uscite"}</span></div>
    <ul class="press">${g.items.map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><span class="o">${esc(p.outlet)}<br><span class="mute">${esc(p.type)}</span></span><span class="t">${esc(p.title)}</span><span class="dt">${mDate(p.date)}</span></a></li>`).join("")}</ul>
  </div>
</section>`).join("")}
${hasInterviews ? "" : `<section class="band t-paper" style="padding-top:0" aria-label="Da aggiungere">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Interviste</span></div><p>${ph("interviste, radio e podcast da inserire")}</p></div>
</section>`}
<section class="band t-night" aria-labelledby="h-forpress">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Per la stampa</span></div>
  <div class="stack" style="--s:20px"><h2 class="serif" style="font-size:var(--step-3);line-height:1.05" id="h-forpress">Materiali e contatti</h2><p class="measure mute">Bio, foto stampa e presentazione del progetto sono nell'archivio.</p><div class="links-row"><a class="link-arrow" href="${c.to("archivio")}">Archivio</a><a class="link-arrow" href="${c.to("contatti", "#press")}">Press / Media</a></div></div></div>
</section>`,
});

const w0 = cinema.works[0];
const cinemaDoc = docByCode("JDZ/02");
pages.cinema = layout("cinema", {
  theme: "t-night",
  title: "Cinema",
  description: `Jediz e il cinema: ${w0.title}, ${w0.kind.toLowerCase()} con la colonna sonora Tempo al tempo.`,
  body: (c) => `
${pageHead({ c, label: "Cinema", title: "Cinema", lede: esc(cinema.intro) })}
<section class="band t-night" style="padding-top:0" aria-labelledby="h-w0">
  <div class="wrap stack" style="--s:40px">
    <div class="frame-169">${w0.image ? `<img src="${esc(c.asset(w0.image))}" alt="${esc(w0.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : phBlock(`Fotogramma · ${w0.title} · da inserire`)}</div>
    <div class="work">
      <div class="stack" style="--s:16px"><p class="kind mono">${esc(w0.kind)} · ${esc(w0.year)}</p><h3 id="h-w0">${esc(w0.title)}</h3><p class="measure" style="font-size:var(--step-1)">${esc(w0.description)}</p><div class="links-row">${extLink(w0.listen_url, "Ascolta Tempo al tempo")}</div></div>
      <dl class="credits">${w0.credits.map((x) => `<dt>${esc(x.role)}</dt><dd>${val(x.value)}</dd>`).join("")}</dl>
    </div>
  </div>
</section>
${cinema.works.length > 1 ? `<section class="band t-night" style="padding-top:0"><div class="wrap"><ol class="dates">${cinema.works.slice(1).map((w) => `<li class="date-row"><span class="when">${esc(w.year)}</span><span class="what"><b>${esc(w.title)}</b><span class="mute">${esc(w.description)}</span></span><span class="where">${esc(w.kind)}</span></li>`).join("")}</ol></div></section>` : ""}
<section class="band t-night" style="padding-top:0"><div class="wrap rail"><div class="rail-meta"><span class="mono">In arrivo</span></div><p>${ph(cinema.future_note)}</p></div></section>
<section class="band t-paper" aria-labelledby="h-cd">
  <div class="wrap grid-2">
    <div class="docs" style="grid-template-columns:minmax(0,320px)">${cinemaDoc ? docCard(cinemaDoc, c) : ""}</div>
    <div class="stack" style="--s:18px"><p class="mono mute">Per registi, produzioni, music supervisor</p><h2 class="serif" style="font-size:var(--step-3);line-height:1.05" id="h-cd">Colonne sonore e sincronizzazioni</h2><p class="measure">Per usare un brano esistente o parlare di musica originale per un progetto, il contatto è unico.</p><a class="link-arrow" href="${c.to("contatti", "#collab")}">Collaborazioni</a></div>
  </div>
</section>`,
});

const featured = textsData.texts.filter((t) => t.featured);
const textsDoc = docByCode(textsData.pdf_code);
pages.testi = layout("testi", {
  theme: "t-paper",
  title: "Testi",
  description: "I testi di Jediz: estratti, testi completi e la raccolta in PDF.",
  body: (c) => `
${pageHead({ c, label: "Testi", title: `<span class="it">Testi</span>`, lede: esc(textsData.intro) })}
<section class="band t-paper" style="padding-top:0" aria-label="Estratti">
  <div class="wrap">
    ${featured.map((t) => `<article class="verse" id="${slug(t.title)}"><div class="rail-meta stack" style="--s:6px"><p class="mono">${esc(t.title)}</p><p class="mono mute">${esc(t.release)} · ${esc(t.year)}</p></div><blockquote>${t.excerpt ? esc(t.excerpt) : phBlock(`Estratto da inserire\n${t.title}`)}</blockquote></article>`).join("")}
  </div>
</section>
<section class="band t-paper" style="padding-top:0" aria-labelledby="h-tidx">
  <div class="wrap rail">
    <div class="rail-meta"><span class="mono" id="h-tidx">Indice</span><span class="mono mute">${textsData.texts.length} testi</span>${textsDoc ? `<a class="link-arrow" style="margin-top:12px;align-self:start" href="${c.to("archivio", "#" + slug(textsDoc.code))}">Raccolta PDF</a>` : ""}</div>
    <ol class="tindex">${textsData.texts.map((t) => `<li id="t-${slug(t.title)}">${t.full ? `<details><summary><span class="tt">${esc(t.title)}</span><span class="tr mono">Leggi il testo</span></summary><div class="lyric">${esc(t.full)}</div></details>` : `<div class="row"><span class="tt">${esc(t.title)}</span><span class="tr mono">${esc(t.release)} · ${esc(t.year)} ${t.excerpt ? "" : ph("testo")}</span></div>`}</li>`).join("")}</ol>
  </div>
</section>`,
});

pages.foto = layout("foto", {
  theme: "t-night",
  title: "Foto",
  description: "Fotografie di Jediz: live, backstage, ritratti, cinema.",
  body: (c) => `
${pageHead({ c, label: "Foto", title: "Foto", lede: "Una selezione: live, backstage, ritratti, set." })}
<section class="band t-night" style="padding-top:0" aria-label="Fotografie">
  <div class="wrap">
    ${filters(photosData.categories, "foto")}
    <div class="pgrid" data-filterable="foto">${photosData.photos.map((p) => photoItem(p, c)).join("")}</div>
    <div class="sec-foot"><a class="link-arrow" href="${c.to("archivio", "#jdz-06")}">Foto stampa in alta risoluzione</a></div>
  </div>
</section>
`,
});

const bioDoc = docByCode(bio.pdf_code);
pages.bio = layout("bio", {
  theme: "t-paper",
  title: "Bio",
  description: bio.short,
  jsonld: [ldArtist],
  body: (c) => `
${pageHead({ c, label: "Bio", title: "Bio" })}
<section class="band t-paper" style="padding-top:0" aria-label="Bio breve">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Breve</span><span class="mono mute">${bio.short.length} battute</span></div><p class="bio-short">${esc(bio.short)}</p></div>
</section>
<section class="band t-paper" style="padding-top:0" aria-label="Bio estesa">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Estesa</span>${bioDoc ? `<a class="link-arrow" style="margin-top:12px;align-self:start" href="${c.to("archivio", "#" + slug(bioDoc.code))}">Bio in PDF</a>` : ""}</div>
  <div class="bio-long">${bio.long.map((p) => `<p>${esc(p)}</p>`).join("")}</div></div>
</section>
<section class="band t-night" aria-label="Collegamenti">
  <div class="wrap rail"><div class="rail-meta"><span class="mono">Vedi anche</span></div>
  <div class="links-row"><a class="link-arrow" href="${c.to("musica")}">Musica</a><a class="link-arrow" href="${c.to("live")}">Live</a><a class="link-arrow" href="${c.to("foto")}">Foto</a><a class="link-arrow" href="${c.to("contatti", "#press")}">Press</a></div></div>
</section>`,
});

pages.contatti = layout("contatti", {
  theme: "t-paper",
  title: "Contatti",
  description: "Contatti di Jediz: booking e live, press, collaborazioni, informazioni generali.",
  body: (c) => `
${pageHead({ c, label: "Contatti", title: "Contatti", lede: "Scrivete direttamente all'indirizzo giusto." })}
<section class="band t-paper" style="padding-top:0" aria-label="Indirizzi">
  <div class="wrap"><div class="contacts">${site.contacts.map((k) => `<article class="contact" id="${esc(k.id)}"><p class="mono mute">${esc(k.label)}</p><h3>${k.name ? esc(k.name) : esc(k.label.split(" /")[0])}</h3><p class="mute">${esc(k.note)}</p><div class="addr">${k.email ? `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a><button class="copy" type="button" data-copy="${esc(k.email)}">Copia</button>` : ph("email da inserire")}</div></article>`).join("")}</div></div>
</section>
<section class="band t-night" aria-labelledby="h-soc">
  <div class="wrap rail"><div class="rail-meta"><span class="mono" id="h-soc">Canali</span></div>
  <ul class="social-list">${site.social.map((s) => `<li><span>${esc(s.label)}</span>${s.url ? `<a class="link-arrow ext" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.handle || "Apri")}</a>` : ph("link da inserire")}</li>`).join("")}</ul></div>
</section>`,
});

const page404 = layout("404", {
  theme: "t-night",
  title: "Pagina non trovata",
  ogPath: "404.html",
  body: (c) => `<section class="band t-night"><div class="wrap stack" style="--s:24px"><p class="mono mute">404</p><h1 class="serif" style="font-size:var(--step-4);line-height:.95"><span class="it">Qui</span> non c'è niente.</h1><div class="links-row"><a class="link-arrow" href="${c.to("home")}">Home</a><a class="link-arrow" href="${c.to("musica")}">Musica</a><a class="link-arrow" href="${c.to("contatti")}">Contatti</a></div></div></section>`,
});

// ---------- scrittura ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
for (const p of PAGES) {
  const file = PREVIEW ? (p.id === "home" ? "index.html" : `${p.path}.html`) : join(p.path, "index.html");
  mkdirSync(dirname(join(OUT, file)), { recursive: true });
  writeFileSync(join(OUT, file), pages[p.id]);
}
if (!PREVIEW) {
  writeFileSync(join(OUT, "404.html"), page404);
  cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
  mkdirSync(join(OUT, "assets/css"), { recursive: true });
  mkdirSync(join(OUT, "assets/js"), { recursive: true });
  writeFileSync(join(OUT, "assets/css/site.css"), css);
  writeFileSync(join(OUT, "assets/js/site.js"), js);
  if (existsSync(join(ROOT, "admin"))) cpSync(join(ROOT, "admin"), join(OUT, "admin"), { recursive: true });
  writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${abs("sitemap.xml")}\n`);
  writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((p) => `  <url><loc>${abs(p.path ? p.path + "/" : "")}</loc><lastmod>${todayRome}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  writeFileSync(join(OUT, "_headers"), `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/css/*\n  Cache-Control: public, max-age=3600\n/assets/js/*\n  Cache-Control: public, max-age=3600\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
}
console.log(`✓ ${PAGES.length} pagine in ${OUT.replace(ROOT + "/", "")}/  (oggi: ${todayRome}, prossima data: ${next ? next.date : "nessuna"})`);
