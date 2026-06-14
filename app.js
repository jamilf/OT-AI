/* ============================================================
   ICS Sentinel — animation engine
   No dependencies. IntersectionObserver + rAF only.
   ============================================================ */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- shared one-shot observer factory ---------- */
  function observe(elements, callback, threshold) {
    if (!elements.length) return;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach(function (el) { callback(el); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.unobserve(entry.target);
          callback(entry.target);
        }
      });
    }, { threshold: threshold || 0.25, rootMargin: "0px 0px -8% 0px" });
    elements.forEach(function (el) { io.observe(el); });
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ---------- count-up (markup holds the final value) ---------- */
  function countUp(el, duration) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    if (reducedMotion || target === 0) {
      el.textContent = String(target);
      return;
    }
    var start = null;
    duration = duration || 1400;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      // easeOutExpo
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = String(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function primeCounters(root) {
    if (reducedMotion) return;
    $all("[data-count]", root).forEach(function (el) {
      el.textContent = "0";
    });
  }

  function runCounters(root, stagger) {
    $all("[data-count]", root).forEach(function (el, i) {
      if (reducedMotion) { countUp(el); return; }
      setTimeout(function () { countUp(el); }, (stagger || 0) * i);
    });
  }

  /* ---------- generic scroll reveals ---------- */
  observe($all("[data-animate]"), function (el) {
    el.classList.add("in-view");
  }, 0.2);

  /* ---------- pipeline funnel ---------- */
  var funnel = document.getElementById("funnel");
  var pipeline = document.getElementById("pipeline");
  if (funnel && pipeline) {
    primeCounters(pipeline);
    observe([funnel], function () {
      funnel.classList.add("funnel-go");
      // counts start as the bands finish wiping in
      setTimeout(function () { runCounters(pipeline, 220); }, reducedMotion ? 0 : 500);
    }, 0.35);
  }

  /* ---------- plant map ---------- */
  var map = document.getElementById("map-svg");
  if (map) {
    observe([map], function () {
      map.classList.add("map-go");
    }, 0.3);
  }

  /* ---------- attacks vs detections rows ---------- */
  observe($all(".matchup-row"), function (el) {
    el.classList.add("in-view");
  }, 0.3);

  /* ---------- severity donut ---------- */
  var severity = document.getElementById("severity");
  if (severity) {
    primeCounters(severity);
    observe([severity], function () {
      severity.classList.add("donut-go");
      runCounters(severity, 180);
    }, 0.4);
  }

  /* ---------- triage terminal typing ---------- */
  var triageCard = document.getElementById("triage-card");
  var triageBody = document.getElementById("triage-body");
  if (triageCard && triageBody && !reducedMotion) {
    var lines = $all(".t-line", triageBody);
    // hide everything up front (full text stays in the DOM for no-JS / SR)
    lines.forEach(function (line) { line.classList.add("t-hidden"); });

    var cursor = document.createElement("span");
    cursor.className = "triage-cursor";
    cursor.setAttribute("aria-hidden", "true");

    var headerCache = null; // snapshot so replay retypes from the original text
    function typeHeader(line, done) {
      // collect text nodes, empty them, then refill char by char
      var walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      var nodes = [], node;
      while ((node = walker.nextNode())) nodes.push(node);
      if (!headerCache) headerCache = nodes.map(function (n) { return n.nodeValue; });
      var fulls = headerCache;
      nodes.forEach(function (n) { n.nodeValue = ""; });
      line.classList.remove("t-hidden");
      line.classList.add("t-shown");
      line.appendChild(cursor);

      var ni = 0, ci = 0;
      function step() {
        if (ni >= nodes.length) {
          line.classList.add("typed");
          triageCard.classList.add("crit-flash");
          done();
          return;
        }
        ci++;
        nodes[ni].nodeValue = fulls[ni].slice(0, ci);
        if (ci >= fulls[ni].length) { ni++; ci = 0; }
        setTimeout(step, 24);
      }
      step();
    }

    function revealLines(startIndex) {
      var i = startIndex;
      function next() {
        if (i >= lines.length) {
          // park the cursor at the end, still blinking
          lines[lines.length - 1].appendChild(cursor);
          return;
        }
        var line = lines[i];
        line.classList.remove("t-hidden");
        line.classList.add("t-shown");
        line.appendChild(cursor);
        i++;
        setTimeout(next, line.classList.contains("t-blank") ? 60 : 130);
      }
      next();
    }

    function playTriage() {
      triageCard.classList.remove("crit-flash");
      lines.forEach(function (line) {
        line.classList.remove("t-shown", "typed");
        line.classList.add("t-hidden");
      });
      // force reflow so crit-flash can re-trigger
      void triageCard.offsetWidth;
      typeHeader(lines[0], function () {
        setTimeout(function () { revealLines(1); }, 250);
      });
    }

    observe([triageCard], function () { playTriage(); }, 0.45);

    var triageReplay = document.getElementById("triage-replay");
    if (triageReplay) {
      triageReplay.addEventListener("click", function () {
        triageReplay.disabled = true;
        playTriage();
        setTimeout(function () { triageReplay.disabled = false; }, 2600);
      });
    }
  } else {
    // reduced motion: replay button just re-flashes nothing; leave full text visible
    var triageReplayRM = document.getElementById("triage-replay");
    if (triageReplayRM) triageReplayRM.style.display = "none";
  }

  /* ---------- copy-to-clipboard buttons (docs page) ---------- */
  $all("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      function flash() {
        btn.classList.add("copied");
        btn.textContent = "✓ copied";
        setTimeout(function () {
          btn.classList.remove("copied");
          btn.textContent = "copy";
        }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(flash, function () { fallbackCopy(text); flash(); });
      } else {
        fallbackCopy(text);
        flash();
      }
    });
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* clipboard unavailable */ }
    document.body.removeChild(ta);
  }

  /* ---------- demo output player (docs page) ---------- */
  var runBtn = document.getElementById("run-demo");
  var demoOut = document.getElementById("demo-output");
  if (runBtn && demoOut) {
    var demoLines = $all(".t-line", demoOut);
    var demoCursor = document.createElement("span");
    demoCursor.className = "triage-cursor";
    demoCursor.setAttribute("aria-hidden", "true");

    if (!reducedMotion) {
      demoLines.forEach(function (line) { line.classList.add("t-hidden"); });
    }

    runBtn.addEventListener("click", function () {
      runBtn.disabled = true;
      demoLines.forEach(function (line) {
        line.classList.remove("t-shown");
        line.classList.add("t-hidden");
      });
      var i = 0;
      function next() {
        if (i >= demoLines.length) {
          demoLines[demoLines.length - 1].appendChild(demoCursor);
          runBtn.disabled = false;
          runBtn.innerHTML = '<span class="tri" aria-hidden="true"></span>Replay';
          return;
        }
        var line = demoLines[i];
        line.classList.remove("t-hidden");
        line.classList.add("t-shown");
        line.appendChild(demoCursor);
        i++;
        setTimeout(next, reducedMotion ? 0 : (line.classList.contains("t-blank") ? 60 : 160));
      }
      next();
    });
  }

  /* ---------- proof-point stats ---------- */
  var stats = document.getElementById("stats");
  if (stats) {
    primeCounters(stats);
    observe([stats], function () {
      runCounters(stats, 140);
      if (!reducedMotion) {
        // the zeros get a green flash instead of a count-up
        $all(".stat-card", stats).forEach(function (card, i) {
          var n = card.querySelector("[data-count]");
          if (n && n.getAttribute("data-count") === "0") {
            setTimeout(function () { card.classList.add("flash-zero"); }, 140 * i + 200);
          }
        });
      }
    }, 0.3);
  }

  /* ========================================================
     INTERACTION LAYER
     ======================================================== */

  /* ---------- interactive plant map ---------- */
  var simBtn = document.getElementById("sim-attack");
  var mapWrap = document.querySelector(".plant-map");
  var toast = document.getElementById("map-toast");
  if (simBtn && mapWrap) {
    simBtn.addEventListener("click", function () {
      mapWrap.classList.remove("attack-now");
      void mapWrap.offsetWidth; // reflow to restart CSS animations
      mapWrap.classList.add("attack-now");
      if (toast) {
        toast.innerHTML = '<span class="toast-sev">[ALERT]</span> unauthorized write ' +
          '10.0.0.66 → PLC-2<br>blocked · rule <span class="toast-rule">write-source allowlist</span> · T0855';
        toast.classList.add("show");
        clearTimeout(simBtn._t);
        simBtn._t = setTimeout(function () { toast.classList.remove("show"); }, 4200);
      }
    });
  }

  /* ---------- map node tooltips ---------- */
  if (mapWrap) {
    var mapTip = document.createElement("div");
    mapTip.className = "map-tip";
    mapTip.setAttribute("role", "tooltip");
    mapWrap.appendChild(mapTip);
    function showTip(node) {
      mapTip.innerHTML = '<span class="tip-name">' + node.getAttribute("data-name") +
        ' <span class="tip-ip">' + node.getAttribute("data-ip") + '</span></span>' +
        node.getAttribute("data-fact");
      var nr = node.getBoundingClientRect();
      var wr = mapWrap.getBoundingClientRect();
      mapTip.style.left = Math.max(6, Math.min(nr.left - wr.left, wr.width - 270)) + "px";
      mapTip.style.top = (nr.bottom - wr.top + 8) + "px";
      mapTip.classList.add("show");
    }
    function hideTip() { mapTip.classList.remove("show"); }
    $all(".map-node[data-node]", mapWrap).forEach(function (node) {
      node.addEventListener("mouseenter", function () { showTip(node); });
      node.addEventListener("mouseleave", hideTip);
      node.addEventListener("click", function (e) { e.stopPropagation(); showTip(node); });
      node.setAttribute("tabindex", "0");
      node.addEventListener("focus", function () { showTip(node); });
      node.addEventListener("blur", hideTip);
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".map-node[data-node]")) hideTip();
    });
  }

  /* ---------- funnel card ↔ node linking ---------- */
  var funnelSvg = document.querySelector("#funnel svg");
  if (funnelSvg) {
    var funnelNodes = $all(".funnel-node", funnelSvg);
    $all(".stage-card[data-stage]").forEach(function (card) {
      var idx = parseInt(card.getAttribute("data-stage"), 10) - 1;
      var target = funnelNodes[idx];
      if (!target) return;
      card.addEventListener("mouseenter", function () { target.classList.add("hl"); });
      card.addEventListener("mouseleave", function () { target.classList.remove("hl"); });
    });
  }

  /* ---------- donut hover ---------- */
  var donutCenter = document.querySelector(".donut-center");
  if (donutCenter) {
    var centerNum = donutCenter.querySelector("b");
    var centerLabel = donutCenter.querySelector("span");
    var defNum = centerNum ? centerNum.textContent : "10";
    var sevRows = $all(".sev-row[data-sev]");
    function setCenter(num, label) {
      if (centerNum) centerNum.textContent = num;
      if (centerLabel) centerLabel.textContent = label;
    }
    $all(".donut-seg[data-sev]").forEach(function (seg) {
      var sev = seg.getAttribute("data-sev");
      var row = sevRows.filter(function (r) { return r.getAttribute("data-sev") === sev; })[0];
      function on() {
        setCenter(seg.getAttribute("data-count"), seg.getAttribute("data-label"));
        if (row) row.classList.add("hl");
      }
      function off() { setCenter(defNum, "alerts"); if (row) row.classList.remove("hl"); }
      seg.addEventListener("mouseenter", on);
      seg.addEventListener("mouseleave", off);
    });
  }

  /* ---------- ELI5 glossary filter (learn page) ---------- */
  var eli5Grid = document.getElementById("eli5-grid");
  if (eli5Grid) {
    var searchEl = document.getElementById("eli5-search");
    var chipsWrap = document.getElementById("eli5-chips");
    var emptyEl = document.getElementById("eli5-empty");
    var cards = $all(".eli5-card", eli5Grid);
    var activeCat = "all";

    function applyFilter() {
      var q = (searchEl && searchEl.value || "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var catOk = activeCat === "all" || card.getAttribute("data-cat") === activeCat;
        var hay = (card.getAttribute("data-term") + " " + card.textContent).toLowerCase();
        var textOk = !q || hay.indexOf(q) !== -1;
        var show = catOk && textOk;
        card.classList.toggle("hide", !show);
        if (show) shown++;
      });
      if (emptyEl) emptyEl.classList.toggle("show", shown === 0);
    }

    if (searchEl) searchEl.addEventListener("input", applyFilter);
    if (chipsWrap) {
      chipsWrap.addEventListener("click", function (e) {
        var chip = e.target.closest(".eli5-chip");
        if (!chip) return;
        $all(".eli5-chip", chipsWrap).forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        activeCat = chip.getAttribute("data-cat");
        applyFilter();
      });
    }
  }
})();
