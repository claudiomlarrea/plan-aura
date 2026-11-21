"""La caída de Hidráulica no falla el job ni inventa días. Una respuesta ilegible sí falla."""
import datetime as dt
import os
import sys
import unittest

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import actualizar as a

DIA = dt.date(2026, 11, 18)
HTML_502 = (
    b"<html><head><title>502 Bad Gateway</title></head><body>"
    b"<center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>"
)


class Resp:
    def __init__(self, status, content=b"", headers=None, url="https://example.test/x"):
        self.status_code = status
        self.content = content
        self.headers = headers or {}
        self.url = url
        self.text = content.decode("latin-1", "replace")


class Sess:
    def __init__(self, get, post):
        self._get = get
        self._post = post

    def get(self, url, timeout=60):
        return self._get(url)

    def post(self, url, data=None, timeout=60, allow_redirects=False):
        return self._post(url, data)


class Bajada(unittest.TestCase):
    def test_502_en_pdf_y_consulta_es_caida(self):
        def get(_url):
            return Resp(502, HTML_502, {"Content-Type": "text/html"})

        def post(_url, _data):
            return Resp(502, HTML_502, {"Content-Type": "text/html"})

        got = a.bajar_planilla(Sess(get, post), DIA)
        self.assertEqual(got["estado"], "caida")
        self.assertIn("consulta HTTP 502", got["detalle"])

    def test_timeout_es_caida(self):
        def get(_url):
            raise requests.ConnectionError("timed out")

        def post(_url, _data):
            raise requests.ConnectionError("timed out")

        got = a.bajar_planilla(Sess(get, post), DIA)
        self.assertEqual(got["estado"], "caida")

    def test_html_200_sin_pdf_sigue_siendo_error(self):
        def get(_url):
            return Resp(200, b"<html>bloqueado</html>", {"Content-Type": "text/html"})

        def post(_url, _data):
            return Resp(200, b"<html>sin ficha</html>", {"Content-Type": "text/html"})

        got = a.bajar_planilla(Sess(get, post), DIA)
        self.assertEqual(got["estado"], "error")

    def test_ficha_sin_embed_sigue_siendo_error(self):
        def get(url):
            if "mostrar.php" in url:
                return Resp(200, b"<html>sin planilla</html>")
            return Resp(404, b"no")

        def post(_url, _data):
            return Resp(302, b"", {"Location": f"{a.BASE}/irrigacion_2025_mostrar.php"})

        got = a.bajar_planilla(Sess(get, post), DIA)
        self.assertEqual(got["estado"], "error")
        self.assertIn("no embebe", got["detalle"])

    def test_404_y_buscador_es_ausente(self):
        def get(_url):
            return Resp(404, b"no")

        def post(_url, _data):
            return Resp(302, b"", {"Location": f"{a.BASE}/irrigacion.php"})

        got = a.bajar_planilla(Sess(get, post), DIA)
        self.assertEqual(got["estado"], "ausente")

    def test_pdf_directo_no_consulta(self):
        def get(url):
            return Resp(200, b"%PDF-1.4\n", url=url)

        def post(_url, _data):
            raise AssertionError("no debía consultar")

        got = a.bajar_planilla(Sess(get, post), DIA)
        self.assertEqual(got["estado"], "pdf")
        self.assertTrue(got["body"].startswith(b"%PDF"))


class Salida(unittest.TestCase):
    def test_fuente_caida_conserva_la_serie(self):
        self.assertEqual(a.codigo_salida(0, 0, [], 31, 31), 0)

    def test_planillas_leidas(self):
        self.assertEqual(a.codigo_salida(25, 31, [], 0, 0), 0)

    def test_caida_parcial_con_datos_no_falla(self):
        self.assertEqual(a.codigo_salida(4, 10, [], 6, 6), 0)

    def test_sitio_contesta_y_nada_se_lee(self):
        self.assertEqual(a.codigo_salida(0, 31, [], 0, 0), 1)

    def test_formato_cambiado_falla(self):
        self.assertEqual(a.codigo_salida(0, 0, [], 0, 31), 1)

    def test_pdf_ilegible_falla_aunque_haya_otras(self):
        self.assertEqual(a.codigo_salida(2, 4, ["2026-11-18: ilegible"], 0, 0), 1)


if __name__ == "__main__":
    unittest.main()
