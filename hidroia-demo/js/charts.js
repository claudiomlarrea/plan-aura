/** Render KPI cards and Chart.js series for the demo dashboard. */

function formatMes(iso) {
  const [y, m] = iso.split("-");
  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${labels[Number(m) - 1]} ${y.slice(2)}`;
}

function latest(series) {
  return series[series.length - 1];
}

function avg(series, key, n = 3) {
  const slice = series.slice(-n);
  return slice.reduce((s, row) => s + row[key], 0) / slice.length;
}

export function renderKpis(container, data) {
  const row = latest(data.series);
  const prev = data.series[data.series.length - 2];
  const estresDelta = row.estres - prev.estres;
  const caudalDelta = row.caudal_m3s - prev.caudal_m3s;

  const cards = [
    {
      label: "Caudal (proxy Hidráulica)",
      value: row.caudal_m3s.toFixed(1),
      meta: `${data.meta.units.caudal_m3s} · ${formatMes(row.mes)} · Δ ${caudalDelta >= 0 ? "+" : ""}${caudalDelta.toFixed(1)}`,
    },
    {
      label: "Entrega urbana (proxy)",
      value: row.entrega_hm3.toFixed(1),
      meta: `${data.meta.units.entrega_hm3} · promedio 3 meses ${avg(data.series, "entrega_hm3").toFixed(1)}`,
    },
    {
      label: "Demanda proxy",
      value: String(row.demanda_proxy),
      meta: `${data.meta.units.demanda_proxy} · estacionalidad urbana`,
    },
    {
      label: "Estrés hídrico",
      value: String(row.estres),
      meta: `${data.meta.units.estres} · Δ ${estresDelta >= 0 ? "+" : ""}${estresDelta}`,
    },
  ];

  container.innerHTML = cards
    .map(
      (c) => `
      <article class="kpi">
        <span class="kpi-label">${c.label}</span>
        <div class="kpi-value">${c.value}</div>
        <div class="kpi-meta">${c.meta}</div>
      </article>`
    )
    .join("");
}

export function renderCharts(data) {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js no disponible");
    return;
  }

  const labels = data.series.map((r) => formatMes(r.mes));
  const thr = data.meta.thresholds;

  const commonOpts = {
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
      y: { grid: { color: "rgba(6,74,56,0.08)" } },
    },
  };

  const ofertaCtx = document.getElementById("chart-oferta");
  const estresCtx = document.getElementById("chart-estres");

  new Chart(ofertaCtx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Caudal (m³/s)",
          data: data.series.map((r) => r.caudal_m3s),
          borderColor: "#1a6fa8",
          backgroundColor: "rgba(43,143,201,0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: "Entrega (hm³)",
          data: data.series.map((r) => r.entrega_hm3),
          borderColor: "#0a5c5e",
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      ...commonOpts,
      scales: {
        ...commonOpts.scales,
        y: { ...commonOpts.scales.y, title: { display: true, text: "m³/s" } },
        y1: {
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "hm³" },
        },
      },
    },
  });

  new Chart(estresCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Estrés (0–100)",
          data: data.series.map((r) => r.estres),
          backgroundColor: data.series.map((r) =>
            r.estres >= thr.estres_alto ? "rgba(155,44,44,0.75)" : "rgba(43,143,201,0.55)"
          ),
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        annotation: undefined,
      },
      scales: {
        ...commonOpts.scales,
        y: {
          ...commonOpts.scales.y,
          min: 0,
          max: 100,
          suggestedMax: 100,
        },
      },
    },
  });
}
