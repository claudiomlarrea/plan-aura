import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expandDaily, mean, median, periodsFromDaily, summarize } from "./stats.js";
import { buildReport } from "./reports.js";

const root = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(root, "../data/sample_series.json"), "utf8"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function approx(a, b, eps, msg) {
  assert(Math.abs(a - b) <= eps, `${msg} (got ${a}, expected ${b} ± ${eps})`);
}

assert(mean([1, 2, 3]) === 2, "media [1,2,3]");
assert(median([1, 2, 3, 4]) === 2.5, "mediana par");

const daily = expandDaily(data.series, data.meta.reportes.semilla);
assert(daily.length === 366 + 365, `días 2024–2025 (got ${daily.length})`);

for (const month of data.series) {
  const rows = daily.filter((r) => r.mes === month.mes);
  const entrega = rows.reduce((s, r) => s + r.entrega_hm3, 0);
  approx(entrega, month.entrega_hm3, 0.02, `entrega ${month.mes} debe coincidir con el mes`);
}

const monthly = periodsFromDaily(daily, "mensual");
const weekly = periodsFromDaily(daily, "semanal");
assert(monthly.length === 24, `24 reportes mensuales (got ${monthly.length})`);
assert(weekly.length >= 100, `al menos 100 semanas ISO (got ${weekly.length})`);

const dic = monthly.find((p) => p.key === "2025-12");
assert(dic && dic.rows.length === 31, "diciembre 2025 tiene 31 días");
const mensual = buildReport(dic, data);
assert(mensual.variables.caudal_m3s.n === 31, "n caudal diciembre");
assert(mensual.variables.entrega_hm3.suma > 0, "suma entrega");
assert(mensual.resumen.includes("caudal promedio"), "narrativa de promedio");
assert(mensual.fuente.includes("plan-aura.com.ar"), "cita el portal");

const ago = monthly.find((p) => p.key === "2025-08");
const agoRep = buildReport(ago, data);
assert(agoRep.alertas.length >= 1, "agosto 2025 debe emitir alerta de umbral");
assert(agoRep.variables.estres.umbral.n > 0, "días de estrés alto en agosto");

const lastWeek = weekly[weekly.length - 1];
const semanal = buildReport(lastWeek, data);
assert(semanal.tipo === "semanal", "tipo semanal");
assert(semanal.nDias >= 1 && semanal.nDias <= 7, "semana de 1–7 días");
assert(semanal.variables.caudal_m3s.media != null, "media semanal");

const firstMonth = buildReport(monthly[0], data);
assert(
  firstMonth.variables.caudal_m3s.vsAnterior.texto.includes("sin período anterior"),
  "el primer mes no inventa una comparación"
);

const s = summarize(dic.rows, "caudal_m3s");
assert(s.min <= s.p25 && s.p25 <= s.mediana && s.mediana <= s.p75 && s.p75 <= s.max, "orden de cuantiles");

console.log(
  `ok · ${daily.length} días · ${weekly.length} reportes semanales · ${monthly.length} mensuales`
);
