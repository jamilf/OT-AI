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

  var CATS = ["numeracy", "sequences", "abstract", "spatial", "mechanical", "reading", "verbal", "safety"];
  var LABELS = { numeracy: "Numeracy", sequences: "Sequences", abstract: "Abstract", spatial: "Spatial", mechanical: "Mechanical", reading: "Reading", verbal: "Verbal", safety: "Safety" };
  var CHIPCLASS = { numeracy: "chip-blue", sequences: "chip-green", abstract: "chip-amber", spatial: "chip-blue", mechanical: "chip-green", reading: "chip-dim", verbal: "chip-amber", safety: "chip-red" };

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
    if (item.options) { return item; }   // already a complete MCQ (e.g. binary / figure)
    var mcq = buildMCQ(item.ans, item.cands || [], item.fmt || fmtNum);
    return {
      category: item.category, q: item.q, options: mcq.options, answer: mcq.answer,
      explain: item.explain, source: item.source, passage: item.passage, title: item.title,
      figure: item.figure, table: item.table
    };
  }

  /* ---- figure (SVG) MCQ: one correct, unique by key ---- */
  function buildFigureMCQ(correct, distractors) {
    var seen = {}; seen[correct.key] = true;
    var pool = [correct];
    for (var i = 0; i < distractors.length && pool.length < 4; i++) {
      var d = distractors[i];
      if (!seen[d.key]) { seen[d.key] = true; pool.push(d); }
    }
    shuffle(pool);
    return { options: pool.map(function (o) { return { svg: o.svg, alt: o.alt }; }), answer: pool.indexOf(correct) };
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
  function numTable(level) {
    var labels = pick([["Mon", "Tue", "Wed", "Thu", "Fri"], ["Site A", "Site B", "Site C", "Site D"], ["Week 1", "Week 2", "Week 3", "Week 4"]]);
    var unit = pick([{ h: "Units", s: "" }, { h: "Hours", s: " h" }, { h: "Cost", s: "", pre: "$" }]);
    var maxv = [12, 20, 40, 80, 120][level - 1] || 40;
    var rows = labels.map(function (l) { return { l: l, v: rint(2, maxv) }; });
    var type = pick(["total", "highest", "diff", "lowest"]);
    var ans, q, expl;
    var total = rows.reduce(function (a, r) { return a + r.v; }, 0);
    var hi = rows.reduce(function (a, r) { return r.v > a.v ? r : a; }, rows[0]);
    var lo = rows.reduce(function (a, r) { return r.v < a.v ? r : a; }, rows[0]);
    if (type === "total") { ans = total; q = "What is the total across all rows?"; expl = "Add every value: " + rows.map(function (r) { return r.v; }).join(" + ") + " = " + total + "."; }
    else if (type === "highest") { ans = hi.v; q = "What is the highest value in the table?"; expl = hi.l + " has the highest value, " + hi.v + "."; }
    else if (type === "lowest") { ans = lo.v; q = "What is the lowest value in the table?"; expl = lo.l + " has the lowest value, " + lo.v + "."; }
    else { ans = hi.v - lo.v; q = "What is the difference between the highest and lowest values?"; expl = hi.v + " − " + lo.v + " = " + (hi.v - lo.v) + "."; }
    var th = '<thead><tr><th>Item</th><th>' + unit.h + '</th></tr></thead>';
    var tb = '<tbody>' + rows.map(function (r) { return '<tr><td>' + r.l + '</td><td>' + (unit.pre || "") + r.v + unit.s + '</td></tr>'; }).join("") + '</tbody>';
    return { category: "numeracy", table: '<table class="data apt-q-table">' + th + tb + '</table>', q: q, ans: ans,
      cands: [total, hi.v, lo.v, hi.v - lo.v, ans + 1, ans - 1, ans + 10], explain: expl };
  }
  function genNumeracy(level) {
    var makers = [numArith, numPercent, numRatio, numRate, numFraction, numUnit, numTable];
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
  function gearTrainSvg(n) {
    var s = '<svg class="apt-diag" viewBox="0 0 ' + (n * 46 + 14) + ' 70" height="70" aria-hidden="true">';
    for (var i = 0; i < n; i++) {
      var cx = 30 + i * 44;
      s += '<circle cx="' + cx + '" cy="35" r="20" fill="none" stroke="currentColor" stroke-width="2.5"/>';
      s += '<circle cx="' + cx + '" cy="35" r="5" fill="currentColor"/>';
      s += '<text x="' + cx + '" y="64" text-anchor="middle" font-size="10" fill="currentColor">' + (i + 1) + '</text>';
    }
    return s + '</svg>';
  }
  function gearPairSvg(Td, Tn) {
    return '<svg class="apt-diag" viewBox="0 0 150 90" height="84" aria-hidden="true">' +
      '<circle cx="42" cy="45" r="26" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
      '<circle cx="98" cy="45" r="20" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
      '<text x="42" y="49" text-anchor="middle" font-size="11" fill="currentColor">' + Td + 'T</text>' +
      '<text x="98" y="49" text-anchor="middle" font-size="11" fill="currentColor">' + Tn + 'T</text>' +
      '<text x="42" y="82" text-anchor="middle" font-size="9" fill="currentColor">driver</text>' +
      '<text x="98" y="82" text-anchor="middle" font-size="9" fill="currentColor">driven</text></svg>';
  }
  function pulleySvg(seg) {
    var s = '<svg class="apt-diag" viewBox="0 0 120 110" height="100" aria-hidden="true"><line x1="10" y1="14" x2="110" y2="14" stroke="currentColor" stroke-width="3"/>';
    for (var i = 0; i < seg; i++) { var x = 30 + i * 14; s += '<line x1="' + x + '" y1="16" x2="' + x + '" y2="74" stroke="currentColor" stroke-width="2"/>'; }
    s += '<rect x="30" y="74" width="' + (seg * 14) + '" height="18" fill="none" stroke="currentColor" stroke-width="2.5"/>';
    s += '<text x="' + (30 + seg * 7) + '" y="106" text-anchor="middle" font-size="10" fill="currentColor">load</text></svg>';
    return s;
  }
  function leverSvg() {
    return '<svg class="apt-diag" viewBox="0 0 160 80" height="74" aria-hidden="true">' +
      '<line x1="15" y1="45" x2="150" y2="45" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M80 45 L72 64 L88 64 Z" fill="currentColor"/>' +
      '<rect x="20" y="28" width="16" height="16" fill="currentColor"/><text x="28" y="22" text-anchor="middle" font-size="9" fill="currentColor">load</text>' +
      '<line x1="140" y1="30" x2="140" y2="44" stroke="currentColor" stroke-width="2.5"/><path d="M140 44 L135 34 L145 34 Z" fill="currentColor"/>' +
      '<text x="140" y="24" text-anchor="middle" font-size="9" fill="currentColor">effort</text></svg>';
  }
  function mechDir(level) {
    var n = pick(level < 3 ? [2, 3] : [3, 4, 5]);
    var startCW = Math.random() < 0.5, sameAs1 = ((n - 1) % 2 === 0);
    var lastCW = sameAs1 ? startCW : !startCW;
    return { category: "mechanical", figure: gearTrainSvg(n),
      q: "In a train of " + n + " meshed gears, gear 1 turns " + (startCW ? "clockwise" : "counter-clockwise") + ". Which way does gear " + n + " turn?",
      options: ["Clockwise", "Counter-clockwise"], answer: lastCW ? 0 : 1,
      explain: "Meshed gears alternate direction, so gear " + n + " turns " + (sameAs1 ? "the same way as" : "opposite to") + " gear 1." };
  }
  function mechRpm(level) {
    var Td = pick([10, 12, 15, 20, 24, 30]), Tn = pick([10, 12, 15, 20, 24, 30, 40, 60]), R = pick([60, 120, 180, 240, 300, 90]);
    var val = R * Td / Tn;
    if (val !== Math.round(val) || val === R) { return null; }
    return { category: "mechanical", figure: gearPairSvg(Td, Tn),
      q: "A " + Td + "-tooth driver gear turning at " + R + " rpm meshes with a " + Tn + "-tooth gear. What is the driven gear's speed?",
      ans: val, fmt: function (v) { return v + " rpm"; },
      cands: [Math.round(R * Tn / Td), R, val + 10, val - 10, val * 2],
      explain: "Driven rpm = driver rpm × driver teeth ÷ driven teeth = " + R + " × " + Td + " ÷ " + Tn + " = " + val + " rpm." };
  }
  function mechPulley(level) {
    var ma = pick(level < 3 ? [2, 3, 4] : [2, 3, 4, 5, 6]), weight = ma * pick([10, 20, 25, 50, 100]);
    if (Math.random() < 0.5) {
      return { category: "mechanical", figure: pulleySvg(ma),
        q: "A pulley system has " + ma + " rope segments supporting the load. What is its mechanical advantage?",
        ans: ma, cands: [ma + 1, ma - 1, ma * 2, Math.round(weight / ma)],
        explain: "Mechanical advantage equals the number of supporting rope segments = " + ma + "." };
    }
    var effort = weight / ma;
    return { category: "mechanical", figure: pulleySvg(ma),
      q: "A frictionless pulley system with " + ma + " supporting rope segments lifts a " + weight + " N load. What effort is needed?",
      ans: effort, fmt: function (v) { return v + " N"; },
      cands: [weight, weight * ma, effort * 2, effort + 10],
      explain: "Effort = load ÷ mechanical advantage = " + weight + " ÷ " + ma + " = " + effort + " N." };
  }
  function mechLever(level) {
    var load = pick([100, 150, 200, 250, 300, 120, 180]), loadArm = pick([0.2, 0.3, 0.4, 0.5, 0.6]), effortArm = pick([0.8, 1, 1.2, 1.5, 2]);
    var effort = load * loadArm / effortArm;
    if (effort !== Math.round(effort)) { return null; }
    return { category: "mechanical", figure: leverSvg(),
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

  /* ================= ABSTRACT (visual) ================= */
  function svgWrap(inner) {
    return '<svg class="apt-cell" viewBox="0 0 60 60" width="58" height="58" aria-hidden="true">' + inner + '</svg>';
  }
  function arrowCell(deg) {
    return svgWrap('<g transform="rotate(' + deg + ' 30 30)"><line x1="30" y1="48" x2="30" y2="14" stroke="currentColor" stroke-width="3"/><path d="M30 8 L23 20 L37 20 Z" fill="currentColor"/></g>');
  }
  function dotsCell(n) {
    var pos = [[20, 20], [40, 20], [20, 40], [40, 40], [30, 30], [20, 30], [40, 30], [30, 20], [30, 40]];
    var s = "";
    for (var i = 0; i < n && i < pos.length; i++) { s += '<circle cx="' + pos[i][0] + '" cy="' + pos[i][1] + '" r="4.5" fill="currentColor"/>'; }
    return svgWrap(s);
  }
  function polyCell(sides) {
    var pts = [];
    for (var i = 0; i < sides; i++) {
      var a = (-90 + i * 360 / sides) * Math.PI / 180;
      pts.push((30 + 20 * Math.cos(a)).toFixed(1) + "," + (30 + 20 * Math.sin(a)).toFixed(1));
    }
    return svgWrap('<polygon points="' + pts.join(" ") + '" fill="none" stroke="currentColor" stroke-width="3"/>');
  }
  function squareCell(size) {
    var h = size / 2;
    return svgWrap('<rect x="' + (30 - h) + '" y="' + (30 - h) + '" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="3"/>');
  }
  function filledDotsCell(total, filled) {
    var pos = [[18, 18], [42, 18], [18, 42], [42, 42], [30, 30], [30, 18]];
    var s = "";
    for (var i = 0; i < total && i < pos.length; i++) {
      var f = i < filled;
      s += '<circle cx="' + pos[i][0] + '" cy="' + pos[i][1] + '" r="5" ' + (f ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2"') + '/>';
    }
    return svgWrap(s);
  }
  function posDotCell(idx) {
    var p = [[20, 20], [40, 20], [40, 40], [20, 40]][idx];
    return svgWrap('<rect x="8" y="8" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" fill="currentColor"/>');
  }
  function barsCell(n) {
    var s = "";
    for (var i = 0; i < n && i < 8; i++) { s += '<rect x="' + (12 + i * 6) + '" y="16" width="3.5" height="28" fill="currentColor"/>'; }
    return svgWrap(s);
  }
  var POLY = { 3: "triangle", 4: "square", 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon", 9: "nonagon" };
  function polyName(s) { return POLY[s] || (s + "-gon"); }
  function arrowDir(deg) {
    var d = ((deg % 360) + 360) % 360;
    return { 0: "up", 45: "up and right", 90: "right", 135: "down and right", 180: "down", 225: "down and left", 270: "left", 315: "up and left" }[d] || (d + "°");
  }
  var POSNAME = ["top-left", "top-right", "bottom-right", "bottom-left"];
  function rowFigure(cellSvgs) {
    return '<div class="apt-figrow">' + cellSvgs.join("") + '<div class="apt-cell apt-cell-q">?</div></div>';
  }
  function genAbstract(level) {
    var t = pick(["count", "sides", "size", "rotate", "fillcount", "position", "bars"]);
    var cfg, norm = function (x) { return ((x % 360) + 360) % 360; };
    if (t === "count") {
      var step = pick([1, 2]); var start = step === 2 ? 1 : rint(1, 5);
      cfg = { vals: [start, start + step, start + 2 * step, start + 3 * step], correct: start + 4 * step,
        cands: [start + 4 * step - 1, start + 4 * step - 2, start + 4 * step + 1, start + 4 * step + 2, start + 4 * step - 3],
        bound: function (v) { return v >= 1 && v <= 9; }, cell: dotsCell, alt: function (v) { return v + " dots"; }, key: function (v) { return "n" + v; },
        explain: "Each box has " + step + " more dot" + (step === 1 ? "" : "s") + " than the one before." };
    } else if (t === "sides") {
      var s0 = pick([3, 4]); var sc = s0 + 4;
      cfg = { vals: [s0, s0 + 1, s0 + 2, s0 + 3], correct: sc, cands: [sc - 1, sc + 1, sc - 2, sc + 2],
        bound: function (v) { return v >= 3 && v <= 9; }, cell: polyCell, alt: function (v) { return polyName(v) + " (" + v + " sides)"; }, key: function (v) { return "s" + v; },
        explain: "The shape gains one side each step." };
    } else if (t === "size") {
      var z0 = pick([10, 14]); var st = pick([7, 9]); var zc = z0 + 4 * st;
      cfg = { vals: [z0, z0 + st, z0 + 2 * st, z0 + 3 * st], correct: zc, cands: [zc - st, zc - 2 * st, zc - 3 * st, zc + st],
        bound: function (v) { return v >= 8 && v <= 52; }, cell: squareCell, alt: function (v) { return "square of size " + v; }, key: function (v) { return "z" + v; },
        explain: "The square grows by the same amount each step." };
    } else if (t === "rotate") {
      var rstep = pick([45, 90]); var rstart = pick([0, 45, 90, 135]); var rc = rstart + 4 * rstep;
      cfg = { vals: [rstart, rstart + rstep, rstart + 2 * rstep, rstart + 3 * rstep], correct: rc,
        cands: [rc - rstep, rc + rstep, rc + 2 * rstep, rc - 2 * rstep], bound: function () { return true; },
        cell: arrowCell, alt: function (v) { return "arrow pointing " + arrowDir(v); }, key: function (v) { return "r" + norm(v); },
        explain: "The arrow turns " + rstep + "° each step." };
    } else if (t === "fillcount") {
      var total = 6; var fstart = pick([1, 2]); var fc = fstart + 4;
      cfg = { vals: [fstart, fstart + 1, fstart + 2, fstart + 3], correct: fc, cands: [fc - 1, fc - 2, fc - 3, fc + 1, fc + 2],
        bound: function (v) { return v >= 0 && v <= total; }, cell: function (v) { return filledDotsCell(total, v); },
        alt: function (v) { return v + " of " + total + " filled"; }, key: function (v) { return "f" + v; },
        explain: "One more of the " + total + " dots is filled each step." };
    } else if (t === "position") {
      var dir = pick([1, 3]); var ps = rint(0, 3); var pc = (ps + 4 * dir) % 4;
      cfg = { vals: [ps, (ps + dir) % 4, (ps + 2 * dir) % 4, (ps + 3 * dir) % 4], correct: pc, cands: [0, 1, 2, 3],
        bound: function () { return true; }, cell: posDotCell, alt: function (v) { return "dot " + POSNAME[v]; }, key: function (v) { return "p" + v; },
        explain: "The dot moves " + (dir === 1 ? "clockwise" : "anticlockwise") + " one corner each step." };
    } else {
      var bstart = pick([1, 2, 3]); var bc = bstart + 4;
      cfg = { vals: [bstart, bstart + 1, bstart + 2, bstart + 3], correct: bc, cands: [bc - 1, bc - 2, bc + 1, bc - 3],
        bound: function (v) { return v >= 1 && v <= 8; }, cell: barsCell, alt: function (v) { return v + " bars"; }, key: function (v) { return "b" + v; },
        explain: "Each box has one more bar than the last." };
    }
    var correctKey = cfg.key(cfg.correct), seenK = {}; seenK[correctKey] = true; var dist = [];
    for (var i = 0; i < cfg.cands.length && dist.length < 3; i++) {
      var v = cfg.cands[i];
      if (!cfg.bound(v) || v === cfg.correct) { continue; }
      var k = cfg.key(v);
      if (!seenK[k]) { seenK[k] = true; dist.push({ key: k, svg: cfg.cell(v), alt: cfg.alt(v) }); }
    }
    var figure = rowFigure(cfg.vals.map(cfg.cell));
    var figureAlt = "Sequence: " + cfg.vals.map(cfg.alt).join(", then ") + ", then ? (choose the figure that comes next).";
    var correctOpt = { key: correctKey, svg: cfg.cell(cfg.correct), alt: cfg.alt(cfg.correct) };
    var mcq = buildFigureMCQ(correctOpt, dist);
    return { category: "abstract", figure: figure, figureAlt: figureAlt, q: "Which figure completes the sequence?", options: mcq.options, answer: mcq.answer, explain: cfg.explain };
  }

  /* ================= SPATIAL (visual) ================= */
  function glyphPath(shape) {
    if (shape === "flag") { return '<line x1="22" y1="12" x2="22" y2="48" stroke="currentColor" stroke-width="3"/><path d="M22 14 L42 20 L22 28 Z" fill="currentColor"/><circle cx="22" cy="48" r="3.5" fill="currentColor"/>'; }
    if (shape === "L") { return '<path d="M20 12 L20 46 L42 46" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="12" r="3.5" fill="currentColor"/>'; }
    if (shape === "boot") { return '<path d="M24 12 L24 40 L42 40 L42 48 L20 48 L20 12 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'; }
    return '<path d="M16 16 L44 16 L28 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function glyphCell(shape, rot, mirror) {
    return svgWrap('<g transform="rotate(' + rot + ' 30 30)' + (mirror ? ' translate(60 0) scale(-1 1)' : '') + '">' + glyphPath(shape) + '</g>');
  }
  function genSpatial(level) {
    var shape = pick(["flag", "L", "boot", "seven"]);
    var type = pick(["rot", "mirror", "odd"]);
    var rots = shuffle([60, 120, 180, 240, 300]);
    var optAlt = "visual figure option";
    if (type === "rot") {
      var correct = { key: "c", svg: glyphCell(shape, rots[0], false), alt: optAlt };
      var dist = [1, 2, 3].map(function (i) { return { key: "m" + i, svg: glyphCell(shape, rots[i], true), alt: optAlt }; });
      var mcq = buildFigureMCQ(correct, dist);
      return { category: "spatial", figure: '<div class="apt-figrow"><span class="apt-cell-label">Target</span>' + glyphCell(shape, 0, false) + '</div>',
        figureAlt: "A target shape, then four options (visual spatial reasoning).",
        q: "Which option is the target simply rotated (not flipped)?", options: mcq.options, answer: mcq.answer,
        explain: "Only one option is a true rotation of the target; the others are mirror images (flipped)." };
    }
    if (type === "mirror") {
      var correct2 = { key: "c", svg: glyphCell(shape, rots[0], true), alt: optAlt };
      var dist2 = [1, 2, 3].map(function (i) { return { key: "r" + i, svg: glyphCell(shape, rots[i], false), alt: optAlt }; });
      var mcq2 = buildFigureMCQ(correct2, dist2);
      return { category: "spatial", figure: '<div class="apt-figrow"><span class="apt-cell-label">Target</span>' + glyphCell(shape, 0, false) + '</div>',
        figureAlt: "A target shape, then four options (visual spatial reasoning).",
        q: "Which option is a mirror image (flip) of the target?", options: mcq2.options, answer: mcq2.answer,
        explain: "Only one option is flipped; the others are plain rotations." };
    }
    var correct3 = { key: "odd", svg: glyphCell(shape, rots[3], true), alt: optAlt };
    var dist3 = [0, 1, 2].map(function (i) { return { key: "r" + i, svg: glyphCell(shape, rots[i], false), alt: optAlt }; });
    var mcq3 = buildFigureMCQ(correct3, dist3);
    return { category: "spatial", figure: "", figureAlt: "",
      q: "Three of these are the same shape rotated. Which is the odd one out (a mirror image)?",
      options: mcq3.options, answer: mcq3.answer, explain: "Three options are rotations of one shape; the odd one is flipped (mirror image)." };
  }

  /* ================= AUTHORED (reading / safety / verbal) ================= */
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
  var lastReadingId = null, lastSafetyId = null, lastVerbalId = null;
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
  function pickVerbal(level) {
    var it = pickNear(APT_VERBAL, level, lastVerbalId); lastVerbalId = it.id;
    var st = pick(it.statements);
    // options fixed True/False/Cannot say; shuffle and remap
    var opts = ["True", "False", "Cannot say"];
    var sm = shuffleMCQ(opts, st.answer);
    return { category: "verbal", title: it.title, passage: it.passage, q: "Statement: " + st.s,
      options: sm.options, answer: sm.answer, explain: st.explain };
  }

  function generate(cat, level) {
    level = Math.max(1, Math.min(5, level || 2));
    if (cat === "numeracy") { return genNumeracy(level); }
    if (cat === "sequences") { return genSequence(level); }
    if (cat === "abstract") { return genAbstract(level); }
    if (cat === "spatial") { return genSpatial(level); }
    if (cat === "mechanical") { return genMechanical(level); }
    if (cat === "reading") { return pickReading(level); }
    if (cat === "verbal") { return pickVerbal(level); }
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
      if (!a.stats[c]) { a.stats[c] = { seen: 0, correct: 0, timeMs: 0 }; }
      else if (typeof a.stats[c].timeMs !== "number") { a.stats[c].timeMs = 0; }
    });
    a.speed = a.speed || { best: 0 };
    a.mock = a.mock || { best: null, last: null, history: [] };
    a.mock.history = a.mock.history || [];
    a.iq = a.iq || { best: null, last: null, history: [] };
    a.iq.history = a.iq.history || [];
    a.settings = a.settings || {};
    if (!a.settings.drillCats) { a.settings.drillCats = {}; CATS.forEach(function (c) { a.settings.drillCats[c] = true; }); }
    if (typeof a.settings.mockCount !== "number") { a.settings.mockCount = 20; }
    if (typeof a.settings.mockMinutes !== "number") { a.settings.mockMinutes = 15; }
    return a;
  }
  function save() { window.StudyTool.save(); }
  function recordStat(cat, correct, ms) {
    var A = ensureApt();
    A.stats[cat].seen++;
    if (correct) { A.stats[cat].correct++; }
    if (ms) { A.stats[cat].timeMs += ms; }
  }
  function band(pct) { return pct >= 85 ? "Strong" : pct >= 70 ? "Good" : pct >= 50 ? "Fair" : "Developing"; }
  function weakestCats(minSeen) {
    var A = ensureApt(), arr = [];
    CATS.forEach(function (c) {
      var s = A.stats[c];
      if (s.seen >= (minSeen || 3)) { arr.push({ c: c, pct: Math.round(s.correct / s.seen * 100) }); }
    });
    arr.sort(function (x, y) { return x.pct - y.pct; });
    return arr;
  }
  function adapt(cat, correct) {
    var A = ensureApt();
    A.difficulty[cat] = correct ? Math.min(5, A.difficulty[cat] + 1) : Math.max(1, A.difficulty[cat] - 1);
  }

  /* ================= shared rendering ================= */
  function optionList(item, opts) {
    var isFig = item.options.length > 0 && typeof item.options[0] === "object";
    var list = document.createElement("div");
    list.className = "mcq-list" + (isFig ? " mcq-figs" : "");
    item.options.forEach(function (opt, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcq-option" + (isFig ? " mcq-option-fig" : "");
      var key = document.createElement("span"); key.className = "mcq-key"; key.textContent = i + 1;
      var span = document.createElement("span"); span.className = "mcq-text";
      if (isFig) { span.innerHTML = opt.svg; b.setAttribute("aria-label", "Option " + (i + 1) + ": " + (opt.alt || "figure")); }
      else { span.textContent = opt; }
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
    if (item.figure) {
      var fig = document.createElement("div"); fig.className = "apt-figure"; fig.innerHTML = item.figure;
      if (item.figureAlt) { fig.setAttribute("role", "img"); fig.setAttribute("aria-label", item.figureAlt); }
      else { fig.setAttribute("aria-hidden", "true"); }
      container.appendChild(fig);
    }
    if (item.table) { var tw = document.createElement("div"); tw.className = "table-wrap apt-table-wrap"; tw.innerHTML = item.table; container.appendChild(tw); }
    var q = document.createElement("p"); q.className = "apt-q"; q.textContent = item.q; container.appendChild(q);
    container.appendChild(optionList(item, opts));
    if (opts.reveal) {
      var ex = document.createElement("div"); ex.className = "mcq-explain"; ex.setAttribute("role", "status");
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
    if (view !== "apt-drills") { stopSpeedTimer(); }
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
    if ($("apt-iq")) { $("apt-iq").textContent = A.iq.last ? A.iq.last.point : "—"; }
    var lv = $("apt-cat-levels"); lv.innerHTML = "";
    CATS.forEach(function (c) {
      var chip = document.createElement("span"); chip.className = "lvl-chip";
      chip.textContent = catLabel(c) + " · L" + A.difficulty[c];
      lv.appendChild(chip);
    });
    renderAptChips();
    $("apt-start-drills").disabled = !CATS.some(function (c) { return A.settings.drillCats[c]; });
    if ($("apt-start-speed")) { $("apt-start-speed").disabled = !CATS.some(function (c) { return A.settings.drillCats[c]; }); }
    var diag = $("apt-diag");
    if (diag) {
      diag.innerHTML = "";
      if (A.iq.last) {
        var iql = document.createElement("p"); iql.className = "apt-diag-line";
        iql.textContent = "Last estimated IQ ≈ " + A.iq.last.point + " (range " + A.iq.last.low + "–" + A.iq.last.high + ") — indicative only, not a clinical IQ.";
        diag.appendChild(iql);
      }
      if (seen >= 5) {
        var overall = Math.round(correct / seen * 100);
        var line = document.createElement("p"); line.className = "apt-diag-line";
        line.textContent = "Overall: " + band(overall) + " (" + overall + "%) over " + seen + " questions" + (A.speed.best ? " · speed best " + A.speed.best : "") + ".";
        diag.appendChild(line);
        var weak = weakestCats(3);
        if (weak.length && weak[0].pct < 100) {
          var fh = document.createElement("p"); fh.className = "apt-focus";
          fh.textContent = "Focus here: " + weak.slice(0, 2).map(function (w) { return catLabel(w.c) + " (" + w.pct + "%)"; }).join(", ") + ".";
          diag.appendChild(fh);
        }
        var note = document.createElement("p"); note.className = "apt-diag-note";
        note.textContent = "Bands are a rough self-guide, not an official percentile.";
        diag.appendChild(note);
      } else {
        var hint = document.createElement("p"); hint.className = "apt-diag-note";
        hint.textContent = "Do a few drills to unlock your focus areas and rating.";
        diag.appendChild(hint);
      }
    }
    save();
    aptShow("apt-dash");
  }

  /* ---- drills (practice + speeded) ---- */
  var drillItem = null, drillLocked = false, drillCorrect = 0, drillSeen = 0,
    drillBag = [], drillLast = null, selectedDrillCats = [],
    drillMode = "practice", drillStart = 0, speedEndTs = 0, speedTimerId = null;
  function stopSpeedTimer() { if (speedTimerId) { clearInterval(speedTimerId); speedTimerId = null; } }
  function drillCatsFromSettings() {
    var A = ensureApt();
    return CATS.filter(function (c) { return A.settings.drillCats[c]; });
  }
  function nextDrillCat() {
    if (!drillBag.length) {
      drillBag = shuffle(selectedDrillCats.slice());
      if (drillBag.length > 1 && drillBag[0] === drillLast) { drillBag.push(drillBag.shift()); }
    }
    drillLast = drillBag.shift();
    return drillLast;
  }
  function startDrills() {
    selectedDrillCats = drillCatsFromSettings();
    if (!selectedDrillCats.length) { return; }
    drillMode = "practice"; drillCorrect = 0; drillSeen = 0; drillBag = []; drillLast = null;
    $("drill-end").textContent = "End drills";
    aptShow("apt-drills");
    nextDrill();
  }
  function startSpeed() {
    selectedDrillCats = drillCatsFromSettings();
    if (!selectedDrillCats.length) { return; }
    drillMode = "speed"; drillCorrect = 0; drillSeen = 0; drillBag = []; drillLast = null;
    speedEndTs = Date.now() + 180000;
    $("drill-end").textContent = "Stop";
    aptShow("apt-drills");
    stopSpeedTimer();
    speedTimerId = setInterval(speedTick, 250);
    nextDrill();
    speedTick();
  }
  function speedTick() {
    var remaining = speedEndTs - Date.now();
    if (remaining <= 0) { stopSpeedTimer(); endSpeed(); return; }
    var s = Math.ceil(remaining / 1000), m = Math.floor(s / 60), ss = s % 60;
    $("drill-progress").textContent = "⏱ " + m + ":" + (ss < 10 ? "0" : "") + ss + " · " + drillCorrect + " correct";
  }
  function endSpeed() {
    var A = ensureApt();
    if (drillCorrect > (A.speed.best || 0)) { A.speed.best = drillCorrect; }
    save();
    var area = $("results-area"); area.innerHTML = "";
    var head = document.createElement("div"); head.className = "panel summary-card";
    var h = document.createElement("h3"); h.textContent = "Beat the clock: " + drillCorrect + " correct"; head.appendChild(h);
    var p = document.createElement("p");
    p.textContent = drillSeen + " attempted in 3 minutes" + (A.speed.best ? " · best " + A.speed.best : "") + ". Speed with accuracy is exactly what timed assessments reward.";
    head.appendChild(p); area.appendChild(head);
    aptShow("apt-results");
  }
  function updateDrillProgress() {
    if (drillMode === "speed") { return; }
    $("drill-progress").textContent = drillCorrect + " of " + drillSeen + " correct";
  }
  function nextDrill() {
    var A = ensureApt(), cat = nextDrillCat();
    drillItem = generate(cat, A.difficulty[cat]);
    drillLocked = false;
    drillStart = Date.now();
    renderQuestionCard($("drill-area"), drillItem, { reveal: false, selected: null, onPick: drillAnswer });
    updateDrillProgress();
    focusFirstOption("drill-area");
  }
  function drillAnswer(i) { if (drillMode === "speed") { answerSpeed(i); } else { answerDrill(i); } }
  function answerDrill(i) {
    if (drillLocked) { return; }
    drillLocked = true;
    var ms = Date.now() - drillStart;
    var correct = (i === drillItem.answer);
    recordStat(drillItem.category, correct, ms);
    adapt(drillItem.category, correct);
    drillSeen++; if (correct) { drillCorrect++; }
    save();
    renderQuestionCard($("drill-area"), drillItem, { reveal: true, selected: i });
    var tnote = document.createElement("p"); tnote.className = "apt-time"; tnote.textContent = "Answered in " + (ms / 1000).toFixed(1) + " s";
    $("drill-area").appendChild(tnote);
    var wrap = document.createElement("div"); wrap.className = "apt-next-wrap";
    var nb = document.createElement("button"); nb.id = "drill-next"; nb.type = "button"; nb.className = "btn btn-primary"; nb.textContent = "Next question";
    nb.addEventListener("click", nextDrill);
    wrap.appendChild(nb); $("drill-area").appendChild(wrap);
    nb.focus();
    updateDrillProgress();
  }
  function answerSpeed(i) {
    if (drillLocked) { return; }
    drillLocked = true;
    var ms = Date.now() - drillStart;
    recordStat(drillItem.category, i === drillItem.answer, ms);
    drillSeen++; if (i === drillItem.answer) { drillCorrect++; }
    save();
    nextDrill();
  }

  /* ---- mock exam ---- */
  var mockQs = [], mockAnswers = [], mockIdx = 0, mockEndTs = 0, mockTimerId = null, mockSubmitted = false,
    mockStartTs = 0, mockElapsedMs = 0;
  function stopMockTimer() { if (mockTimerId) { clearInterval(mockTimerId); mockTimerId = null; } }
  var MOCK_CFG = { kind: "mock" };
  var IQ_CFG = { kind: "iq", cats: ["abstract", "spatial", "sequences", "numeracy", "verbal"],
    count: 25, minutes: 13, levels: [3, 4, 4, 5, 5], weight: { abstract: 6, spatial: 5, sequences: 5, numeracy: 5, verbal: 4 } };
  var testKind = "mock", testMinutes = 15;

  function authoredCaps() {
    return {
      reading: APT_READING.reduce(function (a, r) { return a + r.questions.length; }, 0),
      safety: APT_SAFETY.length,
      verbal: APT_VERBAL.reduce(function (a, v) { return a + v.statements.length; }, 0)
    };
  }
  function buildTest(cfg) {
    var A = ensureApt();
    var cats = cfg.cats || CATS;
    var count = cfg.count || A.settings.mockCount;
    var levels = cfg.levels || [2, 3, 3, 4];
    var cap = authoredCaps();
    var per = {}; cats.forEach(function (c) { per[c] = 0; });
    if (cfg.weight) {
      cats.forEach(function (c) { per[c] = Math.min(cfg.weight[c] || 0, cap.hasOwnProperty(c) ? cap[c] : Infinity); });
      var gen = cats.filter(function (c) { return !cap.hasOwnProperty(c); });
      var sum = cats.reduce(function (s, c) { return s + per[c]; }, 0), gi = 0, guard = 0;
      while (sum < count && gen.length && guard < 2000) { guard++; per[gen[gi % gen.length]]++; gi++; sum++; }
      while (sum > count && gen.length && guard < 4000) { guard++; var g = gen[gi % gen.length]; gi++; if (per[g] > 0) { per[g]--; sum--; } }
    } else {
      var total = count, order = cats.slice(), i = 0, g2 = 0;
      while (total > 0 && g2 < 2000) { g2++; var c0 = order[i % order.length]; i++; var lim = cap.hasOwnProperty(c0) ? cap[c0] : Infinity; if (per[c0] < lim) { per[c0]++; total--; } }
    }
    var qs = [], seenQ = {};
    cats.forEach(function (c) {
      var made = 0, tries = 0;
      while (made < per[c] && tries < 80) {
        tries++;
        var lvl = levels[made % levels.length];
        var it = generate(c, lvl);
        var keyq = it.q + "|" + (it.figure || "") + "|" + it.options.map(function (o) { return o.svg || o; }).join("~");
        if (seenQ[keyq]) { continue; }
        seenQ[keyq] = true; it._lvl = lvl; qs.push(it); made++;
      }
    });
    return shuffle(qs);
  }
  function startTest(cfg) {
    var A = ensureApt();
    testKind = cfg.kind;
    testMinutes = cfg.minutes || A.settings.mockMinutes;
    mockQs = buildTest(cfg);
    mockAnswers = mockQs.map(function () { return -1; });
    mockIdx = 0; mockSubmitted = false;
    mockStartTs = Date.now();
    mockEndTs = Date.now() + testMinutes * 60000;
    aptShow("apt-mock");
    renderMockQ();
    stopMockTimer();
    mockTimerId = setInterval(tickMock, 250);
    tickMock();
    focusFirstOption("mock-area");
  }

  /* ---- estimated IQ (transparent, conservative, banded) ---- */
  function iqMap(raw) { return Math.max(70, Math.min(130, Math.round(100 + (raw - 0.5) * 60))); }
  function iqBand(p) { return p < 85 ? "below average" : p < 115 ? "broadly average" : p < 130 ? "above average" : "high (capped)"; }
  function computeIQ() {
    var earned = 0, maxw = 0, correct = 0, answered = 0;
    mockQs.forEach(function (it, idx) {
      var lvl = it._lvl || 3;
      maxw += lvl;
      if (mockAnswers[idx] >= 0) { answered++; }
      if (mockAnswers[idx] === it.answer) { earned += lvl; correct++; }
    });
    var raw = maxw ? earned / maxw : 0;
    var point = iqMap(raw);
    return { point: point, low: Math.max(70, point - 8), high: Math.min(130, point + 8),
      raw: Math.round(raw * 100), correct: correct, total: mockQs.length, answered: answered,
      minutes: Math.round(mockElapsedMs / 60000 * 10) / 10, date: new Date().toISOString().slice(0, 10) };
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
    mockElapsedMs = Math.min(Date.now() - mockStartTs, testMinutes * 60000);
    var A = ensureApt(), score = 0, byCat = {};
    CATS.forEach(function (c) { byCat[c] = { c: 0, n: 0 }; });
    mockQs.forEach(function (it, idx) {
      byCat[it.category].n++;
      if (mockAnswers[idx] === it.answer) { score++; byCat[it.category].c++; }
    });
    var total = mockQs.length, pct = Math.round(score / total * 100);
    if (testKind === "iq") {
      var iq = computeIQ();
      A.iq.last = iq;
      if (!A.iq.best || iq.point > A.iq.best.point) { A.iq.best = iq; }
      A.iq.history.push(iq); if (A.iq.history.length > 20) { A.iq.history = A.iq.history.slice(-20); }
      save();
      renderIqResults(iq, byCat);
      return;
    }
    var rec = { score: score, total: total, pct: pct, date: new Date().toISOString().slice(0, 10) };
    A.mock.last = rec;
    if (!A.mock.best || pct > A.mock.best.pct) { A.mock.best = rec; }
    A.mock.history.push(rec);
    if (A.mock.history.length > 20) { A.mock.history = A.mock.history.slice(-20); }
    save();
    renderResults(score, total, pct, byCat);
  }
  function appendBreakdown(area, byCat) {
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
    function optText(opt) { return (opt && typeof opt === "object") ? (opt.alt || "(figure)") : opt; }
    missed.forEach(function (m) {
      var card = document.createElement("div"); card.className = "browse-item";
      var q = document.createElement("p"); q.className = "bi-q"; q.textContent = m.it.q; card.appendChild(q);
      if (m.it.figure) { var f = document.createElement("div"); f.className = "apt-figure"; f.innerHTML = m.it.figure; card.appendChild(f); }
      var your = document.createElement("p"); your.className = "bi-a";
      your.textContent = "Your answer: " + (m.sel >= 0 ? optText(m.it.options[m.sel]) : "(left blank)");
      card.appendChild(your);
      var corr = document.createElement("p"); corr.className = "bi-a bi-correct"; corr.textContent = "Correct: " + optText(m.it.options[m.it.answer]); card.appendChild(corr);
      if (m.it.options[m.it.answer] && typeof m.it.options[m.it.answer] === "object") {
        var cf = document.createElement("div"); cf.className = "apt-figure apt-figure-sm"; cf.innerHTML = m.it.options[m.it.answer].svg; card.appendChild(cf);
      }
      var ex = document.createElement("p"); ex.className = "bi-src"; ex.textContent = m.it.explain + (m.it.source ? " · " + m.it.source : ""); card.appendChild(ex);
      area.appendChild(card);
    });
  }

  function renderIqResults(iq, byCat) {
    var A = ensureApt(), area = $("results-area");
    area.innerHTML = "";
    var card = document.createElement("div"); card.className = "panel summary-card iq-result";
    var h = document.createElement("h3"); h.textContent = "Estimated IQ"; card.appendChild(h);
    var big = document.createElement("p"); big.className = "iq-score"; big.textContent = "≈ " + iq.point; card.appendChild(big);
    var rng = document.createElement("p"); rng.className = "iq-range";
    rng.textContent = "indicative range " + iq.low + "–" + iq.high + " · " + iqBand(iq.point); card.appendChild(rng);
    var work = document.createElement("p"); work.className = "iq-work";
    work.textContent = "You earned " + iq.raw + "% of the difficulty-weighted points (" + iq.correct + "/" + iq.total + " correct) in " + iq.minutes + " min" + (A.iq.best ? " · best ≈ " + A.iq.best.point : "") + ".";
    card.appendChild(work);
    var cav = document.createElement("p"); cav.className = "iq-caveat";
    cav.textContent = "Indicative only — a short, unproctored, self-administered reasoning test, not a clinical or professionally-normed IQ. It can't measure above ~130 (the questions only get so hard), repeat attempts inflate it, and only an honest single timed sitting means anything.";
    card.appendChild(cav);
    area.appendChild(card);
    appendBreakdown(area, byCat);
    aptShow("apt-results");
  }

  function renderResults(score, total, pct, byCat) {
    var A = ensureApt(), area = $("results-area");
    area.innerHTML = "";
    var head = document.createElement("div"); head.className = "panel summary-card";
    var h = document.createElement("h3"); h.textContent = "Mock score: " + score + " / " + total + " (" + pct + "%)"; head.appendChild(h);
    var avgs = total ? (mockElapsedMs / 1000 / total).toFixed(1) : "0";
    var sub = document.createElement("p");
    sub.textContent = band(pct) + " · " + avgs + " s per question · " + (A.mock.best ? "best " + A.mock.best.pct + "%" : "first run") + ". Rough self-guide, not an official score.";
    head.appendChild(sub);
    // focus-here: weakest categories in THIS mock
    var weak = [];
    CATS.forEach(function (c) { if (byCat[c].n) { weak.push({ c: c, pct: Math.round(byCat[c].c / byCat[c].n * 100) }); } });
    weak.sort(function (x, y) { return x.pct - y.pct; });
    if (weak.length && weak[0].pct < 100) {
      var fh = document.createElement("p"); fh.className = "apt-focus";
      fh.textContent = "Focus here: " + weak.slice(0, 2).map(function (w) { return catLabel(w.c) + " (" + w.pct + "%)"; }).join(", ") + ".";
      head.appendChild(fh);
    }
    area.appendChild(head);
    appendBreakdown(area, byCat);
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
  $("apt-start-mock").addEventListener("click", function () { startTest(MOCK_CFG); });
  if ($("apt-start-iq")) { $("apt-start-iq").addEventListener("click", function () { startTest(IQ_CFG); }); }
  if ($("apt-start-speed")) { $("apt-start-speed").addEventListener("click", startSpeed); }
  $("drill-end").addEventListener("click", function () {
    if (drillMode === "speed") { stopSpeedTimer(); endSpeed(); } else { renderAptDash(); }
  });
  $("mock-submit").addEventListener("click", function () { submitMock(); });
  $("mock-next").addEventListener("click", mockNext);
  $("mock-prev").addEventListener("click", mockPrev);
  $("apt-results-back").addEventListener("click", renderAptDash);

  $("apt-drills").addEventListener("keydown", function (e) {
    if (!drillItem) { return; }
    if (!drillLocked) {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= drillItem.options.length) { e.preventDefault(); drillAnswer(n - 1); }
    } else if (e.key === "Enter" && drillMode !== "speed") {
      var nb = $("drill-next"); if (nb) { e.preventDefault(); nb.click(); }
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
    iqMap: iqMap,
    cats: CATS
  };
})();
