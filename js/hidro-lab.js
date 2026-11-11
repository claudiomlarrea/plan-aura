/**
 * Laboratorio de datos hídricos (#datos-hidrologicos).
 * Serie diaria Km 101 desde hidrologia/caudales_diarios.csv.
 * Sin interpolación: solo días con dato publicado.
 */
(function () {
  var CSV_URL = "hidrologia/caudales_diarios.csv";
  var MANIFEST_URL = "hidrologia/manifest.json";
  var CHART_SRC = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
  var SEC_IN_DAY = 86400;

  var series = null;
  var manifest = null;
  var chart = null;
  var lastStats = null;

  function t(key, vars) {
    var text =
      window.I18N && typeof window.I18N.t === "function"
        ? window.I18N.t(key)
        : key;
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? vars[k] : "{" + k + "}";
    });
  }

  function lang() {
    return window.I18N && window.I18N.getLang ? window.I18N.getLang() : "es";
  }

  function $(id) {
    return document.getElementById(id);
  }

  function parseNum(raw) {
    if (raw == null || raw === "") return null;
    var n = Number(String(raw).trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function parseCsv(text) {
    var lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = line.split(";");
      if (parts.length < 2) continue;
      var fecha = parts[0].trim();
      var m3s = parseNum(parts[1]);
      if (!fecha || m3s == null) continue;
      rows.push({
        fecha: fecha,
        m3s: m3s,
        fuente: (parts[2] || "").trim()
      });
    }
    return rows;
  }

  function loadChart() {
    if (window.Chart) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = CHART_SRC;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function setStatus(msg, isError) {
    var el = $("lab-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function fmt(n, digits) {
    if (n == null || !Number.isFinite(n)) return "s/d";
    return n.toLocaleString("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function fechaCorta(iso) {
    if (!iso) return "s/d";
    var p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3 || p[0].length !== 4) return "s/d";
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function addDays(iso, n) {
    var p = String(iso).split("-");
    var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    d.setUTCDate(d.getUTCDate() + n);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  function addMonths(ym, n) {
    var p = String(ym).split("-");
    var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1 + n, 1));
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1);
  }

  function bustUrl(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + Date.now();
  }

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    var pos = (sorted.length - 1) * q;
    var base = Math.floor(pos);
    var rest = pos - base;
    if (sorted[base + 1] == null) return sorted[base];
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  function filterRange(rows, from, to) {
    return rows.filter(function (r) {
      return r.fecha >= from && r.fecha <= to;
    });
  }

  function daySpan(from, to) {
    var a = new Date(from + "T12:00:00");
    var b = new Date(to + "T12:00:00");
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  function summarize(rows, from, to) {
    if (!rows.length) {
      return {
        n: 0,
        span: daySpan(from, to),
        coverage: 0,
        media: null,
        mediana: null,
        p10: null,
        p90: null,
        min: null,
        max: null,
        fechaMin: null,
        fechaMax: null,
        derrame: null
      };
    }
    var values = rows.map(function (r) {
      return r.m3s;
    });
    var sorted = values.slice().sort(function (a, b) {
      return a - b;
    });
    var sum = 0;
    var min = rows[0];
    var max = rows[0];
    rows.forEach(function (r) {
      sum += r.m3s;
      if (r.m3s < min.m3s) min = r;
      if (r.m3s > max.m3s) max = r;
    });
    var span = daySpan(from, to);
    return {
      n: rows.length,
      span: span,
      coverage: (100 * rows.length) / span,
      media: sum / rows.length,
      mediana: quantile(sorted, 0.5),
      p10: quantile(sorted, 0.1),
      p90: quantile(sorted, 0.9),
      min: min.m3s,
      max: max.m3s,
      fechaMin: fechaCorta(min.fecha),
      fechaMax: fechaCorta(max.fecha),
      derrame: (sum * SEC_IN_DAY) / 1e6
    };
  }

  function aggregateMonthly(rows) {
    var map = {};
    rows.forEach(function (r) {
      var key = r.fecha.slice(0, 7);
      if (!map[key]) map[key] = { sum: 0, n: 0 };
      map[key].sum += r.m3s;
      map[key].n += 1;
    });
    var keys = Object.keys(map).sort();
    if (!keys.length) return [];
    var out = [];
    var cursor = keys[0];
    var end = keys[keys.length - 1];
    while (cursor <= end) {
      if (map[cursor]) {
        out.push({ label: cursor, m3s: map[cursor].sum / map[cursor].n });
      } else {
        out.push({ label: cursor, m3s: null });
      }
      cursor = addMonths(cursor, 1);
    }
    return out;
  }

  function pointsWithGaps(rows) {
    if (!rows.length) return [];
    var byDate = {};
    rows.forEach(function (r) {
      byDate[r.fecha] = r.m3s;
    });
    var out = [];
    var cursor = rows[0].fecha;
    var end = rows[rows.length - 1].fecha;
    while (cursor <= end) {
      out.push({
        label: cursor,
        m3s: Object.prototype.hasOwnProperty.call(byDate, cursor) ? byDate[cursor] : null
      });
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  function renderStats(targetId, stats, title) {
    var el = $(targetId);
    if (!el) return;
    if (!stats || !stats.n) {
      el.innerHTML =
        "<p class=\"lab-empty\">" + t("sec.lab.stats.empty") + "</p>";
      return;
    }
    el.innerHTML =
      "<h4>" +
      title +
      "</h4>" +
      '<dl class="lab-stats">' +
      "<div><dt>" +
      t("sec.lab.stats.n") +
      "</dt><dd>" +
      stats.n +
      " / " +
      stats.span +
      "</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.coverage") +
      "</dt><dd>" +
      fmt(stats.coverage, 1) +
      " %</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.mean") +
      "</dt><dd>" +
      fmt(stats.media, 3) +
      " m³/s</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.median") +
      "</dt><dd>" +
      fmt(stats.mediana, 3) +
      " m³/s</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.p10") +
      "</dt><dd>" +
      fmt(stats.p10, 3) +
      " m³/s</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.p90") +
      "</dt><dd>" +
      fmt(stats.p90, 3) +
      " m³/s</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.min") +
      "</dt><dd>" +
      fmt(stats.min, 3) +
      " · " +
      (stats.fechaMin || "s/d") +
      "</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.max") +
      "</dt><dd>" +
      fmt(stats.max, 3) +
      " · " +
      (stats.fechaMax || "s/d") +
      "</dd></div>" +
      "<div><dt>" +
      t("sec.lab.stats.runoff") +
      "</dt><dd>" +
      fmt(stats.derrame, 1) +
      " hm³</dd></div>" +
      "</dl>";
  }

  function renderChart(rows) {
    var canvas = $("lab-chart");
    if (!canvas || !window.Chart) return;
    var useMonthly = rows.length > 400;
    var points = useMonthly ? aggregateMonthly(rows) : pointsWithGaps(rows);
    var label = useMonthly
      ? t("sec.lab.chart.monthly")
      : t("sec.lab.chart.daily");
    var note = $("lab-chart-note");
    if (note) note.textContent = label;
    if (chart) chart.destroy();
    chart = new window.Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: points.map(function (p) {
          return p.label;
        }),
        datasets: [
          {
            label: "m³/s",
            data: points.map(function (p) {
              return p.m3s;
            }),
            borderColor: "#1a6fa8",
            backgroundColor: "rgba(26, 111, 168, 0.12)",
            fill: true,
            pointRadius: points.length > 120 ? 0 : 2,
            borderWidth: 1.5,
            tension: 0,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: label,
            color: "#1f1418"
          }
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 8,
              color: "#5c6570"
            },
            grid: { color: "rgba(26,111,168,0.08)" }
          },
          y: {
            title: { display: true, text: "m³/s", color: "#5c6570" },
            ticks: { color: "#5c6570" },
            grid: { color: "rgba(26,111,168,0.08)" }
          }
        }
      }
    });
  }

  function citationText(from, to, n) {
    var generated = manifest && manifest.generado ? fechaCorta(manifest.generado) : "s/d";
    if (lang() === "en") {
      return (
        "San Juan River flow at Km 101 (m³/s), daily series " +
        from +
        " to " +
        to +
        " (n = " +
        n +
        " published days; no interpolation). Source: Departamento de Hidráulica de San Juan. Compiled by Plan AURA – Universidad Católica de Cuyo. Dataset updated " +
        generated +
        ". https://plan-aura.com.ar/#datos-hidrologicos"
      );
    }
    return (
      "Caudal del río San Juan en Km 101 (m³/s), serie diaria " +
      from +
      " a " +
      to +
      " (n = " +
      n +
      " días con dato publicado; sin interpolación). Fuente: Departamento de Hidráulica de San Juan. Compilación: Plan AURA – Universidad Católica de Cuyo. Actualización del dataset: " +
      generated +
      ". https://plan-aura.com.ar/#datos-hidrologicos"
    );
  }

  function downloadCsv(rows, from, to) {
    var lines = ["fecha;caudal_m3s;fuente"];
    rows.forEach(function (r) {
      lines.push(
        r.fecha +
          ";" +
          String(r.m3s).replace(".", ",") +
          ";" +
          (r.fuente || "")
      );
    });
    var blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "caudal_km101_" + from + "_" + to + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function applyLab() {
    if (!series || !series.length) return;
    var from = $("lab-from").value;
    var to = $("lab-to").value;
    var fromB = $("lab-from-b").value;
    var toB = $("lab-to-b").value;
    if (!from || !to || from > to) {
      setStatus(t("sec.lab.error.range"), true);
      return;
    }
    var rowsA = filterRange(series, from, to);
    var statsA = summarize(rowsA, from, to);
    lastStats = { from: from, to: to, rows: rowsA, stats: statsA };
    renderStats("lab-stats-a", statsA, t("sec.lab.period.a") + " · " + from + " → " + to);
    renderChart(rowsA);
    $("lab-cite").textContent = citationText(from, to, statsA.n);
    $("lab-dl-range").disabled = !rowsA.length;

    var boxB = $("lab-stats-b");
    var results = document.querySelector(".lab-results");
    if (fromB && toB) {
      if (fromB > toB) {
        setStatus(t("sec.lab.error.rangeB"), true);
        return;
      }
      var rowsB = filterRange(series, fromB, toB);
      var statsB = summarize(rowsB, fromB, toB);
      boxB.hidden = false;
      if (results) results.classList.add("has-compare");
      renderStats(
        "lab-stats-b",
        statsB,
        t("sec.lab.period.b") + " · " + fromB + " → " + toB
      );
    } else {
      boxB.hidden = true;
      boxB.innerHTML = "";
      if (results) results.classList.remove("has-compare");
    }
    setStatus(
      t("sec.lab.status.ok", { n: String(statsA.n), from: from, to: to }),
      false
    );
  }

  function fillMeta() {
    var meta = $("lab-meta");
    if (!meta || !series || !series.length) return;
    var first = series[0].fecha;
    var last = series[series.length - 1].fecha;
    var caudal = manifest && manifest.caudal_hasta ? manifest.caudal_hasta : last;
    var embalses = manifest && manifest.embalses_hasta ? manifest.embalses_hasta : "";
    var gen = manifest && manifest.generado ? fechaCorta(manifest.generado) : "s/d";
    meta.innerHTML =
      "<ul>" +
      "<li>" +
      t("sec.datos.asof", { caudal: fechaCorta(caudal), embalses: fechaCorta(embalses) }) +
      "</li>" +
      "<li>" +
      t("sec.lab.meta.period", { from: fechaCorta(first), to: fechaCorta(last) }) +
      "</li>" +
      "<li>" +
      t("sec.lab.meta.n", { n: String(series.length) }) +
      "</li>" +
      "<li>" +
      t("sec.lab.meta.updated", { fecha: gen }) +
      "</li>" +
      "<li>" +
      t("sec.lab.meta.rule") +
      "</li>" +
      "</ul>";
    document.querySelectorAll("#datos-hidrologicos a[href^='hidrologia/']").forEach(function (a) {
      var href = a.getAttribute("href").split("?")[0];
      a.href = href + "?v=" + encodeURIComponent(caudal || gen);
    });
    $("lab-from").min = first;
    $("lab-from").max = last;
    $("lab-to").min = first;
    $("lab-to").max = last;
    $("lab-from-b").min = first;
    $("lab-from-b").max = last;
    $("lab-to-b").min = first;
    $("lab-to-b").max = last;
    if (!$("lab-from").value) $("lab-from").value = first;
    if (!$("lab-to").value) $("lab-to").value = last;
  }

  function bind() {
    var form = $("lab-form");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      applyLab();
    });
    $("lab-dl-range").addEventListener("click", function () {
      if (!lastStats || !lastStats.rows.length) return;
      downloadCsv(lastStats.rows, lastStats.from, lastStats.to);
    });
    var copy = $("lab-cite-copy");
    if (copy) {
      copy.addEventListener("click", function () {
        var text = $("lab-cite").textContent;
        if (navigator.clipboard && text) {
          navigator.clipboard.writeText(text).then(function () {
            setStatus(t("sec.lab.cite.copied"), false);
          });
        }
      });
    }
    document.addEventListener("oia:page", function (ev) {
      if (ev.detail === "datos-hidrologicos" && chart) chart.resize();
    });
    window.addEventListener("oia:langchange", function () {
      if (lastStats) applyLab();
      else fillMeta();
    });
  }

  function init() {
    if (!$("datos-hidrologicos")) return;
    bind();
    setStatus(t("sec.lab.status.loading"), false);
    Promise.all([
      fetch(bustUrl(CSV_URL), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("csv");
        return r.text();
      }),
      fetch(bustUrl(MANIFEST_URL), { cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      loadChart().catch(function () {
        return null;
      })
    ])
      .then(function (parts) {
        series = parseCsv(parts[0]);
        manifest = parts[1];
        if (!series.length) throw new Error("empty");
        fillMeta();
        applyLab();
      })
      .catch(function () {
        setStatus(t("sec.lab.status.error"), true);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
