#!/usr/bin/env python3
"""Pronóstico de cierre de mes del Río San Juan en Km 101.

Lee lo que ya genera la actualización diaria (caudales.db y el balance de
Los Caracoles). No baja planillas del Departamento de Hidráulica y no
interpola la serie oficial: los días sin caudal medido ni estimado se
proyectan con un modelo grado-día.

Volumen del día (hm³) = Q (m³/s) × 86400 / 1e6.

Q(D) = max(42, C · DDF · T⁺(D−2) · A / 86,4)

42 m³/s es un piso, no un sumando: C ya está calibrado al caudal total y
sumarlo otra vez contaría la base dos veces. A = 8.419 km² (ocho mil
cuatrocientos diecinueve; el punto es el separador de miles). DDF está en
mm/°C/día. Dividir por 86,4 pasa mm·km²/día a m³/s (86,4 = 86400/1000).

T⁺ es el máximo entre cero y el promedio de 26 celdas Open-Meteo de la
cuenca alta (3.200–4.500 m, grilla de 0,2°), cada una llevada a 3.850 m
con 6,5 °C/km antes de promediar. Esa corrección de cota es el sesgo que
se saca. Después del horizonte se usa la climatología 1991–2020 de la
misma grilla. La banda P10–P90 recorre C = 0,12 y C = 0,24; el piso de
42 m³/s no depende de C.
"""
import calendar
import datetime as dt
import json
import os
import sqlite3
import sys
import time

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
# 86,4 = 86400/1000: mm/día · km² → m³/s.
DIVISOR = 86.4
GRILLA = os.path.join(B, "grilla_cuenca_alta.json")
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


def t_a_cota(t_celda, elevacion_celda, objetivo=ELEVACION, gradiente=GRADIENTE):
    """Lleva la temperatura de la celda a la cota objetivo. Puede ser negativa."""
    return float(t_celda) - gradiente * (objetivo - float(elevacion_celda)) / 1000.0


def t_positiva(t_celda, elevacion_celda, objetivo=ELEVACION, gradiente=GRADIENTE):
    """Temperatura en la cota objetivo, truncada a cero. La conserva el nombre anterior."""
    return max(t_a_cota(t_celda, elevacion_celda, objetivo, gradiente), 0.0)


def t_plus_grilla(temperaturas_a_3850):
    """T⁺ del promedio espacial. Se trunca el promedio, no cada celda."""
    if not temperaturas_a_3850:
        raise ValueError("la grilla no tiene temperaturas")
    return max(sum(temperaturas_a_3850) / len(temperaturas_a_3850), 0.0)


def q_proyectado(t_plus, c=C, ddf=DDF, area=AREA_KM2, qbase=QBASE):
    """Piso de caudal base. C ya incluye la base: no se suma 42 encima del derretimiento."""
    derretimiento = c * ddf * float(t_plus) * area / DIVISOR
    return max(qbase, derretimiento)


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

    Si hay caudal DH, el día es MEDIDO aunque el balance de Caracoles esté
    interpolado. El 09/11/2026 es 93,47 m³/s (planilla del 10/11). La rampa
    05–08/11 no tiene medición y entra como estimada. Desde el 10/11, sin
    medición DH, se usa el balance.
    """
    if fila_balance and fila_balance.get("km101_clase") == "medido" and medido is None:
        medido = fila_balance.get("km101_medido_m3s")
    q_est = None if not fila_balance else fila_balance.get("caudal_estimado_m3s")
    if medido is not None:
        return "medido", float(medido)
    if _marca_estimada(fila_balance) and q_est is not None:
        return "estimado", float(q_est)
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
            "divisor_m3s": DIVISOR,
            "formula": "max(qbase, C*DDF*Tplus*area/86.4)",
            "estimado_desde": ESTIMADO_DESDE.isoformat(),
            "interpolado_km101": ["2026-11-05", "2026-11-08"],
            "medido_09_11_2026_m3s": 93.47,
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
        "Los días con caudal publicado por el Departamento de Hidráulica van como MEDIDO, "
        "aunque el balance de ese día esté interpolado. El 09/11/2026 es medido: 93,47 m³/s "
        "(planilla del 10/11). Del 5 al 8/11 no hay medición y entra la rampa del balance. "
        "Desde el 10/11/2026, donde no hay medición DH, el caudal es el de entrada a Los "
        "Caracoles: salida hacia Punta Negra más la variación de almacenamiento. Si el "
        "balance no tiene caudal, el día se proyecta.\n\n"
        "Los días que faltan usan un grado-día con retardo de 2 días y piso de base: "
        "Q(D) = max(42, C · 5,2 · T⁺(D−2) · 8419 / 86,4). "
        "C es 0,19 (P10 = 0,12 y P90 = 0,24) y ya está calibrado al caudal total: 42 m³/s "
        "no se suma encima. 5,2 es el factor de grado-día en mm/°C/día. 8419 km² es el área "
        "nival entre 3.200 y 4.500 m. El 86,4 pasa milímetros por kilómetro cuadrado a m³/s. "
        "T⁺ es el máximo entre cero y el promedio de 26 celdas de la cuenca alta. Cada celda "
        "se corre a 3.850 m con 6,5 °C/km (corrección de sesgo por altura) y después se "
        "promedia. La grilla es de 0,2° entre 30,5° S y 32,3° S y entre 69,6° O y 70,4° O; "
        "de las celdas que caen en 3.200–4.500 m se dejan las 26 más cercanas a 3.850 m. "
        "Pasado el horizonte del pronóstico se usa la media 1991–2020 de esa grilla. "
        "El 14/11/2026 la referencia del Instituto es 1,95 °C y el 15/11 es 1,00 °C "
        "(Q del 16/11 ≈ 185 m³/s y del 17/11 ≈ 95 m³/s). El piso de 42 m³/s no depende de C."
    )


def _sesion():
    s = requests.Session()
    s.headers.update(UA)
    return s


def cargar_grilla(path=GRILLA):
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    puntos = doc.get("puntos") or []
    if len(puntos) < 20:
        raise RuntimeError(f"la grilla {path} no tiene las celdas de la cuenca alta")
    return doc


def _medias_diarias(bloque):
    daily = bloque.get("daily") or {}
    fechas = daily.get("time") or []
    medias = daily.get("temperature_2m_mean")
    if medias is None:
        tmax = daily.get("temperature_2m_max") or []
        tmin = daily.get("temperature_2m_min") or []
        medias = [
            None if a is None or b is None else (a + b) / 2.0
            for a, b in zip(tmax, tmin)
        ]
    return fechas, medias


def _pedido_grilla(session, url, params, puntos):
    params = dict(params)
    params["latitude"] = ",".join(f"{p['lat']:.2f}" for p in puntos)
    params["longitude"] = ",".join(f"{p['lon']:.2f}" for p in puntos)
    params.setdefault("timezone", "America/Argentina/San_Juan")
    params.setdefault("daily", "temperature_2m_mean")
    ultimo = None
    for intento in range(6):
        r = session.get(url, params=params, timeout=180)
        if r.status_code != 429:
            r.raise_for_status()
            break
        ultimo = r
        time.sleep(2 + intento * 3)
    else:
        ultimo.raise_for_status()
    doc = r.json()
    if isinstance(doc, dict) and doc.get("error"):
        raise RuntimeError(doc.get("reason") or "Open-Meteo rechazó el pedido")
    bloques = doc if isinstance(doc, list) else [doc]
    if len(bloques) != len(puntos):
        raise RuntimeError(
            f"Open-Meteo devolvió {len(bloques)} celdas y la grilla tiene {len(puntos)}"
        )
    return bloques


def _promedio_dia(bloques, puntos, indice):
    """Promedio de las temperaturas del día ya llevadas a 3.850 m. None si falta la grilla."""
    valores = []
    for bloque, punto in zip(bloques, puntos):
        fechas, medias = _medias_diarias(bloque)
        if indice >= len(medias) or medias[indice] is None:
            continue
        elev = bloque.get("elevation", punto.get("elevacion_m"))
        if elev is None:
            continue
        valores.append(t_a_cota(medias[indice], elev))
    if len(valores) < max(20, int(0.8 * len(puntos))):
        return None
    return t_plus_grilla(valores)


def bajar_pronostico(session, hoy, puntos):
    """Pronóstico y pasado reciente de las 26 celdas. Devuelve fecha → T⁺."""
    past = min(92, (hoy - dt.date(hoy.year, hoy.month, 1)).days + RETARDO + 3)
    bloques = _pedido_grilla(session, "https://api.open-meteo.com/v1/forecast", {
        "past_days": past,
        "forecast_days": 16,
    }, puntos)
    fechas, _ = _medias_diarias(bloques[0])
    if not fechas:
        raise RuntimeError("Open-Meteo no devolvió temperaturas diarias")
    serie = {}
    for i, fecha in enumerate(fechas):
        valor = _promedio_dia(bloques, puntos, i)
        if valor is None:
            continue
        serie[dt.date.fromisoformat(fecha)] = valor
    if not serie:
        raise RuntimeError("la grilla no tuvo temperaturas utilizables")
    return serie, max(serie)


def _clave_mes_dia(fecha):
    return f"{fecha.month:02d}-{fecha.day:02d}"


def _climatologia_cacheada(path, grilla_id):
    if not path or not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    if doc.get("periodo") == "1991-2020" and doc.get("grilla") == grilla_id and doc.get("t_media_3850"):
        return doc
    return None


def cargar_climatologia(session, puntos, path=CLIMA, grilla_id="cuenca-alta-0.2deg-26"):
    """Media 1991–2020 del promedio de la grilla a 3.850 m, por mes-día."""
    cache = _climatologia_cacheada(path, grilla_id)
    if cache is not None:
        return cache
    grupos = {}
    # Un año entero de 26 celdas recibe 429. Se baja de a un trimestre.
    trimestres = (("01-01", "03-31"), ("04-01", "06-30"), ("07-01", "09-30"), ("10-01", "12-31"))
    for anio in range(CLIMA_DESDE.year, CLIMA_HASTA.year + 1):
        for inicio_md, fin_md in trimestres:
            time.sleep(0.4)
            bloques = _pedido_grilla(session, "https://archive-api.open-meteo.com/v1/archive", {
                "start_date": f"{anio}-{inicio_md}",
                "end_date": f"{anio}-{fin_md}",
            }, puntos)
            fechas, _ = _medias_diarias(bloques[0])
            for i, fecha in enumerate(fechas):
                valor = _promedio_dia(bloques, puntos, i)
                if valor is None:
                    continue
                grupos.setdefault(_clave_mes_dia(dt.date.fromisoformat(fecha)), []).append(valor)
    if len(grupos) < 360:
        raise RuntimeError("la climatología de la grilla llegó incompleta")
    doc = {
        "periodo": "1991-2020",
        "grilla": grilla_id,
        "elevacion_objetivo_m": ELEVACION,
        "gradiente_c_km": GRADIENTE,
        "n_celdas": len(puntos),
        "t_media_3850": {k: round(sum(v) / len(v), 3) for k, v in sorted(grupos.items())},
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return doc


def _climatologia_necesaria(hoy, serie):
    inicio = dt.date(hoy.year, hoy.month, 1) - dt.timedelta(days=RETARDO)
    fin = dt.date(hoy.year, hoy.month, _dias_del_mes(hoy.year, hoy.month))
    cursor = inicio
    while cursor <= fin:
        if cursor not in serie:
            return True
        cursor += dt.timedelta(days=1)
    return False


def temperaturas_del_mes(hoy, serie_grilla, clima, grilla):
    """T⁺ de la grilla para cada día que el caudal del mes puede necesitar."""
    inicio = dt.date(hoy.year, hoy.month, 1) - dt.timedelta(days=RETARDO)
    fin = dt.date(hoy.year, hoy.month, _dias_del_mes(hoy.year, hoy.month))
    horizonte = max(serie_grilla) if serie_grilla else inicio
    t_plus = {}
    origen = {}
    cursor = inicio
    while cursor <= fin:
        if cursor in serie_grilla and cursor <= horizonte:
            t_plus[cursor] = float(serie_grilla[cursor])
            origen[cursor] = "pronostico"
        else:
            clave = _clave_mes_dia(cursor)
            tabla = clima.get("t_media_3850") or {}
            if clave not in tabla and cursor.month == 2 and cursor.day == 29:
                clave = "02-28"
            if clave not in tabla:
                raise KeyError(f"sin climatología para {cursor.isoformat()}")
            t_plus[cursor] = max(float(tabla[clave]), 0.0)
            origen[cursor] = "climatologia"
        cursor += dt.timedelta(days=1)
    meta = {
        "fuente": "Open-Meteo",
        "grilla": grilla.get("id"),
        "n_celdas": len(grilla.get("puntos") or []),
        "elevacion_objetivo_m": ELEVACION,
        "gradiente_c_km": GRADIENTE,
        "correccion": "sesgo de cota: cada celda a 3.850 m con 6,5 °C/km, luego promedio",
        "horizonte_pronostico": horizonte.isoformat(),
        "climatologia": clima.get("periodo") or "1991-2020",
        "variable": "temperature_2m_mean",
        "referencia_instituto_t_plus_c": {"2026-11-14": 1.95, "2026-11-15": 1.00},
    }
    for fecha, clave in ((dt.date(2026, 11, 14), "grilla_2026-11-14"), (dt.date(2026, 11, 15), "grilla_2026-11-15")):
        if fecha in serie_grilla:
            meta[clave] = redondear(serie_grilla[fecha], 2)
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
    grilla = cargar_grilla()
    puntos = grilla["puntos"]
    serie, _horizonte = bajar_pronostico(session, hoy, puntos)
    clima_cacheada = _climatologia_cacheada(clima_path, grilla.get("id"))
    if clima_cacheada is not None:
        clima = clima_cacheada
    elif _climatologia_necesaria(hoy, serie):
        clima = cargar_climatologia(session, puntos, clima_path, grilla.get("id"))
    else:
        clima = {
            "t_media_3850": {},
            "periodo": "1991-2020, todavía no hizo falta: el pronóstico cubre el mes",
        }
    t_plus, origen, meta = temperaturas_del_mes(hoy, serie, clima, grilla)
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
