(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector("#site-nav");
  var baseTitle = "Plan AURA | Universidad Católica de Cuyo";
  var aliases = {
    contenido: "inicio"
  };
  var pageTitles = {
    inicio: baseTitle,
    "el-plan": "El Plan AURA · Plan AURA",
    "plan-aura": "Plan AURA · Plan Integral AURA",
    comision: "Sala de trabajo · Plan AURA",
    equipo: "Equipo coordinador · Plan AURA",
    red: "Red institucional · Plan AURA",
    convocatoria: "Convocatorias · Plan AURA",
    documentos: "Documentos · Plan AURA",
    galeria: "Galería de imágenes · Plan AURA",
    visitas: "Visitas al Plan AURA · Plan AURA",
    contacto: "Contacto · Plan AURA"
  };

  function pageTitle(id) {
    return pageTitles[id] || baseTitle;
  }

  function pageIdFromHash(hash) {
    var id = String(hash || "").replace(/^#/, "");
    if (!id) return "inicio";
    id = aliases[id] || id;
    if (document.querySelector('.page-panel[data-page="' + id + '"]')) return id;
    var el = document.getElementById(id);
    if (el) {
      var panel = el.closest(".page-panel");
      if (panel && panel.getAttribute("data-page")) return panel.getAttribute("data-page");
    }
    return "inicio";
  }

  function showPage(hash, push) {
    var raw = String(hash || "").replace(/^#/, "") || "inicio";
    var id = pageIdFromHash(hash);
    var panel = document.querySelector('.page-panel[data-page="' + id + '"]');
    if (!panel) return;
    document.querySelectorAll(".page-panel.is-active").forEach(function (el) {
      el.classList.remove("is-active");
    });
    panel.classList.add("is-active");
    var shownHash = "#" + raw;
    var target = document.getElementById(raw);
    if (target && panel.contains(target) && raw !== "inicio") {
      window.scrollTo(0, 0);
      requestAnimationFrame(function () {
        target.scrollIntoView({ block: "start" });
      });
    } else {
      window.scrollTo(0, 0);
    }
    document.title = pageTitle(id);
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (href === "#contenido") {
        link.removeAttribute("aria-current");
        return;
      }
      if (href === shownHash || href === "#" + id || (id === "inicio" && href === "#inicio")) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    if (push) {
      if (location.hash !== shownHash) {
        history.pushState({ page: id }, "", shownHash);
      }
    }
    document.dispatchEvent(new CustomEvent("oia:page", { detail: id }));
  }

  function cerrarMenu() {
    if (nav) nav.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (href === "#" || href === "#contenido") return;
    if (link.getAttribute("target") === "_blank") return;
    e.preventDefault();
    showPage(href, true);
    cerrarMenu();
  });

  window.addEventListener("popstate", function () {
    showPage(location.hash || "#inicio", false);
  });

  window.addEventListener("hashchange", function () {
    showPage(location.hash || "#inicio", false);
  });

  window.addEventListener("oia:langchange", function () {
    showPage(location.hash || "#inicio", false);
  });

  showPage(location.hash || "#inicio", false);

  if (!toggle || !nav) return;

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") cerrarMenu();
  });

  document.addEventListener("click", function (e) {
    if (!nav.contains(e.target) && !(toggle && toggle.contains(e.target))) {
      cerrarMenu();
    }
  });
})();
