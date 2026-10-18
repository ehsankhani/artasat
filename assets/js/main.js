/* ArtaSat — site behaviour (no dependencies) */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var cfg = window.ARTASAT || {};

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* theme */
  var themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var next = doc.getAttribute("data-theme") === "dark" ? "light" : "dark";
    doc.setAttribute("data-theme", next);
    store("artasat-theme", next);
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function (e) { if (!store("artasat-theme")) doc.setAttribute("data-theme", e.matches ? "dark" : "light"); };
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener && mq.addListener(onChange);
  }

  /* remember language choice */
  document.querySelectorAll(".lang-menu a").forEach(function (a) {
    a.addEventListener("click", function () { store("artasat-lang", a.getAttribute("hreflang")); });
  });

  /* language dropdown */
  var lang = document.querySelector("[data-lang]");
  if (lang) {
    var lb = lang.querySelector("button");
    lb.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = lang.classList.toggle("open");
      lb.setAttribute("aria-expanded", open);
    });
    document.addEventListener("click", function () { lang.classList.remove("open"); lb.setAttribute("aria-expanded", "false"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { lang.classList.remove("open"); lb.setAttribute("aria-expanded", "false"); } });
  }

  /* mobile nav */
  var burger = document.querySelector(".burger");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open);
    });
    document.querySelectorAll(".main-nav a").forEach(function (a) {
      a.addEventListener("click", function () { document.body.classList.remove("nav-open"); burger.setAttribute("aria-expanded", "false"); });
    });
  }

  /* header shadow + scroll progress + floating to-top */
  var header = document.querySelector(".site-header");
  var progress = document.querySelector(".progress");
  var fab = document.querySelector(".fab-top");
  var onScroll = function () {
    var sy = window.scrollY;
    header && header.classList.toggle("scrolled", sy > 8);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty("--sp", (max > 0 ? Math.min(1, sy / max) : 0).toFixed(4));
    }
    fab && fab.classList.toggle("show", sy > 600);
  };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  if (fab) fab.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* reveal on scroll — replays when elements re-enter from below */
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) en.target.classList.add("in");
        else if (en.boundingClientRect.top > 0) en.target.classList.remove("in");
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add("in"); }); }

  /* footer year (Persian calendar on fa pages) */
  var y = document.querySelector("[data-year]");
  if (y && window.Intl) {
    try {
      var loc = cfg.lang === "fa" ? "fa-IR-u-ca-persian" : (cfg.lang === "ar" ? "ar-u-nu-latn" : "en");
      y.textContent = new Intl.DateTimeFormat(loc, { year: "numeric" }).format(new Date()).replace(/[^\d۰-۹]/g, "");
    } catch (e) {}
  }

  /* solutions tabs */
  var bar = document.querySelector("[data-tabs]");
  if (bar) {
    var tabs = Array.prototype.slice.call(bar.querySelectorAll("[role=tab]"));
    var select = function (id, focus, scroll) {
      var found = false;
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-tab") === id; if (on) found = true;
        t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute("aria-controls"));
        if (p) { p.hidden = !on; if (on) { p.classList.remove("in"); requestAnimationFrame(function () { p.classList.add("in"); }); } }
        if (on && focus) t.focus();
        if (on) t.scrollIntoView({ block: "nearest", inline: "center" });
      });
      if (found && scroll) bar.scrollIntoView({ behavior: "smooth", block: "start" });
      return found;
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { var id = t.getAttribute("data-tab"); select(id); history.replaceState(null, "", "#" + id); });
      t.addEventListener("keydown", function (e) {
        var rtl = doc.dir === "rtl", n = null;
        if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) n = (i + 1) % tabs.length;
        if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) n = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") n = 0; if (e.key === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); tabs[n].click(); tabs[n].focus(); }
      });
    });
    var initial = (location.hash || "").slice(1);
    if (!select(initial, false, !!initial)) select(tabs[0].getAttribute("data-tab"));
    window.addEventListener("hashchange", function () { select(location.hash.slice(1), false, true); });
    // footer links to other modules on the same page
    document.querySelectorAll('a[href^="solutions.html#"]').forEach(function (a) {
      a.addEventListener("click", function (e) { var id = a.getAttribute("href").split("#")[1]; if (select(id, false, true)) { e.preventDefault(); history.replaceState(null, "", "#" + id); } });
    });
  }

  /* forms → send.php (server-side; recipient address never appears in the page) */
  var qs = new URLSearchParams(location.search);
  function wireForm(form, kind) {
    if (!form) return;
    var status = form.querySelector(".form-status");
    var btn = form.querySelector("button[type=submit]");
    var btnHTML = btn.innerHTML;
    var M = cfg.msg || {};
    var msgReq = kind === "collab" ? M.c_required : M.required;
    var msgOk = kind === "collab" ? M.c_sent : M.sent;
    var msgErr = kind === "collab" ? M.c_err : M.err;
    var setStatus = function (txt, ok) { status.textContent = txt; status.className = "form-status " + (ok ? "ok" : "bad"); };

    // prefill from ?type=…&module=…
    var t = qs.get("type"), m = qs.get("module");
    if (t) { var r = form.querySelector('input[name=type][value="' + t + '"]'); if (r) r.checked = true; }
    if (m) {
      var sel = form.querySelector("#f-module"); if (sel && sel.querySelector('option[value="' + m + '"]')) sel.value = m;
      var cb = form.querySelector('input[name=modules][data-id="' + m + '"]'); if (cb) cb.checked = true;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements, bad = false;
      var req = kind === "collab" ? ["name", "email", "phone", "message"] : ["name", "email", "message"];
      req.forEach(function (n) {
        var el = f[n], v = (el.value || "").trim();
        var invalid = !v || (n === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        el.classList.toggle("invalid", invalid); if (invalid) bad = true;
      });
      if (kind === "collab") {
        var typeOn = form.querySelector("input[name=type]:checked");
        form.querySelector(".types").classList.toggle("invalid", !typeOn); if (!typeOn) bad = true;
        var cons = f.consent; cons.closest(".consent").classList.toggle("invalid", !cons.checked); if (!cons.checked) bad = true;
      }
      if (bad) { setStatus(msgReq, false); var first = form.querySelector(".invalid"); if (first) first.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

      var data = { lang: cfg.lang, page: location.pathname };
      ["form", "name", "organization", "role", "email", "phone", "link", "sector", "region", "area", "crops", "message", "website"].forEach(function (n) { if (f[n]) data[n] = (f[n].value || "").trim(); });
      var sel = form.querySelector("#f-module"); if (sel) data.module = sel.options[sel.selectedIndex].text;
      var typeOn2 = form.querySelector("input[name=type]:checked"); if (typeOn2) { data.type = typeOn2.value; data.type_label = typeOn2.getAttribute("data-label"); }
      var mods = Array.prototype.map.call(form.querySelectorAll("input[name=modules]:checked"), function (c) { return c.value; });
      if (mods.length) data.modules = mods.join(", ");

      btn.disabled = true; btn.textContent = M.sending || "…"; status.textContent = "";
      fetch(cfg.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { if (!r.ok || !j.ok) throw 0; }); })
        .then(function () { setStatus(msgOk, true); form.reset(); form.classList.add("done"); })
        .catch(function () { setStatus(msgErr, false); })
        .then(function () { btn.disabled = false; btn.innerHTML = btnHTML; });
    });
  }
  wireForm(document.getElementById("contact-form"), "contact");
  wireForm(document.getElementById("collab-form"), "collab");

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* hero stage: scroll-linked zoom (Apple-style) */
  var zoom = document.querySelector("[data-zoom]");
  if (zoom && !reduce) {
    var tick = false;
    var upd = function () {
      tick = false;
      var r = zoom.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9)));
      zoom.style.setProperty("--p", p.toFixed(3));
    };
    window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* 3D pointer tilt + glare spotlight on cards */
  if (!reduce && window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
    var tiltEls = document.querySelectorAll(".card:not(.form),.tile,.member,.bigstat,.fig,.flow-step,.collab-card,.audience li,.value,.grant,.area,.why-item,.type-in,.pub,.hazard-fig,.paper-shot");
    tiltEls.forEach(function (el) {
      el.setAttribute("data-tilt", "");
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      var glow = document.createElement("i");
      glow.className = "glow"; glow.setAttribute("aria-hidden", "true");
      el.appendChild(glow);
      var raf = null;
      el.addEventListener("pointermove", function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = el.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          var amp = r.width > 500 ? 3.5 : 7;
          el.style.setProperty("--ry", ((x - 0.5) * amp).toFixed(2) + "deg");
          el.style.setProperty("--rx", ((0.5 - y) * amp).toFixed(2) + "deg");
          el.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
          el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        });
      });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* count-up stats (handles Persian/Arabic digits) */
  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  function countUp(el) {
    var txt = el.textContent;
    var m = txt.match(/[0-9۰-۹٠-٩]+(?:[.٫][0-9۰-۹٠-٩]+)?/);
    if (!m) return;
    var tok = m[0], isFa = /[۰-۹]/.test(tok), isAr = /[٠-٩]/.test(tok);
    var west = tok.split("").map(function (ch) {
      var i = FA.indexOf(ch); if (i > -1) return i;
      i = AR.indexOf(ch); if (i > -1) return i;
      return ch === "٫" ? "." : ch;
    }).join("");
    var val = parseFloat(west);
    if (isNaN(val)) return;
    var dec = (west.split(".")[1] || "").length;
    var fmt = function (n) {
      var s = n.toFixed(dec);
      if (isFa) s = s.replace(/\d/g, function (d) { return FA[d]; }).replace(".", "٫");
      else if (isAr) s = s.replace(/\d/g, function (d) { return AR[d]; });
      return s;
    };
    var dur = 1400, t0 = null;
    var step = function (ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      p = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = txt.replace(tok, fmt(val * p));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = txt.replace(tok, fmt(0));
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll(".bigstat b,.fig b,.rt-stat b,.stat b,.rc-stats b");
  if (counters.length && !reduce && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { countUp(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* hero parallax */
  var hero2 = document.querySelector(".hero2");
  if (hero2 && !reduce) {
    var ptick = false;
    var pupd = function () {
      ptick = false;
      hero2.style.setProperty("--par", Math.min(1, window.scrollY / 700).toFixed(3));
    };
    window.addEventListener("scroll", function () { if (!ptick) { ptick = true; requestAnimationFrame(pupd); } }, { passive: true });
    pupd();
  }

  /* layers scrollytelling */
  var steps = document.querySelectorAll(".lstep");
  if (steps.length && "IntersectionObserver" in window) {
    var setLayer = function (k) {
      document.querySelectorAll(".layers-frame [data-layer]").forEach(function (el) { el.classList.toggle("on", el.getAttribute("data-layer") === k); });
      steps.forEach(function (s) { s.classList.toggle("on", s.getAttribute("data-layer") === k); });
    };
    var lio = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) setLayer(e.target.getAttribute("data-layer")); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { lio.observe(s); });
  }

  /* before / after compare */
  document.querySelectorAll("[data-compare]").forEach(function (c) {
    var range = c.querySelector("input[type=range]");
    var set = function (v) { c.style.setProperty("--pos", v + "%"); };
    range.addEventListener("input", function () { set(range.value); });
    set(range.value);
  });

  var fine = window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches;

  /* 3D orbit rings on inner-page heroes */
  document.querySelectorAll(".page-hero").forEach(function (hero) {
    if (hero.querySelector(".scene-3d") || document.body.classList.contains("page-home")) return;
    var scene = document.createElement("div");
    scene.className = "scene-3d";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML = "<span class='ring r1'></span><span class='ring r2'></span><span class='ring r3'></span><span class='core'></span>";
    hero.appendChild(scene);
  });

  /* hero stage: pointer-driven 3D */
  var stage = document.querySelector(".stage");
  if (stage && !reduce && fine) {
    var wrap = stage.closest(".stage-wrap") || stage;
    wrap.addEventListener("pointermove", function (e) {
      var r = wrap.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      stage.style.setProperty("--sty", (x * 8).toFixed(2) + "deg");
      stage.style.setProperty("--stx", (-y * 5).toFixed(2) + "deg");
    });
    wrap.addEventListener("pointerleave", function () {
      stage.style.setProperty("--sty", "0deg");
      stage.style.setProperty("--stx", "0deg");
    });
  }

  /* magnetic pull on primary chrome */
  if (!reduce && fine) {
    document.querySelectorAll(".btn-primary, .fab-top, .header-cta").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.28;
        el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* mark ready so CSS can hold first paint */
  requestAnimationFrame(function () { doc.classList.add("ready"); });
})();
