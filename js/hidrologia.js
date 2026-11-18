/**
 * Décadas y medias mensuales de caudal Km 101 (#info-hidrologica).
 * Lee hidrologia/decadas.json, regenerado por la actualización diaria.
 * No interpola: un mes sin días publicados se muestra como s/d.
 */
(function () {
  var DATA_URL = "hidrologia/decadas.json";
  var FULL_CSV = "hidrologia/caudales_diarios.csv";
  var MISSING = "s/d";
  var CHART_SRC = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
  var JSPDF_SRC = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
  var XLSX_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

  var SERIES = [
    {
      key: "caudal",
      field: "caudal_km101_m3s",
      digits: 3,
      color: "#1a6fa8",
      fill: "rgba(26, 111, 168, 0.14)",
      yKey: "sec.hidro.datos.yCaudal",
      titleKey: "sec.hidro.datos.exportTitle.caudal"
    },
    {
      key: "punta",
      field: "Punta Negra",
      digits: 2,
      color: "#1a6fa8",
      fill: "rgba(26, 111, 168, 0.1)",
      yKey: "sec.hidro.datos.yCota",
      titleKey: "sec.hidro.datos.exportTitle.punta"
    },
    {
      key: "ullum",
      field: "Ullum",
      digits: 2,
      color: "#0a5c5e",
      fill: "rgba(10, 92, 94, 0.12)",
      yKey: "sec.hidro.datos.yCota",
      titleKey: "sec.hidro.datos.exportTitle.ullum"
    },
    {
      key: "caracoles",
      field: "Los Caracoles",
      digits: 2,
      color: "#7a1532",
      fill: "rgba(122, 21, 50, 0.1)",
      yKey: "sec.hidro.datos.yCota",
      titleKey: "sec.hidro.datos.exportTitle.caracoles"
    },
    {
      key: "cuesta",
      field: "Cuesta del Viento",
      digits: 2,
      color: "#0d6e4f",
      fill: "rgba(13, 110, 79, 0.12)",
      yKey: "sec.hidro.datos.yCota",
      titleKey: "sec.hidro.datos.exportTitle.cuesta"
    }
  ];

  var CSV_HEADERS = [
    "fecha",
    "caudal_km101_m3s",
    "punta_negra_msnm",
    "ullum_msnm",
    "los_caracoles_msnm",
    "cuesta_del_viento_msnm"
  ];

  var state = {
    data: null,
    chartView: "meses",
    selected: null,
    open: {},
    mode: {},
    balance: null,
    cierre: null
  };
  var vistaChart = null;
  var historiaChart = null;
  var balanceChart = null;
  var charts = {};
  var scriptLoads = {};

  function t(key, vars) {
    if (window.I18N && typeof window.I18N.t === "function") return window.I18N.t(key, vars);
    return key;
  }

  function panelVisible() {
    var panel = document.getElementById("info-hidrologica");
    return !!(panel && panel.classList.contains("is-active"));
  }

  function setStatus(message) {
    var el = document.getElementById("hidro-datos-status");
    if (el) el.textContent = message || "";
  }

  function enableActions(ready) {
    document.querySelectorAll("[data-hidro-action]").forEach(function (btn) {
      var action = btn.getAttribute("data-hidro-action");
      if (action === "png" || action === "pdf-charts") {
        btn.disabled = !vistaChart;
        return;
      }
      if (action === "png-historia" || action === "pdf-historia") {
        btn.disabled = !historiaChart;
        return;
      }
      btn.disabled = !ready;
    });
  }

  function isNum(value) {
    return typeof value === "number" && isFinite(value);
  }

  function formatFixed(value, digits) {
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }

  function formatCaudal(value) {
    return isNum(value) ? formatFixed(value, 3) : MISSING;
  }

  function formatCota(value) {
    return isNum(value) ? formatFixed(value, 2) : MISSING;
  }

  function formatAxis(value, maxDigits) {
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDigits
    }).format(value);
  }

  function formatFechaCorta(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return String(iso);
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function formatFechaTabla(iso) {
    var d = new Date(iso + "T12:00:00");
    var lang = window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" ? "en-GB" : "es-AR";
    var wd = "";
    try {
      wd = new Intl.DateTimeFormat(lang, { weekday: "short" }).format(d);
    } catch (_e) {
      wd = "";
    }
    wd = wd.replace(/\./g, "");
    if (wd) wd = wd.charAt(0).toUpperCase() + wd.slice(1) + " ";
    return wd + formatFechaCorta(iso);
  }

  function sortDesc(rows) {
    return rows.slice().sort(function (a, b) {
      return String(b.fecha).localeCompare(String(a.fecha));
    });
  }

  function cellValue(row, field) {
    return isNum(row[field]) ? row[field] : null;
  }

  function csvNumber(value, digits) {
    if (!isNum(value)) return MISSING;
    return value.toFixed(digits).replace(".", ",");
  }

  function csvEscape(value) {
    var s = String(value);
    if (/[";\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function rowToCsv(row) {
    return [
      row.fecha,
      csvNumber(row.caudal_km101_m3s, 3),
      csvNumber(row["Punta Negra"], 2),
      csvNumber(row.Ullum, 2),
      csvNumber(row["Los Caracoles"], 2),
      csvNumber(row["Cuesta del Viento"], 2)
    ].map(csvEscape).join(";");
  }

  function toCsv(rows) {
    var lines = [CSV_HEADERS.join(";")];
    rows.forEach(function (row) {
      lines.push(rowToCsv(row));
    });
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  function fileStamp() {
    return state.data && state.data.generado ? state.data.generado : "serie";
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function saveText(text, filename, type) {
    saveBlob(new Blob([text], { type: type || "text/plain;charset=utf-8" }), filename);
  }

  function loadScript(src) {
    if (scriptLoads[src]) return scriptLoads[src];
    scriptLoads[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-hidro-src="' + src + '"]');
      if (existing && existing.getAttribute("data-loaded") === "1") {
        resolve();
        return;
      }
      var script = existing || document.createElement("script");
      function done() {
        script.setAttribute("data-loaded", "1");
        resolve();
      }
      function fail() {
        delete scriptLoads[src];
        reject(new Error(src));
      }
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", fail, { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        script.setAttribute("data-hidro-src", src);
        document.head.appendChild(script);
      }
    });
    return scriptLoads[src];
  }

  function td(text) {
    if (text === MISSING) return '<td class="hidro-sd">s/d</td>';
    return "<td>" + text + "</td>";
  }

  function monthNames() {
    return lang() === "en"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  }

  function lang() {
    return window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" ? "en" : "es";
  }

  function decadeByStart(start) {
    var list = state.data.decadas;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].desde === start) return list[i];
    }
    return list[list.length - 1];
  }

  function decadeLabel(dec, withCourse, compact) {
    var label = dec.desde + "–" + dec.hasta;
    if (withCourse && dec.en_curso && dec.ultimo_dato) {
      if (compact) {
        label += " · " + formatFechaCorta(dec.ultimo_dato);
      } else {
        label += " (" + t("sec.hidro.dec.ongoing", { fecha: formatFechaCorta(dec.ultimo_dato) }) + ")";
      }
    }
    return label;
  }

  function numOrSd(value, digits) {
    return value == null ? MISSING : formatFixed(value, digits);
  }

  function monthCell(entry, digits) {
    if (!entry || !entry.dias_con_dato || entry.caudal_medio_m3s == null && entry.media_msnm == null) {
      return '<td class="hidro-sd">s/d</td>';
    }
    var value = entry.caudal_medio_m3s != null ? entry.caudal_medio_m3s : entry.media_msnm;
    var text = formatFixed(value, digits);
    if (entry.incompleto) {
      var tip = t("sec.hidro.dec.daysTip", { n: entry.dias_con_dato, d: entry.dias_del_mes });
      return '<td><span class="hidro-star" title="' + tip + '">' + text + "*</span></td>";
    }
    return "<td>" + text + "</td>";
  }

  function kpiCard(title, value, detail) {
    return '<article class="hidro-kpi"><span class="t">' + title + '</span><span class="v">' + value +
      '</span><span class="d">' + detail + "</span></article>";
  }

  function renderKpis() {
    var box = document.getElementById("hidro-kpis");
    var u = state.ultimos;
    if (!box || !u) return;
    var c = u.caudal_km101;
    var pct = c.anomalia_pct;
    var arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "→";
    var cls = pct > 0 ? "up" : pct < 0 ? "down" : "";
    var ah = u.anio_hidrologico;
    var delta = ah && ah.media_a_la_fecha_hm3 != null ? ah.escurrimiento_hm3 - ah.media_a_la_fecha_hm3 : 0;
    var ahCls = delta > 0 ? "up" : delta < 0 ? "down" : "";
    var ahArrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "→";
    var fechaEmb = u.embalses.Ullum ? u.embalses.Ullum.fecha : u.generado;
    var levels = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"].map(function (name) {
      var emb = u.embalses[name];
      return '<div class="hidro-kpi-level"><span class="hidro-kpi-level__name">' + name + '</span><strong class="hidro-kpi-level__value">' + (emb ? formatCota(emb.cota_msnm) : MISSING) + "</strong></div>";
    }).join("");
    box.innerHTML =
      kpiCard(t("sec.hidro.kpi.caudal"), formatCaudal(c.m3s) + " <small>m³/s</small>", formatFechaCorta(c.fecha)) +
      kpiCard(t("sec.hidro.kpi.anomaly"), '<span class="' + cls + '">' + arrow + " " + formatFixed(pct, 1) + " %</span>",
        t("sec.hidro.kpi.vsMean", { mean: formatFixed(c.media_historica_misma_fecha_m3s, 2), n: String(c.n_anios_misma_fecha) })) +
      kpiCard(t("sec.hidro.kpi.ytd", { year: ah.etiqueta }), formatFixed(ah.escurrimiento_hm3, 1) + " <small>hm³</small>",
        '<span class="' + ahCls + '">' + ahArrow + " " + t("sec.hidro.kpi.vsYtd", { mean: formatFixed(ah.media_a_la_fecha_hm3, 1) }) + "</span> · " +
        formatFechaCorta(ah.desde) + "–" + formatFechaCorta(ah.hasta)) +
      '<article class="hidro-kpi hidro-kpi--levels"><span class="t">' + t("sec.hidro.kpi.levels") +
      '</span><div class="hidro-kpi-levels">' + levels + '</div><span class="d">' + formatFechaCorta(fechaEmb) + " · m.s.n.m.</span></article>";
  }

  function allOpen() {
    return state.data.decadas.every(function (dec) { return state.open[dec.desde]; });
  }

  function renderExpandButton() {
    var btn = document.getElementById("hidro-expand-all");
    if (!btn) return;
    btn.textContent = allOpen() ? t("sec.hidro.dec.collapseAll") : t("sec.hidro.dec.expandAll");
  }

  function fillSelector() {
    var html = state.data.decadas.map(function (dec) {
      return '<option value="' + dec.desde + '">' + decadeLabel(dec, true, true) + "</option>";
    }).join("");
    ["hidro-decada-select", "hidro-chart-decada-select"].forEach(function (id) {
      var select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = html;
      select.value = String(state.selected);
    });
    var list = state.data.decadas;
    var idx = -1;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].desde === state.selected) idx = i;
    }
    var prev = document.getElementById("hidro-decada-prev");
    var next = document.getElementById("hidro-decada-next");
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx < 0 || idx >= list.length - 1;
  }

  function yearRows(dec, mode) {
    var names = monthNames();
    var head = "<tr><th>" + t("sec.hidro.hist.col.year") + "</th>" +
      names.map(function (name) { return "<th>" + name + "</th>"; }).join("") +
      "<th>" + t("sec.hidro.dec.annual") + "</th></tr>";
    var body = dec.anios.map(function (year) {
      var months = mode === "caudal" ? year.meses : (year.embalses && year.embalses[mode]) || [];
      var cells = months.map(function (entry) { return monthCell(entry, 2); }).join("");
      var annual = MISSING;
      if (mode === "caudal") {
        annual = year.media_anual_m3s == null ? MISSING : formatFixed(year.media_anual_m3s, 2);
      } else {
        var sum = 0;
        var days = 0;
        months.forEach(function (entry) {
          if (entry && entry.media_msnm != null && entry.dias_con_dato) {
            sum += entry.media_msnm * entry.dias_con_dato;
            days += entry.dias_con_dato;
          }
        });
        annual = days ? formatFixed(sum / days, 2) : MISSING;
      }
      var annualCell = td(annual);
      if (mode === "caudal" && year.incompleto && year.media_anual_m3s != null) {
        var tip = t("sec.hidro.dec.daysTip", { n: year.dias_con_dato, d: year.dias_del_anio });
        annualCell = '<td><span class="hidro-star" title="' + tip + '">' + formatFixed(year.media_anual_m3s, 2) + "*</span></td>";
      }
      return "<tr><td>" + year.anio + "</td>" + cells + annualCell + "</tr>";
    }).join("");
    return "<table class=\"hidro-month\"><thead>" + head + "</thead><tbody>" + body + "</tbody></table>";
  }

  function renderDecadas() {
    var table = document.getElementById("hidro-decadas-table");
    if (!table || !state.data) return;
    var cotaHeads = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"].map(function (name) {
      return "<th>" + name + "</th>";
    }).join("");
    var head = "<thead><tr><th>" + t("sec.hidro.dec.selector") + "</th><th>" + t("sec.hidro.dec.mean") +
      "</th><th>" + t("sec.hidro.dec.runoff") + "</th><th>" + t("sec.hidro.dec.runoffYear") +
      "</th><th>" + t("sec.hidro.dec.max") + "</th><th>" + t("sec.hidro.dec.min") +
      "</th><th>" + t("sec.hidro.dec.days") + "</th>" + cotaHeads + "</tr></thead>";
    var body = state.data.decadas.map(function (dec) {
      var open = !!state.open[dec.desde];
      var current = dec.desde === state.selected ? " is-current" : "";
      var cotas = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"].map(function (name) {
        return td(numOrSd(dec.cotas[name], 2));
      }).join("");
      var maxCell = dec.max_m3s == null ? td(MISSING) : "<td>" + formatFixed(dec.max_m3s, 2) + "<br>" + formatFechaCorta(dec.fecha_max) + "</td>";
      var minCell = dec.min_m3s == null ? td(MISSING) : "<td>" + formatFixed(dec.min_m3s, 2) + "<br>" + formatFechaCorta(dec.fecha_min) + "</td>";
      var hasEmb = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"].some(function (name) {
        return dec.cotas[name] != null;
      });
      var mode = state.mode[dec.desde] || "caudal";
      var tabs = "";
      if (hasEmb) {
        tabs = '<div class="hidro-tabs hidro-detail-tabs">' +
          '<button type="button" data-mode="caudal" data-decada="' + dec.desde + '">' + t("sec.hidro.dec.flowTab") + "</button>" +
          '<button type="button" data-mode="Punta Negra" data-decada="' + dec.desde + '">Punta Negra</button>' +
          '<button type="button" data-mode="Ullum" data-decada="' + dec.desde + '">Ullum</button>' +
          '<button type="button" data-mode="Los Caracoles" data-decada="' + dec.desde + '">Los Caracoles</button>' +
          '<button type="button" data-mode="Cuesta del Viento" data-decada="' + dec.desde + '">Cuesta del Viento</button>' +
          "</div>";
      }
      var detail = open
        ? '<tr class="hidro-decada-detail"><td colspan="11"><div class="hidro-detail">' +
          tabs +
          '<div class="hidro-month-scroll">' +
          yearRows(dec, mode) +
          "</div></div></td></tr>"
        : "";
      return '<tbody><tr class="hidro-decada-sum' + current + '"><th scope="row"><button type="button" class="hidro-exp" data-decada="' +
        dec.desde + '" aria-expanded="' + (open ? "true" : "false") + '">' + (open ? "▾ " : "▸ ") + decadeLabel(dec, true, true) +
        "</button></th><td>" + numOrSd(dec.caudal_medio_m3s, 2) + "</td><td>" + numOrSd(dec.escurrimiento_hm3, 1) +
        "</td><td>" + numOrSd(dec.escurrimiento_medio_anual_hm3, 1) + "</td>" + maxCell + minCell + "<td>" +
        dec.dias_con_dato + "</td>" + cotas + "</tr>" + detail + "</tbody>";
    }).join("");
    table.innerHTML = head + body;
    var nota = document.getElementById("hidro-decadas-nota");
    if (nota) nota.textContent = t("sec.hidro.dec.note1910") + " " + t("sec.hidro.dec.noteStar");
    renderExpandButton();
    ["hidro-decada-select", "hidro-chart-decada-select"].forEach(function (id) {
      var select = document.getElementById(id);
      if (select && select.value !== String(state.selected)) select.value = String(state.selected);
    });
    table.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-mode") === (state.mode[Number(btn.getAttribute("data-decada"))] || "caudal"));
    });
    fitDecadeDetails();
  }

  function fitDecadeDetails() {
    var wrap = document.querySelector("#hidro-decadas-table") &&
      document.querySelector("#hidro-decadas-table").closest(".hidro-table-wrap");
    if (!wrap) return;
    var width = Math.max(0, wrap.clientWidth - 8);
    document.querySelectorAll(".hidro-detail").forEach(function (el) {
      el.style.width = width + "px";
      el.style.maxWidth = width + "px";
    });
  }

  function selectDecade(start, opts) {
    opts = opts || {};
    state.selected = start;
    if (opts.open) state.open[start] = true;
    if (opts.view) state.chartView = opts.view;
    fillSelector();
    renderDecadas();
    syncChartTabs();
    renderVista();
    if (opts.scroll) {
      var row = document.querySelector('.hidro-exp[data-decada="' + start + '"]');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: "center" });
    }
  }

  function yBounds(values) {
    var nums = values.filter(isNum);
    if (!nums.length) return {};
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    var pad = (max - min) * 0.35;
    if (!pad) pad = seriesPad(nums[0]);
    return { min: min - pad, max: max + pad };
  }

  function seriesPad(value) {
    return Math.max(Math.abs(value) * 0.002, 0.05);
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (key) {
      charts[key].destroy();
      delete charts[key];
    });
  }

  function renderHistoria() {
    if (!window.Chart || !state.anual || !panelVisible()) return;
    var canvas = document.getElementById("hidro-chart-historia");
    if (!canvas) return;
    if (historiaChart) {
      historiaChart.destroy();
      historiaChart = null;
    }
    var Q = state.anual.caudal_km101;
    var rows = Q.anio_hidrologico || [];
    var trends = (Q.tendencias && Q.tendencias.media_anual_hidrologico) || {};
    var full = trends.periodo_completo;
    var recent = trends.desde_2001;
    var ref = Q.referencia_1910_2022 && Q.referencia_1910_2022.hidrologico;
    var maxYear = Q.destacados && Q.destacados.anio_hidrologico_mas_caudaloso && Q.destacados.anio_hidrologico_mas_caudaloso.anio;
    var minYear = Q.destacados && Q.destacados.anio_hidrologico_mas_seco && Q.destacados.anio_hidrologico_mas_seco.anio;
    var done = [];
    var ma = rows.map(function (row) {
      if (!row.completo || row.media_m3s == null) return null;
      done.push(row.media_m3s);
      if (done.length < 10) return null;
      var slice = done.slice(-10);
      return slice.reduce(function (acc, value) { return acc + value; }, 0) / 10;
    });
    var trend = rows.map(function (row) {
      if (!full || !row.completo) return null;
      var year = parseInt(String(row.anio).slice(0, 4), 10);
      if (year < full.desde || year > full.hasta) return null;
      return full.intercepto + full.pendiente_sen_por_anio * year;
    });
    historiaChart = new window.Chart(canvas, {
      data: {
        labels: rows.map(function (row) { return String(row.anio); }),
        datasets: [
          {
            type: "bar",
            label: t("sec.hidro.histChart.mean"),
            data: rows.map(function (row) { return row.media_m3s; }),
            backgroundColor: rows.map(function (row) {
              if (!row.completo) return "rgba(26, 111, 168, 0.18)";
              if (String(row.anio) === String(maxYear)) return "#0d6e4f";
              if (String(row.anio) === String(minYear)) return "#7a1532";
              return "#1a6fa8";
            }),
            borderColor: rows.map(function (row) { return row.completo ? "transparent" : "#1a6fa8"; }),
            borderWidth: 1.5,
            order: 3
          },
          {
            type: "line",
            label: t("sec.hidro.histChart.ma"),
            data: ma,
            borderColor: "#0a5c5e",
            pointRadius: 0,
            borderWidth: 2,
            spanGaps: false,
            order: 2
          },
          {
            type: "line",
            label: t("sec.hidro.histChart.trend"),
            data: trend,
            borderColor: "#e69138",
            pointRadius: 0,
            borderWidth: 2,
            spanGaps: false,
            order: 1
          },
          {
            type: "line",
            label: ref ? t("sec.hidro.histChart.ref", { periodo: ref.periodo }) : "",
            data: rows.map(function () { return ref ? ref.media_m3s : null; }),
            borderColor: "#5c4f54",
            borderDash: [6, 4],
            pointRadius: 0,
            borderWidth: 1.5,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          title: { display: true, text: t("sec.hidro.histChart.title"), color: "#1f1418" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var value = ctx.parsed.y;
                return ctx.dataset.label + ": " + (value == null ? MISSING : formatFixed(value, 1) + " m³/s");
              }
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14, color: "#5c4f54" } },
          y: {
            min: 0,
            title: { display: true, text: "m³/s", color: "#1a6fa8" },
            ticks: { callback: function (value) { return formatFixed(Number(value), 0); } }
          }
        }
      }
    });
    var caption = document.getElementById("hidro-historia-caption");
    if (caption && full && recent) {
      caption.textContent = t("sec.hidro.histChart.caption", {
        full: formatFixed(full.pendiente_sen_por_decada, 1),
        desde: String(full.desde),
        hasta: String(full.hasta),
        recent: formatFixed(recent.pendiente_sen_por_decada, 1),
        recentDesde: String(recent.desde)
      });
    }
    var wrap = document.getElementById("hidro-chart-historia-wrap");
    if (wrap) wrap.setAttribute("aria-label", t("sec.hidro.histChart.title"));
    enableActions(true);
  }

  function syncChartTabs() {
    document.querySelectorAll("[data-chart-view]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-chart-view") === state.chartView);
    });
  }

  function renderVista() {
    if (!window.Chart || !state.data || !panelVisible()) return;
    var canvas = document.getElementById("hidro-chart-vista");
    if (!canvas) return;
    if (vistaChart) {
      vistaChart.destroy();
      vistaChart = null;
    }
    var dec = decadeByStart(state.selected);
    var wrap = document.getElementById("hidro-chart-vista-wrap");
    if (state.chartView === "decadas") {
      if (wrap) wrap.setAttribute("aria-label", t("sec.hidro.dec.chartDecadas"));
      vistaChart = new window.Chart(canvas, {
        data: {
          labels: state.data.decadas.map(function (item) {
            return item.desde + "–" + item.hasta + (item.en_curso ? "*" : "");
          }),
          datasets: [
            {
              type: "bar",
              label: t("sec.hidro.dec.mean"),
              data: state.data.decadas.map(function (item) { return item.caudal_medio_m3s; }),
              backgroundColor: state.data.decadas.map(function (item) {
                return item.desde === state.selected ? "#1a6fa8" : "#9fc5e8";
              }),
              yAxisID: "y",
              order: 2
            },
            {
              type: "line",
              label: t("sec.hidro.dec.chartHm3"),
              data: state.data.decadas.map(function (item) { return item.escurrimiento_hm3; }),
              borderColor: "#e69138",
              backgroundColor: "#e69138",
              pointRadius: 4,
              borderWidth: 2,
              yAxisID: "y1",
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          onClick: function (_evt, elements) {
            if (!elements.length) return;
            var start = state.data.decadas[elements[0].index].desde;
            setTimeout(function () {
              selectDecade(start, { open: true, view: "meses" });
            }, 0);
          },
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: t("sec.hidro.dec.chartDecadas"), color: "#1f1418" },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var digits = ctx.dataset.yAxisID === "y1" ? 1 : 2;
                  var value = ctx.parsed.y;
                  return ctx.dataset.label + ": " + (value == null ? MISSING : formatFixed(value, digits));
                }
              }
            }
          },
          scales: {
            x: { ticks: { maxRotation: 0, color: "#5c4f54" } },
            y: {
              position: "left",
              min: 0,
              title: { display: true, text: "m³/s", color: "#1a6fa8" },
              ticks: { callback: function (value) { return formatFixed(Number(value), 0); } }
            },
            y1: {
              position: "right",
              min: 0,
              grid: { drawOnChartArea: false },
              title: { display: true, text: "hm³", color: "#e69138" },
              ticks: { callback: function (value) { return formatFixed(Number(value), 0); } }
            }
          }
        }
      });
    } else {
      var labels = [];
      var values = [];
      var refLine = [];
      var incomplete = [];
      var names = monthNames();
      var flat = [];
      dec.anios.forEach(function (year) {
        year.meses.forEach(function (month) {
          flat.push({ year: year.anio, month: month });
        });
      });
      var last = -1;
      var fi;
      for (fi = 0; fi < flat.length; fi += 1) {
        if (flat[fi].month.dias_con_dato) last = fi;
      }
      flat.slice(0, last + 1).forEach(function (item) {
        labels.push(names[item.month.mes - 1] + " " + String(item.year).slice(2) + (item.month.incompleto ? "*" : ""));
        values.push(item.month.dias_con_dato ? item.month.caudal_medio_m3s : null);
        refLine.push(state.data.media_mensual_historica[item.month.mes - 1]);
        incomplete.push(!!item.month.incompleto);
      });
      if (wrap) wrap.setAttribute("aria-label", t("sec.hidro.dec.chartMeses", { decada: decadeLabel(dec, false) }));
      vistaChart = new window.Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: t("sec.hidro.dec.chartMeses", { decada: decadeLabel(dec, false) }),
              data: values,
              borderColor: "#1a6fa8",
              backgroundColor: "rgba(26, 111, 168, 0.12)",
              fill: false,
              spanGaps: false,
              borderWidth: 2,
              pointRadius: incomplete.map(function (mark) { return mark ? 3.5 : 2; }),
              pointHoverRadius: 4,
              pointBackgroundColor: incomplete.map(function (mark) { return mark ? "#ffffff" : "#1a6fa8"; }),
              pointBorderColor: "#1a6fa8",
              pointBorderWidth: 1.5,
              tension: 0
            },
            {
              label: t("sec.hidro.dec.chartRef"),
              data: refLine,
              borderColor: "#5c4f54",
              borderDash: [5, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              spanGaps: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: t("sec.hidro.dec.chartMeses", { decada: decadeLabel(dec, true, true) }), color: "#1f1418" },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var value = ctx.parsed.y;
                  return ctx.dataset.label + ": " + (value == null ? MISSING : formatFixed(value, 2) + " m³/s");
                }
              }
            }
          },
          scales: {
            x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: "#5c4f54" } },
            y: {
              title: { display: true, text: "m³/s", color: "#1a6fa8" },
              ticks: { callback: function (value) { return formatFixed(Number(value), 0); } }
            }
          }
        }
      });
    }
    enableActions(true);
  }

  function ensureCharts() {
    if (!state.data || !panelVisible()) return;
    loadScript(CHART_SRC)
      .then(function () {
        if (!panelVisible()) return;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
          renderHistoria();
          renderVista();
        });
        });
      })
      .catch(function () {
        setStatus(t("sec.hidro.datos.chartError"));
      });
  }

  function sourceLine() {
    return t("sec.hidro.datos.exportSource", {
      generado: formatFechaCorta(state.data && state.data.generado)
    });
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = String(text).split(/\s+/);
    var line = "";
    var lines = 0;
    words.forEach(function (word) {
      var next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        lines += 1;
        line = word;
      } else {
        line = next;
      }
    });
    if (line) ctx.fillText(line, x, y + lines * lineHeight);
    return lines + 1;
  }

  function composeCanvas(sourceCanvas, title, source) {
    var ratio = Math.max(1, Math.round(window.devicePixelRatio || 1));
    var padX = 24 * ratio;
    var titleSize = 20 * ratio;
    var sourceSize = 13 * ratio;
    var padTop = 56 * ratio;
    var padBottom = 78 * ratio;
    var out = document.createElement("canvas");
    out.width = sourceCanvas.width;
    out.height = sourceCanvas.height + padTop + padBottom;
    var ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = "#1f1418";
    ctx.font = "600 " + titleSize + "px 'Source Sans 3', sans-serif";
    ctx.textBaseline = "top";
    wrapText(ctx, title, padX, 16 * ratio, out.width - padX * 2, titleSize + 4 * ratio);
    ctx.drawImage(sourceCanvas, 0, padTop);
    ctx.fillStyle = "#5c4f54";
    ctx.font = sourceSize + "px 'Source Sans 3', sans-serif";
    wrapText(ctx, source, padX, padTop + sourceCanvas.height + 16 * ratio, out.width - padX * 2, sourceSize + 5 * ratio);
    return out;
  }

  function chartTitle() {
    var dec = state.data ? decadeByStart(state.selected) : null;
    if (state.chartView === "meses" && dec) {
      return t("sec.hidro.dec.exportMeses", { decada: decadeLabel(dec, true) });
    }
    return t("sec.hidro.dec.exportDecadas");
  }

  function downloadChartPng() {
    if (!vistaChart) return;
    vistaChart.resize();
    var image = composeCanvas(vistaChart.canvas, chartTitle(), sourceLine());
    image.toBlob(function (blob) {
      if (!blob) return;
      saveBlob(blob, "rio-san-juan-" + state.chartView + "-" + fileStamp() + ".png");
    }, "image/png");
  }

  function addCanvasPage(pdf, canvas, isFirst) {
    if (!isFirst) pdf.addPage();
    var pageW = pdf.internal.pageSize.getWidth();
    var pageH = pdf.internal.pageSize.getHeight();
    var margin = 28;
    var scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
    var w = canvas.width * scale;
    var h = canvas.height * scale;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  }

  function downloadChartsPdf() {
    loadScript(JSPDF_SRC)
      .then(function () {
        var JsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!JsPDF || !vistaChart) {
          setStatus(t("sec.hidro.datos.libMissing"));
          return;
        }
        vistaChart.resize();
        var pdf = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        addCanvasPage(pdf, composeCanvas(vistaChart.canvas, chartTitle(), sourceLine()), true);
        pdf.save("rio-san-juan-" + state.chartView + "-" + fileStamp() + ".pdf");
      })
      .catch(function (err) {
        console.error(err);
        setStatus(t("sec.hidro.datos.libMissing"));
      });
  }

  function monthValue(month) {
    return month && month.dias_con_dato && month.caudal_medio_m3s != null ? month.caudal_medio_m3s : MISSING;
  }

  function monthlyRows() {
    var rows = [["anio", "mes", "caudal_medio_m3s", "dias_con_dato"]];
    state.data.decadas.forEach(function (dec) {
      dec.anios.forEach(function (year) {
        year.meses.forEach(function (month) {
          rows.push([year.anio, month.mes, monthValue(month), month.dias_con_dato]);
        });
      });
    });
    return rows;
  }

  function decadeRows() {
    var rows = [[
      "decada", "en_curso", "ultimo_dato", "caudal_medio_m3s", "escurrimiento_hm3",
      "escurrimiento_medio_anual_hm3", "max_m3s", "fecha_max", "min_m3s", "fecha_min",
      "dias_con_dato", "punta_negra_msnm", "ullum_msnm", "los_caracoles_msnm", "cuesta_del_viento_msnm"
    ]];
    state.data.decadas.forEach(function (dec) {
      rows.push([
        dec.desde + "-" + dec.hasta,
        dec.en_curso ? 1 : 0,
        dec.ultimo_dato || MISSING,
        dec.caudal_medio_m3s == null ? MISSING : dec.caudal_medio_m3s,
        dec.escurrimiento_hm3 == null ? MISSING : dec.escurrimiento_hm3,
        dec.escurrimiento_medio_anual_hm3 == null ? MISSING : dec.escurrimiento_medio_anual_hm3,
        dec.max_m3s == null ? MISSING : dec.max_m3s,
        dec.fecha_max || MISSING,
        dec.min_m3s == null ? MISSING : dec.min_m3s,
        dec.fecha_min || MISSING,
        dec.dias_con_dato,
        dec.cotas["Punta Negra"] == null ? MISSING : dec.cotas["Punta Negra"],
        dec.cotas.Ullum == null ? MISSING : dec.cotas.Ullum,
        dec.cotas["Los Caracoles"] == null ? MISSING : dec.cotas["Los Caracoles"],
        dec.cotas["Cuesta del Viento"] == null ? MISSING : dec.cotas["Cuesta del Viento"]
      ]);
    });
    return rows;
  }

  function todayRows() {
    var hoy = state.data.dato_del_dia;
    return [
      ["campo", "fecha", "valor", "unidad"],
      ["caudal_km101", hoy.caudal.fecha, hoy.caudal.m3s, "m3/s"],
      ["Punta Negra", hoy.embalses_fecha, hoy.embalses["Punta Negra"] == null ? MISSING : hoy.embalses["Punta Negra"], "m.s.n.m."],
      ["Ullum", hoy.embalses_fecha, hoy.embalses.Ullum == null ? MISSING : hoy.embalses.Ullum, "m.s.n.m."],
      ["Los Caracoles", hoy.embalses_fecha, hoy.embalses["Los Caracoles"] == null ? MISSING : hoy.embalses["Los Caracoles"], "m.s.n.m."],
      ["Cuesta del Viento", hoy.embalses_fecha, hoy.embalses["Cuesta del Viento"] == null ? MISSING : hoy.embalses["Cuesta del Viento"], "m.s.n.m."]
    ];
  }

  function monthlyCsv() {
    return "\uFEFF" + monthlyRows().map(function (row) {
      return row.map(function (cell) {
        if (typeof cell === "number") return String(cell).replace(".", ",");
        return csvEscape(cell);
      }).join(";");
    }).join("\r\n") + "\r\n";
  }

  function downloadXlsx() {
    loadScript(XLSX_SRC)
      .then(function () {
        if (!window.XLSX) {
          setStatus(t("sec.hidro.datos.libMissing"));
          return;
        }
        var XLSX = window.XLSX;
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyRows()), "Mensual");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(decadeRows()), "Décadas");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(todayRows()), "Dato del día");
        XLSX.writeFile(wb, "rio-san-juan-decadas-" + fileStamp() + ".xlsx");
      })
      .catch(function () {
        setStatus(t("sec.hidro.datos.libMissing"));
      });
  }

  function onAction(action, chartKey) {
    if (!state.data) return;
    setStatus("");
    if (action === "csv-table") {
      saveText(monthlyCsv(), "rio-san-juan-mensual-" + fileStamp() + ".csv", "text/csv;charset=utf-8");
    } else if (action === "csv-series") {
      fetch(FULL_CSV + "?v=" + Date.now(), { cache: "no-store" })
        .then(function (res) { return res.blob(); })
        .then(function (blob) { saveBlob(blob, "rio-san-juan-km101-serie-" + fileStamp() + ".csv"); });
    } else if (action === "json-series") {
      fetch(FULL_CSV + "?v=" + Date.now(), { cache: "no-store" })
        .then(function (res) { return res.text(); })
        .then(function (text) {
          var lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
          var rows = lines.slice(1).map(function (line) {
            var parts = line.split(";");
            var raw = parts[1] || "";
            var num = raw.indexOf(",") >= 0 ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw);
            return { fecha: parts[0], caudal_m3s: isFinite(num) ? num : null, fuente: parts[2] || "" };
          });
          saveText(JSON.stringify(rows) + "\n", "rio-san-juan-km101-serie-" + fileStamp() + ".json", "application/json;charset=utf-8");
        });
    } else if (action === "xlsx-table") {
      downloadXlsx();
    } else if (action === "png") {
      downloadChartPng();
    } else if (action === "pdf-charts") {
      downloadChartsPdf();
    } else if (action === "png-historia") {
      downloadHistoria("png");
    } else if (action === "pdf-historia") {
      downloadHistoria("pdf");
    }
  }

  function downloadHistoria(kind) {
    if (!historiaChart) return;
    historiaChart.resize();
    var image = composeCanvas(historiaChart.canvas, t("sec.hidro.histChart.export"), sourceLine());
    if (kind === "png") {
      image.toBlob(function (blob) {
        if (blob) saveBlob(blob, "rio-san-juan-serie-historica-" + fileStamp() + ".png");
      }, "image/png");
      return;
    }
    loadScript(JSPDF_SRC).then(function () {
      var JsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!JsPDF) {
        setStatus(t("sec.hidro.datos.libMissing"));
        return;
      }
      var pdf = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      addCanvasPage(pdf, image, true);
      pdf.save("rio-san-juan-serie-historica-" + fileStamp() + ".pdf");
    }).catch(function () {
      setStatus(t("sec.hidro.datos.libMissing"));
    });
  }

  function bind() {
    var root = document.getElementById("info-hidrologica");
    if (!root) return;
    root.addEventListener("click", function (event) {
      var actionBtn = event.target.closest("[data-hidro-action]");
      if (actionBtn && !actionBtn.disabled) {
        onAction(actionBtn.getAttribute("data-hidro-action"), actionBtn.getAttribute("data-chart"));
        return;
      }
      var modeBtn = event.target.closest("[data-mode]");
      if (modeBtn) {
        state.mode[Number(modeBtn.getAttribute("data-decada"))] = modeBtn.getAttribute("data-mode");
        renderDecadas();
        return;
      }
      var decBtn = event.target.closest(".hidro-exp");
      if (decBtn) {
        var start = Number(decBtn.getAttribute("data-decada"));
        state.open[start] = !state.open[start];
        state.selected = start;
        fillSelector();
        renderDecadas();
        if (state.chartView === "meses") renderVista();
        return;
      }
      var viewBtn = event.target.closest("[data-chart-view]");
      if (viewBtn) {
        state.chartView = viewBtn.getAttribute("data-chart-view");
        syncChartTabs();
        renderVista();
        return;
      }
      if (event.target.id === "hidro-decada-prev" || event.target.id === "hidro-decada-next") {
        if (event.target.disabled) return;
        var list = state.data.decadas;
        var idx = -1;
        var di;
        for (di = 0; di < list.length; di += 1) {
          if (list[di].desde === state.selected) idx = di;
        }
        var step = event.target.id === "hidro-decada-prev" ? -1 : 1;
        var neighbor = list[idx + step];
        if (!neighbor) return;
        selectDecade(neighbor.desde, { open: true, view: state.chartView });
        return;
      }
      if (event.target.id === "hidro-expand-all") {
        var open = !allOpen();
        state.data.decadas.forEach(function (dec) { state.open[dec.desde] = open; });
        renderDecadas();
      }
    });
    root.addEventListener("change", function (event) {
      if (event.target.id !== "hidro-decada-select" && event.target.id !== "hidro-chart-decada-select") return;
      selectDecade(Number(event.target.value), {
        open: true,
        view: "meses",
        scroll: event.target.id === "hidro-decada-select"
      });
    });
  }

  function applyData(data) {
    state.data = data;
    var current = data.decadas.filter(function (dec) { return dec.en_curso; })[0] || data.decadas[data.decadas.length - 1];
    state.selected = current.desde;
    state.open = {};
    state.open[current.desde] = true;
    var link = document.getElementById("hidro-fuente-link");
    if (link && data.fuente_url) link.href = data.fuente_url;
    renderKpis();
    renderAsof();
    fillSelector();
    renderDecadas();
    enableActions(true);
    setStatus("");
    ensureCharts();
  }

  function renderAsof() {
    var el = document.getElementById("hidro-asof");
    var u = state.ultimos;
    if (!el || !u) return;
    var embFecha = "";
    Object.keys(u.embalses || {}).forEach(function (name) {
      var fecha = u.embalses[name] && u.embalses[name].fecha;
      if (fecha && (!embFecha || fecha > embFecha)) embFecha = fecha;
    });
    var caudalFecha = u.caudal_km101 && u.caudal_km101.fecha;
    el.textContent = t("sec.datos.asof", {
      caudal: caudalFecha ? formatFechaCorta(caudalFecha) : MISSING,
      embalses: embFecha ? formatFechaCorta(embFecha) : MISSING
    });
  }

  function balanceLang() {
    return window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" ? "en" : "es";
  }

  function balanceText(es, en) {
    return balanceLang() === "en" ? en : es;
  }

  function escHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function addIsoDays(iso, days) {
    var parts = String(iso).split("-");
    var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function balanceHost() {
    var root = document.getElementById("info-hidrologica");
    if (!root) return null;
    var host = document.getElementById("hidro-balance");
    if (host) return host;
    var inner = root.querySelector(".section-inner") || root;
    host = document.createElement("div");
    host.id = "hidro-balance";
    host.className = "card hidro-datos";
    var anchor = document.getElementById("caudales-embalses");
    if (anchor && anchor.parentNode === inner) inner.insertBefore(host, anchor);
    else inner.appendChild(host);
    return host;
  }

  function renderBalance() {
    var host = balanceHost();
    var doc = state.balance;
    if (!host || !doc || !doc.serie) return;
    if (balanceChart) {
      balanceChart.destroy();
      balanceChart = null;
    }
    if (!document.getElementById("hidro-balance-style")) {
      var style = document.createElement("style");
      style.id = "hidro-balance-style";
      style.textContent = [
        "#hidro-balance { margin: 0 0 1.5rem; }",
        "#hidro-balance .hidro-balance-leyenda { display: inline-block; margin: 0 0 0.8rem; padding: 0.28rem 0.7rem; border-radius: 999px; background: #7a1532; color: #fff; font-weight: 700; letter-spacing: 0.04em; }",
        "#hidro-balance .hidro-balance-chart { position: relative; height: 340px; margin: 0.4rem 0 0.8rem; }",
        "#hidro-balance .hidro-balance-metodo { margin-top: 0.8rem; }",
        "#hidro-balance .hidro-balance-metodo p { white-space: pre-wrap; }",
        "#hidro-balance tr.hidro-balance-interp td { color: #8a4b12; }"
      ].join("\n");
      document.head.appendChild(style);
    }
    var rows = doc.serie.slice().sort(function (a, b) {
      return String(b.fecha).localeCompare(String(a.fecha));
    });
    var body = rows.map(function (row) {
      var estimado = row.nota === "pendiente"
        ? balanceText("pendiente", "pending")
        : (isNum(row.caudal_estimado_m3s) ? formatFixed(row.caudal_estimado_m3s, 1) : MISSING);
      var descarga = isNum(row.descarga_m3s) ? formatFixed(row.descarga_m3s, 1) : MISSING;
      var almacenamiento = isNum(row.almacenamiento_caracoles_m3s) ? formatFixed(row.almacenamiento_caracoles_m3s, 1) : MISSING;
      var ventana = row.dias_ventana == null ? MISSING : String(row.dias_ventana);
      var medido = isNum(row.km101_medido_m3s) ? formatFixed(row.km101_medido_m3s, 3) : MISSING;
      var marca = row.interpolado ? " class=\"hidro-balance-interp\"" : "";
      var nota = row.nota === "pendiente" ? "" : (row.nota || "");
      return "<tr" + marca + "><th scope=\"row\">" + escHtml(formatFechaTabla(row.fecha)) + "</th><td>" + escHtml(estimado) +
        "</td><td>" + escHtml(formatCota(row.cota_caracoles)) + "</td><td>" + escHtml(descarga) +
        "</td><td>" + escHtml(almacenamiento) +
        "</td><td>" + escHtml(ventana) + "</td><td>" + escHtml(medido) + "</td><td>" +
        escHtml(nota) + "</td></tr>";
    }).join("");
    var validacion = doc.validacion && doc.validacion.texto ? doc.validacion.texto : "";
    host.innerHTML =
      "<h3>" + escHtml(balanceText(
        "Caudal de entrada estimado – Los Caracoles (balance de agua)",
        "Estimated inflow – Los Caracoles (water balance)"
      )) + "</h3>" +
      "<p class=\"hidro-balance-leyenda\">" + escHtml(balanceText("ESTIMADO, no medido", "ESTIMATED, not measured")) + "</p>" +
      "<p>" + escHtml(balanceText(
        "Estimación por balance de Los Caracoles, Punta Negra y Ullum y del desembalse de Ullum. ESTIMADO, no medido: no es el caudal de Km 101. La línea gruesa es el caudal; las finas son la descarga a Punta Negra y el almacenamiento en Caracoles. En un hueco de 2 a 7 días van discontinuas, punteadas y con marcador hueco.",
        "Estimate from Los Caracoles, Punta Negra and Ullum storage plus the Ullum release. ESTIMATED, not measured: it is not the Km 101 flow. The thick line is the inflow; the thin lines are the release toward Punta Negra and the Caracoles storage change. Over a 2–7 day gap they are dashed or dotted, with a hollow marker."
      )) + "</p>" +
      "<div class=\"hidro-chart hidro-balance-chart\" id=\"hidro-balance-chart-wrap\" role=\"img\" aria-label=\"" +
      escHtml(balanceText(
        "Gráfico de línea del caudal de entrada estimado a Los Caracoles. ESTIMADO, no medido.",
        "Line chart of the estimated inflow to Los Caracoles. ESTIMATED, not measured."
      )) + "\"><canvas id=\"hidro-balance-chart\"></canvas></div>" +
      "<div class=\"hidro-table-wrap hidro-table-wrap--scroll\"><table class=\"hidro-table\"><caption>" +
      escHtml(balanceText(
        "Serie diaria desde el 15/10/2026. La columna de Km 101 es solo referencia y no entra en la estimación.",
        "Daily series from 15 Oct 2026. The Km 101 column is reference only and is not part of the estimate."
      )) + "</caption><thead><tr><th>" + escHtml(balanceText("Fecha", "Date")) + "</th><th>" +
      escHtml(balanceText("Caudal estimado (m³/s)", "Estimated flow (m³/s)")) + "</th><th>" +
      escHtml(balanceText("Cota Caracoles (m s.n.m.)", "Caracoles level (m a.s.l.)")) + "</th><th>" +
      escHtml(balanceText("Descarga a Punta Negra (m³/s)", "Release toward Punta Negra (m³/s)")) + "</th><th>" +
      escHtml(balanceText("Almacenamiento Caracoles (m³/s)", "Caracoles storage (m³/s)")) + "</th><th>" +
      escHtml(balanceText("Días de ventana", "Window (days)")) + "</th><th>" +
      escHtml(balanceText("Km 101 medido (m³/s), solo referencia", "Measured Km 101 (m³/s), reference only")) + "</th><th>" +
      escHtml(balanceText("Nota", "Note")) + "</th></tr></thead><tbody>" + body +       "</tbody></table></div>" +
      "<p class=\"hidro-note\">" + escHtml(balanceText(
        "Nota. «interpolado»: la descarga a Punta Negra y el almacenamiento en Caracoles siguen una rampa lineal entre las estimaciones diarias de los extremos, desplazada para conservar el volumen de cada parte en ese hueco de 2 a 7 días. En cada día, descarga + almacenamiento = caudal estimado. Del 5 al 9/11 se conserva el balance 5→10/11 (descarga ≈ 33,0 m³/s, almacenamiento ≈ 40,3 m³/s, caudal 73,3 m³/s). Donde no hubo planilla de DH, la cota de Caracoles también está interpolada. Un hueco de más de 7 días no se rellena.",
        "Note. “interpolated”: the release toward Punta Negra and the Caracoles storage change follow a linear ramp between the daily estimates at the ends, shifted so each part keeps its balance volume over that 2–7 day gap. Each day, release + storage = estimated inflow. From 5 to 9 Nov the 5–10 Nov balance is kept (release ≈ 33.0 m³/s, storage ≈ 40.3 m³/s, inflow 73.3 m³/s). Where DH published no sheet, the Caracoles level is interpolated too. A gap longer than 7 days is left empty."
      )) + "</p>" +
      "<p class=\"hidro-note\">" + escHtml(validacion) + "</p>" +
      "<details class=\"hidro-balance-metodo\" open><summary>" + escHtml(balanceText("Nota del método", "Method note")) +
      "</summary><p class=\"hidro-note\">" + escHtml(doc.metodo || "") + "</p></details>" +
      "<p class=\"hidro-dl__actions\"><a class=\"btn btn-primary\" href=\"hidrologia/balance_caracoles.csv\" download>" +
      escHtml(balanceText("Descargar CSV", "Download CSV")) + "</a> <a class=\"btn btn-primary\" href=\"hidrologia/balance_caracoles.json\" download>" +
      escHtml(balanceText("Descargar JSON", "Download JSON")) + "</a></p>";
    ensureBalanceChart();
  }

  function drawBalanceChart() {
    var doc = state.balance;
    var canvas = document.getElementById("hidro-balance-chart");
    if (!doc || !canvas || !window.Chart || !panelVisible()) return;
    var rows = {};
    (doc.serie || []).forEach(function (row) { rows[row.fecha] = row; });
    var fechas = Object.keys(rows).sort();
    if (!fechas.length) return;
    var labels = [];
    var iso = [];
    var solid = [];
    var dashed = [];
    var dashedRadius = [];
    var descargaSolida = [];
    var descargaPunteada = [];
    var almacenamientoSolido = [];
    var almacenamientoPunteado = [];
    var radioHueco = [];
    var cursor = fechas[0];
    var end = fechas[fechas.length - 1];
    function valorDe(row, campo) {
      return row && isNum(row[campo]) ? row[campo] : null;
    }
    while (cursor <= end) {
      var row = rows[cursor];
      var prev = rows[addIsoDays(cursor, -1)];
      var next = rows[addIsoDays(cursor, 1)];
      var valor = valorDe(row, "caudal_estimado_m3s");
      var esRampa = !!(row && row.interpolado);
      var uneRampa = esRampa || (prev && prev.interpolado) || (next && next.interpolado);
      labels.push(formatFechaCorta(cursor));
      iso.push(cursor);
      solid.push(!esRampa ? valor : null);
      dashed.push(valor != null && uneRampa ? valor : null);
      dashedRadius.push(esRampa ? 6 : 0);
      var descarga = valorDe(row, "descarga_m3s");
      var almacenamiento = valorDe(row, "almacenamiento_caracoles_m3s");
      descargaSolida.push(!esRampa ? descarga : null);
      descargaPunteada.push(descarga != null && uneRampa ? descarga : null);
      almacenamientoSolido.push(!esRampa ? almacenamiento : null);
      almacenamientoPunteado.push(almacenamiento != null && uneRampa ? almacenamiento : null);
      radioHueco.push(esRampa ? 4 : 0);
      cursor = addIsoDays(cursor, 1);
    }
    if (balanceChart) {
      balanceChart.destroy();
      balanceChart = null;
    }
    balanceChart = new window.Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: balanceText("Balance diario", "Daily balance"),
          data: solid,
          borderColor: "#7a1532",
          backgroundColor: "#7a1532",
          borderWidth: 2,
          spanGaps: false,
          tension: 0,
          pointRadius: 3.5,
          pointBackgroundColor: "#7a1532",
          pointBorderColor: "#7a1532",
          fill: false,
          soloDiario: true
        }, {
          label: balanceText("Interpolado (conserva el volumen del balance)", "Interpolated (keeps the balance volume)"),
          data: dashed,
          borderColor: "#c47b2b",
          backgroundColor: "#ffffff",
          borderDash: [7, 4],
          borderWidth: 2,
          spanGaps: false,
          tension: 0,
          pointRadius: dashedRadius,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#c47b2b",
          pointBorderWidth: 2,
          fill: false,
          soloInterpolado: true
        }, {
          label: balanceText("Descarga a Punta Negra", "Release toward Punta Negra"),
          data: descargaSolida,
          borderColor: "#0a5c5e",
          backgroundColor: "#0a5c5e",
          borderWidth: 1,
          spanGaps: false,
          tension: 0,
          pointRadius: 2,
          pointBackgroundColor: "#0a5c5e",
          fill: false,
          soloDiario: true
        }, {
          label: balanceText("Descarga interpolada", "Interpolated release"),
          data: descargaPunteada,
          borderColor: "#0a5c5e",
          backgroundColor: "#ffffff",
          borderDash: [1, 3],
          borderWidth: 1,
          spanGaps: false,
          tension: 0,
          pointRadius: radioHueco,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#0a5c5e",
          pointBorderWidth: 1.5,
          fill: false,
          soloInterpolado: true
        }, {
          label: balanceText("Almacenamiento Caracoles", "Caracoles storage"),
          data: almacenamientoSolido,
          borderColor: "#1a6fa8",
          backgroundColor: "#1a6fa8",
          borderWidth: 1,
          spanGaps: false,
          tension: 0,
          pointRadius: 2,
          pointBackgroundColor: "#1a6fa8",
          fill: false,
          soloDiario: true
        }, {
          label: balanceText("Almacenamiento interpolado", "Interpolated storage"),
          data: almacenamientoPunteado,
          borderColor: "#1a6fa8",
          backgroundColor: "#ffffff",
          borderDash: [1, 3],
          borderWidth: 1,
          spanGaps: false,
          tension: 0,
          pointRadius: radioHueco,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#1a6fa8",
          pointBorderWidth: 1.5,
          fill: false,
          soloInterpolado: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: "#3d2a24",
              font: { weight: "700", size: 12 },
              boxWidth: 28,
              padding: 14
            }
          },
          tooltip: {
            filter: function (item) {
              var ds = item.chart.data.datasets[item.datasetIndex];
              var es = !!(rows[iso[item.dataIndex]] && rows[iso[item.dataIndex]].interpolado);
              if (ds.soloInterpolado) return es && item.raw != null;
              if (ds.soloDiario) return !es && item.raw != null;
              return item.raw != null;
            },
            callbacks: {
              label: function (ctx) {
                var row = rows[iso[ctx.dataIndex]];
                var clase = row && row.interpolado
                  ? balanceText("Interpolado", "Interpolated")
                  : balanceText("Balance diario", "Daily balance");
                return clase + ": " + formatFixed(ctx.parsed.y, 1) + " m³/s · " +
                  balanceText("ESTIMADO, no medido", "ESTIMATED, not measured");
              }
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: "m³/s" },
            ticks: { callback: function (value) { return formatAxis(value, 0); } }
          },
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }
        }
      }
    });
  }

  function ensureBalanceChart() {
    if (!state.balance || !panelVisible()) return;
    if (window.Chart) {
      drawBalanceChart();
      return;
    }
    loadScript(CHART_SRC).then(function () {
      if (panelVisible()) drawBalanceChart();
    }).catch(function () {});
  }

  var CIERRE_JSON = "data/hidrologia/pronostico_cierre_mes.json";
  var CIERRE_ETIQUETA = "Estimación del Instituto del Agua – no es dato oficial del Departamento de Hidráulica";

  function hm1(value) {
    return isNum(value) ? formatFixed(value, 1) : MISSING;
  }

  function cierreHost() {
    var root = document.getElementById("info-hidrologica");
    if (!root) return null;
    var host = document.getElementById("hidro-cierre");
    if (host) return host;
    var inner = root.querySelector(".section-inner") || root;
    host = document.createElement("div");
    host.id = "hidro-cierre";
    host.className = "card hidro-datos";
    var anchor = document.getElementById("hidro-historia") || document.getElementById("caudales-embalses");
    if (anchor && (anchor.parentNode === inner || inner.contains(anchor))) inner.insertBefore(host, anchor);
    else inner.appendChild(host);
    return host;
  }

  function cierreStyles() {
    if (document.getElementById("hidro-cierre-style")) return;
    var style = document.createElement("style");
    style.id = "hidro-cierre-style";
    style.textContent = [
      "#hidro-cierre { margin: 0 0 1.5rem; max-width: 100%; min-width: 0; }",
      "#hidro-cierre h3 { margin-bottom: 0.45rem; }",
      "#hidro-cierre .hidro-cierre-aviso { display: block; margin: 0 0 0.85rem; padding: 0.6rem 0.75rem; border-radius: 8px; background: #7a1532; color: #fff; font-weight: 700; line-height: 1.35; }",
      "#hidro-cierre .hidro-cierre-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.2rem, 1fr)); gap: 0.55rem; margin: 0 0 0.85rem; }",
      "#hidro-cierre .hidro-cierre-kpi { min-width: 0; padding: 0.6rem 0.7rem; border: 1px solid rgba(43, 143, 201, 0.22); border-radius: 8px; background: #fff; }",
      "#hidro-cierre .hidro-cierre-kpi span { display: block; color: #5c4f54; font-size: 0.78rem; line-height: 1.3; }",
      "#hidro-cierre .hidro-cierre-kpi strong { display: block; margin-top: 0.15rem; color: #4a0c1f; font-size: 1.28rem; font-variant-numeric: tabular-nums; line-height: 1.15; overflow-wrap: anywhere; }",
      "#hidro-cierre .hidro-cierre-kpi small { display: block; margin-top: 0.2rem; color: #5c4f54; font-size: 0.78rem; font-weight: 600; }",
      "#hidro-cierre .hidro-cierre-leyenda { display: flex; flex-wrap: wrap; gap: 0.35rem 0.85rem; list-style: none; padding: 0; margin: 0 0 0.75rem; font-size: 0.85rem; }",
      "#hidro-cierre .hidro-cierre-leyenda i { display: inline-block; width: 0.75rem; height: 0.75rem; margin-right: 0.28rem; border-radius: 2px; vertical-align: -1px; }",
      "#hidro-cierre .is-medido { background: #1a6fa8; }",
      "#hidro-cierre .is-estimado { background: #c47b2b; }",
      "#hidro-cierre .is-proyectado { background: #0a5c5e; }",
      "#hidro-cierre .is-media { background: #7a1532; }",
      "#hidro-cierre .hidro-cierre-bar { position: relative; height: 22px; margin: 0.15rem 0 0.45rem; }",
      "#hidro-cierre .hidro-cierre-track { position: absolute; left: 0; right: 0; top: 6px; height: 10px; border-radius: 999px; background: #e7f3fa; }",
      "#hidro-cierre .hidro-cierre-seg { position: absolute; top: 6px; height: 10px; }",
      "#hidro-cierre .hidro-cierre-media { position: absolute; top: 0; width: 2px; height: 22px; background: #7a1532; }",
      "#hidro-cierre .hidro-cierre-metodo { margin-top: 0.8rem; }",
      "#hidro-cierre .hidro-cierre-metodo p { white-space: pre-wrap; }",
      "#hidro-cierre .hidro-table { min-width: 28rem; }",
      "@media (max-width: 640px) {",
      "  #hidro-cierre .hidro-cierre-grid { grid-template-columns: 1fr 1fr; }",
      "  #hidro-cierre h3 { font-size: 1.2rem; }",
      "  #hidro-cierre .hidro-cierre-kpi strong { font-size: 1.12rem; }",
      "}",
      "@media (max-width: 380px) {",
      "  #hidro-cierre .hidro-cierre-grid { grid-template-columns: 1fr; }",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  var MES_EN = {
    enero: "January", febrero: "February", marzo: "March", abril: "April",
    mayo: "May", junio: "June", julio: "July", agosto: "August",
    septiembre: "September", octubre: "October", noviembre: "November", diciembre: "December"
  };

  function mesEn(nombre) {
    return MES_EN[nombre] || nombre || "the month";
  }

  function cierreClase(clase) {
    if (clase === "medido") return balanceText("Medido", "Measured");
    if (clase === "estimado") return balanceText("Estimado", "Estimated");
    return balanceText("Proyectado", "Projected");
  }

  function cierreVsMedia(doc) {
    var media = doc.media_historica_hm3;
    var diff = doc.diferencia_vs_media_hm3;
    var mes = doc.mes_nombre || "";
    if (!isNum(media) || !isNum(diff)) {
      return balanceText("Sin media histórica del mes.", "No historical mean for this month.");
    }
    if (Math.abs(diff) < 0.05) {
      return balanceText(
        "El cierre coincide con la media histórica de " + mes + " (" + hm1(media) + " hm³).",
        "The month-end total matches the historical mean for " + mesEn(mes) + " (" + hm1(media) + " hm³)."
      );
    }
    if (diff < 0) {
      return balanceText(
        "Faltan " + hm1(Math.abs(diff)) + " hm³ para alcanzar la media histórica de " + mes + " (" + hm1(media) + " hm³).",
        hm1(Math.abs(diff)) + " hm³ short of the historical mean for " + mesEn(mes) + " (" + hm1(media) + " hm³)."
      );
    }
    return balanceText(
      "El cierre supera la media histórica de " + mes + " (" + hm1(media) + " hm³) en " + hm1(diff) + " hm³.",
      "The month-end total is " + hm1(diff) + " hm³ above the historical mean for " + mesEn(mes) + " (" + hm1(media) + " hm³)."
    );
  }

  function renderCierre() {
    var host = cierreHost();
    var doc = state.cierre;
    if (!host || !doc) return;
    cierreStyles();
    var scale = Math.max(
      doc.total_mes_p90_hm3 || 0,
      doc.media_historica_hm3 || 0,
      doc.total_mes_hm3 || 0,
      1
    );
    function pct(value) {
      return Math.max(0, (Number(value) || 0) / scale * 100);
    }
    var wMed = pct(doc.acumulado_medido_hm3);
    var wEst = pct(doc.acumulado_estimado_hm3);
    var wPro = pct(doc.proyectado_restante_hm3);
    var mediaLeft = pct(doc.media_historica_hm3);
    var hasta = doc.ultimo_dia_con_caudal ? formatFechaCorta(doc.ultimo_dia_con_caudal) : MISSING;
    var mes = doc.mes_nombre || "";
    var anios = doc.media_historica_anios ? String(doc.media_historica_anios) : "";
    var mediaNota = doc.media_historica_fuente === "respaldo"
      ? balanceText("respaldo", "fallback")
      : (anios ? balanceText(anios + " noviembres completos", anios + " complete Novembers") : "");
    if (doc.mes && doc.mes.slice(5) !== "11") {
      mediaNota = anios ? balanceText(anios + " meses completos", anios + " complete months") : mediaNota;
    }
    var filas = (doc.dias || []).map(function (row) {
      var marca = row.clase === "estimado" ? " class=\"hidro-balance-interp\"" : "";
      return "<tr" + marca + "><th scope=\"row\">" + escHtml(formatFechaCorta(row.fecha)) + "</th><td>" +
        escHtml(cierreClase(row.clase)) + "</td><td>" + escHtml(isNum(row.q_m3s) ? formatFixed(row.q_m3s, row.clase === "proyectado" ? 1 : 2) : MISSING) +
        "</td><td>" + escHtml(isNum(row.volumen_hm3) ? formatFixed(row.volumen_hm3, 2) : MISSING) + "</td></tr>";
    }).join("");
    var titulo = doc.titulo || balanceText(
      "Pronóstico de cierre de mes – Río San Juan Km 101",
      "Month-end outlook – San Juan River Km 101"
    );
    host.innerHTML =
      "<h3>" + escHtml(balanceLang() === "en"
        ? "Month-end outlook – San Juan River Km 101"
        : titulo) + "</h3>" +
      "<p class=\"hidro-cierre-aviso\">" + escHtml(CIERRE_ETIQUETA) + "</p>" +
      "<p>" + escHtml(balanceText(
        "Volumen de " + (mes || "este mes") + " en Km 101. Lo medido sale de la planilla del Departamento de Hidráulica, incluido el 9/11/2026 (93,47 m³/s). Del 5 al 8/11 el caudal es la interpolación del balance y desde el 10/11, donde no hay medición, es la entrada estimada a Los Caracoles (salida a Punta Negra más la variación de almacenamiento). Los días sin dato se proyectan con un grado-día que no baja de 42 m³/s.",
        (mesEn(mes) || "This month") + " volume at Km 101. Measured days come from the Hydraulics Department sheet, including 9 Nov 2026 (93.47 m³/s). From 5 to 8 Nov the flow is the balance interpolation, and from 10 Nov, where there is no measurement, it is the estimated inflow to Los Caracoles (release toward Punta Negra plus the storage change). Days without a figure are projected with a degree-day model that does not fall below 42 m³/s."
      )) + "</p>" +
      "<div class=\"hidro-cierre-grid\">" +
      cierreKpi(balanceText("Acumulado medido", "Measured to date"), hm1(doc.acumulado_medido_hm3) + " hm³",
        (doc.dias_medidos || 0) + " " + balanceText("días", "days")) +
      cierreKpi(balanceText("Acumulado estimado", "Estimated to date"), hm1(doc.acumulado_estimado_hm3) + " hm³",
        (doc.dias_estimados || 0) + " " + balanceText("días", "days")) +
      cierreKpi(balanceText("Proyectado restante", "Projected remainder"), hm1(doc.proyectado_restante_hm3) + " hm³",
        "P10–P90 " + hm1(doc.proyectado_restante_p10_hm3) + "–" + hm1(doc.proyectado_restante_p90_hm3)) +
      cierreKpi(balanceText("Total del mes", "Month total"), hm1(doc.total_mes_hm3) + " hm³",
        "P10–P90 " + hm1(doc.total_mes_p10_hm3) + "–" + hm1(doc.total_mes_p90_hm3)) +
      cierreKpi(balanceText("Media histórica del mes", "Historical month mean"), hm1(doc.media_historica_hm3) + " hm³", mediaNota) +
      cierreKpi(balanceText("Falta para cerrar el mes", "Left to close the month"),
        String(doc.falta_dias || 0) + " " + balanceText("días", "days"),
        hm1(doc.falta_volumen_hm3) + " hm³") +
      "</div>" +
      "<div class=\"hidro-cierre-bar\" role=\"img\" aria-label=\"" + escHtml(balanceText(
        "Barras de volumen medido, estimado y proyectado, con la media histórica.",
        "Bars for measured, estimated and projected volume, with the historical mean."
      )) + "\">" +
      "<div class=\"hidro-cierre-track\"></div>" +
      "<span class=\"hidro-cierre-seg is-medido\" style=\"left:0;width:" + wMed.toFixed(2) + "%\"></span>" +
      "<span class=\"hidro-cierre-seg is-estimado\" style=\"left:" + wMed.toFixed(2) + "%;width:" + wEst.toFixed(2) + "%\"></span>" +
      "<span class=\"hidro-cierre-seg is-proyectado\" style=\"left:" + (wMed + wEst).toFixed(2) + "%;width:" + wPro.toFixed(2) + "%\"></span>" +
      (isNum(doc.media_historica_hm3) ? "<i class=\"hidro-cierre-media\" style=\"left:" + mediaLeft.toFixed(2) + "%\"></i>" : "") +
      "</div>" +
      "<ul class=\"hidro-cierre-leyenda\"><li><i class=\"is-medido\"></i>" + escHtml(balanceText("Medido", "Measured")) +
      "</li><li><i class=\"is-estimado\"></i>" + escHtml(balanceText("Estimado", "Estimated")) +
      "</li><li><i class=\"is-proyectado\"></i>" + escHtml(balanceText("Proyectado", "Projected")) +
      "</li><li><i class=\"is-media\"></i>" + escHtml(balanceText("Media histórica", "Historical mean")) + "</li></ul>" +
      "<p class=\"hidro-note\">" + escHtml(balanceText(
        "Caudal incorporado hasta el " + hasta + ". " + cierreVsMedia(doc),
        "Flow included through " + hasta + ". " + cierreVsMedia(doc)
      )) + "</p>" +
      "<details class=\"hidro-cierre-metodo\"><summary>" + escHtml(balanceText("Día por día", "Day by day")) +
      "</summary><div class=\"hidro-table-wrap hidro-table-wrap--scroll\"><table class=\"hidro-table\"><caption>" +
      escHtml(balanceText(
        (mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : "Mes") + " día por día. El proyectado no es una medición.",
        mesEn(mes) + " day by day. Projected values are not measurements."
      )) +
      "</caption><thead><tr><th>" + escHtml(balanceText("Fecha", "Date")) + "</th><th>" +
      escHtml(balanceText("Clase", "Class")) + "</th><th>" + escHtml(balanceText("Caudal (m³/s)", "Flow (m³/s)")) +
      "</th><th>" + escHtml(balanceText("Volumen (hm³)", "Volume (hm³)")) + "</th></tr></thead><tbody>" +
      filas + "</tbody></table></div></details>" +
      "<details class=\"hidro-cierre-metodo\"><summary>" + escHtml(balanceText("Nota del método", "Method note")) +
      "</summary><p class=\"hidro-note\">" + escHtml(doc.metodo || "") + "</p></details>" +
      "<p class=\"hidro-dl__actions\"><a class=\"btn btn-primary\" href=\"" + escHtml(CIERRE_JSON) + "\" download>" +
      escHtml(balanceText("Descargar JSON", "Download JSON")) + "</a></p>";
  }

  function cierreKpi(label, value, note) {
    return "<div class=\"hidro-cierre-kpi\"><span>" + escHtml(label) + "</span><strong>" + escHtml(value) +
      "</strong>" + (note ? "<small>" + escHtml(note) + "</small>" : "") + "</div>";
  }

  function loadCierre() {
    var bust = Date.now();
    fetch(CIERRE_JSON + "?v=" + bust, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then(function (doc) {
        state.cierre = doc;
        renderCierre();
      })
      .catch(function () {
        var host = cierreHost();
        if (!host || state.cierre) return;
        cierreStyles();
        host.innerHTML = "<h3>" + escHtml(balanceText(
          "Pronóstico de cierre de mes – Río San Juan Km 101",
          "Month-end outlook – San Juan River Km 101"
        )) + "</h3><p class=\"hidro-cierre-aviso\">" + escHtml(CIERRE_ETIQUETA) + "</p><p class=\"hidro-note\">" +
          escHtml(balanceText(
            "El pronóstico de cierre todavía no está publicado.",
            "The month-end outlook is not published yet."
          )) + "</p>";
      });
  }

  function loadBalance() {
    var bust = Date.now();
    fetch("hidrologia/balance_caracoles.json?v=" + bust, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then(function (doc) {
        state.balance = doc;
        renderBalance();
      })
      .catch(function () {
        var host = balanceHost();
        if (!host || state.balance) return;
        host.innerHTML = "<p class=\"hidro-note\">" + escHtml(balanceText(
          "La serie estimada todavía no está publicada.",
          "The estimated series is not published yet."
        )) + "</p>";
      });
  }

  function loadData() {
    setStatus(t("sec.hidro.datos.loading"));
    var bust = Date.now();
    function json(url) {
      return fetch(url + "?v=" + bust, { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      });
    }
    Promise.all([
      json(DATA_URL),
      json("hidrologia/ultimos_valores.json"),
      json("hidrologia/datos_anuales.json")
    ]).then(function (parts) {
      state.ultimos = parts[1];
      state.anual = parts[2];
      applyData(parts[0]);
    }).catch(function () {
      setStatus(t("sec.hidro.datos.error"));
    });
    loadBalance();
    loadCierre();
  }

  bind();
  loadData();

  document.addEventListener("oia:page", function (event) {
    if (event.detail !== "info-hidrologica") return;
    if (vistaChart) vistaChart.resize();
    if (historiaChart) historiaChart.resize();
    if (balanceChart) balanceChart.resize();
    if (!vistaChart || !historiaChart) ensureCharts();
    if (!balanceChart) ensureBalanceChart();
  });

  window.addEventListener("oia:langchange", function () {
    if (state.cierre) renderCierre();
    if (state.balance) renderBalance();
    if (!state.data) return;
    renderKpis();
    renderAsof();
    fillSelector();
    renderDecadas();
    if (panelVisible() && window.Chart) {
      renderHistoria();
      renderVista();
    }
  });

  window.addEventListener("resize", function () {
    fitDecadeDetails();
  });
})();
