import { renderKpis, renderCharts } from "./charts.js";
import { computeAlerts, renderAlerts } from "./alerts.js";
import { initAssistant } from "./assistant.js";
import { initReports } from "./reports.js";

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.json();
}

function setupTabs() {
  const buttons = document.querySelectorAll(".nav-tabs button");
  const panels = {
    tablero: document.getElementById("panel-tablero"),
    alertas: document.getElementById("panel-alertas"),
    reportes: document.getElementById("panel-reportes"),
    asistente: document.getElementById("panel-asistente"),
  };

  function showPanel(id) {
    const btn = document.querySelector('.nav-tabs [data-panel="' + id + '"]');
    buttons.forEach((b) => b.classList.toggle("active", b === btn));
    Object.entries(panels).forEach(([key, el]) => {
      el.classList.toggle("active", key === id);
    });
    if (id === "reportes") {
      window.dispatchEvent(new Event("hidroia:reportes"));
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => showPanel(btn.dataset.panel));
  });

  document.addEventListener("click", (ev) => {
    const jump = ev.target.closest("[data-panel]");
    if (!jump || jump.closest(".nav-tabs")) return;
    if (!panels[jump.dataset.panel]) return;
    ev.preventDefault();
    showPanel(jump.dataset.panel);
  });
}

function waitForChart(maxMs = 4000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tick() {
      if (typeof Chart !== "undefined") return resolve();
      if (Date.now() - start > maxMs) return reject(new Error("Chart.js timeout"));
      requestAnimationFrame(tick);
    })();
  });
}

async function main() {
  setupTabs();

  const [seriesData, kb] = await Promise.all([
    loadJson("data/sample_series.json"),
    loadJson("data/assistant_kb.json"),
  ]);

  renderKpis(document.getElementById("kpi-grid"), seriesData);

  try {
    await waitForChart();
    renderCharts(seriesData);
  } catch (err) {
    console.warn(err);
    document.querySelector(".charts").insertAdjacentHTML(
      "beforeend",
      `<p style="color:#9b2c2c">No se pudieron cargar los gráficos (Chart.js). El resto del demo sigue disponible.</p>`
    );
  }

  const alerts = computeAlerts(seriesData);
  renderAlerts(document.getElementById("alert-list"), alerts);
  initReports(document.getElementById("panel-reportes"), seriesData);
  initAssistant(document.getElementById("panel-asistente"), kb);
}

main().catch((err) => {
  console.error(err);
  document.querySelector("main").insertAdjacentHTML(
    "afterbegin",
    `<p style="background:#fff;padding:1rem;border-radius:8px;color:#9b2c2c">Error al iniciar el demo: ${err.message}. Abrí el sitio con un servidor estático (no como file://).</p>`
  );
});
