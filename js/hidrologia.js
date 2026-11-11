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
    mode: {}
  };
  var vistaChart = null;
  var historiaChart = null;
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

  function decadeLabel(dec, withCourse) {
    var label = dec.desde + "–" + dec.hasta;
    if (withCourse && dec.en_curso && dec.ultimo_dato) {
      label += " (" + t("sec.hidro.dec.ongoing", { fecha: formatFechaCorta(dec.ultimo_dato) }) + ")";
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
      return '<option value="' + dec.desde + '">' + decadeLabel(dec, true) + "</option>";
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
        ? '<tr class="hidro-decada-detail"><td colspan="11"><div class="hidro-month-scroll">' + tabs +
          yearRows(dec, mode) + "</div></td></tr>"
        : "";
      return '<tbody><tr class="hidro-decada-sum' + current + '"><th scope="row"><button type="button" class="hidro-exp" data-decada="' +
        dec.desde + '" aria-expanded="' + (open ? "true" : "false") + '">' + (open ? "▾ " : "▸ ") + decadeLabel(dec, true) +
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
            title: { display: true, text: t("sec.hidro.dec.chartMeses", { decada: decadeLabel(dec, true) }), color: "#1f1418" },
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
    fillSelector();
    renderDecadas();
    enableActions(true);
    setStatus("");
    ensureCharts();
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
  }

  bind();
  loadData();

  document.addEventListener("oia:page", function (event) {
    if (event.detail !== "info-hidrologica") return;
    if (vistaChart) vistaChart.resize();
    if (historiaChart) historiaChart.resize();
    if (!vistaChart || !historiaChart) ensureCharts();
  });

  window.addEventListener("oia:langchange", function () {
    if (!state.data) return;
    renderKpis();
    fillSelector();
    renderDecadas();
    if (panelVisible() && window.Chart) {
      renderHistoria();
      renderVista();
    }
  });
})();
