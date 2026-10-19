(function () {
  "use strict";

  const forms = document.querySelectorAll(".needs-validation");
  const toast = document.getElementById("toastExito");
  let toastTimeout;

  function mostrarToast() {
    if (!toast) return;
    toast.classList.add("mostrar");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      toast.classList.remove("mostrar");
    }, 5000);
  }

  Array.from(forms).forEach(function (form) {
    form.addEventListener(
      "submit",
      function (event) {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        } else {
          event.preventDefault();
          mostrarToast();
          form.reset();
          form.classList.remove("was-validated");

          const validados = form.querySelectorAll(".is-valid");
          validados.forEach(function (el) {
            el.classList.remove("is-valid");
          });
          return;
        }
        form.classList.add("was-validated");
      },
      false,
    );
  });

  const inputs = document.querySelectorAll(".form-control, .form-select");
  inputs.forEach(function (input) {
    input.addEventListener("blur", function () {
      if (input.checkValidity()) {
        input.classList.remove("is-invalid");
        input.classList.add("is-valid");
      } else {
        input.classList.remove("is-valid");
        input.classList.add("is-invalid");
      }
    });

    input.addEventListener("input", function () {
      if (input.checkValidity()) {
        input.classList.remove("is-invalid");
        input.classList.add("is-valid");
      }
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
  );

  document.querySelectorAll(".destino-card").forEach(function (el) {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(el);
  });

  console.log("Turismo Perú - Grupo 10");
  console.log("Scripts cargados correctamente");
})();
