#!/usr/bin/env python3
"""Pronóstico de cierre de mes del Río San Juan en Km 101.

Lee lo que ya genera la actualización diaria (caudales.db y el balance de
Los Caracoles). No baja planillas del Departamento de Hidráulica y no
interpola la serie oficial: los días sin caudal medido ni estimado se
proyectan con un modelo grado-día.

Volumen del día (hm³) = Q (m³/s) × 86400 / 1e6.

Q_proj(d) = Qbase + C · DDF · T⁺(d−2) · Área · 1000 / 86400

El 1000 convierte mm·km² a m³ (1 mm sobre 1 km²). DDF está en mm/°C/día
y el área nival en km²; sin ese factor el término de derretimiento queda
en el orden de 0,1 m³/s por °C y la banda P10–P90 desaparece.

T⁺ es la temperatura diaria en 3.850 m: Open-Meteo en (−31,9; −70,0),
corregida con 6,5 °C/km desde la elevación de la celda. Después del
horizonte del pronóstico se usa la climatología 1991–2020 del mismo punto.
La banda P10–P90 recorre C = 0,12 y C = 0,24. El valor central usa C = 0,19.
"""
import calendar
import datetime as dt
import json
import os
import sqlite3
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(B))
DB = os.path.join(B, "caudales.db")
BALANCE = os.path.join(REPO, "hidrologia", "balance_caracoles.json")
CLIMA = os.path.join(B, "clima_3850.json")
OUT = os.path.join(REPO, "data", "hidrologia", "pronostico_cierre_mes.json")

ESTIMADO_DESDE = dt.date(2026, 11, 5)
C = 0.19
C_P10 = 0.12
C_P90 = 0.24
DDF = 5.2
AREA_KM2 = 8419
QBASE = 42.0
RETARDO = 2
ELEVACION = 3850
GRADIENTE = 6.5
LAT = -31.9
LON = -70.0
M3_POR_MM_KM2 = 1000
MEDIA_RESPALDO = {11: 210.5}
CLIMA_DESDE = dt.date(1991, 1, 1)
CLIMA_HASTA = dt.date(2020, 12, 31)
UA = {"User-Agent": "plan-aura-hidrologia/1.0 (pronostico cierre de mes)"}
MESES = (
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)
ETIQUETA = (
    "Estimación del Instituto del Agua – no es dato oficial del Departamento de Hidráulica"
)


def hoy_san_juan():
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("America/Argentina/San_Juan")).date()
    except Exception:
        return dt.date.today()


def hm3(q_m3s):
    return q_m3s * 86400.0 / 1e6


def t_positiva(t_celda, elevacion_celda, objetivo=ELEVACION, gradiente=GRADIENTE):
    """Temperatura en la cota objetivo, truncada a cero. Baja si la celda está más abajo."""
    t = float(t_celda) - gradiente * (objetivo - float(elevacion_celda)) / 1000.0
    return max(t, 0.0)


def q_proyectado(t_plus, c=C, ddf=DDF, area=AREA_KM2, qbase=QBASE):
    return qbase + c * ddf * float(t_plus) * area * M3_POR_MM_KM2 / 86400.0


def redondear(valor, decimales):
    if valor is None:
        return None
    return round(float(valor), decimales)


def _marca_estimada(fila):
    if not fila:
        return False
    if fila.get("interpolado"):
        return True
    nota = str(fila.get("nota") or "").lower()
    return "interpol" in nota or "estim" in nota


def clasificar_dia(fecha, medido, fila_balance):
    """Devuelve ('medido'|'estimado', q) o (None, None) si el día se proyecta.

    Una marca de estimado del balance gana sobre el caudal DH del mismo día
    (el 05–09/11/2026 está interpolado aunque el 09 tenga un valor de planilla).
    Desde el 05/11/2026, un día sin medición DH usa el balance si lo hay.
    """
    q_est = None if not fila_balance else fila_balance.get("caudal_estimado_m3s")
    if _marca_estimada(fila_balance) and q_est is not None:
        return "estimado", float(q_est)
    if medido is not None:
        return "medido", float(medido)
    if fecha >= ESTIMADO_DESDE and q_est is not None:
        return "estimado", float(q_est)
    return None, None


def media_historica(caudales, mes, excluir_anio=None):
    """Media del volumen mensual (hm³) de los meses completos de la serie.

    Un mes entra si tiene un caudal por cada día del calendario. El año en
    curso no entra: todavía no cerró. Si no hay ningún mes completo, noviembre
    usa 210,5 hm³ como respaldo.
    """
    por_anio = {}
    for fecha, q in caudales.items():
        if fecha.month != mes:
            continue
        if excluir_anio is not None and fecha.year == excluir_anio:
            continue
        por_anio.setdefault(fecha.year, []).append(q)
    volumenes = []
    for anio, valores in por_anio.items():
        if len(valores) == calendar.monthrange(anio, mes)[1]:
            volumenes.append(sum(valores) * 86400.0 / 1e6)
    if volumenes:
        return sum(volumenes) / len(volumenes), len(volumenes), "serie"
    if mes in MEDIA_RESPALDO:
        return MEDIA_RESPALDO[mes], 0, "respaldo"
    return None, 0, "sin dato"


def cargar_caudales(path=DB):
    con = sqlite3.connect(path)
    try:
        rows = con.execute("SELECT fecha, caudal_m3s FROM caudales_diarios").fetchall()
    finally:
        con.close()
    out = {}
    for fecha, q in rows:
        if q is None:
            continue
        out[dt.date.fromisoformat(str(fecha)[:10])] = float(q)
    return out


def cargar_balance(path=BALANCE):
    if not path or not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    out = {}
    for fila in doc.get("serie") or []:
        fecha = fila.get("fecha")
        if not fecha:
            continue
        out[dt.date.fromisoformat(str(fecha)[:10])] = fila
    return out


def _dias_del_mes(anio, mes):
    return calendar.monthrange(anio, mes)[1]


def construir(hoy, caudales, balance, t_plus, origen_t, temperatura_meta=None):
    """Arma el documento del mes de `hoy`. t_plus mapea fecha → T⁺ ya en 3.850 m."""
    anio, mes = hoy.year, hoy.month
    n = _dias_del_mes(anio, mes)
    dias = []
    medido = estimado = 0.0
    proy = {C_P10: 0.0, C: 0.0, C_P90: 0.0}
    n_med = n_est = n_proy = 0
    for dia in range(1, n + 1):
        fecha = dt.date(anio, mes, dia)
        clase, q = clasificar_dia(fecha, caudales.get(fecha), balance.get(fecha))
        if clase == "medido":
            vol = hm3(q)
            medido += vol
            n_med += 1
            dias.append(_dia(fecha, "medido", q, vol, None, None))
            continue
        if clase == "estimado":
            vol = hm3(q)
            estimado += vol
            n_est += 1
            dias.append(_dia(fecha, "estimado", q, vol, None, None))
            continue
        lag = fecha - dt.timedelta(days=RETARDO)
        if lag not in t_plus:
            raise KeyError(f"sin temperatura para {lag.isoformat()} (caudal del {fecha.isoformat()})")
        tp = float(t_plus[lag])
        qs = {c: q_proyectado(tp, c) for c in proy}
        vols = {c: hm3(qs[c]) for c in proy}
        for c in proy:
            proy[c] += vols[c]
        n_proy += 1
        dias.append(_dia(fecha, "proyectado", qs[C], vols[C], tp, origen_t.get(lag), qs, vols))

    med_r, est_r = redondear(medido, 1), redondear(estimado, 1)
    proy_r = {c: redondear(proy[c], 1) for c in proy}
    total = redondear(med_r + est_r + proy_r[C], 1)
    total_p10 = redondear(med_r + est_r + proy_r[C_P10], 1)
    total_p90 = redondear(med_r + est_r + proy_r[C_P90], 1)
    media, n_media, fuente_media = media_historica(caudales, mes, excluir_anio=anio)
    media_r = redondear(media, 1) if media is not None else None
    diff = None if media_r is None else redondear(total - media_r, 1)
    meta = temperatura_meta or {}
    return {
        "titulo": "Pronóstico de cierre de mes – Río San Juan Km 101",
        "etiqueta": ETIQUETA,
        "estacion": "Río San Juan Km 101",
        "generado": hoy.isoformat(),
        "zona_horaria": "America/Argentina/San_Juan",
        "mes": f"{anio:04d}-{mes:02d}",
        "mes_nombre": MESES[mes],
        "anio": anio,
        "hoy": hoy.isoformat(),
        "dias_del_mes": n,
        "ultimo_dia_con_caudal": next((d["fecha"] for d in reversed(dias) if d["clase"] != "proyectado"), None),
        "acumulado_medido_hm3": med_r,
        "acumulado_estimado_hm3": est_r,
        "dias_medidos": n_med,
        "dias_estimados": n_est,
        "proyectado_restante_hm3": proy_r[C],
        "proyectado_restante_p10_hm3": proy_r[C_P10],
        "proyectado_restante_p90_hm3": proy_r[C_P90],
        "dias_proyectados": n_proy,
        "total_mes_hm3": total,
        "total_mes_p10_hm3": total_p10,
        "total_mes_p90_hm3": total_p90,
        "media_historica_hm3": media_r,
        "media_historica_anios": n_media,
        "media_historica_fuente": fuente_media,
        "diferencia_vs_media_hm3": diff,
        "falta_dias": n_proy,
        "falta_volumen_hm3": proy_r[C],
        "parametros": {
            "C": C,
            "C_p10": C_P10,
            "C_p90": C_P90,
            "DDF_mm_c_dia": DDF,
            "area_nival_km2": AREA_KM2,
            "area_rango_m": [3200, 4500],
            "qbase_m3s": QBASE,
            "retardo_dias": RETARDO,
            "elevacion_objetivo_m": ELEVACION,
            "gradiente_c_km": GRADIENTE,
            "lat": LAT,
            "lon": LON,
            "m3_por_mm_km2": M3_POR_MM_KM2,
            "estimado_desde": ESTIMADO_DESDE.isoformat(),
        },
        "temperatura": meta,
        "metodo": texto_metodo(),
        "dias": dias,
    }


def _dia(fecha, clase, q, vol, t_plus, origen, qs=None, vols=None):
    fila = {
        "fecha": fecha.isoformat(),
        "clase": clase,
        "q_m3s": redondear(q, 2),
        "volumen_hm3": redondear(vol, 3),
    }
    if clase == "proyectado":
        fila["t_plus_c"] = redondear(t_plus, 2)
        fila["t_origen"] = origen
        fila["q_p10_m3s"] = redondear(qs[C_P10], 2)
        fila["q_p90_m3s"] = redondear(qs[C_P90], 2)
        fila["volumen_p10_hm3"] = redondear(vols[C_P10], 3)
        fila["volumen_p90_hm3"] = redondear(vols[C_P90], 3)
    return fila


def texto_metodo():
    return (
        "Cierre de mes del Río San Juan en Km 101. Es una estimación del Instituto del Agua: "
        "no es un dato oficial del Departamento de Hidráulica.\n\n"
        "El volumen de cada día, en hm³, es el caudal en m³/s por 86400 / 1e6. "
        "Los días con caudal publicado por el Departamento de Hidráulica van como MEDIDO. "
        "Si el balance de Los Caracoles marca el día como interpolado o estimado, se usa ese "
        "caudal y va como ESTIMADO aunque la planilla traiga un número (del 5 al 9/11/2026 "
        "la rampa es el dato que entra). Desde el 10/11/2026, donde no hay medición DH, el "
        "caudal es el de entrada a Los Caracoles: salida hacia Punta Negra más la variación "
        "de almacenamiento en Caracoles. Un día sin marca y sin medición DH desde el "
        "05/11/2026 también queda como estimado cuando el balance tiene caudal; si no lo "
        "tiene, se proyecta.\n\n"
        "Los días que faltan usan un grado-día con retardo de 2 días: "
        "Q(d) = 42 + C · 5,2 · T⁺(d−2) · 8419 · 1000 / 86400. "
        "C es 0,19 (P10 = 0,12 y P90 = 0,24). 5,2 es el factor de grado-día en mm/°C/día. "
        "8419 km² es el área nival entre 3.200 y 4.500 m. El 1000 pasa milímetros por "
        "kilómetro cuadrado a metros cúbicos. T⁺ es el máximo entre la temperatura diaria "
        "y cero, llevada a 3.850 m. La temperatura sale de Open-Meteo (lat −31,9, lon −70,0) "
        "y se corrige 6,5 °C por kilómetro desde la elevación de la celda. Pasado el horizonte "
        "del pronóstico se usa la media 1991–2020 de ese día del año, con la misma corrección. "
        "La base de 42 m³/s no depende de C: la banda cubre solo el término de derretimiento."
    )


def _sesion():
    s = requests.Session()
    s.headers.update(UA)
    return s


def _diario_open_meteo(session, url, params):
    r = session.get(url, params=params, timeout=120)
    r.raise_for_status()
    doc = r.json()
    if doc.get("error"):
        raise RuntimeError(doc.get("reason") or "Open-Meteo rechazó el pedido")
    daily = doc.get("daily") or {}
    fechas = daily.get("time") or []
    medias = daily.get("temperature_2m_mean")
    if medias is None:
        tmax = daily.get("temperature_2m_max") or []
        tmin = daily.get("temperature_2m_min") or []
        medias = [
            None if a is None or b is None else (a + b) / 2.0
            for a, b in zip(tmax, tmin)
        ]
    if "elevation" not in doc:
        raise RuntimeError("Open-Meteo no informó la elevación de la celda")
    serie = {}
    for fecha, temp in zip(fechas, medias):
        if temp is None:
            continue
        serie[dt.date.fromisoformat(fecha)] = float(temp)
    return float(doc["elevation"]), serie


def bajar_pronostico(session, hoy):
    """Temperatura de la celda: pasado reciente y pronóstico (hasta 16 días)."""
    # El caudal del día 1 usa la temperatura de dos días antes.
    past = min(92, (hoy - dt.date(hoy.year, hoy.month, 1)).days + RETARDO + 3)
    elev, serie = _diario_open_meteo(session, "https://api.open-meteo.com/v1/forecast", {
        "latitude": LAT,
        "longitude": LON,
        "daily": "temperature_2m_mean,temperature_2m_max,temperature_2m_min",
        "timezone": "America/Argentina/San_Juan",
        "past_days": past,
        "forecast_days": 16,
    })
    if not serie:
        raise RuntimeError("Open-Meteo no devolvió temperaturas diarias")
    return elev, serie, max(serie)


def _clave_mes_dia(fecha):
    return f"{fecha.month:02d}-{fecha.day:02d}"


def cargar_climatologia(session, path=CLIMA):
    """Media 1991–2020 de T⁺ en 3.850 m, por mes-día. Se cachea junto al script."""
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            doc = json.load(fh)
        if doc.get("periodo") == "1991-2020" and doc.get("t_plus_3850"):
            return doc
    elev, serie = _diario_open_meteo(session, "https://archive-api.open-meteo.com/v1/archive", {
        "latitude": LAT,
        "longitude": LON,
        "start_date": CLIMA_DESDE.isoformat(),
        "end_date": CLIMA_HASTA.isoformat(),
        "daily": "temperature_2m_mean",
        "timezone": "America/Argentina/San_Juan",
    })
    grupos = {}
    for fecha, temp in serie.items():
        grupos.setdefault(_clave_mes_dia(fecha), []).append(t_positiva(temp, elev))
    if len(grupos) < 360:
        raise RuntimeError("la climatología de Open-Meteo llegó incompleta")
    doc = {
        "lat": LAT,
        "lon": LON,
        "periodo": "1991-2020",
        "elevacion_celda_m": elev,
        "elevacion_objetivo_m": ELEVACION,
        "gradiente_c_km": GRADIENTE,
        "t_plus_3850": {k: round(sum(v) / len(v), 3) for k, v in sorted(grupos.items())},
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return doc


def temperaturas_del_mes(hoy, elev_pronostico, serie_celda, clima):
    """T⁺ en 3.850 m para cada día que el caudal del mes puede necesitar (con retardo)."""
    inicio = dt.date(hoy.year, hoy.month, 1) - dt.timedelta(days=RETARDO)
    fin = dt.date(hoy.year, hoy.month, _dias_del_mes(hoy.year, hoy.month))
    horizonte = max(serie_celda) if serie_celda else inicio
    t_plus = {}
    origen = {}
    cursor = inicio
    while cursor <= fin:
        if cursor in serie_celda and cursor <= horizonte:
            t_plus[cursor] = t_positiva(serie_celda[cursor], elev_pronostico)
            origen[cursor] = "pronostico"
        else:
            clave = _clave_mes_dia(cursor)
            tabla = clima.get("t_plus_3850") or {}
            if clave not in tabla and cursor.month == 2 and cursor.day == 29:
                clave = "02-28"
            if clave not in tabla:
                raise KeyError(f"sin climatología para {cursor.isoformat()}")
            t_plus[cursor] = float(tabla[clave])
            origen[cursor] = "climatologia"
        cursor += dt.timedelta(days=1)
    meta = {
        "fuente": "Open-Meteo",
        "lat": LAT,
        "lon": LON,
        "elevacion_celda_m": elev_pronostico,
        "elevacion_objetivo_m": ELEVACION,
        "gradiente_c_km": GRADIENTE,
        "horizonte_pronostico": horizonte.isoformat(),
        "climatologia": "1991-2020",
        "variable": "temperature_2m_mean",
    }
    return t_plus, origen, meta


def escribir(doc, path=OUT):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def generar(hoy=None, db_path=DB, balance_path=BALANCE, clima_path=CLIMA, session=None):
    hoy = hoy or hoy_san_juan()
    session = session or _sesion()
    caudales = cargar_caudales(db_path)
    balance = cargar_balance(balance_path)
    elev, serie, _horizonte = bajar_pronostico(session, hoy)
    clima = cargar_climatologia(session, clima_path)
    t_plus, origen, meta = temperaturas_del_mes(hoy, elev, serie, clima)
    return construir(hoy, caudales, balance, t_plus, origen, meta)


def main():
    doc = generar()
    escribir(doc)
    print(
        f"{doc['mes_nombre']} {doc['anio']}: "
        f"medido {doc['acumulado_medido_hm3']} hm3, "
        f"estimado {doc['acumulado_estimado_hm3']} hm3, "
        f"proyectado {doc['proyectado_restante_hm3']} hm3 "
        f"(P10–P90 {doc['proyectado_restante_p10_hm3']}–{doc['proyectado_restante_p90_hm3']}), "
        f"total {doc['total_mes_hm3']} hm3 "
        f"(P10–P90 {doc['total_mes_p10_hm3']}–{doc['total_mes_p90_hm3']}), "
        f"media {doc['media_historica_hm3']} hm3, "
        f"faltan {doc['falta_dias']} días"
    )
    print(OUT)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
