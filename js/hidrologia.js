/**
 * Datos diarios de caudal y embalses en #info-hidrologica.
 *
 * Lee data/hidrologia/tabla_hidrologica.json. Reemplazar ese archivo
 * actualiza la tabla, los gráficos Chart.js y todas las descargas.
 * La figura de escurrimiento acumulado sigue en assets/hidrologia/
 * hasta que la serie anual viva en esta misma carpeta.
 */
(function () {
  var DATA_URL = "data/hidrologia/tabla_hidrologica.json";
  var FIGURA_SRC = "assets/hidrologia/pantallazo.png";
  var TABLE_DAYS = 21;
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
    rowsDesc: [],
    tableRows: []
  };
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
      if (action === "pdf-figura") {
        btn.disabled = false;
        return;
      }
      if (action === "png" || action === "pdf-charts") {
        btn.disabled = !ready || !charts[btn.getAttribute("data-chart") || "caudal"];
        if (action === "pdf-charts") btn.disabled = !ready || !Object.keys(charts).length;
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

  function renderTable() {
    var body = document.getElementById("hidro-datos-body");
    if (!body) return;
    var html = state.tableRows.map(function (row) {
      return (
        "<tr>" +
        "<th scope=\"row\">" + formatFechaTabla(row.fecha) + "</th>" +
        td(formatCaudal(row.caudal_km101_m3s)) +
        td(formatCota(row["Punta Negra"])) +
        td(formatCota(row.Ullum)) +
        td(formatCota(row["Los Caracoles"])) +
        td(formatCota(row["Cuesta del Viento"])) +
        "</tr>"
      );
    }).join("");
    body.innerHTML = html;
  }

  function td(text) {
    if (text === MISSING) return '<td class="hidro-sd">s/d</td>';
    return "<td>" + text + "</td>";
  }

  function latestNumeric(rows, field) {
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (isNum(rows[i][field])) return { fecha: rows[i].fecha, value: rows[i][field] };
    }
    return null;
  }

  function latestReservoir(rows) {
    var fields = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"];
    var i;
    var j;
    for (i = 0; i < rows.length; i += 1) {
      for (j = 0; j < fields.length; j += 1) {
        if (isNum(rows[i][fields[j]])) return { fecha: rows[i].fecha };
      }
    }
    return null;
  }

  function fillMeta() {
    var meta = document.getElementById("hidro-datos-meta");
    var caption = document.getElementById("hidro-datos-caption");
    var link = document.getElementById("hidro-fuente-link");
    if (!state.data) return;
    var caudal = latestNumeric(state.rowsDesc, "caudal_km101_m3s");
    var embalse = latestReservoir(state.rowsDesc);
    if (meta && caudal && embalse) {
      meta.textContent = t("sec.hidro.datos.meta", {
        caudal: formatCaudal(caudal.value),
        fechaCaudal: formatFechaCorta(caudal.fecha),
        fechaEmbalses: formatFechaCorta(embalse.fecha),
        generado: formatFechaCorta(state.data.generado),
        n: String(state.tableRows.length)
      });
    }
    if (caption) {
      caption.textContent = t("sec.hidro.datos.tableCaption", {
        n: String(state.tableRows.length)
      });
    }
    if (link && state.data.fuente_url) link.href = state.data.fuente_url;
    SERIES.forEach(function (series) {
      var wrap = document.getElementById("hidro-chart-" + series.key + "-wrap");
      if (wrap) wrap.setAttribute("aria-label", t(series.titleKey));
    });
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

  function renderCharts() {
    if (!window.Chart || !state.tableRows.length || !panelVisible()) return;
    destroyCharts();
    var asc = state.tableRows.slice().reverse();
    var labels = asc.map(function (row) {
      return formatFechaCorta(row.fecha).slice(0, 5);
    });

    SERIES.forEach(function (series) {
      var canvas = document.getElementById("hidro-chart-" + series.key);
      if (!canvas) return;
      var values = asc.map(function (row) {
        return cellValue(row, series.field);
      });
      var bounds = yBounds(values);
      charts[series.key] = new window.Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: t(series.titleKey),
              data: values,
              borderColor: series.color,
              backgroundColor: series.fill,
              fill: true,
              tension: 0.25,
              spanGaps: false,
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: series.color
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var value = ctx.parsed.y;
                  var text = isNum(value) ? formatFixed(value, series.digits) : MISSING;
                  return text + " " + t(series.yKey);
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, color: "#5c4f54" },
              grid: { display: false }
            },
            y: {
              suggestedMin: bounds.min,
              suggestedMax: bounds.max,
              ticks: {
                maxTicksLimit: 6,
                color: "#5c4f54",
                callback: function (value) {
                  return formatAxis(Number(value), series.key === "caudal" ? 1 : 2);
                }
              },
              title: {
                display: true,
                text: t(series.yKey),
                color: "#1f1418",
                font: { family: "Source Sans 3, sans-serif", size: 12 }
              },
              grid: { color: "rgba(26, 111, 168, 0.12)" }
            }
          }
        }
      });
    });
    enableActions(true);
  }

  function ensureCharts() {
    if (!state.data || !panelVisible()) return;
    loadScript(CHART_SRC)
      .then(function () {
        if (!panelVisible()) return;
        requestAnimationFrame(function () {
          requestAnimationFrame(renderCharts);
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

  function downloadChartPng(key) {
    var chart = charts[key];
    var series = SERIES.filter(function (item) { return item.key === key; })[0];
    if (!chart || !series) return;
    chart.resize();
    var image = composeCanvas(chart.canvas, t(series.titleKey), sourceLine());
    image.toBlob(function (blob) {
      if (!blob) return;
      saveBlob(blob, "rio-san-juan-km101-" + key + "-" + fileStamp() + ".png");
    }, "image/png");
  }

  function chartImages() {
    return SERIES.map(function (series) {
      var chart = charts[series.key];
      if (!chart) return null;
      chart.resize();
      return {
        canvas: composeCanvas(chart.canvas, t(series.titleKey), sourceLine())
      };
    }).filter(Boolean);
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
        if (!JsPDF || !Object.keys(charts).length) {
          setStatus(t("sec.hidro.datos.libMissing"));
          return;
        }
        var pdf = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        chartImages().forEach(function (item, index) {
          addCanvasPage(pdf, item.canvas, index === 0);
        });
        pdf.save("rio-san-juan-km101-graficos-" + fileStamp() + ".pdf");
      })
      .catch(function (err) {
        console.error(err);
        setStatus(t("sec.hidro.datos.libMissing"));
      });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function downloadFiguraPdf() {
    Promise.all([loadScript(JSPDF_SRC), loadImage(FIGURA_SRC)])
      .then(function (results) {
        var JsPDF = window.jspdf && window.jspdf.jsPDF;
        var img = results[1];
        if (!JsPDF) {
          setStatus(t("sec.hidro.datos.libMissing"));
          return;
        }
        var scratch = document.createElement("canvas");
        scratch.width = img.naturalWidth;
        scratch.height = img.naturalHeight;
        scratch.getContext("2d").drawImage(img, 0, 0);
        var composed = composeCanvas(scratch, t("sec.hidro.datos.exportTitle.figura"), sourceLine());
        var pdf = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        addCanvasPage(pdf, composed, true);
        pdf.save("rio-san-juan-km101-escurrimiento-" + fileStamp() + ".pdf");
      })
      .catch(function (err) {
        console.error(err);
        setStatus(t("sec.hidro.datos.libMissing"));
      });
  }

  function sheetRows(rows) {
    var header = [
      "Fecha",
      "Caudal Km 101 (m3/s)",
      "Punta Negra (m.s.n.m.)",
      "Ullum (m.s.n.m.)",
      "Los Caracoles (m.s.n.m.)",
      "Cuesta del Viento (m.s.n.m.)"
    ];
    var body = rows.map(function (row) {
      return [
        row.fecha,
        isNum(row.caudal_km101_m3s) ? row.caudal_km101_m3s : MISSING,
        isNum(row["Punta Negra"]) ? row["Punta Negra"] : MISSING,
        isNum(row.Ullum) ? row.Ullum : MISSING,
        isNum(row["Los Caracoles"]) ? row["Los Caracoles"] : MISSING,
        isNum(row["Cuesta del Viento"]) ? row["Cuesta del Viento"] : MISSING
      ];
    });
    return [header].concat(body);
  }

  function applyNumberFormats(ws, rowCount) {
    var formats = [null, "0.000", "0.00", "0.00", "0.00", "0.00"];
    var r;
    var c;
    for (r = 1; r <= rowCount; r += 1) {
      for (c = 1; c < formats.length; c += 1) {
        var ref = window.XLSX.utils.encode_cell({ r: r, c: c });
        var cell = ws[ref];
        if (cell && cell.t === "n") cell.z = formats[c];
      }
    }
  }

  function downloadXlsx() {
    loadScript(XLSX_SRC)
      .then(function () {
        if (!window.XLSX) {
          setStatus(t("sec.hidro.datos.libMissing"));
          return;
        }
        var XLSX = window.XLSX;
        var aoa = sheetRows(state.tableRows);
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        applyNumberFormats(ws, state.tableRows.length);
        ws["!cols"] = [
          { wch: 12 },
          { wch: 24 },
          { wch: 24 },
          { wch: 20 },
          { wch: 26 },
          { wch: 28 }
        ];
        var meta = XLSX.utils.aoa_to_sheet([
          ["Fuente", state.data.fuente || ""],
          ["URL", state.data.fuente_url || "https://hidraulica.sanjuan.gob.ar/"],
          ["Generado", state.data.generado || ""],
          ["Caudal", (state.data.unidades && state.data.unidades.caudal) || "m3/s"],
          ["Cotas", (state.data.unidades && state.data.unidades.cotas) || "m.s.n.m."],
          ["Nota", "s/d = sin dato publicado. La hoja Tabla trae los días visibles en el sitio."]
        ]);
        meta["!cols"] = [{ wch: 14 }, { wch: 88 }];
        var wb = XLSX.utils.book_new();
        wb.Props = {
          Title: "Río San Juan - caudal Km 101 y cotas de embalses",
          Subject: state.data.fuente || "",
          CreatedDate: new Date((state.data.generado || "2026-01-01") + "T12:00:00")
        };
        XLSX.utils.book_append_sheet(wb, ws, "Tabla");
        if (state.rowsDesc.length !== state.tableRows.length) {
          var full = XLSX.utils.aoa_to_sheet(sheetRows(state.rowsDesc));
          applyNumberFormats(full, state.rowsDesc.length);
          XLSX.utils.book_append_sheet(wb, full, "Serie completa");
        }
        XLSX.utils.book_append_sheet(wb, meta, "Fuente");
        XLSX.writeFile(wb, "rio-san-juan-km101-tabla-" + fileStamp() + ".xlsx");
      })
      .catch(function () {
        setStatus(t("sec.hidro.datos.libMissing"));
      });
  }

  function onAction(action, chartKey) {
    if (!state.data && action !== "pdf-figura") return;
    setStatus("");
    if (action === "csv-table") {
      saveText(toCsv(state.tableRows), "rio-san-juan-km101-tabla-" + fileStamp() + ".csv", "text/csv;charset=utf-8");
    } else if (action === "csv-series") {
      saveText(toCsv(state.rowsDesc), "rio-san-juan-km101-serie-" + fileStamp() + ".csv", "text/csv;charset=utf-8");
    } else if (action === "json-series") {
      saveText(JSON.stringify(state.data, null, 2) + "\n", "rio-san-juan-km101-serie-" + fileStamp() + ".json", "application/json;charset=utf-8");
    } else if (action === "xlsx-table") {
      downloadXlsx();
    } else if (action === "png") {
      downloadChartPng(chartKey);
    } else if (action === "pdf-charts") {
      downloadChartsPdf();
    } else if (action === "pdf-figura") {
      downloadFiguraPdf();
    }
  }

  function bind() {
    var root = document.getElementById("caudales-embalses");
    if (!root) return;
    root.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-hidro-action]");
      if (!btn || btn.disabled) return;
      onAction(btn.getAttribute("data-hidro-action"), btn.getAttribute("data-chart"));
    });
  }

  function applyData(data) {
    var rows = Array.isArray(data.filas) ? data.filas : [];
    state.data = data;
    state.rowsDesc = sortDesc(rows);
    state.tableRows = state.rowsDesc.slice(0, TABLE_DAYS);
    renderTable();
    fillMeta();
    enableActions(true);
    setStatus("");
    ensureCharts();
  }

  function loadData() {
    setStatus(t("sec.hidro.datos.loading"));
    fetch(DATA_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then(applyData)
      .catch(function () {
        setStatus(t("sec.hidro.datos.error"));
        var body = document.getElementById("hidro-datos-body");
        if (body) {
          body.innerHTML = '<tr><td colspan="6">' + t("sec.hidro.datos.error") + "</td></tr>";
        }
      });
  }

  bind();
  loadData();

  document.addEventListener("oia:page", function (event) {
    if (event.detail !== "info-hidrologica") return;
    if (Object.keys(charts).length) {
      Object.keys(charts).forEach(function (key) {
        charts[key].resize();
      });
      return;
    }
    ensureCharts();
  });

  window.addEventListener("oia:langchange", function () {
    if (!state.data) return;
    fillMeta();
    renderTable();
    if (panelVisible() && window.Chart) renderCharts();
    else if (Object.keys(charts).length) destroyCharts();
  });
})();
