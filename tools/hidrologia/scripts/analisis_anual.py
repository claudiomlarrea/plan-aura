"""Análisis anual (año calendario e hidrológico jul-jun) de caudales Km 101 y cotas de embalses.
Escribe hidrologia/ (JSON y CSV que lee el sitio) y data/hidrologia/tabla_hidrologica.json.
Solo datos reales; años con < 330 días de dato se marcan como incompletos y no entran en tendencias ni medias.
No se interpola: un día sin fila en la base no aparece en las series."""
import sqlite3, json, math, datetime as dt, os
import numpy as np, pandas as pd
from scipy.stats import norm
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(B))
W = os.path.join(REPO, "hidrologia")
os.makedirs(W, exist_ok=True)
os.makedirs(os.path.join(REPO, "data", "hidrologia"), exist_ok=True)
MIN_DIAS = 330
EMB = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"]
FUENTES = [
  {"nombre": "Departamento de Hidráulica de San Juan – Base de datos DH, estación Km 101 (1910–jun 2022)",
   "url": "https://hidraulica.sanjuan.gob.ar/datos%20y%20estadisticas/chart2.php"},
  {"nombre": "Departamento de Hidráulica de San Juan – Planilla diaria 'Distribución de Riego' 08:00 h (dic 2014–hoy)",
   "url": "https://hidraulica.sanjuan.gob.ar/irrigacionver2/irrigacion_consulta.php"}]

def mann_kendall_sen(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float); n = len(y)
    if n < 8: return None
    s = 0
    for k in range(n - 1): s += np.sign(y[k+1:] - y[k]).sum()
    _, cnt = np.unique(y, return_counts=True)
    var = (n*(n-1)*(2*n+5) - sum(t*(t-1)*(2*t+5) for t in cnt)) / 18
    z = (s - np.sign(s)) / math.sqrt(var) if s != 0 else 0.0
    p = 2 * (1 - norm.cdf(abs(z)))
    slopes = [(y[j]-y[i])/(x[j]-x[i]) for i in range(n) for j in range(i+1, n) if x[j] != x[i]]
    sen = float(np.median(slopes)); icpt = float(np.median(y - sen * x))
    return {"n": n, "desde": int(x.min()), "hasta": int(x.max()), "S": int(s), "Z": round(z, 3), "p": round(p, 4),
            "significativa_95": bool(p < 0.05), "pendiente_sen_por_anio": round(sen, 4),
            "pendiente_sen_por_decada": round(sen*10, 3), "intercepto": round(icpt, 3),
            "tendencia": ("creciente" if z > 0 else "decreciente") if p < 0.05 else "sin tendencia significativa"}

def r(v, d=3): return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), d)

def stats_caudal(s, key, ultimo_ref=2022):
    rows = []
    for k, g in s.groupby(key):
        g = g.dropna()
        if g.empty: continue
        rows.append({"anio": k, "dias_con_dato": int(len(g)), "completo": bool(len(g) >= MIN_DIAS),
                     "media_m3s": r(g.mean()), "max_m3s": r(g.max()), "fecha_max": str(g.idxmax().date()),
                     "min_m3s": r(g.min()), "fecha_min": str(g.idxmin().date()),
                     "derrame_hm3": r(g.sum()*86400/1e6, 1)})
    df = pd.DataFrame(rows)
    ref = df[df.completo & (df.anio.map(lambda a: int(str(a)[:4])) <= ultimo_ref)]
    media_ref = ref.media_m3s.mean(); der_ref = ref.derrame_hm3.mean()
    df["anomalia_media_pct"] = ((df.media_m3s/media_ref - 1)*100).round(1)
    df.loc[~df.completo, "anomalia_media_pct"] = None
    return df, {"media_m3s": r(media_ref), "derrame_hm3": r(der_ref, 1), "anios": int(len(ref)),
                "periodo": f"{ref.anio.min()}–{ref.anio.max()}"}

def tendencias(df, col, label_year):
    c = df[df.completo].copy(); c["x"] = c.anio.map(label_year)
    out = {}
    for nombre, desde in [("periodo_completo", None), ("desde_1971", 1971), ("desde_1991", 1991), ("desde_2001", 2001)]:
        cc = c if desde is None else c[c.x >= desde]
        res = mann_kendall_sen(cc.x, cc[col]) if len(cc) else None
        if res: out[nombre] = res
    return out

def write_csv(df, name):
    path = os.path.join(W, name)
    with open(path, "w", encoding="utf-8-sig", newline="") as fh:
        df.to_csv(fh, index=False, sep=";", decimal=",")

def write_tabla(q, e, generado):
    """Últimos 21 días calendario, misma forma que data/hidrologia/tabla_hidrologica.json."""
    fin = max(q.fecha.max(), e.fecha.max())
    dias = list(pd.date_range(fin - pd.Timedelta(days=20), fin))
    caud = q.drop_duplicates("fecha").set_index("fecha").caudal_m3s
    niv = e.pivot_table(index="fecha", columns="embalse", values="nivel")
    embalses = ["Punta Negra", "Ullum", "Los Caracoles", "Cuesta del Viento"]
    filas = []
    for d in reversed(dias):
        row = {"fecha": d.strftime("%Y-%m-%d")}
        if d in caud.index and pd.notna(caud.at[d]):
            row["caudal_km101_m3s"] = round(float(caud.at[d]), 3)
        for emb in embalses:
            if emb in niv.columns and d in niv.index and pd.notna(niv.at[d, emb]):
                row[emb] = round(float(niv.at[d, emb]), 2)
        filas.append(row)
    doc = {
        "fuente": "Departamento de Hidráulica de San Juan (planilla diaria Distribución de Riego, hidraulica.sanjuan.gob.ar)",
        "fuente_url": "https://hidraulica.sanjuan.gob.ar/",
        "unidades": {"caudal": "m3/s", "cotas": "m.s.n.m."},
        "generado": generado,
        "filas": filas,
    }
    dest = os.path.join(REPO, "data", "hidrologia", "tabla_hidrologica.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

def main():
    con = sqlite3.connect(os.path.join(B, "caudales.db"))
    q = pd.read_sql("SELECT fecha, caudal_m3s, fuente FROM caudales_diarios ORDER BY fecha", con, parse_dates=["fecha"])
    e = pd.read_sql("SELECT * FROM niveles_embalses ORDER BY fecha", con, parse_dates=["fecha"])
    s = q.set_index("fecha").caudal_m3s
    hy = lambda d: f"{d.year}-{str(d.year+1)[2:]}" if d.month >= 7 else f"{d.year-1}-{str(d.year)[2:]}"
    cal, ref_cal = stats_caudal(s, s.index.year)
    hid, ref_hid = stats_caudal(s, s.index.map(hy), 2021)
    ly = lambda a: int(str(a)[:4])
    hasta = str(max(s.index.max(), e.fecha.max()).date()) if len(e) else str(s.index.max().date())
    out = {"generado": hasta, "zona_horaria": "America/Argentina/San_Juan",
           "criterio_completo": f">= {MIN_DIAS} días con dato", "fuentes": FUENTES,
           "caudal_km101": {"unidad": "m³/s",
              "referencia_1910_2022": {"calendario": ref_cal, "hidrologico": ref_hid},
              "anio_calendario": json.loads(cal.to_json(orient="records")),
              "anio_hidrologico": json.loads(hid.to_json(orient="records")),
              "tendencias": {
                 "media_anual_calendario": tendencias(cal, "media_m3s", ly),
                 "media_anual_hidrologico": tendencias(hid, "media_m3s", ly),
                 "derrame_hidrologico_hm3": tendencias(hid, "derrame_hm3", ly),
                 "max_anual_calendario": tendencias(cal, "max_m3s", ly),
                 "min_anual_calendario": tendencias(cal, "min_m3s", ly)}},
           "embalses": {}}
    c_ok = cal[cal.completo]; h_ok = hid[hid.completo]
    def fila(df, i, cols): return {k: (int(df.loc[i, k]) if k == "anio" and not isinstance(df.loc[i, k], str) else df.loc[i, k]) for k in cols}
    out["caudal_km101"]["destacados"] = {
        "record_max_diario": {"m3s": r(s.max()), "fecha": str(s.idxmax().date())},
        "record_min_diario": {"m3s": r(s.min()), "fecha": str(s.idxmin().date())},
        "anio_hidrologico_mas_caudaloso": fila(h_ok, h_ok.media_m3s.idxmax(), ["anio", "media_m3s", "derrame_hm3"]),
        "anio_hidrologico_mas_seco": fila(h_ok, h_ok.media_m3s.idxmin(), ["anio", "media_m3s", "derrame_hm3"]),
        "anio_calendario_mas_caudaloso": fila(c_ok, c_ok.media_m3s.idxmax(), ["anio", "media_m3s"]),
        "anio_calendario_mas_seco": fila(c_ok, c_ok.media_m3s.idxmin(), ["anio", "media_m3s"]),
        "registros_diarios": int(s.notna().sum()), "desde": str(s.index.min().date()), "hasta": str(s.index.max().date())}
    filas_emb = []
    for emb in EMB:
        g = e[e.embalse == emb].set_index("fecha").nivel
        if g.empty: continue
        res = {"unidad": "m.s.n.m.", "registros": int(len(g)), "desde": str(g.index.min().date()), "hasta": str(g.index.max().date())}
        for nombre, key in [("anio_calendario", g.index.year), ("anio_hidrologico", g.index.map(hy))]:
            rows = []
            for k, gg in g.groupby(key):
                rows.append({"anio": k, "dias_con_dato": int(len(gg)), "completo": bool(len(gg) >= MIN_DIAS),
                             "media_msnm": r(gg.mean(), 2), "max_msnm": r(gg.max(), 2), "fecha_max": str(gg.idxmax().date()),
                             "min_msnm": r(gg.min(), 2), "fecha_min": str(gg.idxmin().date())})
            df = pd.DataFrame(rows); res[nombre] = rows
            for rr in rows: filas_emb.append({"embalse": emb, "tipo_anio": nombre, **rr})
            res[f"tendencia_{nombre}"] = tendencias(df, "media_msnm", ly).get("periodo_completo") if len(df) else None
        out["embalses"][emb] = res
    json.dump(out, open(os.path.join(W, "datos_anuales.json"), "w"), ensure_ascii=False, indent=1, default=str)
    write_csv(cal, "caudal_anual_calendario.csv")
    write_csv(hid, "caudal_anual_hidrologico.csv")
    write_csv(pd.DataFrame(filas_emb), "embalses_anual.csv")
    # últimos valores
    lq = q.dropna().iloc[-1]; le = e.fecha.max()
    ult = {"generado": out["generado"], "caudal_km101": {"fecha": str(lq.fecha.date()), "m3s": r(lq.caudal_m3s),
           "fuente": lq.fuente.split(" | ")[0]},
           "embalses": {row.embalse: {"fecha": str(row.fecha.date()), "cota_msnm": r(row.nivel, 2), "volumen_hm3": r(row.volumen_hm3, 2),
                        "volumen_disponible_hm3": r(row.volumen_disponible_hm3, 2)} for row in e[e.fecha == le].itertuples()},
           "fuentes": FUENTES}
    # media histórica del mismo día del año
    md = s[(s.index.month == lq.fecha.month) & (s.index.day == lq.fecha.day)]
    ult["caudal_km101"]["media_historica_misma_fecha_m3s"] = r(md.mean()); ult["caudal_km101"]["n_anios_misma_fecha"] = int(md.count())
    json.dump(ult, open(os.path.join(W, "ultimos_valores.json"), "w"), ensure_ascii=False, indent=1)
    # serie diaria reciente (400 días)
    fin = max(s.index.max(), e.fecha.max()); ini = fin - pd.Timedelta(days=400)
    idx = pd.date_range(ini, fin)
    niv = e.pivot_table(index="fecha", columns="embalse", values="nivel").reindex(idx)
    rec = pd.DataFrame({"fecha": idx.strftime("%Y-%m-%d"), "caudal_m3s": s.reindex(idx).values})
    for k in EMB:
        rec[k] = niv[k].values if k in niv else None
    rec = rec.astype(object).where(rec.notna(), None)
    json.dump({"generado": out["generado"], "columnas": list(rec.columns), "datos": rec.values.tolist()},
              open(os.path.join(W, "serie_diaria_reciente.json"), "w"), ensure_ascii=False)
    write_csv(rec, "serie_diaria_reciente.csv")
    # Acumulado del año hidrológico (día 0 = 1 de julio). Solo días con dato publicado.
    dd = pd.DataFrame({"hm3": s.dropna() * 86400 / 1e6}).sort_index()
    dd["ah"] = dd.index.map(hy)
    dd["dia"] = [(d - pd.Timestamp(int(a[:4]), 7, 1)).days for d, a in zip(dd.index, dd.ah)]
    dd["acum"] = dd.groupby("ah").hm3.cumsum()
    comp = set(hid[hid.completo].anio)
    # La media de referencia usa solo años completos del período 1910–2022 (ya filtrados en ref_hid).
    ref_anios = set(hid[hid.completo & (hid.anio.map(lambda a: int(str(a)[:4])) <= 2021)].anio)
    m = dd[dd.ah.isin(ref_anios)].groupby("dia").acum.mean().sort_index()
    actual = hy(fin)
    mx = h_ok.loc[h_ok.derrame_hm3.idxmax(), "anio"]
    mn = h_ok.loc[h_ok.derrame_hm3.idxmin(), "anio"]
    anios = []
    for a, g in dd.groupby("ah"):
        g = g.sort_values("dia")
        item = {
            "anio": a,
            "completo": a in comp,
            "dias": int(len(g)),
            "en_media_1910_2022": a in ref_anios,
            "inicio": str(g.index.min().date()),
            "fin": str(g.index.max().date()),
            "curva": [[int(x), r(y, 1)] for x, y in zip(g.dia, g.acum)],
        }
        if a == "1909-10":
            item["nota"] = (
                "Año hidrológico parcial. La serie oficial del Departamento de Hidráulica "
                "empieza el 1910-01-01: no hay dato publicado de julio a diciembre de 1909 "
                "y no se completa ni se interpola. Queda fuera de la media y de las tendencias."
            )
        elif a not in comp:
            item["nota"] = (
                f"Año incompleto ({int(len(g))} días con dato, umbral {MIN_DIAS}). "
                "No entra en la media ni en las tendencias."
            )
        anios.append(item)
    anios.sort(key=lambda it: it["anio"])
    json.dump({
        "generado": out["generado"],
        "anio_actual": actual,
        "anio_max": mx,
        "anio_min": mn,
        "periodo_media": ref_hid["periodo"],
        "criterio_completo": f">= {MIN_DIAS} días con dato",
        "media_completos": [[int(x), r(y, 1)] for x, y in m.items()],
        "n_completos": int(len(ref_anios)),
        "anios": anios,
    }, open(os.path.join(W, "acumulado.json"), "w"), ensure_ascii=False)
    qq = q.copy()
    qq["fuente"] = qq.fuente.str.split(r" \| ").str[0]
    qq["fecha"] = qq.fecha.dt.strftime("%Y-%m-%d")
    write_csv(qq, "caudales_diarios.csv")
    ee = e[["fecha", "embalse", "nivel", "volumen_hm3", "volumen_disponible_hm3", "fuente"]].copy()
    ee["fuente"] = ee.fuente.str.split(r" \| ").str[0]
    ee["fecha"] = ee.fecha.dt.strftime("%Y-%m-%d")
    write_csv(ee.rename(columns={"nivel": "cota_msnm"}), "niveles_embalses.csv")
    write_tabla(q, e, hasta)
    json.dump({
        "generado": hasta,
        "caudal_hasta": str(q.dropna(subset=["caudal_m3s"]).fecha.max().date()),
        "embalses_hasta": str(e.fecha.max().date()) if len(e) else None,
        "registros_caudal": int(q.caudal_m3s.notna().sum()),
        "anio_hidrologico_inicial": anios[0]["anio"] if anios else None,
    }, open(os.path.join(W, "manifest.json"), "w"), ensure_ascii=False, indent=2)
    print("hidrologia/ OK:", ult["caudal_km101"], "| embalses", le.date(), "| años", len(anios))

if __name__ == "__main__":
    main()
