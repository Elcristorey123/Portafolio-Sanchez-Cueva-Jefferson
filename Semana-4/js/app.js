/* ============================================================
   APP.JS - Orquestador Principal
   Semana 04 - IS093A - Desarrollo de Aplicaciones Web
   ------------------------------------------------------------
   Patrón: IIFE (Immediately Invoked Function Expression)
   Objetivo:
     1. Aislar el scope global (evitar contaminación de window)
     2. Controlar navegación entre pasos
     3. Inyectar dinámicamente el código del paso activo
     4. Inicializar cada módulo de paso
     5. Manejar el marcador del header
   ------------------------------------------------------------
   NOTA: Ninguna lógica de IA fue usada para generar este código.
         Todo fue escrito manualmente (regla 70% del laboratorio).
   ============================================================ */

(() => {
  "use strict";

  /* =========================================================
       1. ESTADO GLOBAL DE LA APP (encapsulado en el closure)
       ========================================================= */
  const AppState = {
    currentStep: 1,
    totalSteps: 5,
    score: { vanilla: 0, frameworks: 0 },
    initializedSteps: new Set(),
    modules: {}, // aquí se guardarán las referencias a los módulos cargados
  };

  /* =========================================================
       2. REFERENCIAS AL DOM (cacheadas al inicio)
       ========================================================= */
  const DOM = {
    stepTabs: document.querySelectorAll(".step-tab"),
    stepContents: document.querySelectorAll(".step-content"),
    codeDisplay: document.getElementById("codeDisplay"),
    activeCodeBadge: document.getElementById("activeCodeBadge"),
    fileTabName: document.getElementById("fileTabName"),
    scoreLocal: document.getElementById("scoreLocal"),
    scoreVisitante: document.getElementById("scoreVisitante"),
  };

  /* =========================================================
       3. FRAGMENTOS DE CÓDIGO POR PASO
       ---------------------------------------------------------
       Cada paso muestra en el panel derecho un resumen del
       código real que está corriendo en ese módulo.
       ========================================================= */
  const CODE_SNIPPETS = {
    1: {
      file: "paso1-canvas.js",
      code: `// ===== PASO 1: Canvas + Controles =====
// Setup del contexto 2D y loop de render con
// requestAnimationFrame + delta time (dt)

const canvas = document.getElementById('demoCanvas');
const ctx = canvas.getContext('2d');

let animationId = null;
let lastTime = 0;
let elapsed = 0;
let speed = 5;

function loop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  elapsed += dt * speed;

  render(elapsed);
  animationId = requestAnimationFrame(loop);
}

function render(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // ... dibujo del balón con arc()
}

// Handlers (arrow functions => this léxico)
document.getElementById('btnPlay')
  .addEventListener('click', () => {
    if (!animationId) {
      lastTime = performance.now();
      animationId = requestAnimationFrame(loop);
    }
  });

document.getElementById('btnPause')
  .addEventListener('click', () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });`,
    },
    2: {
      file: "paso2-closures.js",
      code: `// ===== PASO 2: IIFE + Closures + Arrow =====
// El closure retiene el estado del contador
// entre invocaciones sin variables globales.

const createCounter = () => {
  let count = 0;            // <-- estado privado del closure
  let lastAction = '—';

  return {
    increment: (label) => {
      count++;
      lastAction = label;
      return count;
    },
    getState: () => ({ count, lastAction }),
    reset: () => { count = 0; lastAction = '—'; }
  };
};

// Instancia única del contador del partido
const matchCounter = createCounter();

document.getElementById('btnIncrement')
  .addEventListener('click', () => {
    const total = matchCounter.increment('Toque');
    updateClosureUI(matchCounter.getState());
  });`,
    },
    3: {
      file: "paso3-dom.js",
      code: `// ===== PASO 3: DOM + Validación =====
// classList.toggle() + variables CSS (no inline styles)

const card = document.getElementById('playerCard');
const btnToggle = document.getElementById('btnToggleHighlight');
const btnPulse  = document.getElementById('btnAddPulse');
const btnReset  = document.getElementById('btnResetCard');
const emailInput = document.getElementById('emailInput');
const emailFeedback = document.getElementById('emailFeedback');

btnToggle.addEventListener('click', () => {
  card.classList.toggle('highlight'); // usa clase CSS
});

btnPulse.addEventListener('click', () => {
  card.classList.add('pulse');
});

btnReset.addEventListener('click', () => {
  card.classList.remove('highlight', 'pulse');
});

// Validación con regex
emailInput.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  const ok = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val);
  emailFeedback.textContent = ok ? '✓ Email válido' : '✗ Email inválido';
  emailFeedback.className = 'feedback ' + (ok ? 'valid' : 'invalid');
});`,
    },
    4: {
      file: "paso4-clicks.js",
      code: `// ===== PASO 4: Contador incremental =====
// Sumas acumulativas + partículas animadas

const arena = document.getElementById('clickArena');
const counterEl = document.getElementById('globalClickCount');
const historyList = document.getElementById('clickHistoryList');

let totalClicks = 0;
const history = [];

arena.addEventListener('click', (e) => {
  totalClicks++;
  counterEl.textContent = totalClicks;

  // Animación de "bump"
  counterEl.classList.add('bump');
  setTimeout(() => counterEl.classList.remove('bump'), 150);

  // Partícula flotante en la posición del click
  spawnParticle(e.offsetX, e.offsetY);

  // Registro en el historial
  history.unshift({
    n: totalClicks,
    time: new Date().toLocaleTimeString()
  });
  renderHistory();
});

function spawnParticle(x, y) {
  const p = document.createElement('span');
  p.className = 'click-particle';
  p.textContent = '⚽';
  p.style.left = x + 'px';
  p.style.top  = y + 'px';
  arena.appendChild(p);
  p.addEventListener('animationend', () => p.remove());
}`,
    },
    5: {
      file: "paso5-performance.js",
      code: `// ===== PASO 5: Performance Monitor (VAR) =====
// FPS con requestAnimationFrame + memoria (si el navegador lo expone)

const fpsEl = document.getElementById('fpsCurrent');
const memEl = document.getElementById('memoryUsed');
const listenersEl = document.getElementById('listenersActive');
const leaksEl = document.getElementById('possibleLeaks');
const memoryBar = document.getElementById('memoryBar');
const memoryPercent = document.getElementById('memoryPercent');
const fpsChart = document.getElementById('fpsChart');
const chartCtx = fpsChart.getContext('2d');

let frames = 0;
let lastFpsTime = performance.now();
const fpsHistory = new Array(60).fill(0);

function measureFPS(now) {
  frames++;
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round((frames * 1000) / (now - lastFpsTime));
    fpsEl.textContent = fps;
    fpsHistory.push(fps);
    fpsHistory.shift();
    drawFpsChart();
    frames = 0;
    lastFpsTime = now;
  }
  requestAnimationFrame(measureFPS);
}
requestAnimationFrame(measureFPS);

// Memoria (solo Chrome/Edge)
if (performance.memory) {
  setInterval(() => {
    const mb = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
    memEl.textContent = mb;
    const pct = ((performance.memory.usedJSHeapSize /
                  performance.memory.jsHeapSizeLimit) * 100).toFixed(1);
    memoryBar.style.width = pct + '%';
    memoryPercent.textContent = pct + '%';
  }, 1000);
}`,
    },
  };

  /* =========================================================
       4. UTILIDADES INTERNAS
       ========================================================= */

  /**
   * Actualiza el marcador del header.
   * Vanilla JS suma +1 cada vez que un paso se completa bien.
   */
  const updateScoreboard = (team, delta = 1) => {
    if (!(team in AppState.score)) return;
    AppState.score[team] += delta;

    const el = team === "vanilla" ? DOM.scoreLocal : DOM.scoreVisitante;

    // Animación de "flash" al sumar
    el.style.transform = "scale(1.5)";
    el.style.color = "#2ecc71";
    setTimeout(() => {
      el.style.transform = "scale(1)";
      el.style.color = "";
    }, 300);

    el.textContent = AppState.score[team];
  };

  /**
   * Cambia el paso activo: oculta los demás, muestra el actual,
   * actualiza pestañas y panel de código.
   */
  const goToStep = (stepNumber) => {
    stepNumber = Number(stepNumber);
    if (stepNumber < 1 || stepNumber > AppState.totalSteps) return;
    if (
      stepNumber === AppState.currentStep &&
      DOM.stepContents[stepNumber - 1].classList.contains("active")
    ) {
      return; // ya está activo
    }

    AppState.currentStep = stepNumber;

    // 1) Actualizar pestañas
    DOM.stepTabs.forEach((tab) => {
      const isActive = Number(tab.dataset.step) === stepNumber;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // 2) Actualizar contenidos
    DOM.stepContents.forEach((content) => {
      const isActive = Number(content.dataset.stepContent) === stepNumber;
      content.classList.toggle("active", isActive);
    });

    // 3) Actualizar panel de código
    updateCodePanel(stepNumber);

    // 4) Inicializar módulo si es la primera vez
    lazyInitModule(stepNumber);
  };

  /**
   * Inyecta en el <code id="codeDisplay"> el snippet del paso activo.
   * Usa textContent (no innerHTML) para evitar inyección.
   */
  const updateCodePanel = (stepNumber) => {
    const snippet = CODE_SNIPPETS[stepNumber];
    if (!snippet) return;

    DOM.codeDisplay.textContent = snippet.code;
    DOM.activeCodeBadge.textContent = `Paso ${stepNumber} activo`;
    DOM.fileTabName.textContent = snippet.file;
  };

  /**
   * Inicializa el módulo JS del paso solo la primera vez que se visita.
   * (lazy loading manual, sin bundlers)
   */
  const lazyInitModule = (stepNumber) => {
    if (AppState.initializedSteps.has(stepNumber)) return;

    // Los módulos se auto-registran en window.__modules por simplicidad.
    // Cada archivo pasoN-*.js define window.__modules.pasoN = initFn.
    const initFn = window.__modules?.[`paso${stepNumber}`];

    if (typeof initFn === "function") {
      try {
        initFn({
          // le inyectamos utilidades controladas (no todo window)
          updateScoreboard,
          AppState,
          DOM,
        });
        AppState.initializedSteps.add(stepNumber);
        logConsole(`✅ Módulo Paso ${stepNumber} inicializado`, "ok");
      } catch (err) {
        console.error(`Error inicializando Paso ${stepNumber}:`, err);
        logConsole(`❌ Error Paso ${stepNumber}: ${err.message}`, "error");
      }
    } else {
      // Puede pasar si el módulo aún no se ha cargado (orden de scripts)
      logConsole(`⏳ Módulo Paso ${stepNumber} aún no disponible`, "warn");
    }
  };

  /**
   * Mini consola para debug (opcional, visible en consola del navegador).
   */
  const logConsole = (msg, level = "info") => {
    const prefix = "[FútbolDOM]";
    if (level === "error") console.error(prefix, msg);
    else if (level === "warn") console.warn(prefix, msg);
    else console.log(prefix, msg);
  };

  /* =========================================================
       5. EVENT LISTENERS PRINCIPALES
       ========================================================= */

  // --- Pestañas de navegación ---
  DOM.stepTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      goToStep(tab.dataset.step);
    });

    // Accesibilidad: navegación con teclado
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        const next = Math.min(AppState.currentStep + 1, AppState.totalSteps);
        goToStep(next);
        DOM.stepTabs[next - 1].focus();
      } else if (e.key === "ArrowLeft") {
        const prev = Math.max(AppState.currentStep - 1, 1);
        goToStep(prev);
        DOM.stepTabs[prev - 1].focus();
      }
    });
  });

  // --- Atajo de teclado global: números 1-5 cambian de paso ---
  document.addEventListener("keydown", (e) => {
    // Ignorar si el usuario está escribiendo en un input
    const tag = document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    const n = Number(e.key);
    if (n >= 1 && n <= AppState.totalSteps) {
      goToStep(n);
    }
  });

  /* =========================================================
       6. ARRANQUE (Bootstrap)
       ========================================================= */
  const bootstrap = () => {
    logConsole("⚽ Sistema iniciado");

    // Mostrar código del paso 1 por defecto
    updateCodePanel(1);

    // Cargar módulos cuando el DOM esté listo
    // (los scripts pasoN-*.js ya se cargaron con defer)
    // Esperamos un tick para asegurarnos de que __modules exista.
    requestAnimationFrame(() => {
      // Inicializar el paso 1 (el visible por defecto)
      lazyInitModule(1);

      // Pre-inicializar los demás en idle time para que al cambiar
      // de pestaña ya estén listos (mejor UX).
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => {
          for (let i = 2; i <= AppState.totalSteps; i++) {
            lazyInitModule(i);
          }
        });
      } else {
        setTimeout(() => {
          for (let i = 2; i <= AppState.totalSteps; i++) {
            lazyInitModule(i);
          }
        }, 1000);
      }
    });
  };

  // Exponer API mínima y controlada (por si otros módulos la necesitan)
  window.__app = {
    goToStep,
    updateScoreboard,
    getState: () => ({ ...AppState }),
  };

  // Arrancar cuando el DOM esté listo (defer ya garantiza esto,
  // pero por seguridad usamos DOMContentLoaded).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
