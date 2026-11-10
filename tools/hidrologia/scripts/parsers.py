"""Parsers para las fuentes oficiales del Departamento de Hidráulica de San Juan."""
import re, gzip, subprocess, datetime as dt

URL_CHART2 = "https://hidraulica.sanjuan.gob.ar/datos%20y%20estadisticas/chart2.php?select=1&start={a}&end={b}"
URL_HTML = "https://hidraulica.sanjuan.gob.ar/irrigacionver2/irrigacion.php (POST fecha_consulta={d} 08:00:00 AM)"
URL_PDF = "https://hidraulica.sanjuan.gob.ar/irrigacionver2/planillas_pdf/{d}.pdf"

EMBALSES = ["Ullum", "Punta Negra", "Los Caracoles", "Cuesta del Viento"]

def num(s):
    """'1.081,10' -> 1081.1 ; '17,132' -> 17.132 ; '19.8' -> 19.8"""
    s = (s or "").strip()
    if not s or s in "-.": return None
    if "," in s: s = s.replace(".", "").replace(",", ".")
    try: return float(s)
    except ValueError: return None

def parse_chart2(text, year):
    """Serie diaria Km101 de la 'Base de datos DH'. Etiquetas dd-mm-yy; el año se toma de la consulta (1 año por consulta)."""
    out = {}
    for d, m, yy, v in re.findall(r"\['(\d\d)-(\d\d)-(\d\d)',\s*([-0-9.eE]+)\]", text):
        if int(yy) != year % 100: raise ValueError(f"año inesperado {yy} en consulta {year}")
        out[dt.date(year, int(m), int(d))] = float(v)
    return out

def num_es(s):
    """Formato argentino de planilla: '1.523' (sin coma) = 1523."""
    s = (s or "").strip()
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", s): s = s.replace(".", "")
    return num(s)

def parse_html_planilla(raw_bytes):
    t = raw_bytes.decode("latin-1", "replace")
    f = dict(re.findall(r'name="([a-z_0-9]+)"\s+id="[^"]*"\s+value="([^"]*)"', t))
    if not f.get("fecha_planilla", "").strip(): return None
    fecha = dt.datetime.strptime(f["fecha_planilla"].strip()[:10], "%d/%m/%Y").date()
    emb = {"Ullum": ("g_6", "h_6", "hm_6"), "Punta Negra": ("g_9", "h_7", "hm_7"),
           "Los Caracoles": ("g_7", "h_8", "hm_8"), "Cuesta del Viento": ("g_8", "h_9", "hm_9")}
    return {"fecha": fecha, "km101": num_es(f.get("e_6")),
            "embalses": {k: (num_es(f.get(c)), num_es(f.get(h)), num_es(f.get(hd))) for k, (c, h, hd) in emb.items()}}

def parse_pdf_planilla(path):
    t = subprocess.run(["pdftotext", "-layout", "-l", "1", path, "-"], capture_output=True, text=True).stdout
    m = re.search(r"Fecha:\s*(\d\d/\d\d/\d{4})", t)
    if not m: return None
    fecha = dt.datetime.strptime(m.group(1), "%d/%m/%Y").date()
    N = r"(-?[\d.]+,\d+|-)"
    q = re.search(r"Km 101\)?:[ \t]*" + N, t)
    pats = {"Ullum": r"Dique Ullum:", "Punta Negra": r"Punta Negra:", "Los Caracoles": r"Caracoles:", "Cuesta del Viento": r"Cuesta del Viento:"}
    emb = {}
    for k, p in pats.items():
        mm = re.search(p + r"[ \t]*" + N + r"[ \t]+" + N + r"[ \t]+" + N, t)
        emb[k] = tuple(num(x) for x in mm.groups()) if mm else (None, None, None)
    return {"fecha": fecha, "km101": num(q.group(1)) if q else None, "embalses": emb}
