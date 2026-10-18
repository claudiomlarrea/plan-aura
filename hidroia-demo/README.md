# AURA-HidroIA — Demo interactivo

Demo estático para jurados de la convocatoria Plan AURA 2026: tablero, alertas, reportes semanales/mensuales y asistente IA simulado con datos de ejemplo.

**No es un sistema operativo oficial.** Las series son ficticias (patrón realista).

## Probar en local

Desde esta carpeta:

```bash
cd hidroia-demo
python3 -m http.server 5173
```

Abrí http://localhost:5173/

> No abras `index.html` como `file://`: el navegador bloqueará el `fetch` de los JSON.

## Publicar en Firebase Hosting

Requisito: cuenta Google + [Firebase CLI](https://firebase.google.com/docs/cli).

```bash
# una vez
npm install -g firebase-tools
firebase login

# crear el proyecto en https://console.firebase.google.com
# (Hosting habilitado). Luego alineá el id en .firebaserc

cd hidroia-demo
# editá .firebaserc → projects.default = id-real-del-proyecto
firebase use
firebase deploy --only hosting
```

URL típica: `https://<proyecto>.web.app`

Emilito: este demo es **sitio estático sin base de datos** → Firebase Hosting alcanza. No hace falta Neon/Vergel.

## Estructura

| Ruta | Rol |
|------|-----|
| `index.html` | UI |
| `css/demo.css` | Estilos |
| `js/app.js` | Orquestación |
| `js/charts.js` | KPIs + Chart.js |
| `js/alerts.js` | Umbrales |
| `js/stats.js` | Desagregación diaria y estadísticas |
| `js/reports.js` | Reportes semanales y mensuales |
| `js/assistant.js` | Q&A simulado |
| `data/sample_series.json` | Series demo (mensual; días sintéticos en runtime) |
| `data/assistant_kb.json` | Base de respuestas |

## Reportes semanales y mensuales

El **tablero** muestra los últimos boletines emitidos (semana ISO completa y mes calendario). La pestaña **Reportes** abre el detalle, con:

- media, mediana, mínimo, máximo y día en que ocurrieron
- desvío estándar, coeficiente de variación y cuartiles (P25–P75)
- volumen de entrega acumulado (hm³) en el período
- comparación con el período anterior (absoluta y %)
- días que cruzan umbrales de caudal bajo, estrés alto o demanda alta
- descarga **JSON** / **CSV** e **impresión**

Los puntos diarios se generan en el navegador a partir de la serie mensual de `sample_series.json` (interpolación + variación acotada, semilla en `meta.reportes.semilla`). La entrega diaria se reescala para que cada mes sume el hm³ del dataset. No son lecturas oficiales.

Cuando cambie la serie mensual, actualizá `data/sample_series.json`; los reportes se recalcan solos. Probá con:

```bash
cd hidroia-demo
npm test
```

## Guion rápido para jurados (≈2 min)

1. **Tablero** — KPIs y gráficos oferta/estrés.
2. **Alertas** — julio–agosto con severidad.
3. **Reportes** — mensual de agosto 2025 (estrés) y una semana de invierno; descargar CSV.
4. **Asistente IA** — preguntar “¿Por qué hay alerta?” o “¿Qué incluyen los reportes?”.
