#!/usr/bin/env python3
"""Actualiza caudales.db con lo último publicado por el Departamento de Hidráulica de San Juan.

Fuentes consultadas (oficiales, DH San Juan):
 1) Planilla diaria "Distribución de Riego" en PDF (08:00 h):
    https://hidraulica.sanjuan.gob.ar/irrigacionver2/planillas_pdf/AAAA-MM-DD.pdf
    Si esa URL no es un PDF, se consulta irrigacion_2025_fecha.php: la ficha oficial
    embebe el archivo vigente (el nombre puede cambiar; el listado del directorio no es público).
    -> caudal Río San Juan Km 101 (guardado en fecha D-1, convención de la base DH) y cotas/volúmenes
       de Ullum, Punta Negra, Los Caracoles y Cuesta del Viento (fecha D).
 2) "Base de datos DH" (serie diaria Km 101) por si se actualiza:
    https://hidraulica.sanjuan.gob.ar/datos%20y%20estadisticas/chart2.php?select=1&start=..&end=..
Idempotente: re-ejecutarlo no duplica nada. No interpola días en blanco.
Uso:  python3 actualizar.py [--dias 30]

Código de salida 1 si la fuente contestó y ninguna planilla del período se pudo leer,
o si un cuerpo bajado no es un PDF legible con fecha y al menos una medición.
Un 404 (y la consulta oficial que vuelve al buscador) es «aún no publicada».
"""
import sys, os, re, argparse, datetime as dt, requests
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
import parsers, db

RAW = f"{db.BASE}/raw"
BASE = "https://hidraulica.sanjuan.gob.ar/irrigacionver2"
UA = {"User-Agent": "Mozilla/5.0 (caudales-rio-san-juan; uso personal)"}

def es_pdf(content):
    return bool(content) and content.lstrip().startswith(b"%PDF")

def fecha_sj():
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("America/Argentina/San_Juan")).date()
    except Exception:
        return dt.date.today()

def pdf_desde_consulta(session, d):
    """La carga oficial (POST fecha) embebe planillas_pdf/<archivo>.pdf.
    Devuelve ('pdf', bytes, url), ('ausente',) si el buscador dice que no está,
    o ('error', detalle) si la ficha no se pudo leer."""
    try:
        r = session.post(f"{BASE}/irrigacion_2025_fecha.php", data={"fecha": d.isoformat()},
                         timeout=60, allow_redirects=False)
    except Exception as e:
        return ("error", f"consulta: {e}")
    loc = r.headers.get("Location") or ""
    if "irrigacion_2025_mostrar.php" not in loc:
        if r.status_code in (301, 302, 303, 307, 308) or r.status_code == 404:
            return ("ausente",)
        return ("error", f"consulta HTTP {r.status_code} location={loc or '-'}")
    try:
        page = session.get(f"{BASE}/irrigacion_2025_mostrar.php", timeout=60)
        page.raise_for_status()
    except Exception as e:
        return ("error", f"mostrar: {e}")
    m = re.search(r'(?:src|href)="([^"]*planillas_pdf/[^"]+\.pdf)"', page.text, re.I)
    if not m:
        return ("error", "la ficha no embebe un PDF de planillas_pdf")
    src = m.group(1)
    url = src if src.startswith("http") else f"{BASE}/{src.lstrip('/')}"
    try:
        pdf = session.get(url, timeout=60)
    except Exception as e:
        return ("error", f"embed: {e}")
    if es_pdf(pdf.content):
        return ("pdf", pdf.content, url)
    return ("error", f"embed HTTP {pdf.status_code} sin PDF ({url})")

def bajar_planilla(session, d):
    """Devuelve un dict estado: pdf | ausente | no-pdf | error, con url y body si hay PDF."""
    url = parsers.URL_PDF.format(d=d)
    try:
        r = session.get(url, timeout=60)
    except Exception as e:
        alt = pdf_desde_consulta(session, d)
        if alt[0] == "pdf":
            return {"dia": d, "estado": "pdf", "url": alt[2], "body": alt[1], "http": 200, "via": "consulta"}
        if alt[0] == "ausente":
            return {"dia": d, "estado": "error", "url": url, "detalle": str(e)}
        return {"dia": d, "estado": "error", "url": url, "detalle": f"{e}; {alt[1]}"}
    if es_pdf(r.content):
        return {"dia": d, "estado": "pdf", "url": str(r.url), "body": r.content, "http": r.status_code}
    alt = pdf_desde_consulta(session, d)
    if alt[0] == "pdf":
        return {"dia": d, "estado": "pdf", "url": alt[2], "body": alt[1], "http": 200, "via": "consulta"}
    if r.status_code == 404 and alt[0] == "ausente":
        return {"dia": d, "estado": "ausente", "url": url, "http": 404}
    if alt[0] == "error":
        return {"dia": d, "estado": "error", "url": url, "detalle": alt[1]}
    ctype = r.headers.get("content-type", "")
    return {"dia": d, "estado": "no-pdf", "url": url, "http": r.status_code,
            "detalle": f"{ctype} {len(r.content)} bytes"}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dias", type=int, default=30,
        help="cuántos días hacia atrás revisar planillas (default 30)")
    a = ap.parse_args()
    now = dt.datetime.now().isoformat(timespec="seconds")
    c = db.connect(); cambios = []; errores = []
    hoy = fecha_sj()
    os.makedirs(f"{RAW}/planillas_pdf", exist_ok=True); os.makedirs(f"{RAW}/dh_chart2", exist_ok=True)
    session = requests.Session(); session.headers.update(UA)
    parseadas = 0
    ausentes = 0
    respuestas = 0
    duras = []
    # 1) planillas PDF (siempre se vuelven a bajar: una republicación del mismo día tiene que entrar)
    for i in range(a.dias, -1, -1):
        d = hoy - dt.timedelta(days=i)
        got = bajar_planilla(session, d)
        if got["estado"] == "error":
            errores.append(f"{d}: {got['detalle']}")
            print(f"{d}  error  {got['detalle']}")
            continue
        respuestas += 1
        if got["estado"] == "ausente":
            ausentes += 1
            print(f"{d}  ausente")
            continue
        if got["estado"] != "pdf":
            duras.append(f"{d}: respuesta {got.get('http')} sin PDF ({got.get('detalle', '')}) en {got['url']}")
            print(f"{d}  no-pdf  HTTP {got.get('http')} {got.get('detalle', '')}")
            continue
        path = f"{RAW}/planillas_pdf/{d}.pdf"
        with open(path, "wb") as fh:
            fh.write(got["body"])
        if os.path.exists(path + ".404"):
            os.remove(path + ".404")
        res = parsers.parse_pdf_planilla(path)
        via = f" via {got['via']}" if got.get("via") else ""
        if res is None:
            duras.append(f"{d}: PDF sin formato reconocible ({got['url']})")
            print(f"{d}  ilegible{via}  {got['url']}")
            continue
        if res["fecha"] != d:
            duras.append(f"{d}: el PDF de {got['url']} trae fecha {res['fecha']}")
            print(f"{d}  fecha-distinta{via}  pdf={res['fecha']}  {got['url']}")
            continue
        if not parsers.planilla_con_medicion(res):
            duras.append(f"{d}: PDF con fecha pero sin caudal ni cotas ({got['url']})")
            print(f"{d}  sin-medicion{via}  {got['url']}")
            continue
        parseadas += 1
        n_cotas = sum(1 for niv, _v, _h in res["embalses"].values() if niv is not None)
        print(f"{d}  ok{via}  km101={res['km101']}  cotas={n_cotas}  {got['url']}")
        cambios += db.apply_planilla(c, res, "DH_planilla_pdf", got["url"], now)
    # 2) base de datos DH (año actual y anterior). Histórica; un fallo aquí no tapa a las planillas.
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
    print(f"RESUMEN planillas parseadas={parseadas} ausentes={ausentes} ilegibles={len(duras)} red={len([e for e in errores if not str(e).startswith('chart2')])} hoy={hoy}")
    for e in errores: print("AVISO:", e, file=sys.stderr)
    for e in duras: print("ERROR:", e, file=sys.stderr)
    if duras or parseadas == 0:
        if not duras and respuestas:
            print("ERROR: la fuente respondió pero ninguna planilla del período se pudo leer. "
                  "No se publica una serie vieja como si estuviera al día.", file=sys.stderr)
        elif not duras:
            print("ERROR: no hubo respuesta utilizable de las planillas.", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
