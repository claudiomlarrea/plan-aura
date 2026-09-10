/**
 * Mesa de ayuda del Plan AURA: respuestas fijas del portal.
 * Sin API: funciona en GitHub Pages.
 */
(function () {
  var MAIL = "luisjimenez@uccuyo.edu.ar";
  var BASES = "documentos/Convocatoria_Proyectos_AURA.pdf";
  var PLANTILLA =
    "documentos/plantillas/Presentacion_proyectos_Convocatoria_AURA.docx";
  var DRIVE =
    "https://drive.google.com/drive/folders/1u1m-4y44z0pBdu2NJVUTzZF7hJEcmB9O";

  function t(key, fallback) {
    if (window.I18N && typeof window.I18N.t === "function") return window.I18N.t(key);
    return fallback || key;
  }

  function lang() {
    return window.I18N && window.I18N.getLang ? window.I18N.getLang() : "es";
  }

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
    presentar: {
      keywords: [
        "presentar un proyecto",
        "presentar proyecto",
        "como presento",
        "como se presenta",
        "cargar en drive",
        "plantilla",
        "inscribir",
        "inscripcion"
      ],
      extra: ["proyecto", "proyectos", "convocatoria", "presentacion"]
    },
    plazos: {
      keywords: [
        "fecha",
        "fechas",
        "plazo",
        "plazos",
        "cierre",
        "apertura",
        "monto",
        "presupuesto",
        "tope",
        "cuanto dura"
      ],
      extra: ["octubre", "septiembre", "millones"]
    },
    ejes: {
      keywords: ["eje", "ejes", "tematico", "tematicos", "linea", "lineas"],
      extra: []
    },
    plan: {
      keywords: ["que es el plan", "que es aura", "el plan aura", "para que sirve"],
      extra: ["aura", "plan"]
    },
    contacto: {
      keywords: ["contacto", "mail", "correo", "consultar", "quien coordina"],
      extra: ["luis", "jimenez"]
    }
  };

  function htmlPresentar() {
    if (lang() === "en") {
      return (
        "<p><strong>How to submit a project</strong></p>" +
        "<ol>" +
        "<li>Read the <a href=\"" + BASES + "\" target=\"_blank\" rel=\"noopener noreferrer\">call guidelines (PDF)</a>.</li>" +
        "<li>Download and complete the <a href=\"" + PLANTILLA + "\" download>single template (DOCX)</a>.</li>" +
        "<li>Get approval from your Academic Unit’s Directing Council.</li>" +
        "<li>Upload the file to the <a href=\"" + DRIVE + "\" target=\"_blank\" rel=\"noopener noreferrer\">call Drive folder</a>.</li>" +
        "</ol>" +
        "<p>Circuit: UA → Drive → Committee → Councils → Superior Council. Questions: <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a>.</p>"
      );
    }
    return (
      "<p><strong>Cómo presentar un proyecto</strong></p>" +
      "<ol>" +
      "<li>Leé las <a href=\"" + BASES + "\" target=\"_blank\" rel=\"noopener noreferrer\">bases / instructivo (PDF)</a>.</li>" +
      "<li>Descargá y completá la <a href=\"" + PLANTILLA + "\" download>plantilla única (DOCX)</a>.</li>" +
      "<li>Aprobación del Consejo Directivo de tu Unidad Académica.</li>" +
      "<li>Cargá el archivo en la <a href=\"" + DRIVE + "\" target=\"_blank\" rel=\"noopener noreferrer\">carpeta Drive de la convocatoria</a>.</li>" +
      "</ol>" +
      "<p>Circuito: UA → Drive → Comité → Consejos → Consejo Superior. Consultas: <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a>.</p>"
    );
  }

  function htmlPlazos() {
    if (lang() === "en") {
      return (
        "<p><strong>Dates and budget (2026 call)</strong></p>" +
        "<ul>" +
        "<li>Opens: 15 September 2026</li>" +
        "<li>Closes: 30 October 2026</li>" +
        "<li>Duration: 12 months (until Oct. 2027)</li>" +
        "<li>Total budget: $10,000,000 · up to $1,000,000 per project · 10 projects</li>" +
        "</ul>" +
        "<p>Source: <a href=\"#convocatoria\">Convocatorias</a> on this site.</p>"
      );
    }
    return (
      "<p><strong>Fechas y montos (convocatoria 2026)</strong></p>" +
      "<ul>" +
      "<li>Apertura: 15 de septiembre de 2026</li>" +
      "<li>Cierre: 30 de octubre de 2026</li>" +
      "<li>Duración: 12 meses (hasta oct. 2027)</li>" +
      "<li>Presupuesto total: $10.000.000 · tope $1.000.000 · 10 proyectos</li>" +
      "</ul>" +
      "<p>Fuente: sección <a href=\"#convocatoria\">Convocatorias</a> de este sitio.</p>"
    );
  }

  function htmlEjes() {
    if (lang() === "en") {
      return (
        "<p>There are 11 thematic axes (consumption, technology, productive impact, health, territory, training, community practice, water quality, education, legislation, and other AURA-related topics). See the full list on <a href=\"#conv-ejes\">thematic axes</a>.</p>"
      );
    }
    return (
      "<p>Hay <strong>11 ejes temáticos</strong> (consumo, tecnología, impacto productivo, salud, territorio, formación, prácticas comunitarias, calidad del agua, educación, legislación y otros pertinentes a AURA). La lista completa está en <a href=\"#conv-ejes\">Ejes temáticos</a>.</p>"
    );
  }

  function htmlPlan() {
    if (lang() === "en") {
      return (
        "<p><strong>Plan AURA</strong> is UCCuyo’s Comprehensive Plan for Saving and Responsible Water Use (Superior Council Res. 418-CS-2024). It links teaching, research and outreach on water in arid contexts. Start at <a href=\"#el-plan\">El Plan AURA</a>.</p>"
      );
    }
    return (
      "<p>El <strong>Plan AURA</strong> es el Plan Integral de Ahorro y Uso Responsable del Agua de la UCCuyo (Res. 418-CS-2024). Articula docencia, investigación y extensión sobre el recurso hídrico en contextos áridos. Empezá por <a href=\"#el-plan\">El Plan AURA</a>.</p>"
    );
  }

  function htmlContacto() {
    if (lang() === "en") {
      return (
        "<p><strong>Technical coordinator:</strong> Eng. Luis Jiménez · <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a>.</p>"
      );
    }
    return (
      "<p><strong>Coordinador Técnico:</strong> Ing. Luis Jiménez · <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a>.</p>"
    );
  }

  function htmlFallback() {
    if (lang() === "en") {
      return (
        "<p>I can help with submitting a project, dates, axes or contact. If it is not on <a href=\"https://plan-aura.com.ar/\">plan-aura.com.ar</a>, write to <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a>.</p>"
      );
    }
    return (
      "<p>Puedo ayudarte a <strong>presentar un proyecto</strong>, con fechas, ejes o contacto. Si no está en <a href=\"https://plan-aura.com.ar/\">plan-aura.com.ar</a>, escribí a <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a>.</p>"
    );
  }

  function htmlGreeting() {
    if (lang() === "en") {
      return "<p>This is the <strong>Mesa de ayuda</strong> of Plan AURA. The most frequent question is how to submit a research or outreach project.</p>";
    }
    return (
      "<p>Soy la <strong>Mesa de ayuda</strong> del Plan AURA. La consulta más frecuente: cómo presentar un proyecto de investigación o extensión.</p>"
    );
  }

  function renderFor(id) {
    if (id === "presentar") return htmlPresentar();
    if (id === "plazos") return htmlPlazos();
    if (id === "ejes") return htmlEjes();
    if (id === "plan") return htmlPlan();
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
    if (best === "presentar" && bestScore >= 1) return "presentar";
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
      quick.innerHTML =
        '<button type="button" data-mesa-q="presentar">' +
        t("bot.q.presentar", "Cómo presentar un proyecto") +
        "</button>" +
        '<button type="button" data-mesa-q="plazos">' +
        t("bot.q.plazos", "Fechas y montos") +
        "</button>";
    }

    function ask(text, idHint) {
      var q = String(text || "").trim();
      var id = idHint || matchId(q);
      if (!q && !id) return;
      var label = q;
      if (!label) {
        if (id === "plazos") label = t("bot.q.plazos", "Fechas y montos");
        else label = t("bot.q.presentar", "Cómo presentar un proyecto");
      }
      setOpen(true);
      appendMessage(log, "user", label, false);
      var html = renderFor(id);
      window.setTimeout(function () {
        appendMessage(log, "bot", html, true);
      }, 180);
    }

    paintQuick();
    greet();

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

    window.addEventListener("oia:langchange", function () {
      paintQuick();
    });

    if (location.hash === "#mesa-ayuda") setOpen(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
