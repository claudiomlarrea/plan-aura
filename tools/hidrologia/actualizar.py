#!/usr/bin/env python3
"""Actualiza caudales.db con lo último publicado por el Departamento de Hidráulica de San Juan.

Fuentes consultadas (oficiales, DH San Juan):
 1) Planilla diaria "Distribución de Riego" en PDF (08:00 h):
    https://hidraulica.sanjuan.gob.ar/irrigacionver2/planillas_pdf/AAAA-MM-DD.pdf
    -> caudal Río San Juan Km 101 (guardado en fecha D-1, convención de la base DH) y cotas/volúmenes
       de Ullum, Punta Negra, Los Caracoles y Cuesta del Viento (fecha D).
 2) "Base de datos DH" (serie diaria Km 101) por si se actualiza:
    https://hidraulica.sanjuan.gob.ar/datos%20y%20estadisticas/chart2.php?select=1&start=..&end=..
Idempotente: re-ejecutarlo no duplica nada. Uso:  python3 actualizar.py [--dias 30]
"""
import sys, os, argparse, datetime as dt, requests
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
import parsers, db

RAW = f"{db.BASE}/raw"
UA = {"User-Agent": "Mozilla/5.0 (caudales-rio-san-juan; uso personal)"}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dias", type=int, default=30,
        help="cuántos días hacia atrás revisar planillas (default 30)")
    a = ap.parse_args()
    now = dt.datetime.now().isoformat(timespec="seconds")
    c = db.connect(); cambios = []; errores = []
    hoy = dt.date.today()
    os.makedirs(f"{RAW}/planillas_pdf", exist_ok=True); os.makedirs(f"{RAW}/dh_chart2", exist_ok=True)
    # 1) planillas PDF
    for i in range(a.dias, -1, -1):
        d = hoy - dt.timedelta(days=i)
        path = f"{RAW}/planillas_pdf/{d}.pdf"
        if not os.path.exists(path):
            try:
                r = requests.get(parsers.URL_PDF.format(d=d), headers=UA, timeout=60)
            except Exception as e:
                errores.append(f"{d}: {e}"); continue
            if r.status_code != 200 or not r.content.startswith(b"%PDF"):
                continue  # aún no publicada
            open(path, "wb").write(r.content)
            if os.path.exists(path + ".404"): os.remove(path + ".404")
        res = parsers.parse_pdf_planilla(path)
        if res is None: errores.append(f"{d}: PDF sin formato reconocible"); continue
        cambios += db.apply_planilla(c, res, "DH_planilla_pdf", parsers.URL_PDF.format(d=d), now)
    # 2) base de datos DH (año actual y anterior)
    for y in (hoy.year - 1, hoy.year):
        url = parsers.URL_CHART2.format(a=f"{y}-01-01", b=f"{y}-12-31")
        try:
            t = requests.get(url, headers=UA, timeout=90).content.decode("latin-1")
            serie = parsers.parse_chart2(t, y)
        except Exception as e:
            errores.append(f"chart2 {y}: {e}"); continue
        if serie: open(f"{RAW}/dh_chart2/km101_{y}.html", "w", encoding="latin-1").write(t)
        for d, v in serie.items():
            st = db.upsert_caudal(c, d, v, f"DH_base_datos_chart2 | {url}", now)
            if st: cambios.append(("caudal", d, v, st))
    c.commit(); db.export_csv(c)
    if cambios:
        print(f"{len(cambios)} cambios:")
        for k, d, v, st in sorted(cambios, key=lambda x: (str(x[1]), x[0])):
            print(f"  {st:11s} {d}  {k:18s} {v}")
    else:
        print("Sin datos nuevos.")
    u = c.execute("SELECT max(fecha) FROM caudales_diarios").fetchone()[0]
    n = c.execute("SELECT max(fecha) FROM niveles_embalses").fetchone()[0]
    print(f"Último caudal Km101: {u} | última lectura de embalses: {n}")
    for e in errores: print("AVISO:", e, file=sys.stderr)

if __name__ == "__main__":
    main()
