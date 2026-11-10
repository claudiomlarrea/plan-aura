# Caudales diarios del Río San Juan (Km 101) y niveles de embalses – Dpto. de Hidráulica de San Juan

## Archivos
- `caudales.db` (SQLite)
  - `caudales_diarios(fecha DATE PK, caudal_m3s REAL, fuente TEXT, descargado_en TIMESTAMP)`
  - `niveles_embalses(fecha, embalse, nivel, unidad, volumen_hm3, volumen_disponible_hm3, fuente, descargado_en, PK(fecha, embalse))`
- `caudales_diarios.csv`, `niveles_embalses.csv`: exportaciones completas (se regeneran en cada actualización).
- `pantallazo.png`: tabla de los últimos 21 días (caudal Km 101 y cotas de Punta Negra, Ullum, Los Caracoles y Cuesta del Viento) + escurrimiento acumulado del año hidrológico.
- `datos_resumen.xlsx`: la tabla del pantallazo, la última lectura de embalses, el acumulado y las series completas.
- `actualizar.py`: actualización incremental e idempotente.
- `scripts/`: parsers, descarga masiva (`bajar_planillas.py`), reconstrucción (`build_db.py`), resumen (`resumen.py`).
- `raw/`: todas las descargas originales (HTML de la base DH por año, planillas HTML .gz, planillas PDF).

## Fuentes (todas oficiales del Departamento de Hidráulica de San Juan)
1. **Base de datos DH – Km 101** (`DH_base_datos_chart2`):
   `https://hidraulica.sanjuan.gob.ar/datos%20y%20estadisticas/chart2.php?select=1&start=AAAA-01-01&end=AAAA-12-31`
   (menú Sistema Integrado de Información Hídrica → Aforos de ríos → Base de datos DH). Serie diaria en m³/s desde
   **01/01/1910** hasta **30/06/2022** (la base no tiene datos de 1909 ni posteriores a junio 2022).
2. **Planilla diaria "Distribución de Riego" (08:00 h), formato HTML histórico** (`DH_planilla_html`):
   `https://hidraulica.sanjuan.gob.ar/irrigacionver2/irrigacion.php` (POST `fecha_consulta=DD/MM/AAAA 08:00:00 AM`).
   Disponible aprox. desde dic-2014 hasta 22/05/2025. Contiene caudal Km 101 y cota/volumen/volumen disponible de los 4 embalses.
3. **Planilla diaria en PDF** (`DH_planilla_pdf`), desde 23/05/2025:
   `https://hidraulica.sanjuan.gob.ar/irrigacionver2/planillas_pdf/AAAA-MM-DD.pdf` (consulta en `irrigacion_consulta.php`).

La columna `fuente` guarda la fuente, la planilla de origen y la URL exacta de cada fila.

### Convención de fechas
El caudal Km 101 que figura en la planilla del día D (08:00 h) coincide con el valor que la base DH asigna al día **D‑1**
(verificado en 571 días superpuestos 2014‑2022: 95 % coincide exacto con D‑1, 0,5 % con D). Por eso el caudal de planilla
se guarda con fecha D‑1. Las cotas de embalses se guardan con la fecha de la planilla (lectura de las 08:00 de ese día).
Cuando hay dato de la base DH y de planilla para el mismo día, prevalece la base DH.

### Reglas
- No se interpola ni se completa nada: los días sin dato publicado no tienen fila.
- Valores en blanco o 0,000 en la planilla se tratan como "sin dato".
- Cota en m.s.n.m.; volumen en hm³; "volumen disponible" es el que informa DH por encima de las cotas mínimas de operatividad (Ley 2470‑L, Res. 709‑MOSP‑2023), puede ser negativo.
- Punta Negra aparece en las planillas desde 2016.
- Se descartan cotas físicamente imposibles (errores de carga de la planilla), con rangos: Ullum 700–800, Punta Negra 850–1000, Los Caracoles 1000–1150, Cuesta del Viento 1450–1560 m.s.n.m. Caso detectado: Cuesta del Viento 04/10/2022 = "1,523".

## Frecuencia de publicación
Las planillas se suben solo en días hábiles, entre ~08:00 y 13:30 (UTC‑3), con 1 a 12 días de atraso
(fines de semana y feriados se suben juntos el día hábil siguiente). La base DH (chart2) no se actualiza desde jun‑2022.
Recomendado: correr una vez por día a las **14:00 (UTC‑3)**; el script revisa los últimos 30 días, así recoge lo publicado con atraso.

## Actualizar
```
python3 tools/hidrologia/actualizar.py          # revisa últimos 30 días
python3 tools/hidrologia/actualizar.py --dias 90
python3 tools/hidrologia/scripts/analisis_anual.py   # regenera hidrologia/ y la tabla de 21 días
python3 tools/hidrologia/scripts/resumen.py      # regenera pantallazo.png y datos_resumen.xlsx (opcional)
```
Reconstruir todo desde `raw/`: `python3 tools/hidrologia/scripts/build_db.py`.

## Fuentes revisadas y no usadas
- BDHI / SNIH (snih.hidricosargentina.gob.ar, estación 1211 Río San Juan – Km 101): la descarga histórica no es accesible por API pública simple (la función de lectura histórica está deshabilitada en el JS del sitio); hay planillas `Info/SeriesDiarias_1931_2020.xlsx` no exploradas. Podría usarse para validar 1971‑2020.
- plan-aura.com.ar/#info-hidrologica: publica esta serie (tabla de 21 días, acumulado histórico y análisis anual).
- Tabla de caudales medios mensuales en `datos y estadisticas/km101.php` (2008‑2020): mensual, no se incorpora.

## Análisis anual y módulo web (Plan AURA)
- `scripts/analisis_anual.py` escribe `hidrologia/` en la raíz del sitio: `datos_anuales.json` (estadísticas por año calendario e hidrológico, tendencias
  Mann-Kendall + Sen para 1910–hoy, desde 1971, 1991 y 2001, anomalías vs. media de años completos 1910–2022, embalses),
  `ultimos_valores.json`, `serie_diaria_reciente.json` (400 días), `acumulado.json`, CSVs y `index.html`
  (Chart.js desde CDN; lee los JSON con rutas relativas, se puede cambiar con `data-base` en `<section id="hidro-aura">`).
- Año incompleto = menos de 330 días con dato: se muestra en gris y no entra en medias, anomalías ni tendencias.
- Captura de referencia: `web_modulo_captura.png`.

## Actualización diaria completa
```
bash tools/hidrologia/actualizar_todo.sh
```
El workflow `.github/workflows/hidrologia-diaria.yml` lo corre todos los días a las 14:00 (hora de San Juan) y también se puede disparar a mano. Solo commitea si cambia un caudal o una cota.

## Publicación en plan-aura.com.ar (no ejecutada)
- Sitio estático (HTML/CSS/JS, sin framework) en el repo público GitHub `claudiomlarrea/plan-aura`, rama `main`, raíz,
  servido por GitHub Pages (CNAME `plan-aura.com.ar`) detrás de Cloudflare (cache ~10 min). No hay proyecto en Vercel.
- La sección está en `index.html` (`<section class="section section--hidro page-panel" id="info-hidrologica">`), textos en `js/i18n-dict.js` (claves `sec.hidro.*`).
- Plan: copiar `web/` a `hidrologia/` del repo y embeber en la sección con
  `<iframe src="hidrologia/index.html" title="Caudales y embalses del Río San Juan" style="width:100%;height:3600px;border:0" loading="lazy"></iframe>`;
  publicar diariamente commiteando solo `hidrologia/*.json|*.csv` (o con un GitHub Action programado).
