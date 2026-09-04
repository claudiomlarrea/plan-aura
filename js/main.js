(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector("#site-nav");
  var baseTitle = "Plan Integral de Ahorro y Uso Responsable del Agua | UCCuyo";
  var aliases = {
    contenido: "inicio",
    comision: "equipo",
    marco: "documentos"
  };
  var pageTitles = {
    inicio: baseTitle,
    "el-plan": "El Plan AURA · Plan AURA",
    "plan-aura": "Plan Técnico AURA · Plan AURA",
    equipo: "Equipo coordinador · Plan AURA",
    red: "Red institucional · Plan AURA",
    convocatoria: "Convocatorias · Plan AURA",
    documentos: "Marco normativo · Plan AURA",
    noticias: "Noticias · Plan AURA",
    publicaciones: "Publicaciones · Plan AURA",
    galeria: "Galería de imágenes · Plan AURA",
    visitas: "Visualizaciones del Plan · Plan AURA",
    contacto: "Contacto · Plan AURA"
  };

  var dismissHover = function () {};

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

  function cerrarSubmenus(except) {
    if (!nav) return;
    nav.querySelectorAll(".has-submenu.is-open").forEach(function (item) {
      if (except && item === except) return;
      item.classList.remove("is-open");
      var btn = item.querySelector(".nav-submenu-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function cerrarMenu() {
    dismissHover();
    if (nav) nav.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    cerrarSubmenus();
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
    if (!open) cerrarSubmenus();
  });

  nav.querySelectorAll(".nav-submenu-toggle").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var item = btn.closest(".has-submenu");
      if (!item) return;
      var willOpen = !item.classList.contains("is-open");
      cerrarSubmenus(willOpen ? item : null);
      item.classList.toggle("is-open", willOpen);
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  });

  (function () {
    var desktopHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    var closeTimer = null;
    var activeItem = null;

    function setOpen(item, open) {
      if (!item) return;
      item.classList.toggle("is-open", open);
      var btn = item.querySelector(".nav-submenu-toggle");
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function openItem(item) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (activeItem && activeItem !== item) setOpen(activeItem, false);
      activeItem = item;
      setOpen(item, true);
    }

    function scheduleClose(item) {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        if (activeItem === item) {
          setOpen(item, false);
          activeItem = null;
        }
        closeTimer = null;
      }, 320);
    }

    nav.querySelectorAll(".has-submenu").forEach(function (item) {
      item.addEventListener("mouseenter", function () {
        if (!desktopHover.matches) return;
        openItem(item);
      });
      item.addEventListener("mouseleave", function () {
        if (!desktopHover.matches) return;
        scheduleClose(item);
      });
    });

    dismissHover = function () {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (activeItem) {
        setOpen(activeItem, false);
        activeItem = null;
      }
    };
  })();

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") cerrarMenu();
  });

  document.addEventListener("click", function (e) {
    if (!nav.contains(e.target) && !(toggle && toggle.contains(e.target))) {
      cerrarSubmenus();
    }
  });
})();
