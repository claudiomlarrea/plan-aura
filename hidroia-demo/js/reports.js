/** Emisión de reportes semanales y mensuales a partir de la serie diaria. */

import {
  VARS,
  expandDaily,
  periodsFromDaily,
  pickLatestPeriod,
  round,
  parseISODate,
  summarize,
} from "./stats.js";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatDay(iso) {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  const month = MESES[d.getUTCMonth()].slice(0, 3);
  return `${day} ${month}`;
}

function formatDayLong(iso) {
  const d = parseISODate(iso);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function periodLabel(period) {
  const desde = period.rows[0].fecha;
  const hasta = period.rows[period.rows.length - 1].fecha;
  if (period.tipo === "semanal") {
    const week = period.key.split("-W")[1];
    const year = period.key.slice(0, 4);
    return `Semana ${Number(week)} de ${year} · ${formatDay(desde)}–${formatDay(hasta)}`;
  }
  const [y, m] = period.key.split("-");
  return `${capitalize(MESES[Number(m) - 1])} ${y}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return round(n, digits).toLocaleString("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function deltaText(curr, prev, digits, unit) {
  if (curr == null || prev == null) return "sin período anterior comparable";
  const d = curr - prev;
  const pct = prev === 0 ? null : (d / Math.abs(prev)) * 100;
  const sign = d > 0 ? "↑" : d < 0 ? "↓" : "=";
  const pctTxt = pct == null ? "" : ` (${d >= 0 ? "+" : ""}${fmt(pct, 1)} %)`;
  return `${sign} ${d >= 0 ? "+" : ""}${fmt(d, digits)} ${unit}${pctTxt} vs período anterior`;
}

function daysBeyond(rows, variable, thresholds) {
  const spec = variable.threshold;
  if (!spec) return { n: 0, limit: null };
  const limit = thresholds[spec.key];
  const field = variable.key;
  const n = rows.filter((r) => (spec.dir === "below" ? r[field] < limit : r[field] >= limit)).length;
  return { n, limit, dir: spec.dir, label: spec.label };
}

export function buildReport(period, data) {
  const { rows, prevRows, tipo, key } = period;
  const thr = data.meta.thresholds;
  const desde = rows[0].fecha;
  const hasta = rows[rows.length - 1].fecha;
  const variables = {};

  for (const v of VARS) {
    const curr = summarize(rows, v.key);
    const prev = prevRows.length ? summarize(prevRows, v.key) : null;
    const beyond = daysBeyond(rows, v, thr);
    const headline = v.kind === "sum" ? curr.suma : curr.media;
    const headlinePrev = prev ? (v.kind === "sum" ? prev.suma : prev.media) : null;
    variables[v.key] = {
      ...v,
      ...curr,
      umbral: beyond,
      vsAnterior: {
        valor: headlinePrev,
        texto: deltaText(headline, headlinePrev, v.kind === "sum" ? 2 : 1, v.unit),
      },
    };
  }

  const alertas = [];
  if (variables.caudal_m3s.umbral.n) {
    alertas.push(
      `Caudal bajo ${variables.caudal_m3s.umbral.n} de ${rows.length} días (umbral ${thr.caudal_bajo_m3s} m³/s).`
    );
  }
  if (variables.estres.umbral.n) {
    alertas.push(
      `Estrés alto ${variables.estres.umbral.n} de ${rows.length} días (umbral ${thr.estres_alto}).`
    );
  }
  if (variables.demanda_proxy.umbral.n) {
    alertas.push(
      `Demanda alta ${variables.demanda_proxy.umbral.n} de ${rows.length} días (umbral ${thr.demanda_alta}).`
    );
  }

  const resumen = narrative(tipo, periodLabel(period), variables, rows.length, alertas);

  return {
    id: `${tipo}-${key}`,
    tipo,
    periodo: key,
    titulo: periodLabel(period),
    desde,
    hasta,
    nDias: rows.length,
    generado: new Date().toISOString(),
    region: data.meta.region,
    disclaimer: data.meta.disclaimer,
    notaMetodologica:
      "Las observaciones diarias del demo se desagregan de la serie mensual de ejemplo (interpolación + variación acotada, semilla fija). No son lecturas oficiales de Hidráulica ni OSSE. La entrega diaria se reescala para que el mes sume el hm³ publicado en el dataset mensual.",
    resumen,
    alertas,
    variables,
    observaciones: rows,
    fuente: "https://plan-aura.com.ar/ · AURA-HidroIA demo",
  };
}

function narrative(tipo, titulo, variables, nDias, alertas) {
  const caudal = variables.caudal_m3s;
  const estres = variables.estres;
  const entrega = variables.entrega_hm3;
  const cadencia = tipo === "semanal" ? "Esta semana" : "Este mes";
  const alertBit = alertas.length
    ? ` ${alertas[0]}`
    : " Ningún umbral de alerta se superó de forma sostenida.";
  return `${cadencia} (${titulo}) el caudal promedio fue ${fmt(caudal.media, 1)} m³/s (${caudal.vsAnterior.texto}). El estrés medio quedó en ${fmt(estres.media, 0)} / 100 y la entrega acumulada fue ${fmt(entrega.suma, 2)} hm³ en ${nDias} días.${alertBit}`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function varCards(report) {
  return VARS.map((v) => {
    const s = report.variables[v.key];
    const headline = v.kind === "sum" ? fmt(s.suma, 2) : fmt(s.media, v.key === "caudal_m3s" ? 1 : 0);
    const umbral =
      s.umbral && s.umbral.limit != null
        ? `${s.umbral.n}/${s.n} días ${s.umbral.dir === "below" ? "bajo" : "sobre"} umbral ${s.umbral.limit}`
        : `total ${fmt(s.suma, 2)} ${v.unit}`;
    return `<article class="kpi">
      <span class="kpi-label">${esc(v.short)}</span>
      <div class="kpi-value">${headline}</div>
      <div class="kpi-meta">${esc(v.unit)} · media ${fmt(s.media, 1)} · ${esc(umbral)}</div>
    </article>`;
  }).join("");
}

function statsTable(report) {
  const head = `<tr>
    <th>Variable</th><th>n</th><th>Media</th><th>Mediana</th>
    <th>Mín.</th><th>Máx.</th><th>Desvío</th><th>P25–P75</th><th>Vs. anterior</th>
  </tr>`;
  const body = VARS.map((v) => {
    const s = report.variables[v.key];
    const digits = v.key === "entrega_hm3" ? 2 : 1;
    return `<tr>
      <td>${esc(v.label)}<div class="cell-unit">${esc(v.unit)}</div></td>
      <td>${s.n}</td>
      <td>${fmt(s.media, digits)}</td>
      <td>${fmt(s.mediana, digits)}</td>
      <td>${fmt(s.min, digits)}<div class="cell-unit">${esc(formatDay(s.minEn))}</div></td>
      <td>${fmt(s.max, digits)}<div class="cell-unit">${esc(formatDay(s.maxEn))}</div></td>
      <td>${fmt(s.desvio, digits)}</td>
      <td>${fmt(s.p25, digits)} – ${fmt(s.p75, digits)}</td>
      <td>${esc(s.vsAnterior.texto)}</td>
    </tr>`;
  }).join("");
  return `<table class="report-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function alertsHtml(report) {
  if (!report.alertas.length) {
    return `<p class="report-ok">Sin días fuera de umbral en este período.</p>`;
  }
  return `<ul class="report-alerts">${report.alertas.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`;
}

function emittedCard(report) {
  const caudal = report.variables.caudal_m3s;
  const estres = report.variables.estres;
  const entrega = report.variables.entrega_hm3;
  const flag = report.alertas.length
    ? `${report.alertas.length} alerta${report.alertas.length > 1 ? "s" : ""} de umbral`
    : "Sin umbrales superados";
  return `<article class="emitted-card">
    <p class="emitted-kicker">Último reporte ${esc(report.tipo)}</p>
    <h3>${esc(report.titulo)}</h3>
    <ul class="emitted-stats">
      <li><strong>${fmt(caudal.media, 1)}</strong> m³/s caudal medio</li>
      <li><strong>${fmt(estres.media, 0)}</strong> estrés medio</li>
      <li><strong>${fmt(entrega.suma, 2)}</strong> hm³ entrega</li>
    </ul>
    <p class="emitted-flag">${esc(flag)}</p>
    <button type="button" class="report-btn report-btn--primary" data-open-report="${esc(report.tipo)}" data-open-key="${esc(report.periodo)}">Ver reporte completo</button>
  </article>`;
}

function reportArticle(report) {
  return `
    <article class="report-sheet" id="report-sheet" data-report-id="${esc(report.id)}">
      <header class="report-sheet__head">
        <p class="report-kicker">Reporte ${report.tipo} · ${esc(report.region)}</p>
        <h2>${esc(report.titulo)}</h2>
        <p class="report-range">${esc(formatDayLong(report.desde))} — ${esc(formatDayLong(report.hasta))} · ${report.nDias} días</p>
      </header>
      <p class="report-summary">${esc(report.resumen)}</p>
      <div class="kpi-grid report-kpis">${varCards(report)}</div>
      <div class="report-chart-card">
        <h3>Serie diaria del período</h3>
        <div class="chart-wrap"><canvas id="chart-reporte" aria-label="Gráfico del reporte"></canvas></div>
      </div>
      ${statsTable(report)}
      <div class="report-flags">
        <h3>Umbrales y alertas</h3>
        ${alertsHtml(report)}
      </div>
      <p class="report-note">${esc(report.notaMetodologica)}</p>
      <p class="report-cite">Fuente: ${esc(report.fuente)} · emitido ${esc(report.generado.slice(0, 16).replace("T", " "))} UTC</p>
    </article>`;
}

function toCsv(report) {
  const lines = [
    ["reporte", report.id],
    ["tipo", report.tipo],
    ["periodo", report.periodo],
    ["desde", report.desde],
    ["hasta", report.hasta],
    ["n_dias", report.nDias],
    [],
    ["variable", "n", "media", "mediana", "min", "min_en", "max", "max_en", "desvio", "p25", "p75", "suma", "dias_umbral"],
    ...VARS.map((v) => {
      const s = report.variables[v.key];
      return [
        v.key,
        s.n,
        round(s.media, 4),
        round(s.mediana, 4),
        round(s.min, 4),
        s.minEn,
        round(s.max, 4),
        s.maxEn,
        round(s.desvio, 4),
        round(s.p25, 4),
        round(s.p75, 4),
        round(s.suma, 4),
        s.umbral ? s.umbral.n : "",
      ];
    }),
    [],
    ["fecha", "caudal_m3s", "entrega_hm3", "demanda_proxy", "estres"],
    ...report.observaciones.map((r) => [r.fecha, r.caudal_m3s, r.entrega_hm3, r.demanda_proxy, r.estres]),
  ];
  return lines
    .map((row) =>
      row
        .map((cell) => {
          const t = String(cell ?? "");
          return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        })
        .join(";")
    )
    .join("\n");
}

function downloadBlob(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

let reportChart = null;

function drawReportChart(report) {
  const canvas = document.getElementById("chart-reporte");
  if (!canvas || typeof Chart === "undefined") return;
  if (reportChart) {
    reportChart.destroy();
    reportChart = null;
  }
  const labels = report.observaciones.map((r) => formatDay(r.fecha));
  reportChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Caudal (m³/s)",
          data: report.observaciones.map((r) => r.caudal_m3s),
          borderColor: "#1a6fa8",
          backgroundColor: "rgba(43,143,201,0.12)",
          fill: true,
          tension: 0.25,
          pointRadius: report.observaciones.length > 20 ? 0 : 2,
          borderWidth: 2,
          yAxisID: "y",
        },
        {
          label: "Estrés (0–100)",
          data: report.observaciones.map((r) => r.estres),
          borderColor: "#7a1532",
          backgroundColor: "transparent",
          tension: 0.25,
          pointRadius: report.observaciones.length > 20 ? 0 : 2,
          borderWidth: 2,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { family: "Source Sans 3" } } },
      },
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } },
          grid: { display: false },
        },
        y: { title: { display: true, text: "m³/s" }, grid: { color: "rgba(6,74,56,0.08)" } },
        y1: {
          position: "right",
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: "estrés" },
        },
      },
    },
  });
}

export function initReports(root, data) {
  const daily = expandDaily(data.series, data.meta.reportes?.semilla ?? 2026);
  const weekly = periodsFromDaily(daily, "semanal");
  const monthly = periodsFromDaily(daily, "mensual");

  const tipoBtns = root.querySelectorAll("[data-report-tipo]");
  const select = root.querySelector("#report-periodo");
  const mount = root.querySelector("#report-mount");
  const emitStatus = root.querySelector("#report-emit-status");

  let tipo = "mensual";
  let current = null;

  function optionsFor(t) {
    const list = t === "semanal" ? weekly : monthly;
    return list
      .slice()
      .reverse()
      .map((p) => `<option value="${esc(p.key)}">${esc(periodLabel(p))}</option>`)
      .join("");
  }

  function emit(key) {
    const list = tipo === "semanal" ? weekly : monthly;
    const period = list.find((p) => p.key === key) || list[list.length - 1];
    current = buildReport(period, data);
    mount.innerHTML = reportArticle(current);
    drawReportChart(current);
    if (emitStatus) {
      emitStatus.textContent = `Emitido ${current.titulo} (${current.nDias} días).`;
    }
    return current;
  }

  function latestPeriod(list) {
    const minDays = list === weekly ? 7 : 28;
    return pickLatestPeriod(list, minDays);
  }

  function latestKey(list) {
    return latestPeriod(list).key;
  }

  function setTipo(next) {
    tipo = next;
    tipoBtns.forEach((b) => {
      const on = b.getAttribute("data-report-tipo") === tipo;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function open(nextTipo, key) {
    setTipo(nextTipo);
    syncSelect(key);
    const tab = document.querySelector('[data-panel="reportes"]');
    if (tab) tab.click();
  }

  function renderEmitted() {
    const box = document.getElementById("report-emitidos");
    if (!box) return;
    const lastW = buildReport(latestPeriod(weekly), data);
    const lastM = buildReport(latestPeriod(monthly), data);
    box.innerHTML = emittedCard(lastW) + emittedCard(lastM);
    box.querySelectorAll("[data-open-report]").forEach((btn) => {
      btn.addEventListener("click", () => {
        open(btn.getAttribute("data-open-report"), btn.getAttribute("data-open-key"));
      });
    });
  }

  function syncSelect(keepKey) {
    const list = tipo === "semanal" ? weekly : monthly;
    select.innerHTML = optionsFor(tipo);
    const next = list.some((p) => p.key === keepKey) ? keepKey : latestKey(list);
    select.value = next;
    emit(next);
  }

  tipoBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setTipo(btn.getAttribute("data-report-tipo"));
      syncSelect(select.value);
    });
  });

  select.addEventListener("change", () => emit(select.value));

  root.querySelector("#report-download-json").addEventListener("click", () => {
    if (!current) return;
    const payload = { ...current, observaciones: current.observaciones };
    downloadBlob(
      `aura-hidroia-reporte-${current.id}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
  });

  root.querySelector("#report-download-csv").addEventListener("click", () => {
    if (!current) return;
    downloadBlob(`aura-hidroia-reporte-${current.id}.csv`, toCsv(current), "text/csv;charset=utf-8");
  });

  root.querySelector("#report-print").addEventListener("click", () => {
    document.body.classList.add("printing-report");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-report"), 400);
  });

  window.addEventListener("hidroia:reportes", () => {
    if (reportChart) reportChart.resize();
    else if (current) drawReportChart(current);
  });

  syncSelect(latestKey(monthly));
  renderEmitted();

  return {
    daily,
    weekly,
    monthly,
    emit,
    open,
    buildReport,
    latestMonthly: () => buildReport(latestPeriod(monthly), data),
    latestWeekly: () => buildReport(latestPeriod(weekly), data),
  };
}
