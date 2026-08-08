/**
 * i18n ES/EN — selector, localStorage y aplicación a [data-i18n].
 * Diccionario: window.I18N_DICT[key] = { es, en }
 */
(function () {
  var STORAGE_KEY = "aura_lang";
  var dict = window.I18N_DICT || {};
  var lang = "es";

  function normalizeLang(code) {
    code = String(code || "").toLowerCase();
    if (code.indexOf("en") === 0) return "en";
    return "es";
  }

  function detectLang() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var q = String(params.get("lang") || "").toLowerCase();
      if (q === "es" || q === "en") return q;
    } catch (_e0) {}
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "es" || saved === "en") return saved;
    } catch (_e) {}
    var nav = (navigator.language || navigator.userLanguage || "es").toLowerCase();
    return normalizeLang(nav);
  }

  function t(key, vars) {
    var entry = dict[key];
    var text = entry && entry[lang] != null ? entry[lang] : entry && entry.es != null ? entry.es : key;
    if (vars && typeof vars === "object") {
      Object.keys(vars).forEach(function (k) {
        text = String(text).split("{" + k + "}").join(String(vars[k]));
      });
    }
    return text;
  }

  function setAttrTranslation(el) {
    var raw = el.getAttribute("data-i18n-attr");
    if (!raw) return;
    raw.split(",").forEach(function (pair) {
      var parts = pair.split(":").map(function (s) {
        return s.trim();
      });
      if (parts.length < 2) return;
      el.setAttribute(parts[0], t(parts[1]));
    });
  }

  function apply() {
    document.documentElement.lang = lang === "en" ? "en" : "es-AR";

    var titleEl = document.querySelector("title");
    if (dict["meta.title"]) {
      document.title = t("meta.title");
    }
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && dict["meta.description"]) {
      metaDesc.setAttribute("content", t("meta.description"));
    }

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      if (el.hasAttribute("data-i18n-html")) {
        el.innerHTML = t(key);
      } else {
        el.textContent = t(key);
      }
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(setAttrTranslation);

    document.querySelectorAll("[data-lang]").forEach(function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    try {
      window.dispatchEvent(
        new CustomEvent("oia:langchange", { detail: { lang: lang } })
      );
    } catch (_e2) {}
  }

  function setLang(next) {
    lang = normalizeLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_e) {}
    apply();
  }

  function ensureSwitcher() {
    if (document.getElementById("lang-switcher")) return;
    var header = document.querySelector(".header-inner");
    if (!header) return;
    var wrap = document.createElement("div");
    wrap.id = "lang-switcher";
    wrap.className = "lang-switcher";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Language / Idioma");
    wrap.innerHTML =
      '<button type="button" class="lang-switcher__btn" data-lang="es" aria-pressed="false" title="Español">' +
      '<span class="lang-switcher__flag" aria-hidden="true">🇦🇷</span>' +
      '<span class="lang-switcher__code">ES</span></button>' +
      '<button type="button" class="lang-switcher__btn" data-lang="en" aria-pressed="false" title="English">' +
      '<span class="lang-switcher__flag" aria-hidden="true">🇬🇧</span>' +
      '<span class="lang-switcher__code">EN</span></button>';
    var toggle = header.querySelector(".nav-toggle");
    if (toggle) header.insertBefore(wrap, toggle);
    else header.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-lang]");
      if (!btn) return;
      setLang(btn.getAttribute("data-lang"));
    });
  }

  window.I18N = {
    t: t,
    getLang: function () {
      return lang;
    },
    setLang: setLang,
    apply: apply
  };

  lang = detectLang();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      ensureSwitcher();
      apply();
    });
  } else {
    ensureSwitcher();
    apply();
  }
})();
