/**
 * Biblioteca del Agua — índice global (OpenAlex, Crossref, Semantic Scholar, Europe PMC + Unpaywall).
 * Temas alineados a los ejes del Plan AURA / convocatoria.
 */
(function () {
  var CFG = window.OBS_PUBLICACIONES || {};
  var MAILTO = String(CFG.OPENALEX_MAILTO || "luisjimenez@uccuyo.edu.ar").trim();
  var DEFAULT_PAGE_SIZE = Number(CFG.OPENALEX_PAGE_SIZE) || 15;
  var SEARCH_DEBOUNCE_MS = 450;
  var DEFAULT_QUERY = String(
    CFG.AGUA_DEFAULT_QUERY ||
      '"water consumption" OR "responsible water use" OR "rational water use" OR "water conservation" OR "water saving" OR "sustainable water use"'
  ).trim();
  var AGUA_OPENALEX_SEARCH = String(
    CFG.AGUA_OPENALEX_SEARCH ||
      '"water conservation"|"water saving"|"responsible water use"|"rational water use"|"water consumption"|"water reuse"|"water scarcity"|"water education"'
  ).trim();

  var items = [];
  var metaTotal = 0;
  var currentPage = 1;
  var totalPages = 1;
  var loaded = false;
  var loading = false;
  var searchQuery = "";
  var searchMode = "auto";
  var searchDebounce = null;
  var pendingPage = null;
  var pendingQuery = null;
  var yearFilter = "all";
  var pageSize = DEFAULT_PAGE_SIZE;
  var sortMode = "date_desc";
  var started = false;

  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function tt(key, fallback, vars) {
    if (window.I18N && typeof window.I18N.t === "function") {
      var v = window.I18N.t(key, vars);
      if (v && v !== key) return v;
    }
    var text = fallback == null ? key : fallback;
    if (vars && typeof vars === "object") {
      Object.keys(vars).forEach(function (k) {
        text = String(text).split("{" + k + "}").join(String(vars[k]));
      });
    }
    return text;
  }

  function formatInt(n) {
    var loc =
      window.I18N && window.I18N.getLang && window.I18N.getLang() === "en"
        ? "en-US"
        : "es-AR";
    return Number(n || 0).toLocaleString(loc);
  }

  function normalizarDoi(q) {
    var s = String(q || "").trim();
    s = s.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
    s = s.replace(/^doi:\s*/i, "");
    return s.trim();
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightText(text) {
    var src = text == null ? "" : String(text);
    var q = searchQuery.trim();
    if (!q) return esc(src);
    var needle = /^10\.\d{3,}/i.test(normalizarDoi(q)) ? normalizarDoi(q) : q;
    if (!needle) return esc(src);
    var re = new RegExp("(" + escapeRegExp(needle) + ")", "ig");
    var isExact = new RegExp("^" + escapeRegExp(needle) + "$", "i");
    return src
      .split(re)
      .map(function (part) {
        return isExact.test(part) ? '<mark class="pub-mark">' + esc(part) + "</mark>" : esc(part);
      })
      .join("");
  }

  function actualizarContador() {
    var wrap = el("pub-index-count-wrap");
    var label = el("pub-index-count-label");
    var n = formatInt(metaTotal);
    if (wrap) wrap.hidden = false;
    if (label) {
      var tpl = tt(
        "sec.biblio.count",
        "{n} trabajos aproximados (referencia OpenAlex)"
      );
      label.innerHTML = tpl
        .split("{n}")
        .join('<strong id="pub-index-total">' + esc(n) + "</strong>");
    }
  }

  function mensajeCarga() {
    return (
      '<div class="pub-msg pub-msg--loading">' +
      tt(
        "dyn.biblio.loading",
        "Cargando en OpenAlex, Crossref, Semantic Scholar y Europe PMC..."
      ) +
      "</div>"
    );
  }

  function filaHTML(it) {
    var href = it.oaUrl || it.link || (it.doi ? "https://doi.org/" + it.doi : "");
    var linkLabel = it.oaUrl
      ? tt("dyn.biblio.openOa", "Leer / descargar (OA)")
      : it.doi
        ? tt("dyn.biblio.viewDoi", "Ver DOI")
        : tt("dyn.biblio.openLink", "Abrir enlace");
    var linkHtml = href
      ? '<a class="pub-btn-link" href="' +
        esc(href) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(linkLabel) +
        "</a>"
      : '<span class="pub-row-nolink">' + tt("dyn.biblio.noLink", "Sin enlace") + "</span>";
    var meta = [];
    if (it.autores) meta.push(highlightText(it.autores));
    if (it.fuente) meta.push(esc(it.fuente));
    if (it.doi) meta.push("DOI: " + highlightText(it.doi));
    return (
      '<article class="pub-row">' +
      '<div class="pub-row-type"><span class="pub-chip pub-chip--papers">' +
      esc(it.tipo || tt("dyn.biblio.chip.articulo", "Artículo")) +
      "</span></div>" +
      '<div class="pub-row-main"><h3 class="pub-row-title">' +
      highlightText(it.titulo || "Sin título") +
      "</h3>" +
      (meta.length ? '<p class="pub-row-meta">' + meta.join(" · ") + "</p>" : "") +
      "</div>" +
      '<div class="pub-row-when"><span class="pub-row-year">' +
      esc(it.anio || "—") +
      "</span></div>" +
      '<div class="pub-row-link">' +
      linkHtml +
      "</div></article>"
    );
  }

  function dibujarPager() {
    if (totalPages <= 1) return "";
    var prevDisabled = currentPage <= 1 ? " disabled" : "";
    var nextDisabled = currentPage >= totalPages ? " disabled" : "";
    return (
      '<nav class="pub-index-pager" aria-label="' +
      esc(tt("dyn.biblio.pager", "Paginación")) +
      '">' +
      '<button type="button" class="pub-more-btn" data-pub-page="1"' +
      (currentPage <= 1 ? " disabled" : "") +
      ">" +
      tt("dyn.biblio.first", "Primera") +
      "</button>" +
      '<button type="button" class="pub-more-btn" data-pub-page="' +
      (currentPage - 1) +
      '"' +
      prevDisabled +
      ">" +
      tt("dyn.biblio.prev", "Anterior") +
      "</button>" +
      "<span>" +
      tt("dyn.biblio.pageOf", "Página {n} de {total} · {count} resultados", {
        n: formatInt(currentPage),
        total: formatInt(totalPages),
        count: formatInt(metaTotal)
      }) +
      "</span>" +
      '<button type="button" class="pub-more-btn" data-pub-page="' +
      (currentPage + 1) +
      '"' +
      nextDisabled +
      ">" +
      tt("dyn.biblio.next", "Siguiente") +
      "</button>" +
      '<button type="button" class="pub-more-btn" data-pub-page="' +
      totalPages +
      '"' +
      (currentPage >= totalPages ? " disabled" : "") +
      ">" +
      tt("dyn.biblio.last", "Última") +
      "</button>" +
      "</nav>"
    );
  }

  function dibujarGrilla() {
    var grid = el("pub-index-grid");
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML =
        '<div class="pub-msg pub-msg--hint"><p>' +
        tt("dyn.biblio.empty", "No hay resultados para esa búsqueda.") +
        "</p></div>";
      return;
    }
    grid.innerHTML =
      '<div class="pub-list" role="list">' +
      '<div class="pub-list-head" aria-hidden="true">' +
      "<span>" +
      tt("dyn.biblio.head.tipo", "Tipo") +
      "</span><span>" +
      tt("dyn.biblio.head.titulo", "Título") +
      "</span><span>" +
      tt("dyn.biblio.head.ano", "Año") +
      "</span><span>" +
      tt("dyn.biblio.head.enlace", "Enlace") +
      "</span></div>" +
      items.map(filaHTML).join("") +
      "</div>" +
      dibujarPager();

    grid.querySelectorAll("[data-pub-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = Number(btn.getAttribute("data-pub-page"));
        if (!p || p < 1) return;
        cargarPagina(p);
        var sec = el("publicaciones");
        if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "start" });
      });
    });
  }

  function actualizarBotonLimpiar() {
    var clearBtn = el("pub-index-q-clear");
    if (clearBtn) clearBtn.hidden = !searchQuery.trim();
  }

  function actualizarResumenFiltros() {
    var box = el("pub-index-active");
    if (!box) return;
    var partes = [];
    if (searchQuery.trim()) {
      partes.push(
        tt("dyn.biblio.activeQuery", "Búsqueda: “{q}”", { q: searchQuery.trim() })
      );
    }
    if (yearFilter !== "all") {
      partes.push(tt("dyn.biblio.activeYear", "Año: {y}", { y: yearFilter }));
    }
    box.textContent = partes.join(" · ");
  }

  function ejecutarPendiente() {
    if (pendingPage == null) return;
    var p = pendingPage;
    var q = pendingQuery;
    pendingPage = null;
    pendingQuery = null;
    cargarPagina(p, q);
  }

  function cargarPagina(page, query) {
    if (typeof query === "string") searchQuery = query;
    if (loading) {
      pendingPage = page;
      pendingQuery = typeof query === "string" ? query : null;
      return;
    }
    if (!window.PUB_FUENTES_ABIERTAS || !window.PUB_FUENTES_ABIERTAS.buscar) {
      var statusErr = el("pub-index-status");
      if (statusErr) {
        statusErr.innerHTML =
          '<div class="pub-msg pub-msg--error">' +
          tt("dyn.biblio.errorScript", "No se pudo cargar el buscador de fuentes abiertas.") +
          "</div>";
      }
      return;
    }
    loading = true;
    currentPage = page;
    var status = el("pub-index-status");
    if (status) status.innerHTML = mensajeCarga();

    window.PUB_FUENTES_ABIERTAS.buscar({
      scope: "agua-global",
      aguaSearch: AGUA_OPENALEX_SEARCH,
      defaultQuery: DEFAULT_QUERY,
      mailto: MAILTO,
      appLabel: "Biblioteca del Agua · Plan AURA UCCuyo",
      page: page,
      pageSize: pageSize,
      searchQuery: searchQuery,
      searchMode: searchMode,
      yearFilter: yearFilter,
      sortMode: sortMode
    })
      .then(function (res) {
        loading = false;
        if (!res || !res.items) throw new Error("format");
        metaTotal = Number(res.metaTotal) || 0;
        currentPage = Number(res.currentPage) || page;
        totalPages = Number(res.totalPages) || Math.max(1, Math.ceil(metaTotal / pageSize));
        items = res.items;
        loaded = true;
        actualizarContador();
        actualizarBotonLimpiar();
        actualizarResumenFiltros();
        if (status) status.innerHTML = "";
        dibujarGrilla();
        ejecutarPendiente();
      })
      .catch(function () {
        loading = false;
        if (status) {
          status.innerHTML =
            '<div class="pub-msg pub-msg--error">' +
            tt(
              "dyn.biblio.error",
              "No se pudo cargar el índice desde las fuentes abiertas. Probá de nuevo en unos minutos."
            ) +
            "</div>";
        }
        ejecutarPendiente();
      });
  }

  function programarBusqueda(valor) {
    if (searchDebounce) window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(function () {
      searchDebounce = null;
      cargarPagina(1, valor);
    }, SEARCH_DEBOUNCE_MS);
  }

  function seleccionarModo(modo) {
    searchMode = modo || "auto";
    document.querySelectorAll("[data-pub-index-mode]").forEach(function (btn) {
      var on = btn.getAttribute("data-pub-index-mode") === searchMode;
      btn.classList.toggle("pub-index-mode--active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function construirOpcionesAnio() {
    var select = el("pub-index-year");
    if (!select) return;
    var currentYear = new Date().getFullYear();
    var opts = [
      '<option value="all">' + esc(tt("dyn.biblio.allYears", "Todos los años")) + "</option>"
    ];
    for (var y = currentYear; y >= 1990; y--) {
      opts.push('<option value="' + y + '">' + y + "</option>");
    }
    select.innerHTML = opts.join("");
    select.value = yearFilter;
  }

  function limpiarBusqueda() {
    var input = el("pub-index-q");
    if (input) input.value = "";
    searchQuery = "";
    actualizarBotonLimpiar();
    actualizarResumenFiltros();
    cargarPagina(1, "");
  }

  function limpiarTodo() {
    var input = el("pub-index-q");
    var yearSelect = el("pub-index-year");
    var sizeSelect = el("pub-index-size");
    var sortSelect = el("pub-index-sort");
    if (input) input.value = "";
    if (yearSelect) yearSelect.value = "all";
    if (sizeSelect) sizeSelect.value = String(DEFAULT_PAGE_SIZE);
    if (sortSelect) sortSelect.value = "date_desc";
    searchQuery = "";
    searchMode = "auto";
    yearFilter = "all";
    pageSize = DEFAULT_PAGE_SIZE;
    sortMode = "date_desc";
    seleccionarModo("auto");
    actualizarBotonLimpiar();
    actualizarResumenFiltros();
    cargarPagina(1, "");
  }

  function initBuscador() {
    var input = el("pub-index-q");
    if (!input) return;
    construirOpcionesAnio();
    var sizeSelect = el("pub-index-size");
    var sortSelect = el("pub-index-sort");
    var yearSelect = el("pub-index-year");
    var clearBtn = el("pub-index-q-clear");
    var clearAllBtn = el("pub-index-clear-all");
    if (sizeSelect) sizeSelect.value = String(pageSize);
    if (sortSelect) sortSelect.value = sortMode;

    document.querySelectorAll("[data-pub-index-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        seleccionarModo(btn.getAttribute("data-pub-index-mode"));
        if (input.value.trim()) {
          if (searchDebounce) window.clearTimeout(searchDebounce);
          cargarPagina(1, input.value);
        }
        actualizarResumenFiltros();
      });
    });

    input.addEventListener("input", function () {
      actualizarBotonLimpiar();
      actualizarResumenFiltros();
      programarBusqueda(input.value);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (searchDebounce) window.clearTimeout(searchDebounce);
      cargarPagina(1, input.value);
    });
    if (clearBtn) clearBtn.addEventListener("click", limpiarBusqueda);
    if (clearAllBtn) clearAllBtn.addEventListener("click", limpiarTodo);
    if (yearSelect) {
      yearSelect.addEventListener("change", function () {
        yearFilter = yearSelect.value || "all";
        actualizarResumenFiltros();
        cargarPagina(1);
      });
    }
    if (sizeSelect) {
      sizeSelect.addEventListener("change", function () {
        pageSize = Number(sizeSelect.value) || DEFAULT_PAGE_SIZE;
        actualizarResumenFiltros();
        cargarPagina(1);
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        sortMode = sortSelect.value || "date_desc";
        actualizarResumenFiltros();
        cargarPagina(1);
      });
    }
    actualizarResumenFiltros();
  }

  function ensureLoaded() {
    if (!loaded && !loading) cargarPagina(1);
  }

  function init() {
    if (started) return;
    if (!el("pub-index-grid")) return;
    started = true;
    initBuscador();
    ensureLoaded();
  }

  document.addEventListener("oia:page", function (ev) {
    if (ev.detail === "publicaciones") ensureLoaded();
  });

  window.addEventListener("oia:langchange", function () {
    if (loaded) {
      actualizarContador();
      dibujarGrilla();
      actualizarResumenFiltros();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
