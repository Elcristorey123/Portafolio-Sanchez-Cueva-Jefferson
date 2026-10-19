/* ============================================================
   PASO 4: Contador Incremental de Eventos
   ------------------------------------------------------------
   Conceptos cubiertos:
     - Delegación de eventos (un solo listener para muchos nodos)
     - Coordenadas de puntero (offsetX/offsetY vs clientX/clientY)
     - Creación dinámica de nodos (createElement + appendChild)
     - Remoción segura (animationend + remove)
     - Historial limitado (queue FIFO)
     - Anti-spam: throttle de partículas
   ------------------------------------------------------------
   La idea pedagógica:
     Cada click dentro de la "arena" suma 1 al contador global,
     deja una partícula ⚽ animada y registra una entrada en el
     historial con timestamp.
   ============================================================ */

window.__modules = window.__modules || {};

window.__modules.paso4 = (function () {
  "use strict";

  /* =========================================================
       1. CONFIGURACIÓN
       ========================================================= */
  const CONFIG = {
    MAX_HISTORY: 8, // máximo de entradas visibles en el historial
    MAX_PARTICLES: 60, // límite duro de partículas simultáneas (anti-leak)
    PARTICLE_ICONS: ["⚽", "🥅", "🏆", "🔥", "💥", "⭐"],
    // Cada cuántos clicks mostramos un ícono "especial" (más grande)
    MILESTONE_EVERY: 10,
  };

  /* =========================================================
       2. ESTADO DEL MÓDULO
       ========================================================= */
  const state = {
    arena: null,
    counterEl: null,
    historyList: null,
    totalClicks: 0,
    history: [], // FIFO de últimas jugadas
    particles: new Set(), // tracking de partículas vivas (para cleanup)
    startTime: 0,
    listeners: [], // referencias para cleanup
    // Cache de DOM interno para reutilizar nodos del historial
    historyNodes: new Map(),
  };

  /* =========================================================
       3. UTILIDADES
       ========================================================= */

  /**
   * Devuelve un timestamp formateado HH:MM:SS.
   */
  const formatTime = (date = new Date()) => {
    return date.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  /**
   * Formatea segundos transcurridos como "mm:ss".
   */
  const formatElapsed = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  /**
   * Devuelve un ícono según el número de click.
   * Los múltiplos de MILESTONE_EVERY son "especiales".
   */
  const pickIcon = (n) => {
    if (n % CONFIG.MILESTONE_EVERY === 0 && n > 0) return "🏆";
    return CONFIG.PARTICLE_ICONS[
      Math.floor(Math.random() * (CONFIG.PARTICLE_ICONS.length - 1))
    ];
  };

  /**
   * Registra un listener y lo guarda para cleanup.
   */
  const on = (el, event, handler, options = {}) => {
    if (!el) return;
    el.addEventListener(event, handler, options);
    state.listeners.push({ el, event, handler, options });
  };

  /* =========================================================
       4. PARTÍCULAS
       ---------------------------------------------------------
       Cada partícula es un <span> posicionado absolutamente
       dentro de la arena, que se elimina al terminar su
       animación CSS (animationend). Sin leaks.
       ========================================================= */

  /**
   * Crea una partícula en la posición (x, y) relativa a la arena.
   * @param {number} x - offsetX dentro de la arena
   * @param {number} y - offsetY dentro de la arena
   * @param {string} icon - emoji a mostrar
   * @param {boolean} isMilestone - si es múltiplo especial
   */
  const spawnParticle = (x, y, icon, isMilestone = false) => {
    const arena = state.arena;
    if (!arena) return;

    // Anti-spam: si hay demasiadas partículas, eliminamos la más vieja
    if (state.particles.size >= CONFIG.MAX_PARTICLES) {
      const oldest = state.particles.values().next().value;
      if (oldest) {
        oldest.remove();
        state.particles.delete(oldest);
      }
    }

    const p = document.createElement("span");
    p.className = "click-particle" + (isMilestone ? " milestone" : "");
    p.textContent = icon;

    // Variación aleatoria para que no queden todas alineadas
    const jitterX = (Math.random() - 0.5) * 30;
    const jitterY = (Math.random() - 0.5) * 20;

    // Posicionamiento vía CSS custom properties (variables CSS)
    // → cumple la guía: no usar style.xxx directo para props visuales
    p.style.setProperty("--x", `${x + jitterX}px`);
    p.style.setProperty("--y", `${y + jitterY}px`);
    p.style.setProperty("--rot", `${(Math.random() - 0.5) * 60}deg`);
    p.style.setProperty("--dur", `${700 + Math.random() * 400}ms`);

    arena.appendChild(p);
    state.particles.add(p);

    // Remoción limpia al terminar la animación
    const removeParticle = () => {
      p.removeEventListener("animationend", removeParticle);
      p.remove();
      state.particles.delete(p);
    };
    p.addEventListener("animationend", removeParticle);

    // Fallback por si el navegador no dispara animationend (raro)
    setTimeout(() => {
      if (state.particles.has(p)) removeParticle();
    }, 1500);
  };

  /* =========================================================
       5. HISTORIAL
       ---------------------------------------------------------
       FIFO: agregamos al inicio, cortamos al máximo.
       Solo re-renderizamos lo mínimo posible.
       ========================================================= */

  /**
   * Agrega una entrada al historial y re-renderiza la lista.
   */
  const pushHistory = (entry) => {
    state.history.unshift(entry);
    if (state.history.length > CONFIG.MAX_HISTORY) {
      state.history.pop();
    }
    renderHistory();
  };

  /**
   * Renderiza el historial en el DOM.
   * Reutiliza el <ul> existente y usa documentFragment para performance.
   */
  const renderHistory = () => {
    const list = state.historyList;
    if (!list) return;

    // Limpiar lista actual (rápido y seguro)
    list.textContent = "";

    if (state.history.length === 0) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "Sin jugadas registradas";
      list.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    state.history.forEach((entry, idx) => {
      const li = document.createElement("li");
      li.className = "history-entry";
      if (idx === 0) li.classList.add("history-entry-new");

      // --- Número de jugada ---
      const num = document.createElement("span");
      num.className = "history-num";
      num.textContent = `#${entry.n}`;

      // --- Descripción ---
      const desc = document.createElement("span");
      desc.className = "history-desc";
      desc.textContent = entry.isMilestone
        ? `${entry.icon} ¡Jugada maestra #${entry.n}!`
        : `${entry.icon} Pase registrado`;

      // --- Tiempo ---
      const time = document.createElement("span");
      time.className = "history-time";
      time.textContent = entry.time;

      li.append(num, desc, time);
      frag.appendChild(li);
    });

    list.appendChild(frag);
  };

  /* =========================================================
       6. MANEJO DEL CLICK
       ---------------------------------------------------------
       Delegación: un solo listener en la arena captura los
       clicks y calcula offsetX/offsetY relativos.
       ========================================================= */
  const handleArenaClick = (e, updateScoreboard) => {
    const arena = state.arena;
    if (!arena) return;

    // --- Calcular coordenadas relativas a la arena ---
    // offsetX/offsetY son relativos al target; si el click cae en
    // un hijo (como el texto), los recalculamos con getBoundingClientRect.
    const rect = arena.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // --- Incrementar estado ---
    state.totalClicks += 1;
    const n = state.totalClicks;
    const isMilestone = n % CONFIG.MILESTONE_EVERY === 0;
    const icon = pickIcon(n);

    // --- Actualizar contador grande ---
    updateCounterDisplay(n);

    // --- Partícula ---
    spawnParticle(x, y, icon, isMilestone);

    // --- Historial ---
    pushHistory({
      n,
      icon,
      isMilestone,
      time: formatTime(),
      elapsed: formatElapsed(Date.now() - state.startTime),
    });

    // --- Marcador del header (cada 5 clicks, +1 gol) ---
    if (n % 5 === 0) {
      updateScoreboard("vanilla", 1);
    }

    // --- Log de depuración ---
    if (isMilestone) {
      console.log(
        `%c[Paso 4] 🏆 ¡Jugada maestra #${n}!`,
        "color:#ffd700;font-weight:bold;font-size:14px",
      );
    }
  };

  /**
   * Actualiza el contador grande con animación "bump".
   */
  const updateCounterDisplay = (n) => {
    const el = state.counterEl;
    if (!el) return;

    el.textContent = n;

    // Reiniciar animación (truco: quitar, forzar reflow, volver a añadir)
    el.classList.remove("bump");
    void el.offsetWidth; // ← fuerza reflow para reiniciar la animación
    el.classList.add("bump");

    // Remover clase al terminar
    const onEnd = () => {
      el.classList.remove("bump");
      el.removeEventListener("animationend", onEnd);
    };
    el.addEventListener("animationend", onEnd);
  };

  /* =========================================================
       7. RESET
       ========================================================= */
  const resetArena = () => {
    state.totalClicks = 0;
    state.history = [];
    state.startTime = Date.now();

    // Actualizar contador
    if (state.counterEl) {
      state.counterEl.textContent = "0";
    }

    // Limpiar partículas vivas
    state.particles.forEach((p) => p.remove());
    state.particles.clear();

    // Limpiar historial
    renderHistory();

    console.log(
      "%c[Paso 4] Arena reiniciada.",
      "color:#3498db;font-weight:bold",
    );
  };

  /* =========================================================
       8. INIT (llamado por app.js)
       ========================================================= */
  const init = ({ updateScoreboard }) => {
    state.arena = document.getElementById("clickArena");
    state.counterEl = document.getElementById("globalClickCount");
    state.historyList = document.getElementById("clickHistoryList");

    if (!state.arena || !state.counterEl) {
      console.warn("[Paso 4] Faltan elementos del DOM en la arena");
      return;
    }

    state.startTime = Date.now();

    // --- Listener principal en la arena ---
    on(state.arena, "click", (e) => handleArenaClick(e, updateScoreboard));

    // --- Prevención de selección de texto al hacer click repetido ---
    on(state.arena, "mousedown", (e) => e.preventDefault());

    // --- Render inicial del historial (estado vacío) ---
    renderHistory();

    // --- Bonus: doble click en el contador reinicia ---
    on(state.counterEl, "dblclick", (e) => {
      e.stopPropagation();
      resetArena();
    });

    // --- Teclado: barra espaciadora simula un click en el centro ---
    on(state.arena, "keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const rect = state.arena.getBoundingClientRect();
        const fakeEvent = {
          clientX: rect.left + rect.width / 2 + (Math.random() - 0.5) * 100,
          clientY: rect.top + rect.height / 2 + (Math.random() - 0.5) * 60,
        };
        handleArenaClick(fakeEvent, updateScoreboard);
      }
    });

    // Hacer el arena focusable para el listener de teclado
    state.arena.setAttribute("tabindex", "0");
    state.arena.setAttribute("role", "button");
    state.arena.setAttribute(
      "aria-label",
      "Arena de clicks. Presiona espacio para registrar un pase.",
    );

    console.log(
      "%c[Paso 4] Arena lista. Haz click para sumar pases.",
      "color:#2ecc71;font-weight:bold",
    );
  };

  /* =========================================================
       9. CLEANUP
       ========================================================= */
  const cleanup = () => {
    // Remover listeners
    state.listeners.forEach(({ el, event, handler, options }) => {
      el.removeEventListener(event, handler, options);
    });
    state.listeners = [];

    // Eliminar partículas vivas (evita detached nodes)
    state.particles.forEach((p) => p.remove());
    state.particles.clear();

    console.log("%c[Paso 4] Cleanup completo.", "color:#9ca3af");
  };

  /* =========================================================
       10. API PÚBLICA
       ========================================================= */
  return {
    init,
    cleanup,
    reset: resetArena,
    getState: () => ({
      totalClicks: state.totalClicks,
      historySize: state.history.length,
      particlesAlive: state.particles.size,
      uptime: formatElapsed(Date.now() - state.startTime),
      getListenerCount: () => state.listeners.length,
    }),
  };
})();
