/**
 * Cierra la carga de la convocatoria AURA el 30 de octubre de 2026
 * a las 24:00 (hora de Argentina).
 */
(function () {
  "use strict";

  var CIERRE_ISO = "2026-10-31T00:00:00-03:00";
  var cierreMs = Date.parse(CIERRE_ISO);

  function t(key, fallback) {
    if (window.I18N && typeof window.I18N.t === "function") return window.I18N.t(key);
    return fallback || key;
  }

  function estaCerrada() {
    return Date.now() >= cierreMs;
  }

  window.PlanAuraConvocatoria = {
    cierre: CIERRE_ISO,
    estaCerrada: estaCerrada,
  };

  function disableUpload(el) {
    if (!el) return;
    el.removeAttribute("href");
    el.classList.add("is-disabled");
    el.setAttribute("aria-disabled", "true");
    el.setAttribute("tabindex", "-1");
    el.setAttribute("role", "button");
    el.textContent = t("btn.cargarDriveCerrado", "Carga cerrada");
    el.setAttribute("data-i18n", "btn.cargarDriveCerrado");
    el.onclick = function (ev) {
      ev.preventDefault();
      return false;
    };
  }

  function applyClosed() {
    if (!estaCerrada()) return;
    var section = document.getElementById("convocatoria");
    if (!section) return;
    section.classList.add("is-cerrada");

    document.querySelectorAll('[data-conv-upload="1"]').forEach(disableUpload);

    var note = document.getElementById("convCierreNote");
    if (note) note.removeAttribute("hidden");

    var fact = document.getElementById("convCierreValue");
    if (fact) {
      fact.innerHTML = t(
        "sec.conv.facts.cierre.valueCerrado",
        "Cerrado · 30 de octubre de 2026 a las 24:00"
      );
      fact.setAttribute("data-i18n-html", "sec.conv.facts.cierre.valueCerrado");
    }

    var paso3 = document.getElementById("convPaso3Body");
    if (paso3) {
      paso3.innerHTML = t(
        "sec.conv.paso3.bodyCerrado",
        "El plazo de presentación está <strong>cerrado</strong>. Ya no se reciben proyectos nuevos en Drive. El Comité Evaluador continúa con las propuestas ingresadas hasta el 30 de octubre."
      );
      paso3.setAttribute("data-i18n-html", "sec.conv.paso3.bodyCerrado");
    }

    var step3 = document.getElementById("convProyectosStep3");
    if (step3) {
      step3.textContent = t(
        "sec.conv.proyectos.step.3cerrado",
        "El plazo de carga en Drive está cerrado."
      );
      step3.setAttribute("data-i18n", "sec.conv.proyectos.step.3cerrado");
    }
  }

  function schedule() {
    applyClosed();
    if (estaCerrada()) return;
    var wait = cierreMs - Date.now();
    if (wait > 0) {
      window.setTimeout(applyClosed, Math.min(wait + 250, 2147483647));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) applyClosed();
  });
  window.addEventListener("focus", applyClosed);
  window.addEventListener("oia:langchange", applyClosed);
  document.addEventListener(
    "click",
    function (ev) {
      if (!estaCerrada()) return;
      var a = ev.target.closest('[data-conv-upload="1"], a[href*="1u1m-4y44z0pBdu2NJVUTzZF7hJEcmB9O"]');
      if (!a) return;
      ev.preventDefault();
      applyClosed();
    },
    true
  );
})();
