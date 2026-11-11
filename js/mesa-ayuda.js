/**
 * Mesa de ayuda del Plan AURA: respuestas fijas del portal.
 * Sin API: funciona en GitHub Pages.
 */
(function () {
  var MAIL = "luisjimenez@uccuyo.edu.ar";

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
    estres: {
      keywords: [
        "estres hidrico",
        "que es el estres",
        "que es estres",
        "que significa estres",
        "oferta y demanda"
      ],
      extra: ["estres", "oferta", "demanda"]
    },
    ciclo: {
      keywords: [
        "ciclo hidrologico",
        "ciclo del agua",
        "que es el ciclo"
      ],
      extra: ["ciclo", "precipita", "evapora", "infiltra"]
    },
    nival: {
      keywords: [
        "regimen nival",
        "ciclo nival",
        "deshielo",
        "nieve en los andes",
        "rio san juan"
      ],
      extra: ["nival", "nieve", "andes", "deshielo"]
    },
    fuentes: {
      keywords: [
        "agua superficial",
        "agua subterranea",
        "acuifero",
        "valle de tulum"
      ],
      extra: ["superficial", "subterranea", "embalse", "canal"]
    },
    hidro: {
      keywords: [
        "informacion hidrologica",
        "hidrologica basica",
        "seccion hidrologica",
        "hidrologia"
      ],
      extra: ["hidrologica", "hidrologico"]
    },
    caudal: {
      keywords: [
        "caudal",
        "km 101",
        "km101",
        "escurrimiento",
        "serie historica",
        "anio hidrologico"
      ],
      extra: ["rio san juan", "media", "tendencia"]
    },
    embalses: {
      keywords: [
        "embalse",
        "embalses",
        "embalses y cotas",
        "punta negra",
        "ullum",
        "caracoles",
        "cuesta del viento",
        "cota"
      ],
      extra: ["nivel", "niveles", "esquema"]
    },
    laboratorio: {
      keywords: [
        "laboratorio",
        "laboratorio de datos",
        "datos hidricos",
        "indicadores hidrologicos",
        "recorte",
        "comparar periodos"
      ],
      extra: ["estadistica", "estadisticas", "periodo a", "periodo b"]
    },
    descargas: {
      keywords: [
        "descargar",
        "descargas",
        "csv",
        "excel",
        "xlsx",
        "json",
        "png",
        "pdf de la serie"
      ],
      extra: ["tabla", "serie", "manifest"]
    },
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
      extra: ["octubre", "noviembre", "septiembre", "millones"]
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

  var QUICK_IDS = [
    "hidro",
    "laboratorio",
    "embalses",
    "caudal",
    "estres",
    "descargas"
  ];

  function labelFor(id) {
    var map = {
      hidro: ["bot.q.hidro", "Información hidrológica básica"],
      laboratorio: ["bot.q.laboratorio", "Laboratorio de datos hídricos"],
      caudal: ["bot.q.caudal", "Caudal Km 101"],
      embalses: ["bot.q.embalses", "Embalses y cotas"],
      estres: ["bot.q.estres", "Qué es estrés hídrico"],
      ciclo: ["bot.q.ciclo", "Ciclo hidrológico"],
      nival: ["bot.q.nival", "Régimen nival"],
      fuentes: ["bot.q.fuentes", "Agua superficial y subterránea"],
      descargas: ["bot.q.descargas", "Descargar datos"],
      presentar: ["bot.q.presentar", "Cómo presentar un proyecto"],
      plazos: ["bot.q.plazos", "Fechas y montos"],
      ejes: ["bot.q.ejes", "Ejes temáticos"],
      plan: ["bot.q.plan", "Qué es el Plan AURA"],
      contacto: ["bot.q.contacto", "Contacto"]
    };
    var entry = map[id] || map.hidro;
    return t(entry[0], entry[1]);
  }

  function htmlPresentar() {
    if (lang() === "en") {
      return (
        "<p>The Plan AURA <strong>call for projects is not published</strong> on this site. For other questions write to <a href=\"mailto:" +
        MAIL +
        "\">" +
        MAIL +
        "</a>.</p>"
      );
    }
    return (
      "<p>La <strong>convocatoria de proyectos del Plan AURA no está publicada</strong> en este sitio. Para otras consultas escribí a <a href=\"mailto:" +
      MAIL +
      "\">" +
      MAIL +
      "</a>.</p>"
    );
  }

  function htmlPlazos() {
    return htmlPresentar();
  }

  function htmlEjes() {
    if (lang() === "en") {
      return (
        "<p>Thematic axes of the call are not published on this site. See <a href=\"#el-plan\">El Plan AURA</a> or write to <a href=\"mailto:" +
        MAIL +
        "\">" +
        MAIL +
        "</a>.</p>"
      );
    }
    return (
      "<p>Los ejes temáticos de la convocatoria no están publicados en este sitio. Ver <a href=\"#el-plan\">El Plan AURA</a> o escribir a <a href=\"mailto:" +
      MAIL +
      "\">" +
      MAIL +
      "</a>.</p>"
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

  function htmlHidro() {
    if (lang() === "en") {
      return (
        "<p><strong>Basic hydrological information</strong></p>" +
        "<p>This section shows daily flow at Km 101, reservoir levels, decade tables and charts, annual analysis and trends, and short explainers (cycle, snowmelt regime, water stress). Source: San Juan Department of Hydraulics.</p>" +
        "<p>Open it: <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Basic hydrological information</a>.</p>"
      );
    }
    return (
      "<p><strong>Información hidrológica básica</strong></p>" +
      "<p>En esa sección ves el caudal diario en Km 101, cotas de embalses, tablas y gráficos por década, análisis anual y tendencias, y nociones básicas (ciclo, régimen nival, estrés hídrico). Fuente: Departamento de Hidráulica de San Juan.</p>" +
      "<p>Abrila acá: <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Información hidrológica básica</a>.</p>"
    );
  }

  function htmlCaudal() {
    if (lang() === "en") {
      return (
        "<p><strong>Flow at Km 101</strong></p>" +
        "<p>The San Juan River series at Km 101 runs from hydrological year 1909–10 (July–June) to today. The section shows the latest reading, decade means, monthly detail, annual analysis and trends. Missing published days stay as s/d; they are not interpolated.</p>" +
        "<p>See <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">the hydrology section</a> and <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#serie-historica\">historical series</a>.</p>"
      );
    }
    return (
      "<p><strong>Caudal Km 101</strong></p>" +
      "<p>La serie del río San Juan en Km 101 va desde el año hidrológico 1909-10 (julio–junio) hasta hoy. En la sección ves el dato del día, medias por década, detalle mensual, análisis anual y tendencias. Los días sin dato publicado quedan como s/d; no se interpolan.</p>" +
      "<p>Miralo en <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Información hidrológica básica</a> y en <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#serie-historica\">serie histórica</a>.</p>"
    );
  }

  function htmlEmbalses() {
    if (lang() === "en") {
      return (
        "<p><strong>Reservoirs and levels</strong></p>" +
        "<p>Choose a year to see mean, max or min elevation for Punta Negra, Ullum, Los Caracoles and Cuesta del Viento, with a fill schematic and the daily series. Data start around 2014–2015.</p>" +
        "<p>Open <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#embalses-cotas\">Reservoirs and levels</a>.</p>"
      );
    }
    return (
      "<p><strong>Embalses y cotas</strong></p>" +
      "<p>Elegí un año para ver la cota media, máxima o mínima de Punta Negra, Ullum, Los Caracoles y Cuesta del Viento, con un esquema de llenado y la serie diaria. La serie arranca hacia 2014–2015.</p>" +
      "<p>Abrí <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#embalses-cotas\">Embalses y cotas</a>.</p>"
    );
  }

  function htmlLaboratorio() {
    if (lang() === "en") {
      return (
        "<p><strong>Water data lab</strong></p>" +
        "<p>Extract the daily Km 101 series from 1910, compute statistics for a period, optionally compare a second span, download the CSV subset and copy a citation. Unpublished days are not interpolated.</p>" +
        "<p>Open <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#datos-hidrologicos\">Water data lab</a>.</p>"
      );
    }
    return (
      "<p><strong>Laboratorio de datos hídricos</strong></p>" +
      "<p>Extraé la serie diaria de Km 101 desde 1910, calculá estadísticas de un período, compará otro tramo si hace falta, descargá el recorte CSV y copiá una cita. Los días sin dato no se interpolan.</p>" +
      "<p>Abrí <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#datos-hidrologicos\">Laboratorio de datos hídricos</a>.</p>"
    );
  }

  function htmlDescargas() {
    if (lang() === "en") {
      return (
        "<p><strong>Download data</strong></p>" +
        "<p>Use the <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#datos-hidrologicos\">Water data lab</a> for a date-range CSV, or the package links there and in <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#hidro-descargas\">Download data</a> for the full daily series, annual summaries, reservoir levels and charts.</p>"
      );
    }
    return (
      "<p><strong>Descargar datos</strong></p>" +
      "<p>Usá el <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#datos-hidrologicos\">Laboratorio de datos hídricos</a> para un CSV por rango de fechas, o los paquetes de ahí y de <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#hidro-descargas\">Descargar datos</a> para la serie diaria completa, resúmenes anuales, cotas y gráficos.</p>"
    );
  }

  function htmlCiclo() {
    if (lang() === "en") {
      return (
        "<p><strong>Hydrological cycle</strong></p>" +
        "<p>Water moves between atmosphere, surface, and subsurface: it precipitates, runs off, infiltrates, evaporates, and returns to the atmosphere. In arid zones that cycle is fragile: little rainfall, high evaporation, and strong dependence on what arrives from the Andes.</p>" +
        "<p>More in <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Basic hydrological information</a>.</p>"
      );
    }
    return (
      "<p><strong>Ciclo hidrológico</strong></p>" +
      "<p>El agua circula entre atmósfera, superficie y subsuelo: precipita, escurre, se infiltra, se evapora y vuelve a la atmósfera. En zonas áridas ese ciclo es frágil: poca lluvia, alta evaporación y fuerte dependencia de lo que llega desde la cordillera.</p>" +
      "<p>Más en <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Información hidrológica básica</a>.</p>"
    );
  }

  function htmlNival() {
    if (lang() === "en") {
      return (
        "<p><strong>Snowmelt regime</strong></p>" +
        "<p>The San Juan River has a predominantly nival regime: its flow depends mainly on Andean snowpack and snowmelt. That is why there are wetter years and scarcer years, according to the snow cycle.</p>" +
        "<p>More in <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Basic hydrological information</a>.</p>"
      );
    }
    return (
      "<p><strong>Régimen nival</strong></p>" +
      "<p>El río San Juan tiene régimen predominantemente nival: su caudal depende sobre todo de la nieve acumulada en los Andes y del deshielo. Por eso hay años más abundantes y años de escasez, según el ciclo nival.</p>" +
      "<p>Más en <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Información hidrológica básica</a>.</p>"
    );
  }

  function htmlFuentes() {
    if (lang() === "en") {
      return (
        "<p><strong>Surface and groundwater</strong></p>" +
        "<p>In the Tulum Valley, surface water (river, reservoirs, and canals) and aquifer groundwater coexist. Part of the flow infiltrates and recharges the aquifer; its level rises or falls with wet or dry cycles and with how the resource is used.</p>" +
        "<p>More in <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Basic hydrological information</a>.</p>"
      );
    }
    return (
      "<p><strong>Agua superficial y subterránea</strong></p>" +
      "<p>En el Valle de Tulum conviven el agua superficial (río, embalses y canales) y el agua subterránea del acuífero. Parte del caudal se infiltra y recarga el acuífero; su nivel sube o baja según ciclos húmedos o secos y según el uso que se haga del recurso.</p>" +
      "<p>Más en <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Información hidrológica básica</a>.</p>"
    );
  }

  function htmlEstres() {
    if (lang() === "en") {
      return (
        "<p><strong>What is water stress?</strong></p>" +
        "<p>Supply is the water available (flow and reserves). Demand is what households, irrigation, industry, and services require. Water stress describes the tension between them: a high value does not always mean “there is no water,” but a greater mismatch between what is available and what is needed.</p>" +
        "<p>More in <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Basic hydrological information</a>.</p>"
      );
    }
    return (
      "<p><strong>Qué es el estrés hídrico</strong></p>" +
      "<p>La oferta es el agua disponible (caudal y reservas). La demanda es lo que requieren hogares, riego, industria y servicios. El estrés hídrico describe la tensión entre ambas: un valor alto no siempre significa «no hay agua», sino mayor desacople entre lo disponible y lo que se necesita.</p>" +
      "<p>Más en <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Información hidrológica básica</a>.</p>"
    );
  }

  function htmlFallback() {
    if (lang() === "en") {
      return (
        "<p>I can help with <strong>hydrology</strong> (basic info, data lab, reservoirs, downloads) and the Plan. Try the quick buttons or open <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Basic hydrological information</a>. Write to <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a> if needed.</p>"
      );
    }
    return (
      "<p>Puedo ayudarte con <strong>hidrología</strong> (información básica, laboratorio, embalses, descargas) y el Plan. Probá los botones o abrí <a href=\"https://claudiomlarrea.github.io/observatorio-ia/instituto-del-agua/#info-hidrologica\">Información hidrológica básica</a>. Consultas: <a href=\"mailto:" + MAIL + "\">" + MAIL + "</a>.</p>"
    );
  }

  function htmlGreeting() {
    if (lang() === "en") {
      return (
        "<p>This is the <strong>Help desk</strong> of Plan AURA. Ask about the data lab, reservoirs and levels, flow at Km 101 or water stress.</p>"
      );
    }
    return (
      "<p>Soy la <strong>Mesa de ayuda</strong> del Plan AURA. Preguntame por el <strong>laboratorio de datos hídricos</strong>, <strong>embalses y cotas</strong>, caudal Km 101 o estrés hídrico.</p>"
    );
  }

  function renderFor(id) {
    if (id === "hidro") return htmlHidro();
    if (id === "laboratorio") return htmlLaboratorio();
    if (id === "caudal") return htmlCaudal();
    if (id === "embalses") return htmlEmbalses();
    if (id === "descargas") return htmlDescargas();
    if (id === "estres") return htmlEstres();
    if (id === "ciclo") return htmlCiclo();
    if (id === "nival") return htmlNival();
    if (id === "fuentes") return htmlFuentes();
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
      quick.innerHTML = QUICK_IDS.map(function (id) {
        return (
          '<button type="button" data-mesa-q="' +
          id +
          '">' +
          labelFor(id) +
          "</button>"
        );
      }).join("");
    }

    function ask(text, idHint) {
      var q = String(text || "").trim();
      var id = idHint || matchId(q);
      if (!q && !id) return;
      var label = q || labelFor(id);
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
