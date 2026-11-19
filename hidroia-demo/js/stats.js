/** Estadísticas y desagregación diaria (demo, semilla fija). */

export const VARS = [
  {
    key: "caudal_m3s",
    label: "Caudal (proxy Hidráulica)",
    short: "Caudal",
    unit: "m³/s",
    kind: "mean",
    threshold: { key: "caudal_bajo_m3s", dir: "below", label: "caudal bajo" },
  },
  {
    key: "entrega_hm3",
    label: "Entrega urbana (proxy)",
    short: "Entrega",
    unit: "hm³",
    kind: "sum",
    threshold: null,
  },
  {
    key: "demanda_proxy",
    label: "Demanda proxy",
    short: "Demanda",
    unit: "índice 0–100",
    kind: "mean",
    threshold: { key: "demanda_alta", dir: "above", label: "demanda alta" },
  },
  {
    key: "estres",
    label: "Estrés hídrico urbano",
    short: "Estrés",
    unit: "índice 0–100",
    kind: "mean",
    threshold: { key: "estres_alto", dir: "above", label: "estrés alto" },
  },
];

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function round(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function mean(values) {
  if (!values.length) return null;
  return values.reduce((s, x) => s + x, 0) / values.length;
}

export function median(values) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(values, q) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function stdev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const acc = values.reduce((s, x) => s + (x - m) ** 2, 0);
  return Math.sqrt(acc / (values.length - 1));
}

export function summarize(rows, key) {
  const pairs = rows
    .map((r) => ({ value: Number(r[key]), at: r.fecha }))
    .filter((p) => Number.isFinite(p.value));
  const values = pairs.map((p) => p.value);
  if (!values.length) {
    return { n: 0, media: null, mediana: null, min: null, max: null };
  }
  const minPair = pairs.reduce((a, b) => (b.value < a.value ? b : a));
  const maxPair = pairs.reduce((a, b) => (b.value > a.value ? b : a));
  const m = mean(values);
  const sd = stdev(values);
  return {
    n: values.length,
    media: m,
    mediana: median(values),
    min: minPair.value,
    minEn: minPair.at,
    max: maxPair.value,
    maxEn: maxPair.at,
    desvio: sd,
    cv: m === 0 ? null : sd / Math.abs(m),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    suma: values.reduce((s, x) => s + x, 0),
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Desagrega la serie mensual a días con interpolación + ruido acotado.
 * La suma de entrega del mes coincide con el valor mensual del dataset.
 */
export function expandDaily(series, seed = 2026) {
  const rand = mulberry32(seed);
  const daily = [];

  for (let i = 0; i < series.length; i++) {
    const row = series[i];
    const next = series[i + 1] || row;
    const [y, m] = row.mes.split("-").map(Number);
    const nDays = daysInMonth(y, m);
    const chunk = [];
    let entregaAcc = 0;

    for (let d = 1; d <= nDays; d++) {
      const t = (d - 1) / Math.max(1, nDays - 1);
      const lerp = (a, b) => a + (b - a) * t;
      const noise = (scale) => (rand() - 0.5) * 2 * scale;
      const caudal = Math.max(8, lerp(row.caudal_m3s, next.caudal_m3s) + noise(1.15));
      const demanda = clamp(lerp(row.demanda_proxy, next.demanda_proxy) + noise(2.8), 0, 100);
      const estres = clamp(lerp(row.estres, next.estres) + noise(3.2), 0, 100);
      const entrega = Math.max(0.02, (row.entrega_hm3 / nDays) * (1 + noise(0.07)));
      entregaAcc += entrega;
      chunk.push({
        fecha: `${row.mes}-${String(d).padStart(2, "0")}`,
        mes: row.mes,
        caudal_m3s: round(caudal, 2),
        entrega_hm3: entrega,
        demanda_proxy: round(demanda, 1),
        estres: round(estres, 1),
      });
    }

    const factor = entregaAcc > 0 ? row.entrega_hm3 / entregaAcc : 1;
    chunk.forEach((r) => {
      r.entrega_hm3 = round(r.entrega_hm3 * factor, 4);
    });
    daily.push(...chunk);
  }

  return daily;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Clave ISO week YYYY-Www (UTC). */
export function isoWeekKey(isoDate) {
  const date = parseISODate(isoDate);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

export function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

export function periodsFromDaily(daily, tipo) {
  const keyFn = tipo === "semanal" ? (r) => isoWeekKey(r.fecha) : (r) => monthKey(r.fecha);
  const grouped = groupBy(daily, keyFn);
  const keys = [...grouped.keys()].sort();
  return keys.map((key, i) => ({
    key,
    tipo,
    rows: grouped.get(key),
    prevKey: i > 0 ? keys[i - 1] : null,
    prevRows: i > 0 ? grouped.get(keys[i - 1]) : [],
  }));
}

/** Último período con al menos minDays observaciones (evita semanas ISO recortadas). */
export function pickLatestPeriod(list, minDays) {
  if (!list.length) return null;
  return [...list].reverse().find((p) => p.rows.length >= minDays) || list[list.length - 1];
}
