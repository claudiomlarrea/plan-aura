# AURA-HidroIA — Demo interactivo

Demo estático para jurados de la convocatoria Plan AURA 2026: tablero, alertas y asistente IA simulado con datos de ejemplo.

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
| `js/assistant.js` | Q&A simulado |
| `data/sample_series.json` | Series demo |
| `data/assistant_kb.json` | Base de respuestas |

## Guion rápido para jurados (≈2 min)

1. **Tablero** — KPIs y gráficos oferta/estrés.
2. **Alertas** — julio–agosto con severidad.
3. **Asistente IA** — preguntar “¿Por qué hay alerta?” o usar botones.
