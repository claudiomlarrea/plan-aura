/**
 * Mapa de origen de visitas (país / provincia estimada por IP).
 * Lista clicable, resumen, leyenda y foco Mundo / Argentina.
 */
(function () {
  var CFG = window.SEC_VISITANTES || {};
  var PUB = window.SEC_PUBLICACIONES || window.OBS_PUBLICACIONES || {};
  var mapRoot = document.getElementById("visitas-mapa");
  var listRoot = document.getElementById("visitas-lista");
  var statusEl = document.getElementById("visitas-status");
  if (!mapRoot) return;

  var base = PUB.APPS_SCRIPT_URL && String(PUB.APPS_SCRIPT_URL).trim();
  var site = (CFG.SITE && String(CFG.SITE).trim()) || "observatorio";
  if (!base) {
    setStatus(tt("dyn.visitas.errorMap", "No se pudo cargar el mapa de visitas."));
    return;
  }

  var GEO_SESSION_KEY = "visitgeo_" + site;

  function tt(key, fallback) {
    if (window.I18N && typeof window.I18N.t === "function") {
      var v = window.I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  var mapApi = null;
  var markerIndex = {};
  var REGION_PAGE_SIZE = 8;
  var regionsVisibleLimit = REGION_PAGE_SIZE;
  var lastListData = null;

  var COUNTRY_CENTROIDS = {
    AF: [-65.2, 33.9],
    AL: [20.2, 41.2],
    DZ: [1.7, 28.0],
    AD: [1.6, 42.5],
    AO: [17.9, -11.2],
    AR: [-64.0, -34.6],
    AM: [45.0, 40.1],
    AU: [133.8, -25.3],
    AT: [14.6, 47.5],
    AZ: [47.6, 40.1],
    BS: [-77.4, 25.0],
    BH: [50.6, 26.0],
    BD: [90.4, 23.7],
    BY: [27.9, 53.7],
    BE: [4.5, 50.5],
    BZ: [-88.5, 17.2],
    BJ: [2.3, 9.3],
    BT: [90.4, 27.5],
    BO: [-63.6, -16.3],
    BA: [17.7, 43.9],
    BW: [24.7, -22.3],
    BR: [-51.9, -14.2],
    BN: [114.7, 4.5],
    BG: [25.5, 42.7],
    BF: [-1.6, 12.2],
    BI: [29.9, -3.4],
    KH: [104.9, 12.6],
    CM: [12.4, 7.4],
    CA: [-106.3, 56.1],
    CV: [-23.6, 16.0],
    CF: [20.9, 6.6],
    TD: [18.7, 15.5],
    CL: [-71.5, -35.7],
    CN: [104.2, 35.9],
    CO: [-74.3, 4.6],
    CR: [-83.8, 9.7],
    HR: [15.2, 45.1],
    CU: [-77.8, 21.5],
    CY: [33.4, 35.1],
    CZ: [15.5, 49.8],
    CD: [21.8, -4.0],
    DK: [9.5, 56.3],
    DJ: [42.6, 11.8],
    DO: [-70.2, 18.7],
    EC: [-78.2, -1.8],
    EG: [30.8, 26.8],
    SV: [-88.9, 13.8],
    GQ: [10.3, 1.6],
    ER: [39.8, 15.2],
    EE: [25.0, 58.6],
    SZ: [31.5, -26.5],
    ET: [40.5, 9.1],
    FJ: [178.1, -17.7],
    FI: [26.0, 61.9],
    FR: [2.2, 46.2],
    GA: [11.6, -0.8],
    GM: [-15.3, 13.4],
    GE: [43.4, 42.3],
    DE: [10.5, 51.2],
    GH: [-1.0, 7.9],
    GR: [21.8, 39.1],
    GT: [-90.2, 15.8],
    GN: [-9.7, 9.9],
    GY: [-58.9, 4.9],
    HT: [-72.3, 18.97],
    HN: [-86.2, 15.2],
    HK: [114.2, 22.3],
    HU: [19.5, 47.2],
    IS: [-19.0, 64.96],
    IN: [78.96, 20.6],
    ID: [113.9, -0.8],
    IR: [53.7, 32.4],
    IQ: [43.7, 33.2],
    IE: [-8.2, 53.1],
    IL: [34.9, 31.0],
    IT: [12.6, 41.9],
    CI: [-5.5, 7.5],
    JM: [-77.3, 18.1],
    JP: [138.3, 36.2],
    JO: [36.2, 30.6],
    KZ: [66.9, 48.0],
    KE: [37.9, -0.0],
    KW: [47.5, 29.3],
    KG: [74.8, 41.2],
    LA: [102.5, 19.9],
    LV: [24.6, 56.9],
    LB: [35.9, 33.9],
    LS: [28.2, -29.6],
    LR: [-9.4, 6.4],
    LY: [17.2, 26.3],
    LT: [23.9, 55.2],
    LU: [6.1, 49.8],
    MG: [46.9, -18.8],
    MW: [34.3, -13.3],
    MY: [101.98, 4.2],
    ML: [-3.996, 17.6],
    MT: [14.4, 35.9],
    MR: [-10.9, 21.0],
    MU: [57.6, -20.3],
    MX: [-102.6, 23.6],
    MD: [28.4, 47.4],
    MC: [7.4, 43.7],
    MN: [103.8, 46.9],
    ME: [19.4, 42.7],
    MA: [-7.1, 31.8],
    MZ: [35.5, -18.7],
    MM: [96.0, 21.9],
    NA: [18.5, -22.96],
    NP: [84.1, 28.4],
    NL: [5.3, 52.1],
    NZ: [174.9, -40.9],
    NI: [-85.2, 12.9],
    NE: [8.1, 17.6],
    NG: [8.7, 9.1],
    KP: [127.5, 40.3],
    MK: [21.7, 41.6],
    NO: [8.5, 60.5],
    OM: [55.9, 21.5],
    PK: [69.3, 30.4],
    PA: [-80.8, 8.5],
    PG: [143.96, -6.3],
    PY: [-58.4, -23.4],
    PE: [-75.0, -9.2],
    PH: [121.8, 12.9],
    PL: [19.1, 51.9],
    PT: [-8.2, 39.4],
    PR: [-66.6, 18.2],
    QA: [51.2, 25.4],
    CG: [15.8, -0.2],
    RO: [24.97, 45.9],
    RU: [105.3, 61.5],
    RW: [29.9, -1.9],
    SA: [45.1, 23.9],
    SN: [-14.5, 14.5],
    RS: [21.0, 44.0],
    SG: [103.8, 1.4],
    SK: [19.7, 48.7],
    SI: [14.8, 46.2],
    SO: [46.2, 5.2],
    ZA: [22.9, -30.6],
    KR: [127.8, 35.9],
    SS: [31.3, 6.9],
    ES: [-3.7, 40.5],
    LK: [80.8, 7.9],
    SD: [30.2, 12.9],
    SR: [-56.0, 3.9],
    SE: [18.6, 60.1],
    CH: [8.2, 46.8],
    SY: [38.996, 34.8],
    TW: [120.96, 23.7],
    TJ: [71.3, 38.9],
    TZ: [34.9, -6.4],
    TH: [100.99, 15.9],
    TL: [125.7, -8.9],
    TG: [0.8, 8.6],
    TT: [-61.2, 10.7],
    TN: [9.5, 33.9],
    TR: [35.2, 38.96],
    TM: [59.6, 38.97],
    UG: [32.3, 1.4],
    UA: [31.2, 48.4],
    AE: [53.8, 23.4],
    GB: [-3.4, 55.4],
    US: [-95.7, 37.1],
    UY: [-55.8, -32.5],
    UZ: [64.6, 41.4],
    VE: [-66.6, 6.4],
    VN: [108.3, 14.1],
    YE: [48.5, 15.6],
    ZM: [27.8, -13.1],
    ZW: [29.2, -19.0]
  };

  var AR_PROVINCE_CENTROIDS = {
    "ciudad autonoma de buenos aires": [-58.4, -34.6],
    "ciudad de buenos aires": [-58.4, -34.6],
    caba: [-58.4, -34.6],
    "capital federal": [-58.4, -34.6],
    "distrito federal": [-58.4, -34.6],
    "buenos aires f d": [-58.4, -34.6],
    "buenos aires fd": [-58.4, -34.6],
    "buenos aires federal district": [-58.4, -34.6],
    "buenos aires": [-60.0, -36.7],
    catamarca: [-66.0, -28.5],
    chaco: [-60.0, -26.4],
    chubut: [-68.0, -43.8],
    cordoba: [-64.0, -32.0],
    corrientes: [-58.8, -28.6],
    "entre rios": [-59.2, -32.0],
    formosa: [-59.0, -24.6],
    jujuy: [-65.5, -23.3],
    "la pampa": [-65.0, -37.0],
    "la rioja": [-66.9, -29.4],
    mendoza: [-68.6, -34.6],
    misiones: [-54.6, -26.9],
    neuquen: [-69.0, -38.95],
    "rio negro": [-67.3, -40.7],
    salta: [-65.0, -24.8],
    "san juan": [-68.5, -30.9],
    "san luis": [-66.0, -33.3],
    "santa cruz": [-69.96, -48.8],
    "santa fe": [-61.0, -30.7],
    "santiago del estero": [-63.3, -27.8],
    "tierra del fuego": [-67.0, -54.4],
    tucuman: [-65.3, -26.9]
  };

  /** Comunidades / regiones frecuentes (ipapi y similares). */
  var ES_REGION_CENTROIDS = {
    andalucia: [-4.5, 37.6],
    aragon: [-0.9, 41.6],
    asturias: [-5.8, 43.3],
    "islas baleares": [2.9, 39.5],
    baleares: [2.9, 39.5],
    "pais vasco": [-2.7, 43.0],
    euskadi: [-2.7, 43.0],
    "canarias": [-15.5, 28.0],
    cantabria: [-4.0, 43.2],
    "castilla la mancha": [-3.0, 39.6],
    "castilla-la mancha": [-3.0, 39.6],
    "castilla y leon": [-4.8, 41.8],
    cataluna: [1.5, 41.8],
    catalunya: [1.5, 41.8],
    extremadura: [-6.2, 39.2],
    galicia: [-8.0, 42.8],
    "la rioja": [-2.5, 42.3],
    madrid: [-3.7, 40.4],
    "comunidad de madrid": [-3.7, 40.4],
    murcia: [-1.1, 37.99],
    navarra: [-1.6, 42.7],
    "comunidad valenciana": [-0.4, 39.5],
    valencia: [-0.4, 39.5],
    ceuta: [-5.3, 35.9],
    melilla: [-2.9, 35.3]
  };

  var REGION_CENTROIDS_BY_COUNTRY = {
    AR: AR_PROVINCE_CENTROIDS,
    ES: ES_REGION_CENTROIDS
  };

  function regionKey(region) {
    return normKey(region)
      .replace(/\./g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function regionCentroid(country, region) {
    var code = String(country || "").toUpperCase();
    var map = REGION_CENTROIDS_BY_COUNTRY[code];
    if (!map) return null;
    var key = regionKey(region);
    if (map[key]) return map[key];
    return null;
  }

  function regionMarkerKey(country, region) {
    return "p:" + String(country || "").toUpperCase() + ":" + regionKey(region);
  }

  function resolveListMarkerKey(preferred, fallbackCountry) {
    if (preferred && markerIndex[preferred]) return preferred;
    var countryKey = "c:" + String(fallbackCountry || "").toUpperCase();
    if (markerIndex[countryKey]) return countryKey;
    var prefix = "p:" + String(fallbackCountry || "").toUpperCase() + ":";
    var keys = Object.keys(markerIndex);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(prefix) === 0) return keys[i];
    }
    return preferred || countryKey;
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
  }

  function fmt(n) {
    var x = Number(n);
    if (!isFinite(x)) return "—";
    try {
      return x.toLocaleString("es-AR");
    } catch (e) {
      return String(x);
    }
  }

  function pct(part, total) {
    if (!total) return "0%";
    return Math.round((1000 * part) / total) / 10 + "%";
  }

  function normKey(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function appsUrl(action, extra) {
    var url =
      base +
      (base.indexOf("?") >= 0 ? "&" : "?") +
      "action=" +
      encodeURIComponent(action) +
      "&site=" +
      encodeURIComponent(site) +
      "&_=" +
      Date.now();
    if (extra) url += "&" + extra;
    return url;
  }

  function fetchJson(url) {
    return fetch(url, { method: "GET" }).then(function (r) {
      if (!r.ok) throw new Error("network");
      return r.json();
    });
  }

  function fetchJsonp(url) {
    return new Promise(function (resolve, reject) {
      var name = "_visMapCb_" + Math.floor(Math.random() * 1e9);
      var done = false;
      var qs = url.indexOf("?") >= 0 ? "&" : "?";
      var script = document.createElement("script");
      window[name] = function (data) {
        if (done) return;
        done = true;
        delete window[name];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(data);
      };
      script.async = true;
      script.src = url + qs + "callback=" + encodeURIComponent(name);
      script.onerror = function () {
        if (done) return;
        done = true;
        delete window[name];
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error("jsonp"));
      };
      document.body.appendChild(script);
      window.setTimeout(function () {
        if (done) return;
        script.onerror();
      }, 20000);
    });
  }

  function fetchApps(action, extra) {
    var url = appsUrl(action, extra);
    return fetchJson(url).then(null, function () {
      return fetchJsonp(url);
    });
  }

  function loadLeaflet() {
    return new Promise(function (resolve, reject) {
      if (window.L) {
        resolve(window.L);
        return;
      }
      if (!document.getElementById("leaflet-css")) {
        var link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "";
        document.head.appendChild(link);
      }
      var script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "";
      script.onload = function () {
        if (window.L) resolve(window.L);
        else reject(new Error("leaflet"));
      };
      script.onerror = function () {
        reject(new Error("leaflet"));
      };
      document.head.appendChild(script);
    });
  }

  function colorForCount(count, max) {
    if (!max || count <= 0) return "#d9e8e1";
    var t = Math.min(1, count / max);
    if (t < 0.25) return "#a8cfc0";
    if (t < 0.5) return "#5fa88c";
    if (t < 0.75) return "#0d6e4f";
    return "#7a1532";
  }

  function radiusForCount(count, max) {
    var t = max > 0 ? Math.sqrt(count / max) : 0;
    return 9 + Math.round(t * 26);
  }

  function ensureChrome() {
    var layout = mapRoot.parentElement;
    if (!layout) return;

    if (!document.getElementById("visitas-stats")) {
      var stats = document.createElement("div");
      stats.id = "visitas-stats";
      stats.className = "visitas-stats";
      stats.hidden = true;
      layout.parentNode.insertBefore(stats, layout);
    }

    if (!document.getElementById("visitas-map-tools")) {
      var tools = document.createElement("div");
      tools.className = "visitas-map-wrap";
      mapRoot.parentNode.insertBefore(tools, mapRoot);
      tools.appendChild(mapRoot);

      var bar = document.createElement("div");
      bar.id = "visitas-map-tools";
      bar.className = "visitas-map-tools";
      bar.innerHTML =
        '<div class="visitas-map-actions" role="group" aria-label="Enfoque del mapa">' +
        '<button type="button" class="visitas-map-btn is-active" data-focus="all">' + tt("dyn.visitas.world", "Mundo") + '</button>' +
        '<button type="button" class="visitas-map-btn" data-focus="ar">' + tt("dyn.visitas.argentina", "Argentina") + '</button>' +
        "</div>" +
        '<div class="visitas-legend" aria-hidden="true">' +
        '<span class="visitas-legend__label">' + tt("dyn.visitas.legend", "Más visitas → círculo más grande y tono más intenso") + '</span>' +
        '<span class="visitas-legend__swatches">' +
        '<i style="background:#a8cfc0"></i><i style="background:#5fa88c"></i>' +
        '<i style="background:#0d6e4f"></i><i style="background:#7a1532"></i>' +
        "</span></div>";
      tools.insertBefore(bar, mapRoot);
    }
  }

  function renderStats(data) {
    var el = document.getElementById("visitas-stats");
    var totalNote = document.getElementById("visitas-total");
    if (totalNote) totalNote.hidden = true;
    if (!el) return;

    var countries = data.countries || [];
    var regions = data.regions || [];
    var total = Number(data.total) || 0;
    if (!countries.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }

    var top = countries[0];
    var arRegions = regions.filter(function (r) {
      return String(r.country || "").toUpperCase() === "AR";
    });
    var topRegion = arRegions[0] || regions[0] || null;

    el.hidden = false;
    el.innerHTML =
      '<div class="visitas-stat"><span class="visitas-stat__k">' + tt("dyn.visitas.withOrigin", "Con origen") + '</span><strong>' +
      fmt(total) +
      "</strong></div>" +
      '<div class="visitas-stat"><span class="visitas-stat__k">' + tt("dyn.visitas.countries", "Países") + '</span><strong>' +
      fmt(countries.length) +
      "</strong></div>" +
      '<div class="visitas-stat"><span class="visitas-stat__k">' + tt("dyn.visitas.regions", "Provincias / regiones") + '</span><strong>' +
      fmt(regions.length) +
      "</strong></div>" +
      '<div class="visitas-stat visitas-stat--wide"><span class="visitas-stat__k">' + tt("dyn.visitas.main", "Principal") + '</span><strong>' +
      escapeHtml(top.name || top.code) +
      "</strong><em>" +
      fmt(top.count) +
      " · " +
      pct(top.count, total) +
      "</em></div>" +
      (topRegion
        ? '<div class="visitas-stat visitas-stat--wide"><span class="visitas-stat__k">' + tt("dyn.visitas.topRegion", "Provincia destacada") + '</span><strong>' +
          escapeHtml(topRegion.region) +
          "</strong><em>" +
          fmt(topRegion.count) +
          " · " +
          pct(topRegion.count, total) +
          "</em></div>"
        : "");

    if (window.OBS_NUMEROS_API) {
      window.OBS_NUMEROS_API.set("visitas", total);
      window.OBS_NUMEROS_API.set("provincias", regions.length);
    }
  }

  function popupHtml(title, count, total) {
    return (
      "<strong>" +
      escapeHtml(title) +
      "</strong><br>" +
      fmt(count) +
      " visita" +
      (count === 1 ? "" : "s") +
      " <span class=\"visitas-popup-pct\">(" +
      pct(count, total) +
      ")</span>"
    );
  }

  function focusMarker(key) {
    var entry = markerIndex[key];
    if (!entry || !mapApi) return;
    var zoom = entry.kind === "province" ? 5 : entry.kind === "country-ar" ? 4 : 3;
    mapApi.setView(entry.latlng, Math.max(mapApi.getZoom(), zoom), { animate: true });
    entry.marker.openPopup();
    setActiveListItem(key);
  }

  function setActiveListItem(key) {
    if (!listRoot) return;
    var items = listRoot.querySelectorAll("[data-marker-key]");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("is-active", items[i].getAttribute("data-marker-key") === key);
    }
  }

  function bindListClicks() {
    if (!listRoot) return;
    listRoot.onclick = function (e) {
      var moreBtn = e.target.closest("[data-visitas-regions-more]");
      if (moreBtn) {
        regionsVisibleLimit += REGION_PAGE_SIZE;
        if (lastListData) renderList(lastListData, true);
        return;
      }
      var btn = e.target.closest("[data-marker-key]");
      if (!btn) return;
      focusMarker(btn.getAttribute("data-marker-key"));
    };
  }

  function regionCountryLabel(r) {
    var code = String(r.country || "").toUpperCase();
    if (code === "AR") return "Argentina";
    return String(r.countryName || code || "").trim() || code;
  }

  /** Argentina primero; resto por país; dentro del país, por cantidad. */
  function sortRegionsByCountry(regions) {
    return (regions || []).slice().sort(function (a, b) {
      var codeA = String(a.country || "").toUpperCase();
      var codeB = String(b.country || "").toUpperCase();
      if (codeA === "AR" && codeB !== "AR") return -1;
      if (codeB === "AR" && codeA !== "AR") return 1;
      var cmp = regionCountryLabel(a).localeCompare(regionCountryLabel(b), "es", {
        sensitivity: "base"
      });
      if (cmp !== 0) return cmp;
      var byCount = (b.count || 0) - (a.count || 0);
      if (byCount !== 0) return byCount;
      return String(a.region || "").localeCompare(String(b.region || ""), "es", {
        sensitivity: "base"
      });
    });
  }

  function regionRowHtml(r, idx, maxCount, total) {
    var code = String(r.country || "").toUpperCase();
    var preferred = regionMarkerKey(code, r.region);
    var key = resolveListMarkerKey(preferred, code);
    return (
      '<li><button type="button" class="visitas-rank__btn" data-marker-key="' +
      escapeHtml(key) +
      '"' +
      (markerIndex[key] ? "" : " disabled") +
      ">" +
      '<span class="visitas-rank__pos">' +
      (idx + 1) +
      "</span>" +
      '<span class="visitas-rank__meta"><span class="visitas-rank__name">' +
      escapeHtml(r.region) +
      '</span><span class="visitas-rank__bar" aria-hidden="true"><i style="width:' +
      Math.max(6, Math.round((100 * r.count) / (maxCount || 1))) +
      '%"></i></span></span>' +
      '<strong><em>' +
      pct(r.count, total) +
      "</em>" +
      fmt(r.count) +
      "</strong></button></li>"
    );
  }

  function renderList(data, keepLimit) {
    if (!listRoot) return;
    lastListData = data;
    if (!keepLimit) regionsVisibleLimit = REGION_PAGE_SIZE;

    var countries = data.countries || [];
    var regions = data.regions || [];
    var total = Number(data.total) || 0;
    if (!countries.length) {
      listRoot.innerHTML =
        '<p class="visitas-empty">' + tt("dyn.visitas.empty", "Todavía no hay orígenes registrados. El mapa se irá completando con las nuevas visitas.") + '</p>';
      return;
    }

    var html = '<div class="visitas-tables">';
    html += "<div><h3>" + tt("dyn.visitas.countries", "Países") + "</h3><ol class=\"visitas-rank\">";
    countries.slice(0, 12).forEach(function (c, idx) {
      var code = String(c.code || "").toUpperCase();
      var key = resolveListMarkerKey("c:" + code, code);
      var enabled = !!markerIndex[key];
      html +=
        '<li><button type="button" class="visitas-rank__btn" data-marker-key="' +
        escapeHtml(key) +
        '"' +
        (enabled ? "" : " disabled") +
        ">" +
        '<span class="visitas-rank__pos">' +
        (idx + 1) +
        "</span>" +
        '<span class="visitas-rank__meta"><span class="visitas-rank__name">' +
        escapeHtml(c.name || code) +
        '</span><span class="visitas-rank__bar" aria-hidden="true"><i style="width:' +
        Math.max(6, Math.round((100 * c.count) / (countries[0].count || 1))) +
        '%"></i></span></span>' +
        '<strong><em>' +
        pct(c.count, total) +
        "</em>" +
        fmt(c.count) +
        "</strong></button></li>";
    });
    html += "</ol></div>";

    if (regions.length) {
      var sortedRegions = sortRegionsByCountry(regions);
      var shownRegions = sortedRegions.slice(0, regionsVisibleLimit);
      var restantes = sortedRegions.length - shownRegions.length;
      var maxRegion = 1;
      for (var ri = 0; ri < sortedRegions.length; ri++) {
        if ((sortedRegions[ri].count || 0) > maxRegion) {
          maxRegion = sortedRegions[ri].count || 0;
        }
      }
      html +=
        "<div><h3>" +
        tt("dyn.visitas.regions", "Provincias / regiones") +
        '</h3><ol class="visitas-rank">';
      var lastCountry = null;
      var regionIdx = 0;
      shownRegions.forEach(function (r) {
        var countryLabel = regionCountryLabel(r);
        var countryKey = String(r.country || "").toUpperCase() || countryLabel;
        if (countryKey !== lastCountry) {
          lastCountry = countryKey;
          html +=
            '<li class="visitas-rank__country" aria-hidden="false">' +
            escapeHtml(countryLabel) +
            "</li>";
          regionIdx = 0;
        }
        html += regionRowHtml(r, regionIdx, maxRegion, total);
        regionIdx += 1;
      });
      html += "</ol>";
      if (restantes > 0) {
        html +=
          '<div class="visitas-more-wrap">' +
          '<button type="button" class="pub-more-btn" data-visitas-regions-more="1">' +
          tt("dyn.visitas.verMas", "Ver más") +
          " (" +
          restantes +
          ")</button>" +
          "</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    listRoot.innerHTML = html;
    bindListClicks();
  }

  function applyFocus(mode) {
    if (!mapApi) return;
    var buttons = document.querySelectorAll(".visitas-map-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle(
        "is-active",
        buttons[i].getAttribute("data-focus") === mode
      );
    }
    if (mode === "ar") {
      mapApi.fitBounds(
        [
          [-55.2, -73.6],
          [-21.5, -53.4]
        ],
        { padding: [28, 28], maxZoom: 5 }
      );
      return;
    }
    if (mapApi._visitasBounds && mapApi._visitasBounds.length > 1) {
      mapApi.fitBounds(mapApi._visitasBounds, {
        padding: [36, 36],
        maxZoom: 4
      });
    } else if (mapApi._visitasBounds && mapApi._visitasBounds.length === 1) {
      mapApi.setView(mapApi._visitasBounds[0], 3);
    } else {
      mapApi.setView([-15, -40], 2);
    }
  }

  function bindFocusButtons() {
    var bar = document.getElementById("visitas-map-tools");
    if (!bar || bar._bound) return;
    bar._bound = true;
    bar.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-focus]");
      if (!btn) return;
      applyFocus(btn.getAttribute("data-focus"));
    });
  }

  function renderMap(L, data) {
    ensureChrome();
    bindFocusButtons();
    markerIndex = {};
    mapRoot.innerHTML = "";

    var map = L.map(mapRoot, {
      scrollWheelZoom: false,
      worldCopyJump: true,
      zoomControl: true
    }).setView([-15, -40], 2);
    mapApi = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 8,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    var countries = data.countries || [];
    var regions = data.regions || [];
    var total = Number(data.total) || 0;
    var max = 0;
    countries.forEach(function (c) {
      if (c.count > max) max = c.count;
    });

    var bounds = [];
    var detailedCountries = {};
    var plottedRegions = regions.filter(function (r) {
      var code = String(r.country || "").toUpperCase();
      return !!regionCentroid(code, r.region);
    });
    plottedRegions.forEach(function (r) {
      detailedCountries[String(r.country || "").toUpperCase()] = true;
    });

    countries.forEach(function (c) {
      var code = String(c.code || "").toUpperCase();
      if (detailedCountries[code]) return;
      var centroid = COUNTRY_CENTROIDS[code];
      if (!centroid) return;
      var latlng = [centroid[1], centroid[0]];
      var key = "c:" + code;
      var marker = L.circleMarker(latlng, {
        radius: radiusForCount(c.count, max),
        color: "#042f23",
        weight: 1.5,
        fillColor: colorForCount(c.count, max),
        fillOpacity: 0.82
      }).addTo(map);
      marker.bindPopup(popupHtml(c.name || code, c.count, total));
      marker.on("click", function () {
        setActiveListItem(key);
      });
      markerIndex[key] = { marker: marker, latlng: latlng, kind: "country" };
      bounds.push(latlng);
    });

    // País de respaldo si hay detalle regional (p. ej. España + Aragón).
    Object.keys(detailedCountries).forEach(function (code) {
      if (markerIndex["c:" + code]) return;
      var centroid = COUNTRY_CENTROIDS[code];
      if (!centroid) return;
      var countryRow = null;
      for (var i = 0; i < countries.length; i++) {
        if (String(countries[i].code || "").toUpperCase() === code) {
          countryRow = countries[i];
          break;
        }
      }
      var latlng = [centroid[1], centroid[0]];
      var key = "c:" + code;
      var marker = L.circleMarker(latlng, {
        radius: Math.max(7, radiusForCount((countryRow && countryRow.count) || 1, max) - 4),
        color: "#042f23",
        weight: 1,
        fillColor: colorForCount((countryRow && countryRow.count) || 1, max),
        fillOpacity: 0.35,
        dashArray: "2 3"
      }).addTo(map);
      marker.bindPopup(
        popupHtml(
          (countryRow && countryRow.name) || code,
          (countryRow && countryRow.count) || 0,
          total
        )
      );
      markerIndex[key] = { marker: marker, latlng: latlng, kind: "country" };
      bounds.push(latlng);
    });

    plottedRegions.forEach(function (r) {
      var code = String(r.country || "").toUpperCase();
      var c = regionCentroid(code, r.region);
      var latlng = [c[1], c[0]];
      var key = regionMarkerKey(code, r.region);
      var marker = L.circleMarker(latlng, {
        radius: radiusForCount(r.count, max),
        color: "#4a0c1f",
        weight: 1.5,
        fillColor: colorForCount(r.count, max),
        fillOpacity: 0.82
      }).addTo(map);
      marker.bindPopup(popupHtml(r.region, r.count, total));
      marker.on("click", function () {
        setActiveListItem(key);
      });
      markerIndex[key] = {
        marker: marker,
        latlng: latlng,
        kind: code === "AR" ? "province" : "region"
      };
      bounds.push(latlng);
    });

    map._visitasBounds = bounds;
    if (bounds.length === 1) {
      map.setView(bounds[0], plottedRegions.length ? 5 : 3);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: plottedRegions.length ? 5 : 4 });
    }

    window.setTimeout(function () {
      map.invalidateSize();
    }, 200);
  }

  function paint(data) {
    if (!data || !data.ok) {
      setStatus(tt("dyn.visitas.errorOrigin", "No se pudo obtener el origen de las visitas."));
      return;
    }
    ensureChrome();
    renderStats(data);
    setStatus("");
    loadLeaflet()
      .then(function (L) {
        renderMap(L, data);
        renderList(data);
      })
      .catch(function () {
        renderList(data);
        mapRoot.innerHTML =
          '<p class="visitas-empty">' + tt("dyn.visitas.mapFail", "No se pudo cargar el mapa interactivo. La lista de orígenes sigue disponible.") + '</p>';
      });
  }

  function registerGeoOnce() {
    try {
      if (sessionStorage.getItem(GEO_SESSION_KEY)) return Promise.resolve();
    } catch (e) {}

    return fetch("https://ipapi.co/json/", { method: "GET" })
      .then(function (r) {
        if (!r.ok) throw new Error("geo");
        return r.json();
      })
      .then(function (geo) {
        if (!geo || geo.error) throw new Error("geo");
        var country = String(geo.country_code || "").trim();
        var countryName = String(geo.country_name || "").trim();
        var region = String(geo.region || "").trim();
        if (!country) throw new Error("geo");
        var extra =
          "country=" +
          encodeURIComponent(country) +
          "&countryName=" +
          encodeURIComponent(countryName) +
          "&region=" +
          encodeURIComponent(region);
        return fetchApps("visitgeo", extra).then(function (res) {
          if (res && res.ok) {
            try {
              sessionStorage.setItem(GEO_SESSION_KEY, "1");
            } catch (e2) {}
          } else if (res && res.error === "invalid_site") {
            window.__visitasGeoBackendPendiente = true;
          }
          return res;
        });
      })
      .catch(function () {
        return null;
      });
  }

  setStatus(tt("dyn.visitas.loading", "Cargando origen de visitas…"));

  registerGeoOnce()
    .then(function () {
      return fetchApps("visitmap");
    })
    .then(
      function (data) {
        paint(data);
        if (
          window.__visitasGeoBackendPendiente &&
          data &&
          data.ok &&
          !(data.total > 0)
        ) {
          setStatus(
            "El mapa está listo, pero Apps Script aún no acepta este sitio. Pegá PublicacionesWeb.gs actualizado y publicá Nueva versión."
          );
        }
      },
      function () {
        setStatus(tt("dyn.visitas.error", "No se pudo cargar el origen de las visitas."));
      }
    );
})();
