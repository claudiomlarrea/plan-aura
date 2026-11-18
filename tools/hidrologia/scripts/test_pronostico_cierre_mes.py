"""Cierre de mes: medido, estimado del balance y grado-día con retardo."""
import datetime as dt
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pronostico_cierre_mes as p

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "caudales.db")
BALANCE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "hidrologia", "balance_caracoles.json",
)


class Formula(unittest.TestCase):
    def test_mm_km2_a_m3s(self):
        # 1 mm sobre 8419 km² en un día, sin piso.
        q = p.q_proyectado(1.0, c=1.0, ddf=1.0, area=8419, qbase=0)
        self.assertAlmostEqual(q, 8419 / 86.4, places=6)

    def test_el_42_es_piso(self):
        self.assertAlmostEqual(p.q_proyectado(0.0), 42.0)
        self.assertAlmostEqual(p.q_proyectado(0.2), 42.0)
        derretimiento = 0.19 * 5.2 * 1.95 * 8419 / 86.4
        self.assertGreater(derretimiento, 42.0)
        self.assertAlmostEqual(p.q_proyectado(1.95), derretimiento, places=4)

    def test_promedio_espacial_antes_de_truncar(self):
        self.assertAlmostEqual(p.t_plus_grilla([3.0, -1.0]), 1.0)
        self.assertEqual(p.t_plus_grilla([-2.0, -4.0]), 0.0)

    def test_correccion_de_altura(self):
        # Celda a 3127 m: 3.850 − 3127 = 723 m → 4,70 °C más frío.
        self.assertAlmostEqual(p.t_positiva(6.7, 3127), 6.7 - 6.5 * 0.723, places=3)
        self.assertEqual(p.t_positiva(-1.0, 3127), 0.0)
        # Celda más alta que 3.850 m: la temperatura sube.
        self.assertGreater(p.t_positiva(0.0, 4000), 0.0)

    def test_volumen(self):
        self.assertAlmostEqual(p.hm3(1.0), 0.0864, places=6)


class Clasificacion(unittest.TestCase):
    def test_el_09_11_medido_no_lo_pisa_la_rampa(self):
        fila = {
            "interpolado": True, "caudal_estimado_m3s": 83.0,
            "km101_medido_m3s": 93.47, "km101_clase": "medido", "nota": "interpolado",
        }
        clase, q = p.clasificar_dia(dt.date(2026, 11, 9), 93.47, fila)
        self.assertEqual(clase, "medido")
        self.assertAlmostEqual(q, 93.47)

    def test_medido_antes_de_la_ventana(self):
        fila = {"interpolado": False, "caudal_estimado_m3s": 65.9, "nota": None}
        clase, q = p.clasificar_dia(dt.date(2026, 11, 4), 67.43, fila)
        self.assertEqual(clase, "medido")
        self.assertAlmostEqual(q, 67.43)

    def test_balance_sin_medicion_desde_noviembre(self):
        fila = {"interpolado": False, "caudal_estimado_m3s": 94.8, "nota": None}
        clase, q = p.clasificar_dia(dt.date(2026, 11, 10), None, fila)
        self.assertEqual(clase, "estimado")
        self.assertAlmostEqual(q, 94.8)

    def test_pendiente_se_proyecta(self):
        fila = {"interpolado": False, "caudal_estimado_m3s": None, "nota": "pendiente"}
        self.assertEqual(p.clasificar_dia(dt.date(2026, 11, 16), None, fila), (None, None))

    def test_sin_marcas_noviembre_sin_dh_se_proyecta(self):
        self.assertEqual(p.clasificar_dia(dt.date(2026, 11, 12), None, None), (None, None))


class Cierre(unittest.TestCase):
    def test_noviembre_2026_separa_y_proyecta_el_resto(self):
        hoy = dt.date(2026, 11, 18)
        caudales = p.cargar_caudales(DB)
        balance = p.cargar_balance(BALANCE)
        t_plus = {}
        origen = {}
        cursor = dt.date(2026, 10, 30)
        while cursor <= dt.date(2026, 11, 30):
            # Solo el 12/11 aporta grados. El caudal del 14 usa ese día (retardo 2).
            t_plus[cursor] = 2.0 if cursor == dt.date(2026, 11, 12) else 0.0
            origen[cursor] = "pronostico"
            cursor += dt.timedelta(days=1)
        doc = p.construir(hoy, caudales, balance, t_plus, origen)
        por = {d["fecha"]: d for d in doc["dias"]}
        self.assertEqual(por["2026-11-04"]["clase"], "medido")
        self.assertAlmostEqual(por["2026-11-04"]["q_m3s"], 67.43)
        self.assertEqual(por["2026-11-05"]["clase"], "estimado")
        self.assertAlmostEqual(por["2026-11-05"]["q_m3s"], 63.7)
        self.assertEqual(por["2026-11-08"]["clase"], "estimado")
        self.assertEqual(por["2026-11-09"]["clase"], "medido")
        self.assertAlmostEqual(por["2026-11-09"]["q_m3s"], 93.47)
        self.assertEqual(por["2026-11-15"]["clase"], "estimado")
        self.assertAlmostEqual(por["2026-11-15"]["q_m3s"], 245.7)
        self.assertEqual(por["2026-11-16"]["clase"], "proyectado")
        self.assertEqual(por["2026-11-14"]["clase"], "estimado")
        self.assertAlmostEqual(por["2026-11-14"]["q_m3s"], 187.1)
        self.assertEqual(doc["dias_proyectados"], 15)
        self.assertEqual(doc["dias_medidos"], 5)
        self.assertEqual(doc["dias_estimados"], 10)
        self.assertAlmostEqual(doc["acumulado_medido_hm3"], 32.3)
        self.assertAlmostEqual(doc["acumulado_estimado_hm3"], 104.7)
        self.assertAlmostEqual(doc["media_historica_hm3"], 210.5)
        self.assertEqual(doc["media_historica_anios"], 115)
        self.assertEqual(doc["etiqueta"], p.ETIQUETA)
        self.assertGreater(doc["total_mes_p90_hm3"], doc["total_mes_p10_hm3"] - 0.05)
        # Con T⁺ = 0 la banda se cierra sobre la base.
        self.assertAlmostEqual(doc["proyectado_restante_hm3"], round(15 * p.hm3(42), 1))

    def test_el_retardo_y_la_banda_mueven_solo_el_derretimiento(self):
        hoy = dt.date(2026, 11, 18)
        # Sin caudales: todo el mes se proyecta. T⁺ = 2 °C solo el 16/11 → caudal del 18.
        t_plus = {dt.date(2026, 11, d): 0.0 for d in range(1, 31)}
        t_plus[dt.date(2026, 10, 30)] = 0.0
        t_plus[dt.date(2026, 10, 31)] = 0.0
        t_plus[dt.date(2026, 11, 16)] = 2.0
        origen = {f: "pronostico" for f in t_plus}
        doc = p.construir(hoy, {}, {}, t_plus, origen)
        por = {d["fecha"]: d for d in doc["dias"]}
        self.assertAlmostEqual(por["2026-11-18"]["q_m3s"], round(p.q_proyectado(2.0), 2))
        self.assertAlmostEqual(por["2026-11-17"]["q_m3s"], 42.0)
        self.assertAlmostEqual(por["2026-11-18"]["q_p10_m3s"], round(p.q_proyectado(2.0, p.C_P10), 2))
        self.assertAlmostEqual(por["2026-11-18"]["q_p90_m3s"], round(p.q_proyectado(2.0, p.C_P90), 2))
        self.assertLess(doc["total_mes_p10_hm3"], doc["total_mes_hm3"])
        self.assertGreater(doc["total_mes_p90_hm3"], doc["total_mes_hm3"])
        # 29 días a 42 m³/s y uno con derretimiento.
        esperado = 29 * p.hm3(42) + p.hm3(p.q_proyectado(2.0))
        self.assertAlmostEqual(doc["total_mes_hm3"], round(esperado, 1))

    def test_respaldo_de_noviembre_si_no_hay_serie(self):
        media, n, fuente = p.media_historica({}, 11, excluir_anio=2026)
        self.assertEqual((round(media, 1), n, fuente), (210.5, 0, "respaldo"))


if __name__ == "__main__":
    unittest.main()
