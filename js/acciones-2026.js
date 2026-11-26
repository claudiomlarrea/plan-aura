(function () {
  var select = document.getElementById("acciones-unidad");
  var button = document.getElementById("acciones-cargar");
  if (!select || !button) return;

  function sync() {
    var url = select.value;
    if (url) {
      button.href = url;
      button.classList.remove("is-disabled");
      button.setAttribute("aria-disabled", "false");
    } else {
      button.href = "#acciones-unidad";
      button.classList.add("is-disabled");
      button.setAttribute("aria-disabled", "true");
    }
  }

  select.addEventListener("change", sync);
  button.addEventListener("click", function (event) {
    if (!select.value) {
      event.preventDefault();
      select.focus();
    }
  });
  sync();
})();
