/* ============================================================
   PASO 2: IIFE + Closures + Arrow Functions
   ------------------------------------------------------------
   Conceptos cubiertos:
     - IIFE (Immediately Invoked Function Expression)
     - Closures: estado privado persistente entre llamadas
     - Arrow functions: this léxico en handlers
     - Factory function que devuelve API controlada
   ------------------------------------------------------------
   La idea pedagógica:
     Cada vez que se hace click en "Incrementar contador",
     el closure retiene el número anterior y lo incrementa,
     SIN usar ninguna variable global.
   ============================================================ */

window.__modules = window.__modules || {};

window.__modules.paso2 = (function () {
  "use strict";

  /* =========================================================
       1. FACTORY DE CONTADOR (el corazón del closure)
       ---------------------------------------------------------
       createCounter() devuelve un objeto con métodos que
       acceden a las variables `count` y `lastAction` del scope
       de la factory. Esas variables NO son accesibles desde
       fuera → estado privado.
       ========================================================= */
  const createCounter = (initialLabel = "—") => {
    // --- Estado privado del closure ---
    let count = 0;
    let lastAction = initialLabel;
    let history = []; // log interno de acciones
    const startedAt = Date.now();

    // --- API pública (métodos que "capturan" el estado) ---
    return {
      /**
       * Incrementa el contador y registra la acción.
       * Arrow function ⇒ `this` no se re-binding.
       */
      increment: (label = "Toque") => {
        count += 1;
        lastAction = `${label} #${count}`;
        history.push({
          n: count,
          label,
          at: Date.now() - startedAt,
        });
        return count;
      },

      /**
       * Decrementa (nunca por debajo de 0).
       */
      decrement: () => {
        if (count > 0) {
          count -= 1;
          lastAction = `Deshacer (quedan ${count})`;
        }
        return count;
      },

      /**
       * Reinicia el estado interno.
       */
      reset: () => {
        count = 0;
        lastAction = initialLabel;
        history = [];
      },

      /**
       * Devuelve una copia del estado (no la referencia).
       * Esto evita que desde fuera puedan mutar `count`.
       */
      getState: () => ({
        count,
        lastAction,
        totalActions: history.length,
        uptime: Date.now() - startedAt,
      }),

      /**
       * Devuelve el historial completo (copia defensiva).
       */
      getHistory: () => history.slice(),
    };
  };

  /* =========================================================
       2. ESTADO DEL MÓDULO
       ========================================================= */
  const state = {
    counter: null, // se crea en init()
    fpsCounter: null, // segundo closure: mide "frames" visuales
    rafId: null,
    dom: {
      framesCount: null,
      clicksCount: null,
      lastAction: null,
      btnIncrement: null,
      btnDecrement: null,
      btnReset: null,
    },
  };

  /* =========================================================
       3. UTILIDADES INTERNAS
       ========================================================= */

  /**
   * Animación de "pop" en un elemento cuando cambia su valor.
   * No usamos estilos inline persistentes: solo durante la animación.
   */
  const popElement = (el) => {
    if (!el) return;
    el.style.transform = "scale(1.3)";
    el.style.color = "#2ecc71";
    setTimeout(() => {
      el.style.transform = "";
      el.style.color = "";
    }, 200);
  };

  /**
   * Formatea milisegundos a "mm:ss".
   */
  const formatUptime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  /* =========================================================
       4. SINCRONIZACIÓN CON LA UI
       ========================================================= */

  /**
   * Vuelca el estado del contador a las 3 tarjetas del DOM.
   * Usa textContent (nunca innerHTML) → seguro contra XSS.
   */
  const renderCounter = () => {
    const { count, lastAction, totalActions } = state.counter.getState();
    const { clicksCount, lastAction: lastActionEl } = state.dom;

    if (clicksCount) {
      clicksCount.textContent = count;
      popElement(clicksCount);
    }

    if (lastActionEl) {
      lastActionEl.textContent = totalActions > 0 ? lastAction : "—";
    }
  };

  /**
   * Vuelca el estado del "frames counter" (independiente).
   */
  const renderFrames = () => {
    const { count } = state.fpsCounter.getState();
    const el = state.dom.framesCount;
    if (el) el.textContent = count;
  };

  /* =========================================================
       5. LOOP DE "FRAMES" (segundo closure independiente)
       ---------------------------------------------------------
       Este loop solo cuenta cuántos frames han pasado desde
       que el módulo arrancó. Sirve como ejemplo visual de que
       dos closures pueden convivir sin compartir estado.
       ========================================================= */
  const startFramesLoop = () => {
    const tick = () => {
      // Cada 60 frames ≈ 1 segundo a 60fps, actualizamos UI
      state.fpsCounter.increment("Frame");
      renderFrames();
      state.rafId = requestAnimationFrame(tick);
    };
    state.rafId = requestAnimationFrame(tick);
  };

  const stopFramesLoop = () => {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  };

  /* =========================================================
       6. INIT (llamado por app.js)
       ========================================================= */
  const init = ({ updateScoreboard }) => {
    // --- Cachear referencias al DOM ---
    state.dom.framesCount = document.getElementById("framesCount");
    state.dom.clicksCount = document.getElementById("clicksCount");
    state.dom.lastAction = document.getElementById("lastAction");
    state.dom.btnIncrement = document.getElementById("btnIncrement");

    // Crear botón "decrementar" dinámicamente si no existe
    // (la guía original solo pide incrementar, pero da valor didáctico)
    const parentPanel = state.dom.btnIncrement?.parentElement;
    if (parentPanel && !document.getElementById("btnDecrement")) {
      const btnDec = document.createElement("button");
      btnDec.id = "btnDecrement";
      btnDec.className = "btn btn-danger";
      btnDec.textContent = "↺ Deshacer";
      btnDec.style.marginLeft = "8px";
      parentPanel.appendChild(btnDec);
    }
    state.dom.btnDecrement = document.getElementById("btnDecrement");

    // --- Crear los dos closures independientes ---
    state.counter = createCounter("—");
    state.fpsCounter = createCounter("Frame");

    // --- Render inicial ---
    renderCounter();
    renderFrames();

    /* ---------- Handlers (arrow functions) ---------- */

    // INCREMENTAR: cada click suma 1 al contador + suma al marcador
    state.dom.btnIncrement?.addEventListener("click", () => {
      state.counter.increment("Toque");
      renderCounter();
      updateScoreboard("vanilla", 1);
    });

    // DESHACER
    state.dom.btnDecrement?.addEventListener("click", () => {
      state.counter.decrement();
      renderCounter();
    });

    // Reinicio rápido con doble click sobre el botón incrementar
    state.dom.btnIncrement?.addEventListener("dblclick", () => {
      state.counter.reset();
      renderCounter();
    });

    // --- Arrancar el loop de frames ---
    startFramesLoop();

    // --- Limpieza al cambiar de paso: cancelAnimationFrame ---
    // Guardamos el cleanup en el módulo por si app.js lo necesita
    state.cleanup = () => {
      stopFramesLoop();
    };

    // --- Exponer el contador en consola para inspección ---
    // (útil para la parte de "depuración" del paso 5)
    console.log(
      "%c[Paso 2] Contador creado con closure. Prueba: window.__app.getState()",
      "color:#2ecc71;font-weight:bold",
    );
  };

  /* =========================================================
       7. API PÚBLICA DEL MÓDULO
       ========================================================= */
  return {
    init,
    getCounterState: () => state.counter?.getState(),
    getFramesState: () => state.fpsCounter?.getState(),
    getListenerCount: () => 3, // 3 listeners: increment, decrement, dblclick
    cleanup: () => state.cleanup?.(),
  };
})();
