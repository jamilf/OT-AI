/* ============================================================
   study.js — spaced-repetition engine (SM-2) for the study tool.
   No dependencies. Reads cards from study-data.js (STUDY_CARDS),
   stores progress in localStorage. Runs only on study.html.
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("study-app");
  if (!root || typeof STUDY_CARDS === "undefined") { return; }

  var KEY = "jf-study-v1";
  var Q = { again: 2, hard: 3, good: 4, easy: 5 };

  /* ---- day granularity (local time) ---- */
  function dayNumber(date) {
    var d = date || new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }
  var TODAY = dayNumber();

  /* ---- persistence ---- */
  function defaultData() {
    return {
      version: 1,
      state: {},                 // id -> { ef, interval, reps, lapses, due }
      stats: { reviews: 0, correct: 0, lastDay: null, streak: 0, byDay: {} },
      settings: { newPerDay: 8 }
    };
  }
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) { return defaultData(); }
      var d = JSON.parse(raw);
      var base = defaultData();
      d.state = d.state || base.state;
      d.stats = d.stats || base.stats;
      d.stats.byDay = d.stats.byDay || {};
      d.settings = d.settings || base.settings;
      return d;
    } catch (e) { return defaultData(); }
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  var data = load();

  /* ---- SM-2 scheduler ---- */
  function newState() { return { ef: 2.5, interval: 0, reps: 0, lapses: 0, due: TODAY }; }
  function schedule(prev, q) {
    var s = prev ? {
      ef: prev.ef, interval: prev.interval, reps: prev.reps,
      lapses: prev.lapses || 0, due: prev.due
    } : newState();
    if (q < 3) {
      s.reps = 0;
      s.interval = 1;
      s.lapses += 1;
    } else {
      if (s.reps === 0) { s.interval = 1; }
      else if (s.reps === 1) { s.interval = 6; }
      else { s.interval = Math.round(s.interval * s.ef); }
      s.reps += 1;
    }
    s.ef = Math.max(1.3, s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    s.due = TODAY + s.interval;
    return s;
  }

  /* ---- helpers ---- */
  function $(id) { return document.getElementById(id); }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  function categories() {
    var seen = {}, out = [];
    STUDY_CARDS.forEach(function (c) {
      if (!seen[c.category]) { seen[c.category] = true; out.push(c.category); }
    });
    return out;
  }

  /* ---- counts for the dashboard ---- */
  function introducedToday() {
    var d = data.stats.byDay[TODAY];
    return d ? (d.new || 0) : 0;
  }
  function newAllowance() {
    return Math.max(0, data.settings.newPerDay - introducedToday());
  }
  function counts(cat) {
    var due = 0, unseen = 0;
    STUDY_CARDS.forEach(function (c) {
      if (cat && c.category !== cat) { return; }
      var st = data.state[c.id];
      if (st) { if (st.due <= TODAY) { due++; } }
      else { unseen++; }
    });
    return { due: due, newAvail: Math.min(unseen, newAllowance()), total: unseen };
  }

  /* ---- session state ---- */
  var queue = [];
  var current = null;
  var sessionReviewed = 0;
  var sessionCorrect = 0;
  var currentCat = null;

  function buildQueue(cat) {
    var due = [], unseen = [];
    STUDY_CARDS.forEach(function (c) {
      if (cat && c.category !== cat) { return; }
      var st = data.state[c.id];
      if (st) { if (st.due <= TODAY) { due.push(c); } }
      else { unseen.push(c); }
    });
    shuffle(due); shuffle(unseen);
    var newCards = unseen.slice(0, newAllowance());
    return shuffle(due.concat(newCards));
  }

  /* ---- views ---- */
  function show(view) {
    ["study-dash", "study-session", "study-summary", "study-browse"].forEach(function (id) {
      var el = $(id);
      if (el) { el.hidden = (id !== view); }
    });
  }

  function renderDash() {
    var c = counts(currentCat);
    $("stat-due").textContent = c.due;
    $("stat-new").textContent = c.newAvail;
    $("stat-total").textContent = STUDY_CARDS.length;
    $("stat-streak").textContent = data.stats.streak || 0;
    $("stat-acc").textContent = data.stats.reviews
      ? Math.round((data.stats.correct / data.stats.reviews) * 100) + "%"
      : "—";
    var start = $("start-review");
    var nothing = (c.due + c.newAvail) === 0;
    start.disabled = nothing;
    start.textContent = nothing ? "All caught up for today" : "Start review";
    show("study-dash");
  }

  function renderChips() {
    var wrap = $("cat-chips");
    if (!wrap) { return; }
    wrap.innerHTML = "";
    var all = document.createElement("button");
    all.type = "button";
    all.className = "eli5-chip" + (currentCat === null ? " active" : "");
    all.textContent = "All";
    all.addEventListener("click", function () { currentCat = null; renderChips(); renderDash(); });
    wrap.appendChild(all);
    categories().forEach(function (cat) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "eli5-chip" + (currentCat === cat ? " active" : "");
      b.textContent = cat;
      b.addEventListener("click", function () { currentCat = cat; renderChips(); renderDash(); });
      wrap.appendChild(b);
    });
  }

  function ensureDayCounted() {
    if (data.stats.lastDay !== TODAY) {
      if (data.stats.lastDay === TODAY - 1) { data.stats.streak = (data.stats.streak || 0) + 1; }
      else { data.stats.streak = 1; }
      data.stats.lastDay = TODAY;
    }
    if (!data.stats.byDay[TODAY]) { data.stats.byDay[TODAY] = { "new": 0, reviews: 0 }; }
  }

  function startSession() {
    queue = buildQueue(currentCat);
    if (!queue.length) { renderDash(); return; }
    sessionReviewed = 0;
    sessionCorrect = 0;
    show("study-session");
    nextCard();
  }

  function nextCard() {
    if (!queue.length) { return showSummary(); }
    current = queue.shift();
    var st = data.state[current.id];
    var tag = st ? "review" : "new";
    $("fc-cat").textContent = current.category;
    $("fc-cat").className = "chip " + (tag === "new" ? "chip-green" : "chip-blue");
    $("fc-front").textContent = current.front;
    $("fc-answer").textContent = current.back;
    $("fc-source").textContent = current.source;
    $("fc-back").hidden = true;
    $("reveal-btn").hidden = false;
    $("grade-row").hidden = true;
    var done = sessionReviewed;
    var remaining = queue.length + 1;
    $("session-progress").textContent = "Reviewed " + done + " · " + plural(remaining, "to go");
    $("progress-fill").style.width = (done + remaining ? (done / (done + remaining)) * 100 : 0) + "%";
    $("reveal-btn").focus();
  }

  function reveal() {
    $("fc-back").hidden = false;
    $("reveal-btn").hidden = true;
    $("grade-row").hidden = false;
    var first = $("grade-row").querySelector("button");
    if (first) { first.focus(); }
  }

  function grade(g) {
    if (!current) { return; }
    var q = Q[g];
    var wasNew = !data.state[current.id];
    ensureDayCounted();
    data.state[current.id] = schedule(data.state[current.id], q);
    data.stats.reviews += 1;
    if (q >= 3) { data.stats.correct += 1; sessionCorrect += 1; }
    var day = data.stats.byDay[TODAY];
    day.reviews += 1;
    if (wasNew) { day["new"] += 1; }
    sessionReviewed += 1;
    if (q < 3) { queue.push(current); }   // relearn this session
    save();
    nextCard();
  }

  function showSummary() {
    current = null;
    var acc = sessionReviewed ? Math.round((sessionCorrect / sessionReviewed) * 100) : 0;
    var dueTomorrow = 0;
    STUDY_CARDS.forEach(function (c) {
      var st = data.state[c.id];
      if (st && st.due === TODAY + 1) { dueTomorrow++; }
    });
    var msg = "You reviewed " + plural(sessionReviewed, "card") + " this session";
    msg += sessionReviewed ? " and recalled " + acc + "% on the first try. " : ". ";
    msg += dueTomorrow
      ? plural(dueTomorrow, "card") + " come back tomorrow. Keep the streak going."
      : "Nothing's due tomorrow. Come back when you want to add more.";
    $("summary-text").textContent = msg;
    show("study-summary");
  }

  /* ---- browse ---- */
  function renderBrowse() {
    var list = $("browse-list");
    list.innerHTML = "";
    categories().forEach(function (cat) {
      var group = document.createElement("div");
      group.className = "browse-cat";
      var h = document.createElement("h4");
      h.textContent = cat;
      group.appendChild(h);
      STUDY_CARDS.filter(function (c) { return c.category === cat; }).forEach(function (c) {
        var item = document.createElement("div");
        item.className = "browse-item";
        var q = document.createElement("p"); q.className = "bi-q"; q.textContent = c.front;
        var a = document.createElement("p"); a.className = "bi-a"; a.textContent = c.back;
        var s = document.createElement("p"); s.className = "bi-src"; s.textContent = "Source: " + c.source;
        item.appendChild(q); item.appendChild(a); item.appendChild(s);
        group.appendChild(item);
      });
      list.appendChild(group);
    });
    show("study-browse");
  }

  /* ---- export / import ---- */
  function exportData() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "study-progress-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash("Progress exported.");
  }
  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var incoming = JSON.parse(reader.result);
        if (!incoming || typeof incoming !== "object" || !incoming.state) {
          throw new Error("bad file");
        }
        data.state = incoming.state || data.state;
        if (incoming.stats) { data.stats = incoming.stats; data.stats.byDay = data.stats.byDay || {}; }
        if (incoming.settings) { data.settings = incoming.settings; }
        save();
        renderChips();
        renderDash();
        flash("Progress imported.");
      } catch (e) {
        flash("Couldn't read that file.");
      }
    };
    reader.readAsText(file);
  }
  var flashTimer;
  function flash(text) {
    var el = $("backup-msg");
    if (!el) { return; }
    el.textContent = text;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(function () { el.textContent = ""; }, 3200);
  }

  /* ---- wire up ---- */
  $("start-review").addEventListener("click", startSession);
  $("browse-toggle").addEventListener("click", renderBrowse);
  $("browse-back").addEventListener("click", renderDash);
  $("back-dash").addEventListener("click", renderDash);
  $("end-session").addEventListener("click", showSummary);
  $("reveal-btn").addEventListener("click", reveal);
  $("export-btn").addEventListener("click", exportData);
  $("import-input").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) { importData(e.target.files[0]); }
    e.target.value = "";
  });
  $("grade-row").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-grade]");
    if (btn) { grade(btn.getAttribute("data-grade")); }
  });

  // keyboard: space/enter reveals, 1-4 grade
  $("study-session").addEventListener("keydown", function (e) {
    if (!$("fc-back").hidden) {
      var map = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      if (map[e.key]) { e.preventDefault(); grade(map[e.key]); }
    } else if ((e.key === " " || e.key === "Enter") && document.activeElement === $("reveal-btn")) {
      // default button behaviour handles it
    }
  });

  renderChips();
  renderDash();
})();
