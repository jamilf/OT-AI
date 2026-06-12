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

    function typeHeader(line, done) {
      // collect text nodes, empty them, then refill char by char
      var walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      var nodes = [], node;
      while ((node = walker.nextNode())) nodes.push(node);
      var fulls = nodes.map(function (n) { return n.nodeValue; });
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

    observe([triageCard], function () {
      typeHeader(lines[0], function () {
        setTimeout(function () { revealLines(1); }, 250);
      });
    }, 0.45);
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
})();
