/**
 * Embalses y cotas (#embalses-cotas).
 * Esquemas de nivel según año elegido. Serie desde hidrologia/.
 */
(function () {
  var ANUAL_URL = "hidrologia/embalses_anual.csv";
  var DIARIO_URL = "hidrologia/niveles_embalses.csv";
  var MANIFEST_URL = "hidrologia/manifest.json";
  var CHART_SRC = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";

  var EMBALSES = [
    {
      id: "punta",
      name: "Punta Negra",
      color: "#e69138",
      ymin: 850,
      ymax: 1000
    },
    {
      id: "ullum",
      name: "Ullum",
      color: "#0a5c5e",
      ymin: 700,
      ymax: 800
    },
    {
      id: "caracoles",
      name: "Los Caracoles",
      color: "#0d6e4f",
      ymin: 1000,
      ymax: 1150
    },
    {
      id: "cuesta",
      name: "Cuesta del Viento",
      color: "#7a1532",
      ymin: 1450,
      ymax: 1560
    }
  ];

  var state = {
    anual: {},
    diario: {},
    years: [],
    year: null,
    metric: "media",
    charts: {},
    manifest: null
  };

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

  function bustUrl(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + Date.now();
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

  function parseAnual(text) {
    var lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    var map = {};
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var p = line.split(";");
      if (p.length < 10) continue;
      if (p[1] !== "anio_calendario") continue;
      var embalse = p[0];
      var anio = p[2];
      if (!map[embalse]) map[embalse] = {};
      map[embalse][anio] = {
        dias: parseNum(p[3]),
        completo: String(p[4]).toLowerCase() === "true",
        media: parseNum(p[5]),
        max: parseNum(p[6]),
        fechaMax: p[7] || null,
        min: parseNum(p[8]),
        fechaMin: p[9] || null
      };
    }
    return map;
  }

  function parseDiario(text) {
    var lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    var map = {};
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var p = line.split(";");
      if (p.length < 3) continue;
      var fecha = p[0];
      var embalse = p[1];
      var cota = parseNum(p[2]);
      if (!fecha || !embalse || cota == null) continue;
      if (!map[embalse]) map[embalse] = [];
      map[embalse].push({
        fecha: fecha,
        cota: cota,
        volumen: parseNum(p[3]),
        disponible: parseNum(p[4])
      });
    }
    Object.keys(map).forEach(function (k) {
      map[k].sort(function (a, b) {
        return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0;
      });
    });
    return map;
  }

  function yearsFromData() {
    var set = {};
    EMBALSES.forEach(function (e) {
      Object.keys(state.anual[e.name] || {}).forEach(function (y) {
        set[y] = true;
      });
    });
    return Object.keys(set).sort();
  }

  function fillYearSelect() {
    var sel = $("emb-year");
    if (!sel) return;
    state.years = yearsFromData();
    if (!state.years.length) return;
    sel.innerHTML = state.years
      .map(function (y) {
        return '<option value="' + y + '">' + y + "</option>";
      })
      .join("");
    if (!state.year || state.years.indexOf(state.year) === -1) {
      state.year = state.years[state.years.length - 1];
    }
    sel.value = state.year;
  }

  function fillMetricSelect() {
    var sel = $("emb-metric");
    if (!sel) return;
    var current = state.metric || sel.value || "media";
    sel.innerHTML =
      '<option value="media">' +
      t("sec.emb.metric.media") +
      "</option>" +
      '<option value="max">' +
      t("sec.emb.metric.max") +
      "</option>" +
      '<option value="min">' +
      t("sec.emb.metric.min") +
      "</option>";
    sel.value = current;
    state.metric = current;
  }

  function levelPct(emb, cota) {
    if (cota == null) return 0;
    var pct = ((cota - emb.ymin) / (emb.ymax - emb.ymin)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  function metricValue(row) {
    if (!row) return null;
    if (state.metric === "max") return row.max;
    if (state.metric === "min") return row.min;
    return row.media;
  }

  function metricFecha(row) {
    if (!row) return null;
    if (state.metric === "max") return row.fechaMax;
    if (state.metric === "min") return row.fechaMin;
    return null;
  }

  function dailyForYear(embalse, year) {
    var rows = state.diario[embalse] || [];
    return rows.filter(function (r) {
      return r.fecha.slice(0, 4) === year;
    });
  }

  function svgSchematic(emb, cota) {
    var pct = levelPct(emb, cota);
    var waterTop = 150 - (pct / 100) * 110;
    return (
      '<svg class="emb-svg" viewBox="0 0 220 180" role="img" aria-hidden="true">' +
      '<rect x="0" y="0" width="220" height="180" fill="#eef5fa"/>' +
      '<path d="M18 150 L18 40 L150 40 L150 150 Z" fill="#d7e3ec"/>' +
      '<rect x="18" y="' +
      waterTop +
      '" width="132" height="' +
      (150 - waterTop) +
      '" fill="' +
      emb.color +
      '" fill-opacity="0.55">' +
      '<animate attributeName="y" dur="0.55s" fill="freeze" from="150" to="' +
      waterTop +
      '"/>' +
      '<animate attributeName="height" dur="0.55s" fill="freeze" from="0" to="' +
      (150 - waterTop) +
      '"/>' +
      "</rect>" +
      '<path d="M150 28 L190 28 L190 150 L150 150 Z" fill="#6b7c89"/>' +
      '<path d="M150 28 L175 12 L190 28 Z" fill="#556672"/>' +
      '<line x1="18" y1="150" x2="190" y2="150" stroke="#3d4a54" stroke-width="3"/>' +
      '<text x="24" y="24" fill="#3d4a54" font-size="11" font-weight="700">' +
      emb.ymin +
      "–" +
      emb.ymax +
      " m</text>" +
      "</svg>"
    );
  }

  function renderCards() {
    var grid = $("emb-grid");
    if (!grid) return;
    grid.innerHTML = EMBALSES.map(function (emb) {
      var row = (state.anual[emb.name] || {})[state.year];
      var cota = metricValue(row);
      var fecha = metricFecha(row);
      var daily = dailyForYear(emb.name, state.year);
      var last = daily.length ? daily[daily.length - 1] : null;
      var dias = row && row.dias != null ? row.dias : daily.length;
      var vol = fmt(last && last.volumen, 1) + " hm³";
      var disp = fmt(last && last.disponible, 1) + " hm³";
      return (
        '<article class="card emb-card" data-embalse="' +
        emb.id +
        '">' +
        "<h3>" +
        emb.name +
        "</h3>" +
        '<div class="emb-visual">' +
        svgSchematic(emb, cota) +
        '<div class="emb-readout">' +
        '<p class="emb-cota" style="color:' +
        emb.color +
        '">' +
        (cota == null ? "s/d" : fmt(cota, 2) + " <small>m s.n.m.</small>") +
        "</p>" +
        '<p class="emb-meta">' +
        t("sec.emb.metric." + state.metric) +
        (fecha ? " · " + fechaCorta(fecha) : "") +
        "</p>" +
        '<p class="emb-meta">' +
        t("sec.emb.lastCota", {
          cota: last ? fmt(last.cota, 2) + " m s.n.m." : "s/d",
          fecha: last ? fechaCorta(last.fecha) : "s/d"
        }) +
        "</p>" +
        '<p class="emb-meta">' +
        t("sec.emb.days", { n: String(dias || 0) }) +
        "</p>" +
        '<p class="emb-meta">' +
        t("sec.emb.lastVol", { vol: vol, disp: disp }) +
        "</p>" +
        "</div></div>" +
        '<div class="emb-spark"><canvas id="emb-chart-' +
        emb.id +
        '" aria-hidden="true"></canvas></div>' +
        "</article>"
      );
    }).join("");
  }

  function renderSparklines() {
    if (!window.Chart) return;
    EMBALSES.forEach(function (emb) {
      var canvas = $("emb-chart-" + emb.id);
      if (!canvas) return;
      var daily = dailyForYear(emb.name, state.year);
      if (state.charts[emb.id]) {
        state.charts[emb.id].destroy();
        state.charts[emb.id] = null;
      }
      if (!daily.length) return;
      var byDate = {};
      daily.forEach(function (row) {
        byDate[row.fecha] = row.cota;
      });
      var labels = [];
      var data = [];
      var cursor = daily[0].fecha;
      var end = daily[daily.length - 1].fecha;
      while (cursor <= end) {
        labels.push(cursor.slice(5));
        data.push(Object.prototype.hasOwnProperty.call(byDate, cursor) ? byDate[cursor] : null);
        cursor = addDays(cursor, 1);
      }
      state.charts[emb.id] = new window.Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              borderColor: emb.color,
              backgroundColor: emb.color + "22",
              fill: true,
              pointRadius: 0,
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
              text: t("sec.emb.spark", { year: state.year }),
              color: "#5c6570",
              font: { size: 11 }
            }
          },
          scales: {
            x: {
              ticks: { maxTicksLimit: 6, color: "#8a93a0", font: { size: 10 } },
              grid: { display: false }
            },
            y: {
              ticks: { color: "#8a93a0", font: { size: 10 } },
              grid: { color: "rgba(0,0,0,0.05)" }
            }
          }
        }
      });
    });
  }

  function setStatus(msg, isError) {
    var el = $("emb-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function latestEmbalseFecha() {
    var latest = "";
    Object.keys(state.diario).forEach(function (name) {
      var rows = state.diario[name];
      if (!rows || !rows.length) return;
      var fecha = rows[rows.length - 1].fecha;
      if (!latest || fecha > latest) latest = fecha;
    });
    return latest;
  }

  function renderAsof() {
    var el = $("emb-asof");
    if (!el) return;
    var manifest = state.manifest || {};
    var caudal = manifest.caudal_hasta || "";
    var embalses = manifest.embalses_hasta || latestEmbalseFecha();
    el.textContent = t("sec.datos.asof", {
      caudal: fechaCorta(caudal),
      embalses: fechaCorta(embalses)
    });
  }

  function render() {
    var note = $("emb-year-note");
    if (note) {
      note.textContent = t("sec.emb.yearNote", { year: state.year || "s/d" });
    }
    renderAsof();
    renderCards();
    renderSparklines();
  }

  function bind() {
    var year = $("emb-year");
    var metric = $("emb-metric");
    if (year) {
      year.addEventListener("change", function () {
        state.year = year.value;
        render();
      });
    }
    if (metric) {
      metric.addEventListener("change", function () {
        state.metric = metric.value;
        render();
      });
    }
    document.addEventListener("oia:page", function (ev) {
      if (ev.detail !== "embalses-cotas") return;
      Object.keys(state.charts).forEach(function (k) {
        if (state.charts[k]) state.charts[k].resize();
      });
    });
    window.addEventListener("oia:langchange", function () {
      fillMetricSelect();
      render();
    });
  }

  function init() {
    if (!$("embalses-cotas")) return;
    bind();
    setStatus(t("sec.emb.status.loading"), false);
    Promise.all([
      fetch(bustUrl(ANUAL_URL), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("anual");
        return r.text();
      }),
      fetch(bustUrl(DIARIO_URL), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("diario");
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
        state.anual = parseAnual(parts[0]);
        state.diario = parseDiario(parts[1]);
        state.manifest = parts[2];
        fillYearSelect();
        fillMetricSelect();
        setStatus("", false);
        render();
      })
      .catch(function () {
        setStatus(t("sec.emb.status.error"), true);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
