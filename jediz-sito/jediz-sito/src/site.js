/* JEDIZ — interazioni. Nessuna dipendenza. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  /* menu mobile */
  const btn = $(".menu-btn"), nav = $("#nav");
  if (btn && nav) {
    const set = (open) => { nav.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); btn.textContent = open ? "Chiudi" : "Menu"; document.body.classList.toggle("menu-open", open); };
    btn.addEventListener("click", () => set(!nav.classList.contains("open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { set(false); btn.focus(); } });
    $$("a", nav).forEach((a) => a.addEventListener("click", () => set(false)));
  }

  /* date scadute: se la pagina è più vecchia della data, nasconde la "prossima data" */
  const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
  $$("[data-expires]").forEach((el) => {
    if (el.dataset.expires >= today) return;
    if (el.hasAttribute("data-keep")) { el.classList.remove("is-next"); el.querySelectorAll(".tag").forEach((t) => t.remove()); }
    else el.hidden = true;
  });

  /* ---------- player ---------- */
  const root = $("[data-player]");
  const mini = $("[data-mini]");
  if (root) {
    const data = JSON.parse($("[data-tracks]", root).textContent);
    const tracks = data.tracks, rels = data.rels;
    let curRel = 0;
    const audio = new Audio();
    audio.preload = "none";
    let i = 0, seeking = false, visible = true;
    const el = {
      title: $("[data-title]", root), kind: $("[data-kind]", root), cur: $("[data-cur]", root), dur: $("[data-dur]", root),
      seek: $("[data-seek]", root), msg: $("[data-msg]", root), rows: $$(".track", root),
      mTitle: $("[data-mini-title]"), mBar: $("[data-mini-bar]"),
    };
    const fmt = (s) => { if (!isFinite(s)) return "0:00"; s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
    const playing = () => !audio.paused && !audio.ended;
    const paint = () => {
      const on = playing();
      root.classList.toggle("is-playing", on);
      mini && mini.classList.toggle("is-playing", on);
      $("[data-play]", root).setAttribute("aria-label", on ? "Pausa" : "Riproduci");
      showMini();
    };
    const load = (n, autoplay) => {
      i = (n + tracks.length) % tracks.length;
      const t = tracks[i];
      el.title.textContent = t.title;
      if (t.r !== curRel) setRel(t.r);
      el.kind.textContent = t.preview ? "Anteprima 30″" : "";
      el.rows.forEach((r, k) => r.setAttribute("aria-current", k === i));
      const sc = $(".tracks-scroll", root), row = el.rows[i];
      if (sc && row && sc.scrollHeight > sc.clientHeight + 4) { const top = row.offsetTop - sc.offsetTop; if (top < sc.scrollTop || top > sc.scrollTop + sc.clientHeight - 48) sc.scrollTo({ top: top - 60, behavior: "smooth" }); }
      el.dur.textContent = t.preview ? "0:30" : t.duration;
      el.cur.textContent = "0:00"; el.seek.value = 0; el.seek.style.setProperty("--p", "0%");
      el.msg.textContent = "";
      if (el.mTitle) el.mTitle.textContent = t.title + (t.feat ? ` — feat. ${t.feat}` : "");
      if (!t.src) { el.msg.textContent = "Audio non ancora caricato per questo brano."; audio.removeAttribute("src"); paint(); return; }
      audio.src = t.src;
      store.set("jdz-player", { i, t: 0 });
      if (autoplay) audio.play().catch(onError);
    };
    const setRel = (r) => {
      curRel = r;
      $$("[data-cover]", root).forEach((c) => { c.hidden = +c.dataset.cover !== r; });
      const R = rels[r];
      $("[data-rtype]", root).textContent = R.type;
      $("[data-rdate]", root).textContent = R.date;
      const box = $("[data-rlinks]", root);
      box.replaceChildren(...R.links.map((l) => { const a = document.createElement("a"); a.className = "link-arrow ext"; a.href = l.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = l.label; return a; }));
    };
    const onError = () => { el.msg.textContent = "Riproduzione non disponibile qui. Ascolta il brano sulle piattaforme qui sotto."; paint(); };
    const toggle = () => {
      if (!audio.src) { load(i, true); return; }
      if (playing()) audio.pause(); else audio.play().catch(onError);
    };
    $("[data-play]", root).addEventListener("click", toggle);
    $("[data-prev]", root).addEventListener("click", () => load(audio.currentTime > 3 ? i : i - 1, true));
    $("[data-next]", root).addEventListener("click", () => load(i + 1, true));
    el.rows.forEach((r) => r.addEventListener("click", () => { const n = +r.dataset.i; if (n === i && audio.src) toggle(); else load(n, true); }));
    audio.addEventListener("play", paint);
    audio.addEventListener("pause", paint);
    audio.addEventListener("error", () => { if (audio.src) onError(); });
    audio.addEventListener("ended", () => { if (i < tracks.length - 1) load(i + 1, true); else paint(); });
    audio.addEventListener("loadedmetadata", () => { el.dur.textContent = fmt(audio.duration); });
    audio.addEventListener("timeupdate", () => {
      if (seeking || !audio.duration) return;
      const p = audio.currentTime / audio.duration;
      el.seek.value = Math.round(p * 1000); el.seek.style.setProperty("--p", p * 100 + "%");
      el.cur.textContent = fmt(audio.currentTime);
      if (el.mBar) el.mBar.style.width = p * 100 + "%";
    });
    el.seek.addEventListener("input", () => { seeking = true; el.seek.style.setProperty("--p", el.seek.value / 10 + "%"); if (audio.duration) el.cur.textContent = fmt((el.seek.value / 1000) * audio.duration); });
    el.seek.addEventListener("change", () => { if (audio.duration) audio.currentTime = (el.seek.value / 1000) * audio.duration; seeking = false; });

    /* mini player: appare quando il lettore principale esce dallo schermo */
    const showMini = () => { if (!mini) return; const on = (playing() || (audio.src && audio.currentTime > 0)) && !visible; mini.classList.toggle("show", !!on); mini.setAttribute("aria-hidden", !on); };
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; showMini(); }).observe(root);
    if (mini) {
      $("[data-mini-play]", mini).addEventListener("click", toggle);
      $("[data-mini-close]", mini).addEventListener("click", () => { audio.pause(); mini.classList.remove("show"); });
    }
    const saved = store.get("jdz-player");
    if (saved && tracks[saved.i]) load(saved.i, false); else load(0, false);
  }

  /* ---------- video: carica YouTube solo al click ---------- */
  $$("[data-yt]").forEach((a) => a.addEventListener("click", (e) => {
    const id = a.dataset.yt, frame = a.closest(".vframe");
    if (!frame) return;
    e.preventDefault();
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    f.title = a.getAttribute("aria-label") || "Video";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    frame.replaceChildren(f);
  }));

  /* ---------- filtri ---------- */
  $$("[data-filter]").forEach((g) => {
    const list = $(`[data-filterable="${g.dataset.filter}"]`);
    if (!list) return;
    g.addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]"); if (!b) return;
      $$("[data-f]", g).forEach((x) => x.setAttribute("aria-pressed", x === b));
      const f = b.dataset.f;
      Array.from(list.children).forEach((it) => { it.hidden = !(f === "*" || it.dataset.cat === f); });
    });
  });

  /* ---------- lightbox ---------- */
  const lb = $("[data-lightbox]");
  if (lb) {
    const items = $$("[data-lb]"); let k = 0, last;
    const show = (n) => { k = (n + items.length) % items.length; const it = items[k]; $("[data-lb-img]", lb).src = it.dataset.lb; $("[data-lb-img]", lb).alt = $("img", it)?.alt || ""; $("[data-lb-cap]", lb).textContent = it.dataset.cap || ""; $("[data-lb-count]", lb).textContent = `${k + 1} / ${items.length}`; };
    const close = () => { lb.hidden = true; document.body.style.overflow = ""; last && last.focus(); };
    items.forEach((it, n) => it.addEventListener("click", () => { last = it; show(n); lb.hidden = false; document.body.style.overflow = "hidden"; $("[data-lb-close]", lb).focus(); }));
    $("[data-lb-close]", lb).addEventListener("click", close);
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-stage")) close(); });
    document.addEventListener("keydown", (e) => { if (lb.hidden) return; if (e.key === "Escape") close(); if (e.key === "ArrowRight") show(k + 1); if (e.key === "ArrowLeft") show(k - 1); });
  }

  /* ---------- copia email ---------- */
  $$("[data-copy]").forEach((b) => b.addEventListener("click", () => {
    const done = () => { b.textContent = "Copiato"; setTimeout(() => (b.textContent = "Copia"), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, () => {});
  }));
})();
