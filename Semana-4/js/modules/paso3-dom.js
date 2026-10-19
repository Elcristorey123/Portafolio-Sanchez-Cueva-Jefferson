/* ============================================================
   PASO 3: Manipulación DOM + Validación
   ------------------------------------------------------------
   Conceptos cubiertos:
     - querySelector / querySelectorAll
     - addEventListener (click, input, blur, keydown)
     - classList.toggle / add / remove / contains
     - Validación de inputs con regex
     - Event Bubbling vs Capturing
     - Evitar estilos inline → usar clases CSS
   ------------------------------------------------------------
   Restricciones respetadas:
     ✅ Sin frameworks ni librerías
     ✅ Sin estilos inline persistentes (solo transitorios)
     ✅ Variables CSS para el highlight (--color-accent)
     ✅ Uso de classList en lugar de .style.xxx
   ============================================================ */

window.__modules = window.__modules || {};

window.__modules.paso3 = (function () {
  "use strict";

  /* =========================================================
       1. ESTADO DEL MÓDULO
       ========================================================= */
  const state = {
    card: null,
    emailInput: null,
    emailFeedback: null,
    btnToggle: null,
    btnPulse: null,
    btnReset: null,
    // Contador de interacciones para el feedback UX
    interactions: 0,
    // Bandera para evitar múltiples pulses apilados
    pulseActive: false,
    // Cleanup: guardamos los listeners para poder removerlos
    listeners: [],
  };

  /* =========================================================
       2. VALIDADORES
       ---------------------------------------------------------
       Regex estándar de email (suficiente para validación de UI,
       no pretende ser RFC 5322 completa).
       ========================================================= */
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /**
   * Valida un string como email.
   * Devuelve { valid: boolean, reason: string }
   */
  const validateEmail = (value) => {
    const v = value.trim();

    if (v === "") {
      return { valid: false, reason: "Escribe tu correo, hincha." };
    }
    if (v.length > 254) {
      return { valid: false, reason: "Email demasiado largo (máx 254)." };
    }
    if (!v.includes("@")) {
      return { valid: false, reason: "Falta el símbolo @." };
    }
    if (!EMAIL_REGEX.test(v)) {
      return { valid: false, reason: "Formato inválido. Ej: test@correo.com" };
    }
    return { valid: true, reason: "✓ Email válido. ¡Bienvenido al estadio!" };
  };

  /* =========================================================
       3. UI HELPERS
       ========================================================= */

  /**
   * Actualiza el feedback visual del input de email.
   * Usa classList (no style inline) para cumplir la guía.
   */
  const showEmailFeedback = (result) => {
    const fb = state.emailFeedback;
    const input = state.emailInput;
    if (!fb || !input) return;

    // Limpiar estados previos
    fb.classList.remove("valid", "invalid");
    input.classList.remove("input-valid", "input-invalid");

    if (result.valid) {
      fb.classList.add("valid");
      input.classList.add("input-valid");
    } else {
      fb.classList.add("invalid");
      input.classList.add("input-invalid");
    }

    fb.textContent = result.reason;
  };

  /**
   * Resetea el estado visual del email.
   */
  const clearEmailFeedback = () => {
    const fb = state.emailFeedback;
    const input = state.emailInput;
    if (!fb || !input) return;

    fb.classList.remove("valid", "invalid");
    input.classList.remove("input-valid", "input-invalid");
    fb.textContent = "";
  };

  /**
   * Animación de "atención" en la tarjeta (sin dejar estilos inline).
   * Añade y quita una clase temporal.
   */
  const flashCard = () => {
    const card = state.card;
    if (!card) return;

    card.classList.add("flash");
    // Removemos la clase al terminar la animación
    const onEnd = () => {
      card.classList.remove("flash");
      card.removeEventListener("animationend", onEnd);
    };
    card.addEventListener("animationend", onEnd);
  };

  /**
   * Añade la clase pulse y programa su remoción tras N segundos.
   * Evita apilar múltiples timeouts si el usuario hace click repetido.
   */
  let pulseTimeout = null;
  const togglePulse = () => {
    const card = state.card;
    if (!card) return;

    if (state.pulseActive) {
      // Si ya estaba activo, lo apagamos
      card.classList.remove("pulse");
      state.pulseActive = false;
      if (pulseTimeout) {
        clearTimeout(pulseTimeout);
        pulseTimeout = null;
      }
      return;
    }

    // Activar
    card.classList.add("pulse");
    state.pulseActive = true;

    // Auto-apagar después de 3 segundos
    pulseTimeout = setTimeout(() => {
      card.classList.remove("pulse");
      state.pulseActive = false;
      pulseTimeout = null;
    }, 3000);
  };

  /**
   * Reset total de la tarjeta: limpia todas las clases de estado.
   */
  const resetCard = () => {
    const card = state.card;
    if (!card) return;

    card.classList.remove("highlight", "pulse", "flash");
    state.pulseActive = false;
    if (pulseTimeout) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
  };

  /**
   * Registra un listener y guarda la referencia para cleanup.
   */
  const on = (el, event, handler, options = {}) => {
    if (!el) return;
    el.addEventListener(event, handler, options);
    state.listeners.push({ el, event, handler, options });
  };

  /* =========================================================
       4. DEMOSTRACIÓN DE EVENT BUBBLING / CAPTURING
       ---------------------------------------------------------
       Añadimos listeners en la tarjeta en fase de captura y
       de burbuja para mostrar la diferencia en consola.
       ========================================================= */
  const setupEventFlowDemo = () => {
    const card = state.card;
    if (!card) return;

    // FASE DE CAPTURA (true como tercer argumento)
    on(
      card,
      "click",
      (e) => {
        console.log(
          "%c[Captura] La tarjeta intercepta el click ANTES de llegar al target",
          "color:#3498db;font-weight:bold",
        );
      },
      true,
    );

    // FASE DE BURBUJA (default, false)
    on(
      card,
      "click",
      (e) => {
        console.log(
          "%c[Burbuja] La tarjeta recibe el click DESPUÉS del target",
          "color:#e67e22;font-weight:bold",
        );
      },
      false,
    );
  };

  /* =========================================================
       5. INIT (llamado por app.js)
       ========================================================= */
  const init = ({ updateScoreboard }) => {
    // --- Cacheo de referencias (querySelector) ---
    state.card = document.getElementById("playerCard");
    state.emailInput = document.getElementById("emailInput");
    state.emailFeedback = document.getElementById("emailFeedback");
    state.btnToggle = document.getElementById("btnToggleHighlight");
    state.btnPulse = document.getElementById("btnAddPulse");
    state.btnReset = document.getElementById("btnResetCard");

    if (!state.card) {
      console.warn("[Paso 3] No se encontró #playerCard");
      return;
    }

    /* ---------- Handlers con arrow functions ---------- */

    // 1) Toggle Highlight (requisito explícito: classList.toggle)
    on(state.btnToggle, "click", () => {
      state.card.classList.toggle("highlight");
      state.interactions++;
      updateScoreboard("vanilla", 1);
    });

    // 2) Añadir/Quitar Pulse
    on(state.btnPulse, "click", () => {
      togglePulse();
      state.interactions++;
      updateScoreboard("vanilla", 1);
    });

    // 3) Reset
    on(state.btnReset, "click", () => {
      resetCard();
    });

    // 4) Click en la tarjeta misma
    on(state.card, "click", () => {
      flashCard();
      // Añadimos clase .highlight si no la tiene
      state.card.classList.toggle("highlight");
    });

    // 5) Validación en vivo (input) → feedback inmediato
    on(state.emailInput, "input", (e) => {
      const value = e.target.value;
      // Solo validamos si hay al menos 1 carácter
      if (value.length === 0) {
        clearEmailFeedback();
        return;
      }
      // Validación más suave mientras escribe:
      // solo mostramos error si ya escribió al menos 3 chars y no tiene @
      if (value.length >= 3) {
        showEmailFeedback(validateEmail(value));
      }
    });

    // 6) Validación al perder foco (blur) → validación estricta
    on(state.emailInput, "blur", (e) => {
      const value = e.target.value;
      if (value.trim() !== "") {
        showEmailFeedback(validateEmail(value));
      }
    });

    // 7) Enter para confirmar
    on(state.emailInput, "keydown", (e) => {
      if (e.key === "Enter") {
        const result = validateEmail(e.target.value);
        showEmailFeedback(result);
        if (result.valid) {
          updateScoreboard("vanilla", 1);
          // Feedback háptico visual: flash verde
          state.emailInput.classList.add("input-valid");
        } else {
          // Shake visual si no es válido
          state.emailInput.classList.add("input-invalid");
          setTimeout(() => {
            state.emailInput.classList.remove("input-invalid");
          }, 400);
        }
      }
    });

    // 8) Prevenir submit de formularios (por si se envuelve en <form>)
    on(state.emailInput, "keypress", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });

    // --- Demostración de event flow ---
    setupEventFlowDemo();

    // --- Estado inicial ---
    clearEmailFeedback();

    // Log de bienvenida
    console.log(
      "%c[Paso 3] DOM listo. Prueba: toggle highlight, pulse y valida un email.",
      "color:#3498db;font-weight:bold",
    );
  };

  /* =========================================================
       6. CLEANUP (para evitar detached nodes / leaks)
       ---------------------------------------------------------
       El orquestador puede invocarlo al cambiar de paso.
       ========================================================= */
  const cleanup = () => {
    // Remover todos los listeners registrados
    state.listeners.forEach(({ el, event, handler, options }) => {
      el.removeEventListener(event, handler, options);
    });
    state.listeners = [];

    // Limpiar timeouts
    if (pulseTimeout) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
    state.pulseActive = false;
  };

  /* =========================================================
       7. API PÚBLICA
       ========================================================= */
  return {
    init,
    cleanup,
    // Útil para DevTools:
    getState: () => ({
      interactions: state.interactions,
      pulseActive: state.pulseActive,
      hasHighlight: state.card?.classList.contains("highlight") ?? false,
      getListenerCount: () => state.listeners.length,
    }),
    validateEmail,
  };
})();
