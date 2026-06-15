/* ============================================================
   aptitude.js — aptitude practice for the study tool.
   Procedural generators (numeracy, sequences, mechanical) whose
   answers are computed in code, plus hand-authored reading/safety
   items from aptitude-data.js. Adaptive difficulty, interleaved
   drills, and a fixed timed mock exam.
   No dependencies. Shares one data object via window.StudyTool.
   ============================================================ */
(function () {
  "use strict";

  if (!document.getElementById("apt-root") || !window.StudyTool) { return; }

  var CATS = ["numeracy", "sequences", "mechanical", "reading", "safety"];
  var LABELS = { numeracy: "Numeracy", sequences: "Sequences", mechanical: "Mechanical", reading: "Reading", safety: "Safety" };
  var CHIPCLASS = { numeracy: "chip-blue", sequences: "chip-green", mechanical: "chip-amber", reading: "chip-blue", safety: "chip-red" };

  /* ---- helpers ---- */
  function $(id) { return document.getElementById(id); }
  function rint(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function fmtNum(v) { if (typeof v !== "number") { return String(v); } return String(Math.round(v * 100) / 100); }
  function catLabel(c) { return LABELS[c] || c; }
  function catChipClass(c) { return CHIPCLASS[c] || "chip-dim"; }

  /* ---- MCQ assembly: guarantees exactly one correct + unique options ---- */
  function buildMCQ(correctVal, candidates, fmt) {
    fmt = fmt || fmtNum;
    var correctStr = fmt(correctVal);
    var seen = {}; seen[correctStr] = true;
    var distract = [];
    (candidates || []).forEach(function (v) {
      if (distract.length >= 3) { return; }
      var s = fmt(v);
      if (!seen[s]) { seen[s] = true; distract.push(s); }
    });
    if (typeof correctVal === "number") {
      var deltas = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10, 4, -4];
      for (var i = 0; i < deltas.length && distract.length < 3; i++) {
        var v = correctVal + deltas[i];
        if (v < 0 && correctVal >= 0) { continue; }
        var s1 = fmt(v);
        if (!seen[s1]) { seen[s1] = true; distract.push(s1); }
      }
      var mult = [1.1, 0.9, 1.25, 0.75, 1.5, 0.5];
      for (var j = 0; j < mult.length && distract.length < 3; j++) {
        var v2 = Math.round(correctVal * mult[j] * 100) / 100;
        var s2 = fmt(v2);
        if (!seen[s2]) { seen[s2] = true; distract.push(s2); }
      }
    }
    var pad = 2;
    while (distract.length < 3) {
      var s3 = correctStr + " (" + pad + ")";
      if (!seen[s3]) { seen[s3] = true; distract.push(s3); }
      pad++;
    }
    var options = shuffle([correctStr].concat(distract.slice(0, 3)));
    return { options: options, answer: options.indexOf(correctStr) };
  }

  function finish(item) {
    if (item.options) { return item; }   // already a complete MCQ (e.g. binary)
    var mcq = buildMCQ(item.ans, item.cands || [], item.fmt || fmtNum);
    return {
      category: item.category, q: item.q, options: mcq.options, answer: mcq.answer,
      explain: item.explain, source: item.source, passage: item.passage, title: item.title
    };
  }

  /* ================= NUMERACY ================= */
  function numArith(level) {
    var max = [9, 15, 30, 99, 250][level - 1] || 30;
    var type = pick(["+", "-", "×", "÷"]);
    var a, b, ans, expl;
    if (type === "÷") {
      b = rint(2, [6, 9, 12, 12, 20][level - 1] || 10);
      ans = rint(2, max);
      a = b * ans;
      expl = a + " ÷ " + b + " = " + ans;
    } else {
      a = rint(2, max); b = rint(2, max);
      if (type === "-" && b > a) { var t = a; a = b; b = t; }
      ans = type === "+" ? a + b : type === "-" ? a - b : a * b;
      expl = a + " " + type + " " + b + " = " + ans;
    }
    return { category: "numeracy", q: a + " " + type + " " + b + " = ?", ans: ans,
      cands: [ans + 1, ans - 1, ans + 10, a + b, a * b, Math.abs(a - b)], explain: expl };
  }
  function numPercent(level) {
    var p = pick(level < 3 ? [10, 25, 50, 20] : [5, 15, 35, 40, 60, 12, 75]);
    var n = rint(2, [20, 40, 80, 200, 400][level - 1] || 80) * 5;
    var val = n * p / 100;
    if (val !== Math.round(val)) { return null; }
    return { category: "numeracy", q: "What is " + p + "% of " + n + "?", ans: val,
      cands: [n * (p + 10) / 100, n * (p - 10) / 100, n * p / 10, val * 10, n / p], explain: p + "% of " + n + " = " + val };
  }
  function numRatio(level) {
    var r = pick([[1, 2], [2, 3], [3, 4], [2, 5], [3, 5], [1, 4]]);
    var unit = rint(2, [6, 10, 15, 25, 40][level - 1] || 10);
    var total = (r[0] + r[1]) * unit, smaller = r[0] * unit, bigger = r[1] * unit;
    var askBig = Math.random() < 0.5, ans = askBig ? bigger : smaller;
    return { category: "numeracy",
      q: "Split " + total + " in the ratio " + r[0] + ":" + r[1] + ". What is the " + (askBig ? "larger" : "smaller") + " share?",
      ans: ans, cands: [askBig ? smaller : bigger, total / 2, total / (r[0] + r[1]), total - ans],
      explain: total + " split " + r[0] + ":" + r[1] + " gives " + smaller + " and " + bigger + "." };
  }
  function numRate(level) {
    var rate = rint(2, [8, 15, 25, 40, 60][level - 1] || 15);
    var time = rint(2, [6, 9, 12, 12, 20][level - 1] || 9);
    var amount = rate * time;
    return { category: "numeracy", q: "A pump moves " + amount + " L in " + time + " minutes. How many litres per minute?",
      ans: rate, fmt: function (v) { return v + " L/min"; },
      cands: [time, amount, rate + 1, rate - 1], explain: amount + " ÷ " + time + " = " + rate + " L/min" };
  }
  function numFraction(level) {
    var fr = pick([[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [3, 5], [2, 5]]);
    var mult = rint(2, [6, 10, 15, 25, 40][level - 1] || 10);
    var n = fr[1] * mult, ans = fr[0] * n / fr[1];
    return { category: "numeracy", q: "What is " + fr[0] + "/" + fr[1] + " of " + n + "?", ans: ans,
      cands: [fr[0] * n, n / fr[1], n - ans, ans + fr[1], n / fr[0]],
      explain: fr[0] + "/" + fr[1] + " of " + n + " = " + ans };
  }
  function numUnit(level) {
    var conv = pick([
      { f: 1000, from: "kV", to: "V" }, { f: 1000, from: "m", to: "mm" },
      { f: 1000, from: "A", to: "mA" }, { f: 1000, from: "kW", to: "W" }
    ]);
    var base = pick([1.2, 2.4, 3.3, 0.4, 5, 11, 1.5, 0.23, 0.8]);
    var val = Math.round(base * conv.f);
    var fmt = function (v) { return v + " " + conv.to; };
    return { category: "numeracy", q: "Convert " + base + " " + conv.from + " to " + conv.to + ".", ans: val, fmt: fmt,
      cands: [base, base * conv.f * 10, base * 100, val * 10, Math.round(base * conv.f / 10)],
      explain: base + " " + conv.from + " = " + val + " " + conv.to };
  }
  function genNumeracy(level) {
    var makers = [numArith, numPercent, numRatio, numRate, numFraction, numUnit];
    for (var t = 0; t < 60; t++) { var it = pick(makers)(level); if (it) { return finish(it); } }
    return finish(numArith(level));
  }

  /* ================= SEQUENCES ================= */
  function Ltr(i) { return String.fromCharCode(65 + ((i % 26) + 26) % 26); }
  function seqArith(level) {
    var a = rint(1, [6, 10, 15, 20, 30][level - 1] || 10);
    var d = rint(2, [4, 6, 9, 12, 15][level - 1] || 6); if (Math.random() < 0.3) { d = -d; }
    var terms = [a, a + d, a + 2 * d, a + 3 * d], next = a + 4 * d;
    return { category: "sequences", q: "What comes next?  " + terms.join(", ") + ", ?", ans: next,
      cands: [next + d, next - d, terms[3], next + 1, a + 5 * d],
      explain: "The sequence " + (d >= 0 ? "adds " : "subtracts ") + Math.abs(d) + " each step, so next is " + next + "." };
  }
  function seqGeo(level) {
    var a = pick([1, 2, 3, 4, 5]), r = pick(level < 3 ? [2, 3] : [2, 3, 4]);
    var terms = [a, a * r, a * r * r, a * r * r * r], next = a * r * r * r * r;
    return { category: "sequences", q: "What comes next?  " + terms.join(", ") + ", ?", ans: next,
      cands: [terms[3] + r, terms[3] * (r + 1), next + a, a * Math.pow(r, 5), terms[3] * r - 1],
      explain: "Each term is multiplied by " + r + ", so next is " + next + "." };
  }
  function seqAlt(level) {
    var a = rint(2, 12), p = rint(2, 7), q = rint(2, 7); if (p === q) { q = p + 1; }
    var t = [a, a + p, a + p + q, a + p + q + p], next = t[3] + q;
    return { category: "sequences", q: "What comes next?  " + t.join(", ") + ", ?", ans: next,
      cands: [t[3] + p, next + 1, next - 1, t[3] - q],
      explain: "It adds " + p + " then " + q + " alternately, so next is " + next + "." };
  }
  function seqFib(level) {
    var a = rint(1, 6), b = rint(1, 8), c = a + b, d = b + c, next = c + d;
    var t = [a, b, c, d];
    return { category: "sequences", q: "What comes next?  " + t.join(", ") + ", ?", ans: next,
      cands: [d + b, d * 2, next + 1, d - c],
      explain: "Each term is the sum of the two before it, so next is " + c + " + " + d + " = " + next + "." };
  }
  function seqLetter(level) {
    var start = rint(0, 15), k = pick(level < 3 ? [1, 2, 3] : [2, 3, 4, 5]);
    var terms = [Ltr(start), Ltr(start + k), Ltr(start + 2 * k), Ltr(start + 3 * k)];
    var next = Ltr(start + 4 * k);
    return { category: "sequences", q: "What letter comes next?  " + terms.join(", ") + ", ?", ans: next,
      cands: [Ltr(start + 4 * k + 1), Ltr(start + 4 * k - 1), Ltr(start + 5 * k), Ltr(start + 3 * k), Ltr(start + 4 * k + k), Ltr(start)],
      explain: "Each letter steps forward " + k + " place" + (k === 1 ? "" : "s") + " in the alphabet, so next is " + next + "." };
  }
  function genSequence(level) {
    return finish(pick([seqArith, seqGeo, seqAlt, seqFib, seqLetter])(level));
  }

  /* ================= MECHANICAL ================= */
  function mechDir(level) {
    var n = pick(level < 3 ? [2, 3] : [3, 4, 5]);
    var startCW = Math.random() < 0.5, sameAs1 = ((n - 1) % 2 === 0);
    var lastCW = sameAs1 ? startCW : !startCW;
    return { category: "mechanical",
      q: "In a train of " + n + " meshed gears, gear 1 turns " + (startCW ? "clockwise" : "counter-clockwise") + ". Which way does gear " + n + " turn?",
      options: ["Clockwise", "Counter-clockwise"], answer: lastCW ? 0 : 1,
      explain: "Meshed gears alternate direction, so gear " + n + " turns " + (sameAs1 ? "the same way as" : "opposite to") + " gear 1." };
  }
  function mechRpm(level) {
    var Td = pick([10, 12, 15, 20, 24, 30]), Tn = pick([10, 12, 15, 20, 24, 30, 40, 60]), R = pick([60, 120, 180, 240, 300, 90]);
    var val = R * Td / Tn;
    if (val !== Math.round(val) || val === R) { return null; }
    return { category: "mechanical",
      q: "A " + Td + "-tooth driver gear turning at " + R + " rpm meshes with a " + Tn + "-tooth gear. What is the driven gear's speed?",
      ans: val, fmt: function (v) { return v + " rpm"; },
      cands: [Math.round(R * Tn / Td), R, val + 10, val - 10, val * 2],
      explain: "Driven rpm = driver rpm × driver teeth ÷ driven teeth = " + R + " × " + Td + " ÷ " + Tn + " = " + val + " rpm." };
  }
  function mechPulley(level) {
    var ma = pick(level < 3 ? [2, 3, 4] : [2, 3, 4, 5, 6]), weight = ma * pick([10, 20, 25, 50, 100]);
    if (Math.random() < 0.5) {
      return { category: "mechanical",
        q: "A pulley system has " + ma + " rope segments supporting the load. What is its mechanical advantage?",
        ans: ma, cands: [ma + 1, ma - 1, ma * 2, Math.round(weight / ma)],
        explain: "Mechanical advantage equals the number of supporting rope segments = " + ma + "." };
    }
    var effort = weight / ma;
    return { category: "mechanical",
      q: "A frictionless pulley system with " + ma + " supporting rope segments lifts a " + weight + " N load. What effort is needed?",
      ans: effort, fmt: function (v) { return v + " N"; },
      cands: [weight, weight * ma, effort * 2, effort + 10],
      explain: "Effort = load ÷ mechanical advantage = " + weight + " ÷ " + ma + " = " + effort + " N." };
  }
  function mechLever(level) {
    var load = pick([100, 150, 200, 250, 300, 120, 180]), loadArm = pick([0.2, 0.3, 0.4, 0.5, 0.6]), effortArm = pick([0.8, 1, 1.2, 1.5, 2]);
    var effort = load * loadArm / effortArm;
    if (effort !== Math.round(effort)) { return null; }
    return { category: "mechanical",
      q: "On a lever, a " + load + " N load sits " + loadArm + " m from the pivot, and the effort acts " + effortArm + " m from the pivot. What effort balances the load?",
      ans: effort, fmt: function (v) { return v + " N"; },
      cands: [Math.round(load * effortArm / loadArm), load, effort + 10, effort - 10, Math.round(load * loadArm * effortArm)],
      explain: "Load × load-arm = effort × effort-arm, so effort = " + load + " × " + loadArm + " ÷ " + effortArm + " = " + effort + " N." };
  }
  function genMechanical(level) {
    for (var t = 0; t < 60; t++) {
      var which = pick(["dir", "rpm", "pulley", "lever"]);
      var it = which === "dir" ? mechDir(level) : which === "rpm" ? mechRpm(level) : which === "pulley" ? mechPulley(level) : mechLever(level);
      if (it) { return finish(it); }
    }
    return finish(mechDir(level));
  }

  /* ================= AUTHORED (reading / safety) ================= */
  function shuffleMCQ(options, answerIdx) {
    var correct = options[answerIdx];
    var opts = shuffle(options.slice());
    return { options: opts, answer: opts.indexOf(correct) };
  }
  function pickNear(pool, level, lastId) {
    var best = Infinity, cands = [];
    pool.forEach(function (it) {
      var d = Math.abs((it.level || 2) - level);
      if (d < best) { best = d; cands = [it]; } else if (d === best) { cands.push(it); }
    });
    var filtered = cands.filter(function (it) { return it.id !== lastId; });
    return pick(filtered.length ? filtered : cands);
  }
  var lastReadingId = null, lastSafetyId = null;
  function pickReading(level) {
    var item = pickNear(APT_READING, level, lastReadingId); lastReadingId = item.id;
    var qq = pick(item.questions);
    var sm = shuffleMCQ(qq.options, qq.answer);
    return { category: "reading", title: item.title, passage: item.passage, q: qq.q,
      options: sm.options, answer: sm.answer, explain: qq.explain };
  }
  function pickSafety(level) {
    var it = pickNear(APT_SAFETY, level, lastSafetyId); lastSafetyId = it.id;
    var sm = shuffleMCQ(it.options, it.answer);
    return { category: "safety", q: it.q, options: sm.options, answer: sm.answer, explain: it.explain, source: it.source };
  }

  function generate(cat, level) {
    level = Math.max(1, Math.min(5, level || 2));
    if (cat === "numeracy") { return genNumeracy(level); }
    if (cat === "sequences") { return genSequence(level); }
    if (cat === "mechanical") { return genMechanical(level); }
    if (cat === "reading") { return pickReading(level); }
    if (cat === "safety") { return pickSafety(level); }
    return genNumeracy(level);
  }

  /* ================= storage ================= */
  function ensureApt() {
    var d = window.StudyTool.getData();
    if (!d.aptitude) { d.aptitude = {}; }
    var a = d.aptitude;
    a.version = a.version || 1;
    a.difficulty = a.difficulty || {};
    a.stats = a.stats || {};
    CATS.forEach(function (c) {
      if (typeof a.difficulty[c] !== "number") { a.difficulty[c] = 2; }
      if (!a.stats[c]) { a.stats[c] = { seen: 0, correct: 0 }; }
    });
    a.mock = a.mock || { best: null, last: null, history: [] };
    a.mock.history = a.mock.history || [];
    a.settings = a.settings || {};
    if (!a.settings.drillCats) { a.settings.drillCats = {}; CATS.forEach(function (c) { a.settings.drillCats[c] = true; }); }
    if (typeof a.settings.mockCount !== "number") { a.settings.mockCount = 20; }
    if (typeof a.settings.mockMinutes !== "number") { a.settings.mockMinutes = 15; }
    return a;
  }
  function save() { window.StudyTool.save(); }
  function recordStat(cat, correct) { var A = ensureApt(); A.stats[cat].seen++; if (correct) { A.stats[cat].correct++; } }
  function adapt(cat, correct) {
    var A = ensureApt();
    A.difficulty[cat] = correct ? Math.min(5, A.difficulty[cat] + 1) : Math.max(1, A.difficulty[cat] - 1);
  }

  /* ================= shared rendering ================= */
  function optionList(item, opts) {
    var list = document.createElement("div");
    list.className = "mcq-list";
    item.options.forEach(function (text, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcq-option";
      var key = document.createElement("span"); key.className = "mcq-key"; key.textContent = i + 1;
      var span = document.createElement("span"); span.className = "mcq-text"; span.textContent = text;
      b.appendChild(key); b.appendChild(span);
      if (opts.reveal) {
        if (i === item.answer) { b.classList.add("is-correct"); }
        else if (i === opts.selected) { b.classList.add("is-wrong"); }
        b.disabled = true;
      } else {
        if (opts.selected === i) { b.classList.add("is-selected"); }
        b.addEventListener("click", function () { opts.onPick(i); });
      }
      list.appendChild(b);
    });
    return list;
  }
  function renderQuestionCard(container, item, opts) {
    container.innerHTML = "";
    if (item.passage) {
      var pass = document.createElement("div"); pass.className = "apt-passage panel";
      if (item.title) { var h = document.createElement("h4"); h.textContent = item.title; pass.appendChild(h); }
      var pp = document.createElement("p"); pp.textContent = item.passage; pass.appendChild(pp);
      container.appendChild(pass);
    }
    var chip = document.createElement("span"); chip.className = "chip " + catChipClass(item.category); chip.textContent = catLabel(item.category);
    container.appendChild(chip);
    var q = document.createElement("p"); q.className = "apt-q"; q.textContent = item.q; container.appendChild(q);
    container.appendChild(optionList(item, opts));
    if (opts.reveal) {
      var ex = document.createElement("div"); ex.className = "mcq-explain";
      var lab = document.createElement("span"); lab.className = "src-label";
      lab.textContent = (opts.selected === item.answer) ? "Correct" : "Answer";
      ex.appendChild(lab);
      ex.appendChild(document.createTextNode(" " + item.explain));
      if (item.source) { var src = document.createElement("p"); src.className = "bi-src"; src.textContent = "Source: " + item.source; ex.appendChild(src); }
      container.appendChild(ex);
    }
  }
  function focusFirstOption(id) { var b = $(id).querySelector(".mcq-option"); if (b) { b.focus(); } }

  /* ================= views ================= */
  function aptShow(view) {
    ["apt-dash", "apt-drills", "apt-mock", "apt-results"].forEach(function (id) {
      var el = $(id); if (el) { el.hidden = (id !== view); }
    });
    if (view !== "apt-mock") { stopMockTimer(); }
  }

  /* ---- dashboard ---- */
  function renderAptChips() {
    var A = ensureApt(), wrap = $("apt-cat-chips");
    wrap.innerHTML = "";
    CATS.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "eli5-chip" + (A.settings.drillCats[c] ? " active" : "");
      b.textContent = catLabel(c);
      b.addEventListener("click", function () {
        A.settings.drillCats[c] = !A.settings.drillCats[c];
        save(); renderAptChips();
        $("apt-start-drills").disabled = !CATS.some(function (x) { return A.settings.drillCats[x]; });
      });
      wrap.appendChild(b);
    });
  }
  function renderAptDash() {
    var A = ensureApt();
    $("apt-best").textContent = A.mock.best ? A.mock.best.pct + "%" : "—";
    $("apt-last").textContent = A.mock.last ? A.mock.last.pct + "%" : "—";
    var seen = 0, correct = 0;
    CATS.forEach(function (c) { seen += A.stats[c].seen; correct += A.stats[c].correct; });
    $("apt-answered").textContent = seen;
    $("apt-acc").textContent = seen ? Math.round(correct / seen * 100) + "%" : "—";
    var lv = $("apt-cat-levels"); lv.innerHTML = "";
    CATS.forEach(function (c) {
      var chip = document.createElement("span"); chip.className = "lvl-chip";
      chip.textContent = catLabel(c) + " · L" + A.difficulty[c];
      lv.appendChild(chip);
    });
    renderAptChips();
    $("apt-start-drills").disabled = !CATS.some(function (c) { return A.settings.drillCats[c]; });
    save();
    aptShow("apt-dash");
  }

  /* ---- drills ---- */
  var drillItem = null, drillLocked = false, drillCorrect = 0, drillSeen = 0, drillBag = [], drillLast = null, selectedDrillCats = [];
  function nextDrillCat() {
    if (!drillBag.length) {
      drillBag = shuffle(selectedDrillCats.slice());
      if (drillBag.length > 1 && drillBag[0] === drillLast) { drillBag.push(drillBag.shift()); }
    }
    drillLast = drillBag.shift();
    return drillLast;
  }
  function startDrills() {
    var A = ensureApt();
    selectedDrillCats = CATS.filter(function (c) { return A.settings.drillCats[c]; });
    if (!selectedDrillCats.length) { return; }
    drillCorrect = 0; drillSeen = 0; drillBag = []; drillLast = null;
    aptShow("apt-drills");
    nextDrill();
  }
  function updateDrillProgress() { $("drill-progress").textContent = drillCorrect + " of " + drillSeen + " correct"; }
  function nextDrill() {
    var A = ensureApt(), cat = nextDrillCat();
    drillItem = generate(cat, A.difficulty[cat]);
    drillLocked = false;
    renderQuestionCard($("drill-area"), drillItem, { reveal: false, selected: null, onPick: answerDrill });
    updateDrillProgress();
    focusFirstOption("drill-area");
  }
  function answerDrill(i) {
    if (drillLocked) { return; }
    drillLocked = true;
    var correct = (i === drillItem.answer);
    recordStat(drillItem.category, correct);
    adapt(drillItem.category, correct);
    drillSeen++; if (correct) { drillCorrect++; }
    save();
    renderQuestionCard($("drill-area"), drillItem, { reveal: true, selected: i });
    var wrap = document.createElement("div"); wrap.className = "apt-next-wrap";
    var nb = document.createElement("button"); nb.id = "drill-next"; nb.type = "button"; nb.className = "btn btn-primary"; nb.textContent = "Next question";
    nb.addEventListener("click", nextDrill);
    wrap.appendChild(nb); $("drill-area").appendChild(wrap);
    nb.focus();
    updateDrillProgress();
  }

  /* ---- mock exam ---- */
  var mockQs = [], mockAnswers = [], mockIdx = 0, mockEndTs = 0, mockTimerId = null, mockSubmitted = false;
  function stopMockTimer() { if (mockTimerId) { clearInterval(mockTimerId); mockTimerId = null; } }
  function buildMock() {
    var A = ensureApt();
    var per = { numeracy: 4, sequences: 4, mechanical: 4, reading: 4, safety: 4 };
    per.safety = Math.min(per.safety, APT_SAFETY.length);
    var rt = 0; APT_READING.forEach(function (r) { rt += r.questions.length; });
    per.reading = Math.min(per.reading, rt);
    var gen = ["numeracy", "sequences", "mechanical"], gi = 0;
    var sum = per.numeracy + per.sequences + per.mechanical + per.reading + per.safety;
    while (sum < A.settings.mockCount) { per[gen[gi % 3]]++; sum++; gi++; }
    while (sum > A.settings.mockCount) { var c0 = gen[gi % 3]; if (per[c0] > 0) { per[c0]--; sum--; } gi++; }
    var levels = [2, 3, 3, 4], qs = [], seenQ = {};
    CATS.forEach(function (c) {
      var made = 0, tries = 0;
      while (made < per[c] && tries < 50) {
        tries++;
        var it = generate(c, levels[made % levels.length]);
        if (seenQ[it.q]) { continue; }
        seenQ[it.q] = true; qs.push(it); made++;
      }
    });
    return shuffle(qs);
  }
  function startMock() {
    var A = ensureApt();
    mockQs = buildMock();
    mockAnswers = mockQs.map(function () { return -1; });
    mockIdx = 0; mockSubmitted = false;
    mockEndTs = Date.now() + A.settings.mockMinutes * 60000;
    aptShow("apt-mock");
    renderMockQ();
    stopMockTimer();
    mockTimerId = setInterval(tickMock, 250);
    tickMock();
    focusFirstOption("mock-area");
  }
  function tickMock() {
    var remaining = mockEndTs - Date.now();
    if (remaining <= 0) { renderTimer(0); submitMock(); return; }
    renderTimer(remaining);
  }
  function renderTimer(ms) {
    var s = Math.ceil(ms / 1000), m = Math.floor(s / 60), ss = s % 60;
    var el = $("mock-timer");
    el.textContent = m + ":" + (ss < 10 ? "0" : "") + ss;
    el.classList.toggle("is-warning", ms <= 60000 && ms > 10000);
    el.classList.toggle("is-critical", ms <= 10000);
  }
  function renderMockQ() {
    var item = mockQs[mockIdx];
    renderQuestionCard($("mock-area"), item, { reveal: false, selected: mockAnswers[mockIdx], onPick: pickMock });
    $("mock-progress").textContent = "Q " + (mockIdx + 1) + " of " + mockQs.length;
    $("mock-fill").style.width = ((mockIdx + 1) / mockQs.length * 100) + "%";
    $("mock-prev").disabled = mockIdx === 0;
    $("mock-next").textContent = (mockIdx === mockQs.length - 1) ? "Finish" : "Next";
  }
  function pickMock(i) { mockAnswers[mockIdx] = i; renderMockQ(); }
  function mockNext() {
    if (mockIdx < mockQs.length - 1) { mockIdx++; renderMockQ(); focusFirstOption("mock-area"); }
    else { submitMock(); }
  }
  function mockPrev() { if (mockIdx > 0) { mockIdx--; renderMockQ(); focusFirstOption("mock-area"); } }
  function submitMock() {
    if (mockSubmitted) { return; }
    mockSubmitted = true;
    stopMockTimer();
    var A = ensureApt(), score = 0, byCat = {};
    CATS.forEach(function (c) { byCat[c] = { c: 0, n: 0 }; });
    mockQs.forEach(function (it, idx) {
      byCat[it.category].n++;
      if (mockAnswers[idx] === it.answer) { score++; byCat[it.category].c++; }
    });
    var total = mockQs.length, pct = Math.round(score / total * 100);
    var rec = { score: score, total: total, pct: pct, date: new Date().toISOString().slice(0, 10) };
    A.mock.last = rec;
    if (!A.mock.best || pct > A.mock.best.pct) { A.mock.best = rec; }
    A.mock.history.push(rec);
    if (A.mock.history.length > 20) { A.mock.history = A.mock.history.slice(-20); }
    save();
    renderResults(score, total, pct, byCat);
  }
  function renderResults(score, total, pct, byCat) {
    var A = ensureApt(), area = $("results-area");
    area.innerHTML = "";
    var head = document.createElement("div"); head.className = "panel summary-card";
    var h = document.createElement("h3"); h.textContent = "Mock score: " + score + " / " + total + " (" + pct + "%)"; head.appendChild(h);
    var sub = document.createElement("p");
    sub.textContent = (A.mock.best ? "Best " + A.mock.best.pct + "% · " : "") + "Timed and interleaved across the categories.";
    head.appendChild(sub);
    area.appendChild(head);

    var tw = document.createElement("div"); tw.className = "table-wrap";
    var t = document.createElement("table"); t.className = "data apt-results-table";
    t.innerHTML = "<thead><tr><th>Category</th><th>Correct</th><th>Score</th></tr></thead>";
    var tb = document.createElement("tbody");
    CATS.forEach(function (c) {
      if (!byCat[c].n) { return; }
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + catLabel(c) + "</td><td>" + byCat[c].c + " / " + byCat[c].n + "</td><td>" + Math.round(byCat[c].c / byCat[c].n * 100) + "%</td>";
      tb.appendChild(tr);
    });
    t.appendChild(tb); tw.appendChild(t); area.appendChild(tw);

    var missed = [];
    mockQs.forEach(function (it, idx) { if (mockAnswers[idx] !== it.answer) { missed.push({ it: it, sel: mockAnswers[idx] }); } });
    var hh = document.createElement("h4"); hh.className = "apt-review-h";
    hh.textContent = missed.length ? ("Review — " + missed.length + " to check") : "Every question correct. Nicely done.";
    area.appendChild(hh);
    missed.forEach(function (m) {
      var card = document.createElement("div"); card.className = "browse-item";
      var q = document.createElement("p"); q.className = "bi-q"; q.textContent = m.it.q; card.appendChild(q);
      var your = document.createElement("p"); your.className = "bi-a";
      your.textContent = "Your answer: " + (m.sel >= 0 ? m.it.options[m.sel] : "(left blank)");
      card.appendChild(your);
      var corr = document.createElement("p"); corr.className = "bi-a bi-correct"; corr.textContent = "Correct: " + m.it.options[m.it.answer]; card.appendChild(corr);
      var ex = document.createElement("p"); ex.className = "bi-src"; ex.textContent = m.it.explain + (m.it.source ? " · " + m.it.source : ""); card.appendChild(ex);
      area.appendChild(card);
    });
    aptShow("apt-results");
  }

  /* ================= mode switch ================= */
  function setMode(mode) {
    var apt = (mode === "aptitude");
    $("sr-root").hidden = apt;
    $("apt-root").hidden = !apt;
    $("mode-knowledge").classList.toggle("is-active", !apt);
    $("mode-aptitude").classList.toggle("is-active", apt);
    $("mode-knowledge").setAttribute("aria-selected", (!apt).toString());
    $("mode-aptitude").setAttribute("aria-selected", apt.toString());
    if (apt) { renderAptDash(); }
    else { stopMockTimer(); window.StudyTool.refreshDash(); }
  }

  /* ================= wire up ================= */
  $("mode-knowledge").addEventListener("click", function () { setMode("knowledge"); });
  $("mode-aptitude").addEventListener("click", function () { setMode("aptitude"); });
  $("apt-start-drills").addEventListener("click", startDrills);
  $("apt-start-mock").addEventListener("click", startMock);
  $("drill-end").addEventListener("click", renderAptDash);
  $("mock-submit").addEventListener("click", function () { submitMock(); });
  $("mock-next").addEventListener("click", mockNext);
  $("mock-prev").addEventListener("click", mockPrev);
  $("apt-results-back").addEventListener("click", renderAptDash);

  $("apt-drills").addEventListener("keydown", function (e) {
    if (!drillItem) { return; }
    if (!drillLocked) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= drillItem.options.length) { e.preventDefault(); answerDrill(n - 1); }
    }
  });
  $("apt-mock").addEventListener("keydown", function (e) {
    var item = mockQs[mockIdx]; if (!item) { return; }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= item.options.length) { e.preventDefault(); pickMock(n - 1); }
    else if (e.key === "Enter") { e.preventDefault(); mockNext(); }
  });

  /* expose for import-refresh and verification */
  window.AptitudeTool = {
    refresh: function () { ensureApt(); if (!$("apt-root").hidden) { renderAptDash(); } },
    generate: generate,
    buildMCQ: buildMCQ,
    cats: CATS
  };
})();
