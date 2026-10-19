/* =========================================================
   FÚTBOL LEGENDS ARCHIVE — main.js (PRO + Acumulativo)
   Stepper acumulable + Contadores + Partículas + Tilt + Form
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     1. STEPPER ACUMULATIVO
     - Cada paso puede estar activo o no, independientemente.
     - Los paneles se INYECTAN al DOM desde <template>.
     - Los paneles se ELIMINAN del DOM al desactivar.
     ========================================================= */
  const contenedorPaneles = document.getElementById("paneles");
  const emptyState = document.getElementById("empty-state");
  const badgeContador = document.getElementById("pasos-activos-badge");
  const badgeNumero = badgeContador.querySelector("strong");
  const botonesPaso = document.querySelectorAll(".paso-item");
  const TOTAL_PASOS = botonesPaso.length;

  const pasosActivos = new Set(); // {1, 2, 4, ...}

  /* ---------- Crea el panel desde su <template> ---------- */
  function crearPanel(numero) {
    const template = document.getElementById(`tpl-paso-${numero}`);
    if (!template) return null;

    const clon = template.content.cloneNode(true);
    const panel = clon.querySelector(".panel-panel");
    panel.dataset.panel = String(numero);

    // Conectar la validación del formulario si es el paso 5
    if (Number(numero) === 5) {
      const form = panel.querySelector("#form-leyenda");
      if (form) inicializarFormulario(form);
    }

    // Aplicar tilt 3D a las cards si es el paso 4
    if (Number(numero) === 4) {
      const tiltCards = panel.querySelectorAll(".tilt-card");
      tiltCards.forEach(activarTilt);
    }

    // Botones internos (ej: "Ver leyendas" → paso 4)
    panel.querySelectorAll("[data-ir-paso]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const destino = Number(btn.dataset.irPaso);
        if (!pasosActivos.has(destino)) {
          togglePaso(destino, true);
        }
        // Scroll suave hasta el panel recién activado
        setTimeout(() => {
          const destinoEl = document.querySelector(
            `.panel-panel[data-panel="${destino}"]`,
          );
          destinoEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      });
    });

    return panel;
  }

  /* ---------- Inserta el panel en el orden correcto ---------- */
  function insertarPanelOrdenado(panel, numero) {
    const panelesActuales = Array.from(
      contenedorPaneles.querySelectorAll(".panel-panel"),
    );

    // Buscar el primer panel con número mayor
    const siguiente = panelesActuales.find(
      (p) => Number(p.dataset.panel) > numero,
    );

    if (siguiente) {
      contenedorPaneles.insertBefore(panel, siguiente);
    } else {
      contenedorPaneles.appendChild(panel);
    }
  }

  /* ---------- Elimina el panel correspondiente ---------- */
  function eliminarPanel(numero) {
    const panel = contenedorPaneles.querySelector(
      `.panel-panel[data-panel="${numero}"]`,
    );
    if (!panel) return;

    panel.classList.add("removing");
    setTimeout(() => panel.remove(), 320);
  }

  /* ---------- Actualiza la UI (botones, badge, empty) ---------- */
  function actualizarUI() {
    botonesPaso.forEach((btn) => {
      const num = Number(btn.dataset.paso);
      btn.classList.toggle("active", pasosActivos.has(num));
      btn.setAttribute(
        "aria-pressed",
        pasosActivos.has(num) ? "true" : "false",
      );
    });

    badgeNumero.textContent = `${pasosActivos.size}/${TOTAL_PASOS}`;

    if (pasosActivos.size === 0) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
    }
  }

  /* ---------- Toggle de un paso ---------- */
  function togglePaso(numero, forzarActivar = null) {
    const num = Number(numero);
    const yaActivo = pasosActivos.has(num);
    const debeActivar = forzarActivar === null ? !yaActivo : forzarActivar;

    if (debeActivar && !yaActivo) {
      const panel = crearPanel(num);
      if (panel) {
        insertarPanelOrdenado(panel, num);
        pasosActivos.add(num);
      }
    } else if (!debeActivar && yaActivo) {
      eliminarPanel(num);
      pasosActivos.delete(num);
    }

    actualizarUI();
  }

  // Eventos de cada botón lateral
  botonesPaso.forEach((btn) => {
    btn.addEventListener("click", () => togglePaso(btn.dataset.paso));
  });

  /* ---------- Botones globales ---------- */
  document
    .getElementById("btn-activar-todos")
    ?.addEventListener("click", () => {
      for (let i = 1; i <= TOTAL_PASOS; i++) togglePaso(i, true);
    });

  document
    .getElementById("btn-desactivar-todos")
    ?.addEventListener("click", () => {
      for (let i = 1; i <= TOTAL_PASOS; i++) togglePaso(i, false);
    });

  /* ---------- Inicialización: activar pasos 1 y 2 por defecto ---------- */
  togglePaso(1, true);
  togglePaso(2, true);

  /* =========================================================
     2. CONTADORES ANIMADOS (por si los agregas en el hero)
     ========================================================= */
  const contadores = document.querySelectorAll(".stat-number[data-count]");

  function animarContador(el) {
    const objetivo = parseInt(el.dataset.count, 10);
    const duracion = 1800;
    const inicio = performance.now();

    function actualizar(ahora) {
      const progreso = Math.min((ahora - inicio) / duracion, 1);
      const eased = progreso === 1 ? 1 : 1 - Math.pow(2, -10 * progreso);
      el.textContent = Math.floor(eased * objetivo).toLocaleString("es-PE");
      if (progreso < 1) requestAnimationFrame(actualizar);
      else el.textContent = objetivo.toLocaleString("es-PE");
    }

    requestAnimationFrame(actualizar);
  }

  const observerContadores = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !entry.target.dataset.done) {
          entry.target.dataset.done = "true";
          animarContador(entry.target);
        }
      });
    },
    { threshold: 0.4 },
  );

  contadores.forEach((el) => observerContadores.observe(el));

  /* =========================================================
     3. PARTÍCULAS EN CANVAS
     ========================================================= */
  const canvas = document.getElementById("particles-canvas");

  if (canvas) {
    const ctx = canvas.getContext("2d");
    let W,
      H,
      particulas = [];
    const CANTIDAD = window.innerWidth < 768 ? 35 : 70;
    const DIST_CONEXION = 130;
    const COLORES = ["#6366f1", "#ec4899", "#06b6d4", "#fbbf24"];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function crearParticula() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.6,
        color: COLORES[Math.floor(Math.random() * COLORES.length)],
      };
    }

    function initParticulas() {
      particulas = Array.from({ length: CANTIDAD }, crearParticula);
    }

    function dibujar() {
      ctx.clearRect(0, 0, W, H);

      particulas.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      for (let i = 0; i < particulas.length; i++) {
        for (let j = i + 1; j < particulas.length; j++) {
          const dx = particulas[i].x - particulas[j].x;
          const dy = particulas[i].y - particulas[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < DIST_CONEXION) {
            ctx.beginPath();
            ctx.strokeStyle = particulas[i].color;
            ctx.globalAlpha = (1 - dist / DIST_CONEXION) * 0.25;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particulas[i].x, particulas[i].y);
            ctx.lineTo(particulas[j].x, particulas[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      requestAnimationFrame(dibujar);
    }

    const prefiereQuieto = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!prefiereQuieto) {
      resize();
      initParticulas();
      dibujar();

      window.addEventListener("resize", () => {
        resize();
        initParticulas();
      });
    }
  }

  /* =========================================================
     4. TILT 3D EN TARJETAS (función reutilizable)
     ========================================================= */
  const MAX_TILT = 8;

  function activarTilt(card) {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const rotY = (x / rect.width - 0.5) * 2 * MAX_TILT;
      const rotX = (y / rect.height - 0.5) * -2 * MAX_TILT;

      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  }

  /* =========================================================
     5. VALIDACIÓN DEL FORMULARIO (función reutilizable)
     ========================================================= */
  function inicializarFormulario(form) {
    const alertaExito = form.querySelector("#form-exito");
    const campos = form.querySelectorAll("input, select, textarea");

    function validarCampo(campo) {
      const valido = campo.checkValidity();
      campo.classList.toggle("is-valid", valido);
      campo.classList.toggle("is-invalid", !valido);
      return valido;
    }

    campos.forEach((campo) => {
      campo.addEventListener("blur", () => validarCampo(campo));
      campo.addEventListener("input", () => {
        if (campo.classList.contains("is-invalid")) validarCampo(campo);
      });
      campo.addEventListener("change", () => validarCampo(campo));
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();

      let todoValido = true;
      campos.forEach((c) => {
        if (!validarCampo(c)) todoValido = false;
      });

      form.classList.add("was-validated");

      if (todoValido) {
        // Guardar en localStorage (visible en DevTools → Application)
        try {
          const datos = Object.fromEntries(new FormData(form));
          const historial = JSON.parse(
            localStorage.getItem("fla-propuestas") || "[]",
          );
          historial.push({ ...datos, fecha: new Date().toISOString() });
          localStorage.setItem("fla-propuestas", JSON.stringify(historial));
          console.log("✅ Propuesta guardada:", datos);
        } catch (err) {
          console.warn("No se pudo guardar en localStorage:", err);
        }

        alertaExito.classList.remove("d-none");

        setTimeout(() => {
          form.reset();
          form.classList.remove("was-validated");
          campos.forEach((c) => c.classList.remove("is-valid", "is-invalid"));
          alertaExito.classList.add("d-none");
        }, 2600);
      } else {
        const primerInvalido = form.querySelector(":invalid");
        if (primerInvalido) primerInvalido.focus();
        alertaExito.classList.add("d-none");
      }
    });

    form.addEventListener("reset", () => {
      form.classList.remove("was-validated");
      campos.forEach((c) => c.classList.remove("is-valid", "is-invalid"));
      alertaExito.classList.add("d-none");
    });
  }

  /* =========================================================
     6. SCROLL SUAVE PARA ANCLAS
     ========================================================= */
  document.querySelectorAll('a[href^="#"]').forEach((enlace) => {
    enlace.addEventListener("click", (e) => {
      const id = enlace.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      const destino = document.querySelector(id);
      if (destino) {
        e.preventDefault();
        destino.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* =========================================================
     7. LOG DE BIENVENIDA
     ========================================================= */
  console.log(
    "%c⚽ Fútbol Legends Archive — PRO Acumulativo",
    "color:#10b981;font-size:16px;font-weight:bold;padding:4px 8px;",
  );
  console.log(
    "%cPasos activables independientemente · Bootstrap 5 + Tailwind",
    "color:#94a3b8;font-size:12px;",
  );
});
