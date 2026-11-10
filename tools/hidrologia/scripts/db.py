import sqlite3, datetime as dt, os, csv
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = f"{BASE}/caudales.db"
PRIO = {"DH_base_datos_chart2": 2, "DH_planilla_html": 1, "DH_planilla_pdf": 1}

def connect():
    c = sqlite3.connect(DB)
    c.executescript("""
    CREATE TABLE IF NOT EXISTS caudales_diarios(
      fecha DATE PRIMARY KEY, caudal_m3s REAL, fuente TEXT, descargado_en TIMESTAMP);
    CREATE TABLE IF NOT EXISTS niveles_embalses(
      fecha DATE, embalse TEXT, nivel REAL, unidad TEXT, volumen_hm3 REAL,
      volumen_disponible_hm3 REAL, fuente TEXT, descargado_en TIMESTAMP,
      PRIMARY KEY(fecha, embalse));
    """)
    return c

def prio(fuente):
    return PRIO.get((fuente or "").split(" | ")[0], 0)

def upsert_caudal(c, fecha, valor, fuente, ts):
    """Inserta o reemplaza solo si la fuente tiene prioridad >= a la existente. Devuelve 'nuevo'/'actualizado'/None."""
    if valor is None: return None
    row = c.execute("SELECT caudal_m3s, fuente FROM caudales_diarios WHERE fecha=?", (str(fecha),)).fetchone()
    if row is None:
        c.execute("INSERT INTO caudales_diarios VALUES(?,?,?,?)", (str(fecha), valor, fuente, ts)); return "nuevo"
    if prio(fuente) > prio(row[1]) or (prio(fuente) == prio(row[1]) and row[0] != valor):
        c.execute("UPDATE caudales_diarios SET caudal_m3s=?, fuente=?, descargado_en=? WHERE fecha=?", (valor, fuente, ts, str(fecha)))
        return "actualizado" if row[0] != valor else None
    return None

# Rango físico plausible de cota (m.s.n.m.). Valores fuera de rango son errores de carga en la planilla
# (p.ej. Cuesta del Viento "1,523" el 04/10/2022) y se descartan sin corregir.
RANGO_COTA = {"Ullum": (700, 800), "Punta Negra": (850, 1000), "Los Caracoles": (1000, 1150), "Cuesta del Viento": (1450, 1560)}

def upsert_nivel(c, fecha, embalse, nivel, vol, disp, fuente, ts):
    if nivel is None or nivel == 0: return None
    lo, hi = RANGO_COTA.get(embalse, (-1e9, 1e9))
    if not lo <= nivel <= hi:
        c.execute("DELETE FROM niveles_embalses WHERE fecha=? AND embalse=?", (str(fecha), embalse))
        return None
    row = c.execute("SELECT nivel, volumen_hm3 FROM niveles_embalses WHERE fecha=? AND embalse=?", (str(fecha), embalse)).fetchone()
    c.execute("INSERT OR REPLACE INTO niveles_embalses VALUES(?,?,?,?,?,?,?,?)",
              (str(fecha), embalse, nivel, "m.s.n.m. (cota)", vol, disp, fuente, ts))
    if row is None: return "nuevo"
    return "actualizado" if (row[0], row[1]) != (nivel, vol) else None

def export_csv(c):
    """Copia de trabajo junto a la base. La web publica los CSV de hidrologia/."""
    out = os.path.join(BASE, "export")
    os.makedirs(out, exist_ok=True)
    for t, f in [("caudales_diarios", "caudales_diarios.csv"), ("niveles_embalses", "niveles_embalses.csv")]:
        cur = c.execute(f"SELECT * FROM {t} ORDER BY 1,2")
        with open(os.path.join(out, f), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh); w.writerow([d[0] for d in cur.description]); w.writerows(cur)

def apply_planilla(c, r, fuente_tag, url, ts):
    """r: dict de parsers. El caudal Km101 de la planilla del día D a las 08:00 coincide con el valor que la
    base DH asigna al día D-1, por eso se guarda con fecha D-1 (ver README)."""
    out = []
    f = f"{fuente_tag} | planilla {r['fecha'].strftime('%d/%m/%Y')} 08:00 | {url}"
    st = upsert_caudal(c, r["fecha"] - dt.timedelta(days=1), r["km101"] or None, f, ts)
    if st: out.append(("caudal", r["fecha"] - dt.timedelta(days=1), r["km101"], st))
    for emb, (niv, vol, disp) in r["embalses"].items():
        st = upsert_nivel(c, r["fecha"], emb, niv, vol, disp, f, ts)
        if st: out.append((emb, r["fecha"], niv, st))
    return out
