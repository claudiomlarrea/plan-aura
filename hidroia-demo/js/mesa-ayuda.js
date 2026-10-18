/**
 * Mesa de ayuda de AURA-HidroIA: respuestas fijas del demo.
 * Sin API: funciona en Firebase Hosting.
 */
(function () {
  var MAIL = "observatorioia@uccuyo.edu.ar";
  var PLAN = "https://plan-aura.com.ar/";

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[¿?¡!.,;:()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  var ANSWERS = {
    "que-es": {
      keywords: [
        "que es",
        "de que se trata",
        "hidroia",
        "proyecto",
        "para que sirve",
        "que hace"
      ],
      extra: ["aura", "sistema"]
    },
    tablero: {
      keywords: ["tablero", "indicador", "indicadores", "kpi", "grafico", "graficos"],
      extra: ["oferta", "estres", "caudal"]
    },
    alertas: {
      keywords: ["alerta", "alertas", "umbral", "umbrales", "julio", "agosto"],
      extra: ["severidad"]
    },
    asistente: {
      keywords: ["asistente", "inteligencia artificial", "preguntar", "chat"],
      extra: ["ia"]
    },
    reportes: {
      keywords: [
        "reporte",
        "reportes",
        "informe",
        "informes",
        "semanal",
        "mensual",
        "emitir",
        "boletin",
        "boletines"
      ],
      extra: ["csv", "json", "imprimir", "semana", "mes"]
    },
    datos: {
      keywords: [
        "datos",
        "demo",
        "ejemplo",
        "oficial",
        "osse",
        "hidraulica",
        "fuente",
        "fuentes"
      ],
      extra: ["real", "ficticio"]
    },
    contacto: {
      keywords: ["contacto", "mail", "correo", "escribir", "consultar"],
      extra: ["observatorio", "uccuyo"]
    }
  };

  var LABELS = {
    "que-es": "Qué es AURA-HidroIA",
    tablero: "Cómo usar el tablero",
    alertas: "Cómo funcionan las alertas",
    reportes: "Cómo emitir un reporte",
    asistente: "Asistente IA",
    datos: "¿Son datos reales?",
    contacto: "Contacto"
  };

  function htmlQueEs() {
    return (
      "<p><strong>AURA-HidroIA</strong></p>" +
      "<p>Es el demo del proyecto del Observatorio de IA (UCCuyo) para la convocatoria del Plan AURA 2026. Muestra cómo monitorear, alertar y explicar el estrés hídrico urbano en San Juan, integrando Hidráulica y OSSE con inteligencia artificial.</p>" +
      "<p>Tiene cuatro partes: <strong>Tablero</strong>, <strong>Alertas</strong>, <strong>Reportes</strong> y <strong>Asistente IA</strong>.</p>"
    );
  }

  function htmlTablero() {
    return (
      "<p><strong>Tablero</strong></p>" +
      "<ol>" +
      "<li>Arriba ves indicadores (KPIs) del período de ejemplo.</li>" +
      "<li>El primer gráfico compara oferta y entrega.</li>" +
      "<li>El segundo muestra el estrés hídrico urbano (índice 0–100).</li>" +
      "</ol>" +
      "<p>Un valor alto de estrés no significa falta absoluta de agua: indica más tensión entre oferta y demanda en ese mes.</p>"
    );
  }

  function htmlAlertas() {
    return (
      "<p><strong>Alertas</strong></p>" +
      "<ul>" +
      "<li>Caudal por debajo de <strong>18 m³/s</strong> → alerta de oferta baja.</li>" +
      "<li>Estrés por encima de <strong>70</strong> → alerta de tensión oferta–demanda.</li>" +
      "</ul>" +
      "<p>En el dataset de ejemplo, julio y agosto concentran las alertas de mayor severidad.</p>"
    );
  }

  function htmlReportes() {
    return (
      "<p><strong>Reportes semanales y mensuales</strong></p>" +
      "<ol>" +
      "<li>Abrí la pestaña <strong>Reportes</strong>.</li>" +
      "<li>Elegí el tipo: <strong>Semanal</strong> o <strong>Mensual</strong>.</li>" +
      "<li>Elegí año, mes y, si es semanal, la semana.</li>" +
      "<li>Tocá <strong>Emitir informe</strong>. Podés descargar JSON o CSV, o imprimir.</li>" +
      "</ol>" +
      "<p>En el tablero, <strong>Últimos reportes emitidos</strong> muestra los boletines ya calculados.</p>"
    );
  }

  function htmlAsistente() {
    return (
      "<p><strong>Asistente IA</strong></p>" +
      "<p>La pestaña <strong>Asistente IA</strong> explica indicadores y alertas con respuestas del demo. Podés escribir una pregunta o usar los botones sugeridos.</p>" +
      "<p>Esta mesa de ayuda responde consultas sobre cómo usar el sitio. El asistente de la pestaña explica los datos del tablero.</p>"
    );
  }

  function htmlDatos() {
    return (
      "<p><strong>Datos de ejemplo</strong></p>" +
      "<p>Este sitio es un demo conceptual. Las series son de ejemplo, con un patrón realista. <strong>No es un sistema operativo oficial</strong> de Hidráulica ni de OSSE.</p>" +
      "<p>En el sistema previsto se integrarían series públicas de ambas instituciones, con umbrales documentados.</p>"
    );
  }

  function htmlContacto() {
    return (
      "<p><strong>Contacto</strong></p>" +
      "<p>Observatorio de Inteligencia Artificial · UCCuyo<br>" +
      '<a href="mailto:' +
      MAIL +
      '">' +
      MAIL +
      "</a></p>" +
      '<p>Plan Integral AURA: <a href="' +
      PLAN +
      '" target="_blank" rel="noopener noreferrer">plan-aura.com.ar</a></p>'
    );
  }

  function htmlFallback() {
    return (
      "<p>No tengo una respuesta exacta para eso. Probá con: qué es el proyecto, tablero, alertas, datos de ejemplo o contacto.</p>" +
      "<p>Consultas: <a href=\"mailto:" +
      MAIL +
      '">' +
      MAIL +
      "</a></p>"
    );
  }

  function htmlGreeting() {
    return (
      "<p>Hola. Soy la mesa de ayuda de <strong>AURA-HidroIA</strong>. Puedo explicar el proyecto, el tablero, las alertas, los reportes y si los datos son reales.</p>" +
      "<p>Elegí un botón o escribí tu pregunta. No envío mails ni cargo archivos.</p>"
    );
  }

  function renderFor(id) {
    if (id === "que-es") return htmlQueEs();
    if (id === "tablero") return htmlTablero();
    if (id === "alertas") return htmlAlertas();
    if (id === "reportes") return htmlReportes();
    if (id === "asistente") return htmlAsistente();
    if (id === "datos") return htmlDatos();
    if (id === "contacto") return htmlContacto();
    return htmlFallback();
  }

  function matchId(query) {
    var q = normalize(query);
    if (!q) return null;
    var best = null;
    var bestScore = 0;
    Object.keys(ANSWERS).forEach(function (id) {
      var entry = ANSWERS[id];
      var score = 0;
      entry.keywords.forEach(function (kw) {
        if (q.indexOf(normalize(kw)) !== -1) score += 4;
      });
      (entry.extra || []).forEach(function (kw) {
        if (q.indexOf(normalize(kw)) !== -1) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    });
    if (!best || bestScore < 2) return null;
    return best;
  }

  function appendMessage(log, role, htmlOrText, asHtml) {
    var div = document.createElement("div");
    div.className = "mesa-ayuda-msg mesa-ayuda-msg--" + role;
    if (asHtml) div.innerHTML = htmlOrText;
    else div.textContent = htmlOrText;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function init() {
    var panel = document.getElementById("mesa-ayuda-panel");
    var toggle = document.getElementById("mesa-ayuda-toggle");
    var closeBtn = document.getElementById("mesa-ayuda-close");
    var log = document.getElementById("mesa-ayuda-log");
    var form = document.getElementById("mesa-ayuda-form");
    var input = document.getElementById("mesa-ayuda-input");
    var quick = document.getElementById("mesa-ayuda-quick");
    if (!panel || !toggle || !log || !form || !input) return;

    var greeted = false;

    function greet() {
      if (greeted) return;
      greeted = true;
      appendMessage(log, "bot", htmlGreeting(), true);
    }

    function setOpen(open) {
      if (open) {
        panel.removeAttribute("hidden");
        toggle.setAttribute("aria-expanded", "true");
        document.body.classList.add("mesa-ayuda-open");
        greet();
        window.setTimeout(function () {
          input.focus();
        }, 50);
      } else {
        panel.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("mesa-ayuda-open");
      }
    }

    function paintQuick() {
      if (!quick) return;
      quick.innerHTML = ["que-es", "tablero", "alertas", "reportes", "datos", "contacto"]
        .map(function (id) {
          return (
            '<button type="button" data-mesa-q="' + id + '">' + LABELS[id] + "</button>"
          );
        })
        .join("");
    }

    function ask(text, idHint) {
      var q = String(text || "").trim();
      var id = idHint || matchId(q);
      if (!q && !id) return;
      setOpen(true);
      appendMessage(log, "user", q || LABELS[id] || id, false);
      window.setTimeout(function () {
        appendMessage(log, "bot", renderFor(id), true);
      }, 180);
    }

    paintQuick();

    toggle.addEventListener("click", function () {
      setOpen(panel.hasAttribute("hidden"));
    });
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setOpen(false);
      });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = input.value;
      input.value = "";
      ask(q);
    });

    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-mesa-q]");
      if (!btn) return;
      ev.preventDefault();
      ask("", btn.getAttribute("data-mesa-q"));
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !panel.hasAttribute("hidden")) setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
