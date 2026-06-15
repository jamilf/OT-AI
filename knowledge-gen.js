/* ============================================================
   knowledge-gen.js — deterministically generated knowledge cards.

   TRUTHFULNESS: every card here is COMPUTED in code from a stated
   electrical formula, so the answer is correct by construction.
   No randomness — cards and ids are deterministic and stable
   across reloads, so spaced-repetition scheduling (keyed on id)
   persists. Appends to the global STUDY_CARDS from study-data.js.
   ============================================================ */
(function () {
  "use strict";
  if (typeof STUDY_CARDS === "undefined") { return; }

  var cards = [];
  function fmt(v) { var r = Math.round(v * 1000) / 1000; return String(r); }
  function add(id, category, front, back, source) {
    cards.push({ id: id, category: category, front: front, back: back, source: source });
  }

  /* ---- Ohm's law: V = I × R ---- */
  (function () {
    var Is = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];
    var Rs = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 22, 33, 47, 100, 220, 470];
    var n = 0;
    Is.forEach(function (I) {
      Rs.forEach(function (R) {
        n++;
        var V = I * R;
        add("kn-ohmV-" + n, "Ohm's law",
          "A current of " + I + " A flows through a " + R + " Ω resistor. What is the voltage across it?",
          "V = I × R = " + I + " × " + R + " = " + V + " V.",
          "Computed from Ohm's law (V = IR)");
      });
    });
  })();

  /* ---- Ohm's law: I = V / R ---- */
  (function () {
    var Vs = [6, 9, 10, 12, 18, 20, 24, 30, 36, 40, 48, 50, 60, 100, 120, 240, 415];
    var Rs = [2, 3, 4, 5, 6, 8, 10, 12];
    var n = 0;
    Vs.forEach(function (V) {
      Rs.forEach(function (R) {
        if (V % R !== 0) { return; }
        n++;
        var I = V / R;
        add("kn-ohmI-" + n, "Ohm's law",
          "A voltage of " + V + " V is applied across a " + R + " Ω resistor. What current flows?",
          "I = V ÷ R = " + V + " ÷ " + R + " = " + I + " A.",
          "Computed from Ohm's law (I = V/R)");
      });
    });
  })();

  /* ---- Ohm's law: R = V / I ---- */
  (function () {
    var Vs = [6, 9, 12, 18, 24, 30, 36, 48, 60, 90, 120, 240, 415, 100, 200];
    var Is = [2, 3, 4, 5, 6, 8, 10];
    var n = 0;
    Vs.forEach(function (V) {
      Is.forEach(function (I) {
        if (V % I !== 0) { return; }
        n++;
        var R = V / I;
        add("kn-ohmR-" + n, "Ohm's law",
          "A " + V + " V supply drives " + I + " A through a resistor. What is its resistance?",
          "R = V ÷ I = " + V + " ÷ " + I + " = " + R + " Ω.",
          "Computed from Ohm's law (R = V/I)");
      });
    });
  })();

  /* ---- Power: P = V × I ---- */
  (function () {
    var Vs = [5, 6, 9, 12, 24, 48, 110, 230, 240, 415];
    var Is = [1, 2, 3, 4, 5, 8, 10];
    var n = 0;
    Vs.forEach(function (V) {
      Is.forEach(function (I) {
        n++;
        var P = V * I;
        add("kn-powVI-" + n, "Power",
          "A load draws " + I + " A at " + V + " V. What power does it consume?",
          "P = V × I = " + V + " × " + I + " = " + P + " W.",
          "Computed from power formula (P = VI)");
      });
    });
  })();

  /* ---- Power: P = I² × R ---- */
  (function () {
    var Is = [1, 2, 3, 4, 5, 6, 8, 10];
    var Rs = [2, 3, 4, 5, 6, 10, 15, 20];
    var n = 0;
    Is.forEach(function (I) {
      Rs.forEach(function (R) {
        n++;
        var P = I * I * R;
        add("kn-powIR-" + n, "Power",
          "A current of " + I + " A flows through a " + R + " Ω resistor. What power is dissipated?",
          "P = I² × R = " + I + "² × " + R + " = " + P + " W.",
          "Computed from power formula (P = I²R)");
      });
    });
  })();

  /* ---- Power: P = V² / R ---- */
  (function () {
    var Vs = [10, 12, 20, 24, 30, 40, 60, 100, 120, 240];
    var Rs = [2, 3, 4, 5, 6, 8, 10, 12, 20, 24, 25, 48, 50, 100];
    var n = 0;
    Vs.forEach(function (V) {
      Rs.forEach(function (R) {
        if ((V * V) % R !== 0) { return; }
        n++;
        var P = (V * V) / R;
        add("kn-powVR-" + n, "Power",
          "A " + V + " V supply is connected across a " + R + " Ω resistor. What power is dissipated?",
          "P = V² ÷ R = " + (V * V) + " ÷ " + R + " = " + P + " W.",
          "Computed from power formula (P = V²/R)");
      });
    });
  })();

  /* ---- Series resistance ---- */
  (function () {
    var groups = [
      [10, 20], [5, 15], [100, 220], [47, 53], [12, 8], [2, 3], [33, 47],
      [6, 6], [4, 4], [100, 100], [220, 330], [1000, 470], [15, 25], [60, 40],
      [22, 18], [120, 80], [330, 270], [3, 5, 7], [10, 20, 30], [100, 100, 100],
      [2, 4, 6], [5, 10, 15], [12, 8, 10], [47, 33, 20], [6, 6, 6], [4, 4, 4, 4],
      [1, 2, 3, 4], [10, 10, 10, 10], [25, 25, 50], [200, 300, 500]
    ];
    var n = 0;
    groups.forEach(function (g) {
      n++;
      var total = g.reduce(function (a, b) { return a + b; }, 0);
      add("kn-series-" + n, "Series & parallel",
        "Resistors of " + g.join(" Ω, ") + " Ω are connected in series. What is the total resistance?",
        "In series, resistances add: " + g.join(" + ") + " = " + total + " Ω.",
        "Computed (series: Rₜ = R₁ + R₂ + …)");
    });
  })();

  /* ---- Parallel resistance (two resistors, clean results) ---- */
  (function () {
    var pairs = [
      [3, 6], [4, 4], [6, 12], [10, 15], [20, 30], [12, 4], [2, 2], [8, 8],
      [20, 5], [12, 6], [30, 20], [60, 30], [40, 40], [10, 40], [6, 3], [15, 10],
      [12, 24], [9, 18], [100, 100], [6, 6], [10, 10], [20, 20], [200, 200],
      [30, 60], [50, 50], [80, 20], [12, 12], [18, 9], [24, 8], [36, 12]
    ];
    var n = 0;
    pairs.forEach(function (p) {
      var R = (p[0] * p[1]) / (p[0] + p[1]);
      if (R !== Math.round(R * 100) / 100) { return; }
      n++;
      add("kn-parallel-" + n, "Series & parallel",
        "A " + p[0] + " Ω and a " + p[1] + " Ω resistor are connected in parallel. What is the total resistance?",
        "R = (R₁ × R₂) ÷ (R₁ + R₂) = (" + p[0] + " × " + p[1] + ") ÷ " + (p[0] + p[1]) + " = " + fmt(R) + " Ω.",
        "Computed (parallel: product over sum)");
    });
  })();

  /* ---- Energy: E = P × t (kWh) ---- */
  (function () {
    var Ps = [0.5, 1, 1.5, 2, 2.4, 3, 4, 5, 8, 10];
    var Ts = [1, 2, 3, 4, 5, 6, 8, 10, 24];
    var n = 0;
    Ps.forEach(function (P) {
      Ts.forEach(function (t) {
        n++;
        var E = Math.round(P * t * 100) / 100;
        add("kn-energy-" + n, "Energy & cost",
          "An appliance rated " + P + " kW runs for " + t + " hours. How much energy does it use?",
          "E = P × t = " + P + " × " + t + " = " + fmt(E) + " kWh.",
          "Computed (E = P × t)");
      });
    });
  })();

  /* ---- Cost of energy ---- */
  (function () {
    var kWhs = [1, 2, 5, 8, 10, 20, 30, 50];
    var rates = [25, 30, 35, 40]; // cents per kWh
    var n = 0;
    kWhs.forEach(function (k) {
      rates.forEach(function (c) {
        n++;
        var cost = (k * c) / 100;
        add("kn-cost-" + n, "Energy & cost",
          "Using " + k + " kWh at " + c + " cents per kWh, what is the cost?",
          k + " kWh × " + c + "c = " + (k * c) + "c = $" + fmt(cost) + ".",
          "Computed (cost = energy × unit rate)");
      });
    });
  })();

  /* ---- Unit / SI-prefix conversions ---- */
  (function () {
    var specs = [
      { from: "kV", to: "V", f: 1000, vals: [0.4, 1, 2.4, 3.3, 6.6, 11, 22, 33, 66, 132] },
      { from: "V", to: "kV", f: 1 / 1000, vals: [400, 1000, 2400, 6600, 11000, 22000, 33000] },
      { from: "kW", to: "W", f: 1000, vals: [0.5, 1, 1.5, 2.4, 3, 5, 7.5, 10, 11, 15] },
      { from: "W", to: "kW", f: 1 / 1000, vals: [500, 1500, 2400, 3000, 7500, 11000] },
      { from: "A", to: "mA", f: 1000, vals: [0.01, 0.1, 0.25, 0.5, 1, 1.5, 2, 5] },
      { from: "mA", to: "A", f: 1 / 1000, vals: [100, 250, 500, 1000, 1500, 2000] },
      { from: "kΩ", to: "Ω", f: 1000, vals: [0.47, 1, 2.2, 4.7, 10, 22, 47, 100] },
      { from: "Ω", to: "kΩ", f: 1 / 1000, vals: [470, 1000, 2200, 4700, 10000] },
      { from: "s", to: "ms", f: 1000, vals: [0.001, 0.01, 0.02, 0.1, 0.5, 1, 2] },
      { from: "ms", to: "s", f: 1 / 1000, vals: [20, 100, 250, 500, 1000] },
      { from: "m", to: "mm", f: 1000, vals: [0.5, 1, 1.5, 2, 2.5, 5, 10, 25] },
      { from: "mm", to: "m", f: 1 / 1000, vals: [500, 1000, 1500, 2500, 6000] }
    ];
    var n = 0;
    specs.forEach(function (sp) {
      sp.vals.forEach(function (v) {
        n++;
        var out = Math.round(v * sp.f * 1000) / 1000;
        add("kn-conv-" + n, "Units & prefixes",
          "Convert " + v + " " + sp.from + " to " + sp.to + ".",
          v + " " + sp.from + " = " + fmt(out) + " " + sp.to + ".",
          "Computed (SI-prefix conversion)");
      });
    });
  })();

  /* ---- Transformer turns ratio: Vs = Vp × Ns / Np ---- */
  (function () {
    var Vps = [240, 415, 11000, 120, 1000, 6600];
    var ratios = [[10, 1], [2, 1], [4, 1], [5, 1], [20, 1], [1, 2], [1, 10], [1, 4]];
    var n = 0;
    Vps.forEach(function (Vp) {
      ratios.forEach(function (r) {
        var Vs = Vp * r[1] / r[0];
        if (Vs !== Math.round(Vs)) { return; }
        n++;
        add("kn-tx-" + n, "Transformers",
          "A transformer has a primary of " + Vp + " V with a turns ratio (primary:secondary) of " + r[0] + ":" + r[1] + ". What is the secondary voltage?",
          "Vs = Vp × Ns ÷ Np = " + Vp + " × " + r[1] + " ÷ " + r[0] + " = " + Vs + " V.",
          "Computed (transformer turns ratio)");
      });
    });
  })();

  /* ---- Voltage divider: Vout = Vin × R2 / (R1 + R2) ---- */
  (function () {
    var Vins = [10, 12, 24, 100, 20, 40];
    var pairs = [[10, 10], [10, 30], [30, 10], [20, 60], [60, 20], [50, 150], [100, 100], [40, 120]];
    var n = 0;
    Vins.forEach(function (Vin) {
      pairs.forEach(function (p) {
        var Vout = Vin * p[1] / (p[0] + p[1]);
        if (Vout !== Math.round(Vout * 100) / 100) { return; }
        n++;
        add("kn-divider-" + n, "Circuit theory",
          "In a voltage divider, " + Vin + " V is applied across R1 = " + p[0] + " Ω and R2 = " + p[1] + " Ω in series. What is the voltage across R2?",
          "Vout = Vin × R2 ÷ (R1 + R2) = " + Vin + " × " + p[1] + " ÷ " + (p[0] + p[1]) + " = " + fmt(Vout) + " V.",
          "Computed (voltage-divider rule)");
      });
    });
  })();

  for (var i = 0; i < cards.length; i++) { STUDY_CARDS.push(cards[i]); }
})();
