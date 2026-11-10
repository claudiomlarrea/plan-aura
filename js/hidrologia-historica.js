/**
 * Serie histórica y análisis anual (#serie-historica).
 * Lee hidrologia/*.json generado por tools/hidrologia/scripts/analisis_anual.py.
 * No completa días faltantes: el gráfico solo une los días publicados.
 */
(function () {
  var BASE = "hidrologia/";
  var bust = Date.now();
  var CHART_SRC = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
  var XLSX_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  var MES = {
    es: ["Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun"],
    en: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]
  };
  var COL = {
    "Punta Negra": "#e69138",
    Ullum: "#1a6fa8",
    "Los Caracoles": "#0d6e4f",
    "Cuesta del Viento": "#7a1532"
  };
  var state = { acum: null, anual: null, tipo: "anio_hidrologico" };
  var charts = { acum: null, media: null, maxmin: null, anom: null, emb: [] };
  var scriptLoads = {};

  function t(key, vars) {
    if (window.I18N && typeof window.I18N.t === "function") return window.I18N.t(key, vars);
    return key;
  }

  function lang() {
    return window.I18N && window.I18N.getLang && window.I18N.getLang() === "en" ? "en" : "es";
  }

  function panelVisible() {
    var panel = document.getElementById("info-hidrologica");
    return !!(panel && panel.classList.contains("is-active"));
  }

  function setStatus(message) {
    var el = document.getElementById("hidro-hist-status");
    if (el) el.textContent = message || "";
  }

  function nf(value, digits) {
    if (value == null || value === "") return "s/d";
    var n = Number(value);
    if (!isFinite(n)) return "s/d";
    return n.toLocaleString("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function fd(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    if (p.length < 3) return String(iso);
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function url(name) {
    return BASE + name + "?v=" + bust;
  }

  function loadScript(src) {
    if (scriptLoads[src]) return scriptLoads[src];
    scriptLoads[src] = new Promise(function (resolve, reject) {
      if (src === CHART_SRC && window.Chart) {
        resolve();
        return;
      }
      if (src === XLSX_SRC && window.XLSX) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        delete scriptLoads[src];
        reject(new Error(src));
      };
      document.head.appendChild(script);
    });
    return scriptLoads[src];
  }

  function destroy(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function destroyEmb() {
    charts.emb.forEach(function (chart) { chart.destroy(); });
    charts.emb = [];
  }

  function yearById(anio) {
    var list = state.acum.anios;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].anio === anio) return list[i];
    }
    return list[list.length - 1];
  }

  function fillYears() {
    var select = document.getElementById("hidro-hist-anio");
    if (!select || select.options.length) return;
    state.acum.anios.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.anio;
      opt.textContent = item.completo ? item.anio : item.anio + " · " + t("sec.hidro.hist.incomplete");
      select.appendChild(opt);
    });
    select.value = state.acum.anio_actual;
  }

  function refreshYearLabels() {
    var select = document.getElementById("hidro-hist-anio");
    if (!select) return;
    var current = select.value;
    Array.prototype.forEach.call(select.options, function (opt) {
      var item = yearById(opt.value);
      opt.textContent = item.completo ? item.anio : item.anio + " · " + t("sec.hidro.hist.incomplete");
    });
    select.value = current;
  }

  function yearNote(item) {
    if (item.anio === "1909-10") return t("sec.hidro.hist.note1909");
    if (!item.completo) {
      return t("sec.hidro.hist.noteIncomplete", {
        n: String(item.dias),
        inicio: fd(item.inicio),
        fin: fd(item.fin)
      });
    }
    return t("sec.hidro.hist.noteComplete", {
      n: String(item.dias),
      inicio: fd(item.inicio),
      fin: fd(item.fin),
      periodo: state.acum.periodo_media
    });
  }

  function line(item, color, width, dash) {
    return {
      label: item.label,
      data: item.curva.map(function (p) { return { x: p[0], y: p[1] }; }),
      borderColor: color,
      backgroundColor: "transparent",
      borderWidth: width,
      borderDash: dash || [],
      pointRadius: 0,
      tension: 0.15,
      spanGaps: false
    };
  }

  function renderAcum() {
    if (!window.Chart || !panelVisible() || !state.acum) return;
    var select = document.getElementById("hidro-hist-anio");
    var item = yearById(select ? select.value : state.acum.anio_actual);
    var nota = document.getElementById("hidro-hist-anio-nota");
    if (nota) nota.textContent = yearNote(item);
    var wrap = document.getElementById("hidro-chart-acumulado-wrap");
    if (wrap) wrap.setAttribute("aria-label", item.anio);
    var datasets = [
      line({
        label: t("sec.hidro.hist.legend.selected", {
          anio: item.anio,
          n: String(item.dias),
          extra: item.completo ? "" : " · " + t("sec.hidro.hist.incomplete")
        }),
        curva: item.curva
      }, "#1a6fa8", 2.6)
    ];
    datasets.push(line({
      label: t("sec.hidro.hist.legend.mean", {
        n: String(state.acum.n_completos),
        periodo: state.acum.periodo_media
      }),
      curva: state.acum.media_completos
    }, "#5c4f54", 1.6, [6, 4]));
    if (item.anio !== state.acum.anio_max) {
      datasets.push(line({
        label: t("sec.hidro.hist.legend.max", { anio: state.acum.anio_max }),
        curva: yearById(state.acum.anio_max).curva
      }, "#0d6e4f", 1.4, [4, 3]));
    }
    if (item.anio !== state.acum.anio_min) {
      datasets.push(line({
        label: t("sec.hidro.hist.legend.min", { anio: state.acum.anio_min }),
        curva: yearById(state.acum.anio_min).curva
      }, "#7a1532", 1.4, [4, 3]));
    }
    var months = MES[lang()];
    destroy("acum");
    charts.acum = new window.Chart(document.getElementById("hidro-chart-acumulado"), {
      type: "line",
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 14, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: function (items) {
                var day = items[0] && items[0].parsed ? items[0].parsed.x : 0;
                var idx = Math.max(0, Math.min(11, Math.floor(day / 30.44)));
                return months[idx];
              },
              label: function (ctx) {
                return ctx.dataset.label + ": " + nf(ctx.parsed.y, 1) + " hm³";
              }
            }
          }
        },
        scales: {
          x: {
            type: "linear",
            min: 0,
            max: 365,
            ticks: {
              stepSize: 30.44,
              callback: function (value) {
                var idx = Math.round(value / 30.44);
                return months[idx] || "";
              },
              maxRotation: 0
            },
            grid: { color: "rgba(26, 111, 168, 0.08)" }
          },
          y: {
            title: { display: true, text: t("sec.hidro.hist.axis.hm3"), color: "#1f1418" },
            ticks: {
              callback: function (value) { return nf(value, 0); }
            },
            grid: { color: "rgba(26, 111, 168, 0.12)" }
          }
        }
      }
    });
  }

  function trendLine(rows, tr) {
    if (!tr) return rows.map(function () { return null; });
    return rows.map(function (row) {
      var x = parseInt(String(row.anio).slice(0, 4), 10);
      if (!row.completo || x < tr.desde || x > tr.hasta) return null;
      return tr.intercepto + tr.pendiente_sen_por_anio * x;
    });
  }

  function renderAnual() {
    if (!window.Chart || !panelVisible() || !state.anual) return;
    var tipo = state.tipo;
    var Q = state.anual.caudal_km101;
    var rows = Q[tipo];
    var labels = rows.map(function (row) { return String(row.anio); });
    var completo = rows.map(function (row) { return row.completo; });
    var key = tipo === "anio_hidrologico" ? "media_anual_hidrologico" : "media_anual_calendario";
    var trends = Q.tendencias[key] || {};
    var refKey = tipo === "anio_hidrologico" ? "hidrologico" : "calendario";
    var ref = Q.referencia_1910_2022[refKey];
    var detalle = Object.keys(trends).map(function (name) {
      var v = trends[name];
      return v.desde + "–" + v.hasta + ": " + nf(v.pendiente_sen_por_decada, 2) + " m³/s (" + v.tendencia + ", p=" + nf(v.p, 3) + ")";
    }).join(" · ");
    var tend = document.getElementById("hidro-hist-tend");
    if (tend) {
      tend.textContent = t("sec.hidro.hist.trend", {
        detalle: detalle,
        periodo: ref.periodo,
        media: nf(ref.media_m3s, 1),
        derrame: nf(ref.derrame_hm3, 0)
      });
    }
    destroy("media");
    destroy("maxmin");
    destroy("anom");
    var mediaSets = [{
      type: "bar",
      label: t("sec.hidro.hist.chart.media"),
      data: rows.map(function (row) { return row.media_m3s; }),
      backgroundColor: completo.map(function (ok) { return ok ? "#6fa8dc" : "#d5dde6"; })
    }];
    if (trends.periodo_completo) {
      mediaSets.push({
        type: "line",
        label: trends.periodo_completo.desde + "–" + trends.periodo_completo.hasta,
        data: trendLine(rows, trends.periodo_completo),
        borderColor: "#7a1532",
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: true
      });
    }
    if (trends.desde_1991) {
      mediaSets.push({
        type: "line",
        label: trends.desde_1991.desde + "–" + trends.desde_1991.hasta,
        data: trendLine(rows, trends.desde_1991),
        borderColor: "#e69138",
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [5, 3],
        spanGaps: true
      });
    }
    var commonX = { ticks: { maxTicksLimit: 12, maxRotation: 0, autoSkip: true } };
    charts.media = new window.Chart(document.getElementById("hidro-chart-media"), {
      type: "bar",
      data: { labels: labels, datasets: mediaSets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          title: { display: true, text: t("sec.hidro.hist.chart.media") }
        },
        scales: { x: commonX }
      }
    });
    charts.maxmin = new window.Chart(document.getElementById("hidro-chart-maxmin"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: t("sec.hidro.hist.col.max"), data: rows.map(function (row) { return row.max_m3s; }), borderColor: "#1a6fa8", pointRadius: 0, borderWidth: 1.4 },
          { label: t("sec.hidro.hist.col.min"), data: rows.map(function (row) { return row.min_m3s; }), borderColor: "#7a1532", pointRadius: 0, borderWidth: 1.4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { title: { display: true, text: t("sec.hidro.hist.chart.maxmin") }, legend: { position: "bottom" } },
        scales: { x: commonX, y: { type: "logarithmic" } }
      }
    });
    charts.anom = new window.Chart(document.getElementById("hidro-chart-anom"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: t("sec.hidro.hist.col.anom"),
          data: rows.map(function (row) { return row.anomalia_media_pct; }),
          backgroundColor: rows.map(function (row) {
            return row.anomalia_media_pct == null ? "#d5dde6" : row.anomalia_media_pct >= 0 ? "#1a6fa8" : "#7a1532";
          })
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: t("sec.hidro.hist.chart.anom", { periodo: ref.periodo }) }
        },
        scales: { x: commonX }
      }
    });
    var table = document.getElementById("hidro-hist-tabla");
    if (table) {
      var head = "<thead><tr><th>" + t("sec.hidro.hist.col.year") + "</th><th>" + t("sec.hidro.hist.col.days") +
        "</th><th>" + t("sec.hidro.hist.col.mean") + "</th><th>" + t("sec.hidro.hist.col.max") +
        "</th><th>" + t("sec.hidro.hist.col.maxDate") + "</th><th>" + t("sec.hidro.hist.col.min") +
        "</th><th>" + t("sec.hidro.hist.col.minDate") + "</th><th>" + t("sec.hidro.hist.col.runoff") +
        "</th><th>" + t("sec.hidro.hist.col.anom") + "</th></tr></thead>";
      var body = "<tbody>" + rows.slice().reverse().map(function (row) {
        return '<tr class="' + (row.completo ? "" : "hidro-inc") + '"><th scope="row">' + row.anio +
          (row.completo ? "" : " *") + "</th><td>" + row.dias_con_dato + "</td><td>" + nf(row.media_m3s, 1) +
          "</td><td>" + nf(row.max_m3s, 1) + "</td><td>" + fd(row.fecha_max) + "</td><td>" + nf(row.min_m3s, 1) +
          "</td><td>" + fd(row.fecha_min) + "</td><td>" + nf(row.derrame_hm3, 0) + "</td><td>" +
          (row.anomalia_media_pct == null ? "–" : nf(row.anomalia_media_pct, 1) + " %") + "</td></tr>";
      }).join("") + "</tbody>";
      table.innerHTML = head + body;
    }
    renderEmbalses(tipo);
  }

  function renderEmbalses(tipo) {
    destroyEmb();
    var box = document.getElementById("hidro-hist-emb");
    var table = document.getElementById("hidro-hist-emb-tabla");
    if (box) box.innerHTML = "";
    var html = "<thead><tr><th>" + t("sec.hidro.hist.col.reservoir") + "</th><th>" + t("sec.hidro.hist.col.year") +
      "</th><th>" + t("sec.hidro.hist.col.days") + "</th><th>" + t("sec.hidro.hist.col.levelMean") +
      "</th><th>" + t("sec.hidro.hist.col.levelMax") + "</th><th>" + t("sec.hidro.hist.col.maxDate") +
      "</th><th>" + t("sec.hidro.hist.col.levelMin") + "</th><th>" + t("sec.hidro.hist.col.minDate") +
      "</th></tr></thead><tbody>";
    Object.keys(state.anual.embalses).forEach(function (name) {
      var emb = state.anual.embalses[name];
      var rows = emb[tipo] || [];
      var id = "hidro-chart-emb-" + name.replace(/\s+/g, "-").toLowerCase();
      if (box) {
        box.insertAdjacentHTML("beforeend",
          '<div class="hidro-chart-card"><div class="hidro-chart hidro-chart--anual"><canvas id="' + id + '" aria-hidden="true"></canvas></div></div>');
      }
      var canvas = document.getElementById(id);
      if (canvas) {
        charts.emb.push(new window.Chart(canvas, {
          type: "line",
          data: {
            labels: rows.map(function (row) { return String(row.anio); }),
            datasets: [
              { label: t("sec.hidro.hist.col.levelMax"), data: rows.map(function (row) { return row.max_msnm; }), borderColor: "#9fc5e8", pointRadius: 2, borderWidth: 1 },
              { label: t("sec.hidro.hist.col.levelMean"), data: rows.map(function (row) { return row.media_msnm; }), borderColor: COL[name] || "#1a6fa8", pointRadius: 3, borderWidth: 2 },
              { label: t("sec.hidro.hist.col.levelMin"), data: rows.map(function (row) { return row.min_msnm; }), borderColor: "#e7b3b8", pointRadius: 2, borderWidth: 1 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
              title: { display: true, text: name + " · " + fd(emb.desde) + "–" + fd(emb.hasta) }
            }
          }
        }));
      }
      rows.slice().reverse().forEach(function (row) {
        html += '<tr class="' + (row.completo ? "" : "hidro-inc") + '"><th scope="row">' + name + "</th><td>" +
          row.anio + (row.completo ? "" : " *") + "</td><td>" + row.dias_con_dato + "</td><td>" +
          nf(row.media_msnm, 2) + "</td><td>" + nf(row.max_msnm, 2) + "</td><td>" + fd(row.fecha_max) +
          "</td><td>" + nf(row.min_msnm, 2) + "</td><td>" + fd(row.fecha_min) + "</td></tr>";
      });
    });
    html += "</tbody>";
    if (table) table.innerHTML = html;
  }

  function bustLinks() {
    ["hidro-dl-q-csv", "hidro-dl-e-csv", "hidro-dl-ah-csv", "hidro-dl-ac-csv", "hidro-dl-emb-csv"].forEach(function (id) {
      var a = document.getElementById(id);
      if (!a) return;
      var href = a.getAttribute("href").split("?")[0];
      a.href = href + "?v=" + bust;
    });
  }

  function parseCsv(text) {
    return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(function (line) { return line.length; }).map(function (line) {
      return line.split(";").map(function (cell) {
        var s = cell.trim();
        if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^-?\d+,\d+$/.test(s) || /^-?\d+\.\d+$/.test(s) || /^-?\d+$/.test(s)) {
          var n = Number(s.indexOf(",") >= 0 ? s.replace(/\./g, "").replace(",", ".") : s);
          if (isFinite(n)) return n;
        }
        return s;
      });
    });
  }

  function downloadExcel(csvName, sheetName, filename) {
    setStatus(t("sec.hidro.hist.xlsxBusy"));
    Promise.all([
      loadScript(XLSX_SRC),
      fetch(url(csvName), { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
    ]).then(function (parts) {
      if (!window.XLSX) throw new Error("xlsx");
      var aoa = parseCsv(parts[1]);
      var ws = window.XLSX.utils.aoa_to_sheet(aoa);
      var wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
      window.XLSX.writeFile(wb, filename);
      setStatus("");
    }).catch(function () {
      setStatus(t("sec.hidro.hist.libMissing"));
    });
  }

  function renderSources() {
    var el = document.getElementById("hidro-hist-fuentes");
    if (!el || !state.anual) return;
    var links = (state.anual.fuentes || []).map(function (fuente) {
      return '<a href="' + fuente.url + '" target="_blank" rel="noopener noreferrer">' + fuente.nombre + "</a>";
    }).join(" · ");
    el.innerHTML = t("sec.hidro.hist.sources") + " " + links + ". " + t("sec.hidro.hist.processing");
  }

  function draw() {
    if (!state.acum || !panelVisible()) return;
    loadScript(CHART_SRC).then(function () {
      if (!panelVisible()) return;
      requestAnimationFrame(function () {
        fillYears();
        refreshYearLabels();
        renderAcum();
        renderAnual();
        renderSources();
      });
    }).catch(function () {
      setStatus(t("sec.hidro.hist.error"));
    });
  }

  function load() {
    setStatus(t("sec.hidro.hist.loading"));
    bustLinks();
    Promise.all([
      fetch(url("acumulado.json"), { cache: "no-store" }).then(function (r) { return r.json(); }),
      fetch(url("datos_anuales.json"), { cache: "no-store" }).then(function (r) { return r.json(); })
    ]).then(function (parts) {
      state.acum = parts[0];
      state.anual = parts[1];
      var act = document.getElementById("hidro-hist-act");
      if (act) act.textContent = t("sec.hidro.hist.updated", { fecha: fd(state.anual.generado) });
      setStatus("");
      draw();
    }).catch(function () {
      setStatus(t("sec.hidro.hist.error"));
    });
  }

  var root = document.getElementById("serie-historica");
  if (!root) return;
  root.addEventListener("change", function (event) {
    if (event.target && event.target.id === "hidro-hist-anio") renderAcum();
  });
  root.addEventListener("click", function (event) {
    var tab = event.target.closest("[data-hist-tab]");
    if (tab) {
      state.tipo = tab.getAttribute("data-hist-tab");
      root.querySelectorAll("[data-hist-tab]").forEach(function (btn) {
        btn.classList.toggle("is-on", btn === tab);
      });
      renderAnual();
      return;
    }
  });
  document.addEventListener("click", function (event) {
    var dl = event.target.closest("[data-hist-dl]");
    if (!dl) return;
    var kind = dl.getAttribute("data-hist-dl");
    var stamp = state.anual && state.anual.generado ? state.anual.generado : "serie";
    if (kind === "xlsx-q") downloadExcel("caudales_diarios.csv", "Caudal", "rio-san-juan-km101-serie-" + stamp + ".xlsx");
    if (kind === "xlsx-e") downloadExcel("niveles_embalses.csv", "Embalses", "rio-san-juan-embalses-" + stamp + ".xlsx");
  });

  document.addEventListener("oia:page", function (event) {
    if (event.detail !== "info-hidrologica") return;
    if (charts.acum) {
      charts.acum.resize();
      ["media", "maxmin", "anom"].forEach(function (key) { if (charts[key]) charts[key].resize(); });
      charts.emb.forEach(function (chart) { chart.resize(); });
      return;
    }
    draw();
  });

  window.addEventListener("oia:langchange", function () {
    if (!state.anual) return;
    var act = document.getElementById("hidro-hist-act");
    if (act) act.textContent = t("sec.hidro.hist.updated", { fecha: fd(state.anual.generado) });
    if (panelVisible()) draw();
  });

  load();
})();
