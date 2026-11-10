"""Construye caudales.db desde los archivos crudos en raw/ (no descarga nada)."""
import glob, gzip, os, datetime as dt, sys
sys.path.insert(0, os.path.dirname(__file__))
import parsers, db
RAW = f"{db.BASE}/raw"
mt = lambda p: dt.datetime.fromtimestamp(os.path.getmtime(p)).isoformat(timespec="seconds")
c = db.connect()
n = 0
for p in sorted(glob.glob(f"{RAW}/dh_chart2/km101_*.html")):
    y = int(p[-9:-5]); ts = mt(p)
    url = parsers.URL_CHART2.format(a=f"{y}-01-01", b=f"{y}-12-31")
    for d, v in parsers.parse_chart2(open(p, encoding="latin-1").read(), y).items():
        if db.upsert_caudal(c, d, v, f"DH_base_datos_chart2 | {url}", ts): n += 1
print("chart2:", n)
k = 0
for p in sorted(glob.glob(f"{RAW}/planillas_html/*.html.gz")):
    r = parsers.parse_html_planilla(gzip.open(p).read())
    if r: k += len(db.apply_planilla(c, r, "DH_planilla_html", parsers.URL_HTML.format(d=r["fecha"].strftime("%d/%m/%Y")), mt(p)))
print("html:", k)
k = 0
for p in sorted(glob.glob(f"{RAW}/planillas_pdf/*.pdf")):
    r = parsers.parse_pdf_planilla(p)
    if r: k += len(db.apply_planilla(c, r, "DH_planilla_pdf", parsers.URL_PDF.format(d=r["fecha"]), mt(p)))
print("pdf:", k)
c.commit(); db.export_csv(c)
