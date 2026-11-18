#!/usr/bin/env python3
"""Caudal de entrada estimado a Los Caracoles por balance de agua.

Usa la planilla DH de las 08:00: volúmenes embalsados (hm³) de Los Caracoles,
Punta Negra y Ullum, y el Desembalse Ullum (m³/s). No usa el caudal medido en
Km 101 y no interpola días sin planilla.

Q_est(D) = media(Desembalse Ullum en D y en la lectura siguiente)
           + (ΔV Caracoles + ΔV Punta Negra + ΔV Ullum) · 1e6 / (Δdías · 86400)

La descarga hacia Punta Negra inferida es
media(Desembalse Ullum) + (ΔV Punta Negra + ΔV Ullum) / Δt.

Un día con planilla al día siguiente guarda ese balance diario. Un hueco de
2 a 7 días se reparte en rampa lineal entre la estimación diaria anterior y
la del día de la lectura siguiente, desplazada para que la media del hueco
conserve el volumen del balance. Más de 7 días se descarta. Si no hay lectura
siguiente, la última fila queda pendiente.
"""
import datetime as dt
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(B))
DB = os.path.join(B, "caudales.db")
OUT_DIR = os.path.join(REPO, "hidrologia")

INICIO = dt.date(2026, 10, 15)
MAX_DIAS = 7
EMBALSES = ("Los Caracoles", "Punta Negra", "Ullum")

# Cifras de la comparación local contra Km 101 medido, 2016–2026.
# Van en el texto de método; no se recalculan en cada corrida.
VALIDACION_CIFRAS = {
    "periodo": "2016–2026",
    "diario_sesgo_m3s": -1.5,
    "diario_error_medio_abs_m3s": 18.7,
    "diario_r": 0.34,
    "semanal_error_mediano_pct": 23,
    "semanal_r": 0.69,
    "mensual_error_mediano_pct": 19.5,
    "mensual_r": 0.86,
    "q_medido_ge_60_subestima_m3s": 13,
}

# Balance diario (planilla D y D+1). El 05/11 ya no va acá: entra en la rampa.
REFERENCIA = {
    dt.date(2026, 11, 10): (94.8, 1, 1084.71),
    dt.date(2026, 11, 11): (105.7, 1, 1085.50),
    dt.date(2026, 11, 12): (131.9, 1, 1086.38),
    dt.date(2026, 11, 13): (162.9, 1, 1087.40),
    dt.date(2026, 11, 14): (187.1, 1, 1088.35),
    dt.date(2026, 11, 15): (245.7, 1, 1089.65),
}
# Rampa 05–09/11. La media conserva el balance 05→10/11 (73,3 m³/s).
# Cota del 05/11 medida; 06–09 interpoladas entre 1082,41 y 1084,71.
RAMPA_05_09 = {
    dt.date(2026, 11, 5): (63.7, 1082.41, False),
    dt.date(2026, 11, 6): (68.5, 1082.87, True),
    dt.date(2026, 11, 7): (73.3, 1083.33, True),
    dt.date(2026, 11, 8): (78.1, 1083.79, True),
    dt.date(2026, 11, 9): (83.0, 1084.25, True),
}
NOTA_INTERPOLADO = "interpolado"
# Descarga a Punta Negra y almacenamiento en Caracoles, en m³/s.
COMPONENTES_05_09 = {
    dt.date(2026, 11, 5): (35.5, 28.2),
    dt.date(2026, 11, 6): (34.2, 34.3),
    dt.date(2026, 11, 7): (33.0, 40.3),
    dt.date(2026, 11, 8): (31.7, 46.4),
    dt.date(2026, 11, 9): (30.5, 52.5),
}

FUENTE = (
    "Departamento de Hidráulica de San Juan, planilla diaria «Distribución de Riego» "
    "de las 08:00 (volúmenes embalsados de Los Caracoles, Punta Negra y Ullum, y "
    "Desembalse Ullum). https://hidraulica.sanjuan.gob.ar/irrigacionver2/planillas_pdf/"
)


def _txt(n):
    """1,5 en vez de 1.5, para el texto de método. 23 queda 23; 0,34 no se recorta a 0,3."""
    if isinstance(n, float) and n.is_integer():
        n = int(n)
    return format(n, "g").replace(".", ",")


def texto_metodo():
    c = VALIDACION_CIFRAS
    return (
        "Caudal de entrada estimado a Los Caracoles por balance de agua de la cadena "
        "Caracoles–Punta Negra–Ullum. Es una estimación: no es el caudal medido en Km 101 "
        "y no lo reemplaza. El Km 101 medido no entra en la cuenta.\n\n"
        "De cada planilla de las 08:00 se leen los volúmenes embalsados (hm³) de Los Caracoles, "
        "Punta Negra y Ullum, y el Desembalse Ullum (m³/s). Entre la lectura D y la siguiente D':\n"
        "Q_est = media(Desembalse Ullum en D y en D') + (ΔV Caracoles + ΔV Punta Negra + "
        "ΔV Ullum) · 1e6 / (Δdías · 86400).\n"
        "Descarga hacia Punta Negra inferida = media(Desembalse Ullum) + (ΔV Punta Negra + "
        "ΔV Ullum) / Δt.\n"
        "Si D' es el día siguiente, ese balance es el caudal del día D. Si el hueco es de "
        "2 a 7 días, el volumen del balance se reparte con una rampa lineal desde la "
        "estimación diaria del día anterior a D hasta la estimación diaria de D', desplazada "
        "para que la media de D a D'−1 conserve ese volumen. La descarga a Punta Negra y el "
        "almacenamiento en Caracoles se reparten con la misma rampa, cada uno conservando "
        "la media de su propia parte, y en cada día descarga + almacenamiento = caudal estimado. "
        "Esos días quedan marcados interpolado. Si no hubo planilla, la cota de Caracoles "
        "también se interpola en línea entre las dos lecturas. Un hueco de más de 7 días no "
        "se rellena. Si todavía no hay lectura siguiente, la última fila queda pendiente.\n\n"
        "El caudal medido en Km 101, cuando existe ese día, se copia en km101_medido_m3s "
        "solo como referencia y km101_clase queda en medido. El 09/11/2026 es una medición "
        "del Departamento de Hidráulica: 93,47 m³/s, en la planilla del 10/11. No hay "
        "medición de Km 101 el 05, 06, 07 ni el 08/11, ni desde el 10/11 (vagoneta rota), "
        "y no publicó planillas el 06, 07, 08 ni el 09/11. La rampa del balance sigue "
        "interpolando el ingreso a Caracoles; eso no reemplaza el caudal medido del 09/11. "
        "El balance 05→10/11 (media 73,3 m³/s, cota 1082,41 m el 05/11) se reparte en la "
        "rampa 63,7; 68,5; 73,3; 78,1 y 83,0 m³/s. De esa media, la descarga a Punta Negra "
        "aporta unos 33,0 m³/s (35,5; 34,2; 33,0; 31,7 y 30,5) y el almacenamiento en "
        "Caracoles unos 40,3 m³/s (28,2; 34,3; 40,3; 46,4 y 52,5). Las cotas del 06 al 09/11 "
        "son 1082,87; 1083,33; 1083,79 y 1084,25 m.\n\n"
        "Validación histórica local de este balance contra el Km 101 medido "
        f"({c['periodo']}): a escala diaria, sesgo −{_txt(abs(c['diario_sesgo_m3s']))} m³/s, "
        f"error medio absoluto {_txt(c['diario_error_medio_abs_m3s'])} m³/s, "
        f"r {_txt(c['diario_r'])}; a escala semanal, error mediano "
        f"{_txt(float(c['semanal_error_mediano_pct']))} % y r {_txt(c['semanal_r'])}; "
        f"a escala mensual, error mediano {_txt(c['mensual_error_mediano_pct'])} % y "
        f"r {_txt(c['mensual_r'])}. Con caudal medido de 60 m³/s o más, el balance tiende "
        f"a subestimar unos {c['q_medido_ge_60_subestima_m3s']} m³/s."
    )


def texto_validacion():
    c = VALIDACION_CIFRAS
    return (
        f"Comparación local contra Km 101 medido ({c['periodo']}), sin usar ese caudal en el cálculo. "
        f"Diario: sesgo −{_txt(abs(c['diario_sesgo_m3s']))} m³/s, error medio absoluto "
        f"{_txt(c['diario_error_medio_abs_m3s'])} m³/s, r {_txt(c['diario_r'])}. "
        f"Semanal: error mediano {_txt(c['semanal_error_mediano_pct'])} %, r {_txt(c['semanal_r'])}. "
        f"Mensual: error mediano {_txt(c['mensual_error_mediano_pct'])} %, r {_txt(c['mensual_r'])}. "
        f"Con Q medido ≥ 60 m³/s tiende a subestimar unos {c['q_medido_ge_60_subestima_m3s']} m³/s."
    )


def redondear(valor, decimales):
    if valor is None:
        return None
    return float(f"{valor:.{decimales}f}")


def _completa(lectura):
    if lectura.get("desembalse_m3s") in (None, 0):
        return False
    vols = lectura.get("volumen_hm3") or {}
    return all(vols.get(k) is not None for k in EMBALSES)


def caudal_intervalo(primera, siguiente):
    dias = (siguiente["fecha"] - primera["fecha"]).days
    if dias < 1:
        raise ValueError("la lectura siguiente no es posterior")
    media = (primera["desembalse_m3s"] + siguiente["desembalse_m3s"]) / 2.0
    delta = {k: siguiente["volumen_hm3"][k] - primera["volumen_hm3"][k] for k in EMBALSES}
    segundos = dias * 86400.0
    almacenamiento = delta["Los Caracoles"] * 1e6 / segundos
    descarga = media + (delta["Punta Negra"] + delta["Ullum"]) * 1e6 / segundos
    entrada = descarga + almacenamiento
    return dias, entrada, descarga, almacenamiento


def repartir(ancla_izq, ancla_der, n, media):
    """Rampa lineal entre las anclas, desplazada para que la media de los n días sea `media`."""
    if n < 1:
        return []
    if ancla_izq is None:
        ancla_izq = media
    if ancla_der is None:
        ancla_der = media
    span = n + 1
    crudos = [ancla_izq + (ancla_der - ancla_izq) * (i / span) for i in range(1, n + 1)]
    corrimiento = media - sum(crudos) / n
    return [valor + corrimiento for valor in crudos]


def _partes(caudal, descarga, almacenamiento):
    """Redondea a 0,1 m³/s y deja caudal = descarga + almacenamiento."""
    q = redondear(caudal, 1) if caudal is not None else None
    d = redondear(descarga, 1) if descarga is not None else None
    a = redondear(almacenamiento, 1) if almacenamiento is not None else None
    if q is None or d is None or a is None or abs((d + a) - q) < 0.001:
        return q, d, a
    resto_d = abs(descarga - d)
    resto_a = abs(almacenamiento - a)
    if resto_d >= resto_a:
        d = redondear(q - a, 1)
    else:
        a = redondear(q - d, 1)
    return q, d, a


def _fila(fecha, cota, cota_interpolada, caudal, descarga, almacenamiento, dias, interpolado, km101, nota):
    medido = None if km101 is None else km101.get(fecha)
    q, d, a = _partes(caudal, descarga, almacenamiento)
    return {
        "fecha": fecha.isoformat(),
        "caudal_estimado_m3s": q,
        "cota_caracoles": redondear(cota, 2) if cota is not None else None,
        "descarga_m3s": d,
        "almacenamiento_caracoles_m3s": a,
        "dias_ventana": dias,
        "km101_medido_m3s": redondear(medido, 3) if medido is not None else None,
        "km101_clase": "medido" if medido is not None else None,
        "interpolado": bool(interpolado),
        "cota_interpolada": bool(cota_interpolada),
        "nota": nota,
    }


def serie_balance(lecturas, km101=None, inicio=INICIO, max_dias=MAX_DIAS):
    """Arma la serie. km101 es solo referencia y no entra en Q_est ni en la rampa."""
    km101 = km101 or {}
    ok = sorted((r for r in lecturas if _completa(r)), key=lambda r: r["fecha"])
    por_lectura = {r["fecha"]: r for r in ok}
    intervalos = []
    for i, primera in enumerate(ok[:-1]):
        siguiente = ok[i + 1]
        dias = (siguiente["fecha"] - primera["fecha"]).days
        if dias < 1 or dias > max_dias:
            intervalos.append({"primera": primera, "siguiente": siguiente, "dias": dias, "descartar": True})
            continue
        _, entrada, descarga, almacenamiento = caudal_intervalo(primera, siguiente)
        intervalos.append({
            "primera": primera, "siguiente": siguiente, "dias": dias,
            "entrada": entrada, "descarga": descarga, "almacenamiento": almacenamiento,
            "descartar": False,
        })
    diario = {
        it["primera"]["fecha"]: (it["entrada"], it["descarga"], it["almacenamiento"])
        for it in intervalos if not it["descartar"] and it["dias"] == 1
    }
    filas = []
    for it in intervalos:
        primera = it["primera"]
        if primera["fecha"] < inicio or it["descartar"]:
            continue
        if it["dias"] == 1:
            filas.append(_fila(
                primera["fecha"], primera.get("cota_caracoles"), False,
                it["entrada"], it["descarga"], it["almacenamiento"], 1, False, km101, None,
            ))
            continue
        siguiente = it["siguiente"]
        n = it["dias"]
        izq = diario.get(primera["fecha"] - dt.timedelta(days=1))
        der = diario.get(siguiente["fecha"])
        caudales = repartir(None if izq is None else izq[0], None if der is None else der[0], n, it["entrada"])
        descargas = repartir(None if izq is None else izq[1], None if der is None else der[1], n, it["descarga"])
        almacen = repartir(None if izq is None else izq[2], None if der is None else der[2], n, it["almacenamiento"])
        for k in range(n):
            fecha = primera["fecha"] + dt.timedelta(days=k)
            lectura = por_lectura.get(fecha)
            if lectura is not None and lectura.get("cota_caracoles") is not None:
                cota = lectura["cota_caracoles"]
                cota_interpolada = False
            else:
                cota_s = primera.get("cota_caracoles")
                cota_e = siguiente.get("cota_caracoles")
                if cota_s is None or cota_e is None:
                    cota = None
                    cota_interpolada = False
                else:
                    cota = cota_s + (cota_e - cota_s) * (k / n)
                    cota_interpolada = True
            filas.append(_fila(
                fecha, cota, cota_interpolada, caudales[k], descargas[k], almacen[k], n, True, km101,
                "interpolado",
            ))
    if ok and ok[-1]["fecha"] >= inicio:
        ultima = ok[-1]
        filas.append(_fila(
            ultima["fecha"], ultima.get("cota_caracoles"), False,
            None, None, None, None, False, km101, "pendiente",
        ))
    return filas


def errores_referencia(filas):
    """None si la serie reproduce la rampa 05–09/11 y los balances diarios siguientes."""
    por_fecha = {}
    for fila in filas:
        por_fecha[dt.date.fromisoformat(fila["fecha"])] = fila
    errores = []
    for fecha, (caudal, dias, cota) in REFERENCIA.items():
        fila = por_fecha.get(fecha)
        if fila is None:
            errores.append(f"falta {fecha.isoformat()}")
            continue
        if fila["caudal_estimado_m3s"] is None or abs(fila["caudal_estimado_m3s"] - caudal) > 0.05:
            errores.append(f"{fecha.isoformat()} caudal {fila['caudal_estimado_m3s']} (esperado {caudal})")
        if fila["dias_ventana"] != dias:
            errores.append(f"{fecha.isoformat()} ventana {fila['dias_ventana']} (esperado {dias})")
        if fila["cota_caracoles"] is None or abs(fila["cota_caracoles"] - cota) > 0.02:
            errores.append(f"{fecha.isoformat()} cota {fila['cota_caracoles']} (esperado {cota})")
        if fila.get("interpolado") or fila.get("cota_interpolada"):
            errores.append(f"{fecha.isoformat()} no es un día interpolado")
    rampas = []
    for fecha, (caudal, cota, cota_interpolada) in RAMPA_05_09.items():
        fila = por_fecha.get(fecha)
        if fila is None:
            errores.append(f"falta la rampa {fecha.isoformat()}")
            continue
        rampas.append(fila["caudal_estimado_m3s"])
        if fila["caudal_estimado_m3s"] != caudal:
            errores.append(f"{fecha.isoformat()} rampa {fila['caudal_estimado_m3s']} (esperado {caudal})")
        if fila["cota_caracoles"] is None or abs(fila["cota_caracoles"] - cota) > 0.001:
            errores.append(f"{fecha.isoformat()} cota {fila['cota_caracoles']} (esperado {cota})")
        if fila.get("interpolado") is not True:
            errores.append(f"{fecha.isoformat()} debe marcarse interpolado")
        if bool(fila.get("cota_interpolada")) != cota_interpolada:
            errores.append(f"{fecha.isoformat()} cota_interpolada={fila.get('cota_interpolada')}")
        if fila.get("nota") != NOTA_INTERPOLADO:
            errores.append(f"{fecha.isoformat()} nota {fila.get('nota')!r}")
        descarga, almacenamiento = COMPONENTES_05_09[fecha]
        if fila.get("descarga_m3s") != descarga:
            errores.append(f"{fecha.isoformat()} descarga {fila.get('descarga_m3s')} (esperado {descarga})")
        if fila.get("almacenamiento_caracoles_m3s") != almacenamiento:
            errores.append(f"{fecha.isoformat()} almacenamiento {fila.get('almacenamiento_caracoles_m3s')} (esperado {almacenamiento})")
        if abs((descarga + almacenamiento) - caudal) > 0.001:
            errores.append(f"{fecha.isoformat()} las partes no suman el caudal")
    if len(rampas) == 5 and abs(sum(rampas) / 5 - 73.3) > 0.05:
        errores.append(f"la media 05–09 es {sum(rampas) / 5}, no 73,3")
    return errores


def documento(filas, actualizado):
    return {
        "metodo": texto_metodo(),
        "fuente": FUENTE,
        "actualizado": actualizado,
        "validacion": {
            "periodo": VALIDACION_CIFRAS["periodo"],
            "contra": "Km 101 medido, solo comparación; no entra en el cálculo",
            "diario": {
                "sesgo_m3s": VALIDACION_CIFRAS["diario_sesgo_m3s"],
                "error_medio_abs_m3s": VALIDACION_CIFRAS["diario_error_medio_abs_m3s"],
                "r": VALIDACION_CIFRAS["diario_r"],
            },
            "semanal": {
                "error_mediano_pct": VALIDACION_CIFRAS["semanal_error_mediano_pct"],
                "r": VALIDACION_CIFRAS["semanal_r"],
            },
            "mensual": {
                "error_mediano_pct": VALIDACION_CIFRAS["mensual_error_mediano_pct"],
                "r": VALIDACION_CIFRAS["mensual_r"],
            },
            "con_q_medido_ge_60_m3s": (
                f"tiende a subestimar unos {VALIDACION_CIFRAS['q_medido_ge_60_subestima_m3s']} m³/s"
            ),
            "texto": texto_validacion(),
        },
        "serie": filas,
    }


def _fecha(valor):
    if isinstance(valor, dt.datetime):
        return valor.date()
    if isinstance(valor, dt.date):
        return valor
    return dt.date.fromisoformat(str(valor)[:10])


def lecturas_db(con):
    """Lee volúmenes y desembalse. El Km 101 se devuelve aparte, solo como referencia."""
    crudas = con.execute(
        """
        SELECT fecha, embalse, nivel, volumen_hm3
        FROM niveles_embalses
        WHERE embalse IN ('Los Caracoles', 'Punta Negra', 'Ullum') AND fecha >= ?
        ORDER BY fecha, embalse
        """,
        ((INICIO - dt.timedelta(days=8)).isoformat(),),
    ).fetchall()
    por_dia = {}
    for fecha, embalse, nivel, volumen in crudas:
        dia = por_dia.setdefault(_fecha(fecha), {"fecha": _fecha(fecha), "volumen_hm3": {}})
        por_dia[dia["fecha"]]["volumen_hm3"][embalse] = volumen
        if embalse == "Los Caracoles":
            dia["cota_caracoles"] = nivel
    des = {
        _fecha(fecha): valor
        for fecha, valor in con.execute("SELECT fecha, caudal_m3s FROM desembalse_ullum")
    }
    for dia in por_dia.values():
        dia["desembalse_m3s"] = des.get(dia["fecha"])
    km = {
        _fecha(fecha): valor
        for fecha, valor in con.execute(
            "SELECT fecha, caudal_m3s FROM caudales_diarios WHERE fecha >= ?",
            (INICIO.isoformat(),),
        )
    }
    return list(por_dia.values()), km


def _csv_num(valor, decimales):
    if valor is None:
        return ""
    return f"{valor:.{decimales}f}".replace(".", ",")


def escribir_csv(filas, path):
    import csv
    campos = [
        "fecha", "caudal_estimado_m3s", "cota_caracoles", "descarga_m3s",
        "almacenamiento_caracoles_m3s", "dias_ventana", "km101_medido_m3s",
        "km101_clase", "interpolado", "cota_interpolada", "nota",
    ]
    with open(path, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(campos)
        for fila in filas:
            w.writerow([
                fila["fecha"],
                _csv_num(fila["caudal_estimado_m3s"], 1),
                _csv_num(fila["cota_caracoles"], 2),
                _csv_num(fila["descarga_m3s"], 1),
                _csv_num(fila["almacenamiento_caracoles_m3s"], 1),
                "" if fila["dias_ventana"] is None else str(fila["dias_ventana"]),
                _csv_num(fila["km101_medido_m3s"], 3),
                fila.get("km101_clase") or "",
                "true" if fila["interpolado"] else "false",
                "true" if fila["cota_interpolada"] else "false",
                fila["nota"] or "",
            ])


def escribir(doc):
    os.makedirs(OUT_DIR, exist_ok=True)
    json_path = os.path.join(OUT_DIR, "balance_caracoles.json")
    csv_path = os.path.join(OUT_DIR, "balance_caracoles.csv")
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    escribir_csv(doc["serie"], csv_path)
    return json_path, csv_path


def main():
    con = sqlite3.connect(DB)
    try:
        lecturas, km101 = lecturas_db(con)
    finally:
        con.close()
    filas = serie_balance(lecturas, km101)
    if not filas:
        print("Sin lecturas completas desde el 2026-10-15. No se publica el balance.", file=sys.stderr)
        return 1
    errores = errores_referencia(filas)
    if errores:
        print("La serie no reproduce los valores de referencia:", file=sys.stderr)
        for e in errores:
            print(" -", e, file=sys.stderr)
        return 1
    ultima = max(r["fecha"] for r in lecturas)
    doc = documento(filas, ultima.isoformat() if hasattr(ultima, "isoformat") else str(ultima)[:10])
    # actualizado: fecha de la última planilla leída, no la hora de la corrida.
    if isinstance(ultima, dt.date):
        doc["actualizado"] = ultima.isoformat()
    json_path, csv_path = escribir(doc)
    ultima_fila = filas[-1]
    print(
        f"balance_caracoles: {len(filas)} filas, {filas[0]['fecha']} a {ultima_fila['fecha']} "
        f"({ultima_fila['nota'] or ultima_fila['caudal_estimado_m3s']}) -> {json_path}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
