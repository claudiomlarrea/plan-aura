"""El balance reproduce la rampa 05–09/11 y no usa el Km 101 medido."""
import datetime as dt
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import balance_caracoles as b
import parsers

# Volúmenes (hm³) y Desembalse Ullum (m³/s). El 04/11 es el ancla izquierda de la rampa.
LECTURAS = [
    (dt.date(2026, 11, 4), 44.0, 1082.00, 251.50, 228.03, 138.87),
    (dt.date(2026, 11, 5), 44.0, 1082.41, 254.53, 228.47, 137.29),
    (dt.date(2026, 11, 10), 42.0, 1084.71, 271.96, 227.86, 133.57),
    (dt.date(2026, 11, 11), 43.0, 1085.50, 278.14, 225.06, 134.71),
    (dt.date(2026, 11, 12), 43.0, 1086.38, 285.14, 222.62, 135.57),
    (dt.date(2026, 11, 13), 43.0, 1087.40, 293.41, 220.46, 137.14),
    (dt.date(2026, 11, 14), 44.0, 1088.35, 301.27, 221.76, 138.30),
    (dt.date(2026, 11, 15), 44.0, 1089.65, 312.28, 222.10, 139.31),
    (dt.date(2026, 11, 16), 44.0, 1090.96, 323.67, 226.98, 140.47),
]

PDF = """
Distribución de Riego                                                        Río SAN JUAN Km 101:        67,430        Dique Ullum:                759,10             137,29          -13,22
Fecha: 05/11/2026                    Hora: 08:00                             Rio Blanco (P.Pi.):                       Punta Negra:                924,37             228,47           32,82
                                                                                                                       Caracoles:                 1.082,41            254,53           13,88
Desembalse Ullum                       44,000        m³/seg                                                            Cuesta del Viento:         1.523,54            121,52           83,06
"""


def lectura(fecha, des, cota, car, pn, ull):
    return {
        "fecha": fecha,
        "desembalse_m3s": des,
        "cota_caracoles": cota,
        "volumen_hm3": {"Los Caracoles": car, "Punta Negra": pn, "Ullum": ull},
    }


class Balance(unittest.TestCase):
    def serie(self, km=None):
        return b.serie_balance([lectura(*row) for row in LECTURAS], km or {})

    def test_referencia(self):
        por_fecha = {dt.date.fromisoformat(f["fecha"]): f for f in self.serie()}
        for fecha, (caudal, dias, cota) in b.REFERENCIA.items():
            fila = por_fecha[fecha]
            self.assertAlmostEqual(fila["caudal_estimado_m3s"], caudal, delta=0.5)
            self.assertEqual(fila["caudal_estimado_m3s"], caudal)
            self.assertEqual(fila["dias_ventana"], dias)
            self.assertEqual(fila["cota_caracoles"], cota)
        for fecha, (caudal, cota, cota_interpolada) in b.RAMPA_05_09.items():
            fila = por_fecha[fecha]
            self.assertEqual(fila["caudal_estimado_m3s"], caudal)
            self.assertEqual(fila["cota_caracoles"], cota)
            self.assertTrue(fila["interpolado"])
            self.assertEqual(fila["cota_interpolada"], cota_interpolada)
        for fecha, (descarga, almacenamiento) in b.COMPONENTES_05_09.items():
            fila = por_fecha[fecha]
            self.assertEqual(fila["nota"], "interpolado")
            self.assertEqual(fila["descarga_m3s"], descarga)
            self.assertEqual(fila["almacenamiento_caracoles_m3s"], almacenamiento)
            self.assertEqual(round(descarga + almacenamiento, 1), fila["caudal_estimado_m3s"])
        media = sum(por_fecha[f]["caudal_estimado_m3s"] for f in b.RAMPA_05_09) / 5
        self.assertAlmostEqual(media, 73.3, delta=0.05)
        self.assertFalse(por_fecha[dt.date(2026, 11, 4)]["interpolado"])
        self.assertFalse(por_fecha[dt.date(2026, 11, 10)]["interpolado"])
        ultima = por_fecha[dt.date(2026, 11, 16)]
        self.assertEqual(ultima["nota"], "pendiente")
        self.assertIsNone(ultima["caudal_estimado_m3s"])
        self.assertFalse(ultima["interpolado"])

    def test_km101_no_entra_en_el_calculo(self):
        sin = self.serie()
        con = self.serie({dt.date(2026, 11, 10): 999.0, dt.date(2026, 11, 5): 1.0})
        for a, c in zip(sin, con):
            self.assertEqual(a["caudal_estimado_m3s"], c["caudal_estimado_m3s"])
            self.assertEqual(a["descarga_m3s"], c["descarga_m3s"])
        por_fecha = {f["fecha"]: f for f in con}
        self.assertEqual(por_fecha["2026-11-10"]["km101_medido_m3s"], 999.0)
        self.assertIsNone(por_fecha["2026-11-11"]["km101_medido_m3s"])

    def test_hueco_largo_se_descarta(self):
        filas = b.serie_balance([
            lectura(dt.date(2026, 10, 15), 40, 1080, 240, 210, 150),
            lectura(dt.date(2026, 10, 24), 40, 1081, 250, 210, 150),
            lectura(dt.date(2026, 10, 25), 40, 1081, 251, 210, 150),
        ])
        fechas = [f["fecha"] for f in filas]
        self.assertNotIn("2026-10-15", fechas)
        self.assertEqual(fechas, ["2026-10-24", "2026-10-25"])
        self.assertEqual(filas[-1]["nota"], "pendiente")

    def test_texto_de_metodo_trae_la_validacion(self):
        texto = b.texto_metodo() + b.texto_validacion()
        for pedazo in ("−1,5", "18,7", "0,34", "23 %", "0,69", "19,5", "0,86", "13 m³/s", "rampa lineal", "más de 7 días"):
            self.assertIn(pedazo, texto)

    def test_parser_separa_desembalse_de_km101(self):
        res = parsers.parse_pdf_text(PDF)
        self.assertEqual(res["fecha"], dt.date(2026, 11, 5))
        self.assertEqual(res["km101"], 67.43)
        self.assertEqual(res["desembalse_ullum"], 44.0)
        self.assertEqual(res["embalses"]["Los Caracoles"][0], 1082.41)
        self.assertEqual(res["embalses"]["Los Caracoles"][1], 254.53)
        self.assertEqual(res["embalses"]["Punta Negra"][1], 228.47)
        self.assertEqual(res["embalses"]["Ullum"][1], 137.29)


if __name__ == "__main__":
    unittest.main()
