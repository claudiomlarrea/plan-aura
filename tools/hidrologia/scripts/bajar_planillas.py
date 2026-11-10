"""Descarga planillas diarias de Distribución de Riego (DH San Juan).
HTML histórico (irrigacion.php, fecha_consulta) y PDF nuevos (planillas_pdf/YYYY-MM-DD.pdf)."""
import sys, os, gzip, time, datetime as dt, requests
from concurrent.futures import ThreadPoolExecutor
RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "raw")
H = "https://hidraulica.sanjuan.gob.ar/irrigacionver2"
UA = {"User-Agent": "Mozilla/5.0 (caudales-rio-san-juan; uso personal)"}

def html(d):
    f = f"{RAW}/planillas_html/{d}.html.gz"
    if os.path.exists(f): return d, "cached"
    s = requests.Session(); s.headers.update(UA)
    for i in range(3):
        try:
            r = s.post(f"{H}/irrigacion.php", data={"fecha_consulta": d.strftime("%d/%m/%Y") + " 08:00:00 AM"}, timeout=60)
            r.raise_for_status(); break
        except Exception as e:
            time.sleep(5); r = None
    if r is None: return d, "error"
    with gzip.open(f, "wb") as g: g.write(r.content)
    return d, "ok"

def pdf(d):
    f = f"{RAW}/planillas_pdf/{d}.pdf"
    if os.path.exists(f) or os.path.exists(f + ".404"): return d, "cached"
    r = requests.get(f"{H}/planillas_pdf/{d}.pdf", headers=UA, timeout=60)
    if r.status_code == 404: open(f + ".404", "w").close(); return d, "404"
    r.raise_for_status()
    if not r.content.startswith(b"%PDF"): return d, "no-pdf"
    open(f, "wb").write(r.content); return d, "ok"

if __name__ == "__main__":
    kind, a, b = sys.argv[1], dt.date.fromisoformat(sys.argv[2]), dt.date.fromisoformat(sys.argv[3])
    os.makedirs(f"{RAW}/planillas_html", exist_ok=True); os.makedirs(f"{RAW}/planillas_pdf", exist_ok=True)
    days = [a + dt.timedelta(i) for i in range((b - a).days + 1)]
    fn = html if kind == "html" else pdf
    with ThreadPoolExecutor(3) as ex:
        for d, st in ex.map(fn, days): print(d, st, flush=True)
