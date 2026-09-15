/** Threshold-based alerts from demo series. */

function formatMes(iso) {
  const [y, m] = iso.split("-");
  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${labels[Number(m) - 1]} ${y}`;
}

export function computeAlerts(data) {
  const { caudal_bajo_m3s, estres_alto, demanda_alta } = data.meta.thresholds;
  const alerts = [];

  for (const row of data.series) {
    if (row.caudal_m3s < caudal_bajo_m3s) {
      alerts.push({
        id: `caudal-${row.mes}`,
        severity: row.caudal_m3s < 16 ? "high" : "mid",
        title: "Oferta baja (caudal)",
        body: `El caudal proxy cayó a ${row.caudal_m3s.toFixed(1)} m³/s (umbral demo: ${caudal_bajo_m3s} m³/s). Conviene revisar entrega y comunicación de uso responsable.`,
        when: formatMes(row.mes),
        source: `serie:caudal_m3s · ${row.mes}`,
      });
    }
    if (row.estres >= estres_alto) {
      alerts.push({
        id: `estres-${row.mes}`,
        severity: row.estres >= 80 ? "high" : "mid",
        title: "Estrés hídrico elevado",
        body: `Índice de estrés ${row.estres}/100 (umbral: ${estres_alto}). Desacople oferta–demanda más tenso en ${formatMes(row.mes)}.`,
        when: formatMes(row.mes),
        source: `serie:estres · ${row.mes}`,
      });
    }
    if (row.demanda_proxy >= demanda_alta && row.caudal_m3s < 30) {
      alerts.push({
        id: `demanda-${row.mes}`,
        severity: "low",
        title: "Demanda alta con oferta moderada",
        body: `Demanda proxy ${row.demanda_proxy} con caudal ${row.caudal_m3s.toFixed(1)} m³/s. Útil para sensibilización estacional.`,
        when: formatMes(row.mes),
        source: `serie:demanda_proxy · ${row.mes}`,
      });
    }
  }

  // Prefer recent + unique by title+when, keep last 8 for the demo UI
  const seen = new Set();
  const unique = [];
  for (let i = alerts.length - 1; i >= 0; i--) {
    const a = alerts[i];
    const key = `${a.title}|${a.when}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(a);
    if (unique.length >= 8) break;
  }
  return unique;
}

export function renderAlerts(container, alerts) {
  if (!alerts.length) {
    container.innerHTML = `<p class="alert-item low">No hay alertas en el período demo.</p>`;
    return;
  }

  const severityLabel = { high: "Alta", mid: "Media", low: "Baja" };

  container.innerHTML = alerts
    .map(
      (a, i) => `
      <article class="alert-item ${a.severity}" style="animation-delay:${i * 0.05}s">
        <h3>
          <span class="badge ${a.severity}">${severityLabel[a.severity]}</span>
          ${a.title}
        </h3>
        <p>${a.body}</p>
        <div class="alert-meta">${a.when} · ${a.source}</div>
      </article>`
    )
    .join("");
}
