/* ============================================================
   PASO 5: Depuración y Optimización (Monitor VAR)
   ------------------------------------------------------------
   Conceptos cubiertos:
     - requestAnimationFrame para medir FPS en vivo
     - performance.memory (Chrome/Edge) para heap JS
     - Detección de detached DOM nodes (referencias huérfanas)
     - cancelAnimationFrame para limpieza correcta
     - performance.now() vs Date.now()
     - Simulación controlada de memory leak (didáctica)
     - Gráfico de FPS en canvas propio (últimos 60 s)
   ------------------------------------------------------------
   Restricciones respetadas:
     ✅ Sin librerías externas
     ✅ Sin setInterval para FPS (solo para polling de memoria)
     ✅ cancelAnimationFrame al limpiar
     ✅ No usar innerHTML
   ============================================================ */

window.__modules = window.__modules || {};

window.__modules.paso5 = (function () {
  "use strict";

  /* =========================================================
       1. CONFIGURACIÓN
       ========================================================= */
  const CONFIG = {
    FPS_SAMPLES: 60, // muestras del gráfico (60 s aprox)
    MEMORY_POLL_MS: 1000, // cada cuánto refrescar memoria
    LEAK_CHUNK_MB: 2, // cuánta memoria "fugar" por click
    LEAK_MAX_MB: 200, // tope de la simulación
    HEALTH_THRESHOLDS: {
      fpsGood: 50,
      fpsWarn: 30,
      memGoodPct: 50,
      memWarnPct: 80,
    },
    LONG_TASK_MS: 50, // umbral de "long task" según spec
  };

  /* =========================================================
       2. ESTADO DEL MÓDULO
       ========================================================= */
  const state = {
    // --- Elementos del DOM ---
    dom: {
      fpsCurrent: null,
      memoryUsed: null,
      listenersActive: null,
      possibleLeaks: null,
      healthBadge: null,
      memoryBar: null,
      memoryPercent: null,
      fpsChart: null,
      monitorConsole: null,
      btnAnalyze: null,
      btnSimulateLeak: null,
      btnCleanMemory: null,
    },

    // --- FPS loop ---
    fpsRafId: null,
    fpsFrames: 0,
    fpsLastTime: 0,
    fpsHistory: new Array(CONFIG.FPS_SAMPLES).fill(0),
    chartCtx: null,

    // --- Memoria ---
    memoryPollId: null,
    memorySupported: false,

    // --- Detección de leaks ---
    leakRegistry: [], // referencias retenidas intencionalmente
    leakSimulatedBytes: 0,

    // --- Listeners propios (para contar y limpiar) ---
    ownListeners: [],

    // --- Long Tasks ---
    longTaskObserver: null,

    // --- HUD de logs internos ---
    consoleLines: [],

    // --- Uptime ---
    startTime: 0,
  };

  /* =========================================================
       3. UTILIDADES DE UI
       ========================================================= */

  /**
   * Escribe una línea en la mini consola del monitor.
   */
  const logLine = (msg, level = "info") => {
    const el = state.dom.monitorConsole;
    if (!el) return;

    const p = document.createElement("p");
    p.className = "console-line" + (level !== "info" ? " " + level : "");
    const ts = new Date().toLocaleTimeString("es-PE", { hour12: false });
    p.textContent = `> [${ts}] ${msg}`;

    el.appendChild(p);

    // Limitar a 30 líneas (FIFO)
    while (el.children.length > 30) {
      el.removeChild(el.firstChild);
    }

    // Auto-scroll al final
    el.scrollTop = el.scrollHeight;

    // Guardar en memoria interna
    state.consoleLines.push({ msg, level, ts });
    if (state.consoleLines.length > 100) state.consoleLines.shift();
  };

  /**
   * Formatea bytes a "X.XX MB".
   */
  const formatMB = (bytes) => (bytes / 1048576).toFixed(2);

  /**
   * Formatea milisegundos como "X ms".
   */
  const formatMs = (ms) => `${ms.toFixed(1)} ms`;

  /* =========================================================
       4. MEDIDOR DE FPS
       ---------------------------------------------------------
       Usamos requestAnimationFrame. Cada 1000 ms calculamos
       el FPS real y lo empujamos al histórico del gráfico.
       ========================================================= */
  const startFpsLoop = () => {
    state.fpsLastTime = performance.now();
    state.fpsFrames = 0;

    const tick = (now) => {
      state.fpsFrames++;

      const delta = now - state.fpsLastTime;
      if (delta >= 1000) {
        const fps = Math.round((state.fpsFrames * 1000) / delta);

        // Actualizar número grande
        if (state.dom.fpsCurrent) {
          state.dom.fpsCurrent.textContent = fps;
        }

        // Push al histórico (FIFO)
        state.fpsHistory.push(fps);
        state.fpsHistory.shift();

        // Redibujar gráfico
        drawFpsChart();

        // Reevaluar salud global
        updateHealthBadge();

        // Reset contadores
        state.fpsFrames = 0;
        state.fpsLastTime = now;
      }

      state.fpsRafId = requestAnimationFrame(tick);
    };

    state.fpsRafId = requestAnimationFrame(tick);
    logLine("Medidor de FPS iniciado", "info");
  };

  const stopFpsLoop = () => {
    if (state.fpsRafId) {
      cancelAnimationFrame(state.fpsRafId);
      state.fpsRafId = null;
    }
  };

  /* =========================================================
       5. GRÁFICO DE FPS (Canvas)
       ---------------------------------------------------------
       Dibuja una barra por cada muestra del histórico.
       Colores: verde > 50, amarillo 30-50, rojo < 30.
       ========================================================= */
  const drawFpsChart = () => {
    const canvas = state.dom.fpsChart;
    const ctx = state.chartCtx;
    if (!canvas || !ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Fondo
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, W, H);

    // Grid horizontal (referencias de 30 y 60 FPS)
    const maxFps = 120;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    [30, 60, 90].forEach((ref) => {
      const y = H - (ref / maxFps) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();

      // Etiqueta
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "10px Consolas, monospace";
      ctx.fillText(`${ref}`, 4, y - 2);
    });
    ctx.setLineDash([]);

    // Barras
    const barW = W / CONFIG.FPS_SAMPLES;
    state.fpsHistory.forEach((fps, i) => {
      const h = (fps / maxFps) * H;
      const x = i * barW;

      // Color según salud
      let color;
      if (fps >= CONFIG.HEALTH_THRESHOLDS.fpsGood) color = "#2ecc71";
      else if (fps >= CONFIG.HEALTH_THRESHOLDS.fpsWarn) color = "#f39c12";
      else if (fps > 0) color = "#e63946";
      else color = "rgba(255,255,255,0.05)";

      ctx.fillStyle = color;
      ctx.fillRect(x, H - h, Math.max(barW - 1, 1), h);
    });

    // Línea de 60 FPS como referencia "ideal"
    const idealY = H - (60 / maxFps) * H;
    ctx.strokeStyle = "rgba(255, 215, 0, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, idealY);
    ctx.lineTo(W, idealY);
    ctx.stroke();
  };

  /* =========================================================
       6. MEMORIA (Chrome/Edge)
       ---------------------------------------------------------
       performance.memory NO es estándar. Solo Chrome/Edge lo
       exponen. Detectamos soporte y avisamos si no está.
       ========================================================= */
  const startMemoryPoll = () => {
    if (!state.memorySupported) return;

    const poll = () => {
      const mem = performance.memory;
      const usedBytes = mem.usedJSHeapSize;
      const limitBytes = mem.jsHeapSizeLimit;
      const pct = (usedBytes / limitBytes) * 100;

      if (state.dom.memoryUsed) {
        state.dom.memoryUsed.textContent = formatMB(usedBytes);
      }
      if (state.dom.memoryBar) {
        state.dom.memoryBar.style.width = `${pct.toFixed(1)}%`;
      }
      if (state.dom.memoryPercent) {
        state.dom.memoryPercent.textContent = `${pct.toFixed(1)}%`;
      }

      updateHealthBadge();
    };

    poll();
    state.memoryPollId = setInterval(poll, CONFIG.MEMORY_POLL_MS);
    logLine("Monitoreo de memoria iniciado", "info");
  };

  const stopMemoryPoll = () => {
    if (state.memoryPollId) {
      clearInterval(state.memoryPollId);
      state.memoryPollId = null;
    }
  };

  /* =========================================================
       7. HEALTH BADGE (semáforo global)
       ---------------------------------------------------------
       Combina FPS + memoria para dar un veredicto.
       ========================================================= */
  const updateHealthBadge = () => {
    const badge = state.dom.healthBadge;
    if (!badge) return;

    // FPS actual
    const lastFps = state.fpsHistory[state.fpsHistory.length - 1] || 60;

    // Memoria
    let memPct = 0;
    if (state.memorySupported) {
      memPct =
        (performance.memory.usedJSHeapSize /
          performance.memory.jsHeapSizeLimit) *
        100;
    }

    // Detección de leaks
    const hasLeaks = state.leakRegistry.length > 0;

    // Veredicto
    let status, text;
    if (
      lastFps < CONFIG.HEALTH_THRESHOLDS.fpsWarn ||
      memPct > CONFIG.HEALTH_THRESHOLDS.memWarnPct ||
      hasLeaks
    ) {
      status = "danger";
      text = "● CRÍTICO";
    } else if (
      lastFps < CONFIG.HEALTH_THRESHOLDS.fpsGood ||
      memPct > CONFIG.HEALTH_THRESHOLDS.memGoodPct
    ) {
      status = "warning";
      text = "● ADVERTENCIA";
    } else {
      status = "ok";
      text = "● SALUDABLE";
    }

    badge.textContent = text;
    badge.className = "health-badge" + (status !== "ok" ? " " + status : "");
  };

  /* =========================================================
       8. CONTEO DE LISTENERS
       ---------------------------------------------------------
       DevTools expone `getEventListeners()` en consola, pero no
       desde JS. Contamos manualmente:
         - listeners propios de este módulo
         - listeners del orquestador (via window.__app.getState)
       ========================================================= */
  const countListeners = () => {
    // Nuestros propios listeners
    let count = state.ownListeners.length;

    // Sumamos los que conocemos del resto de módulos
    // (cada módulo expone un método para contar, si existe)
    const modules = ["paso1", "paso2", "paso3", "paso4"];
    modules.forEach((name) => {
      const mod = window.__modules?.[name];
      if (mod && typeof mod.getListenerCount === "function") {
        count += mod.getListenerCount();
      }
    });

    return count;
  };

  const refreshListenerCount = () => {
    if (state.dom.listenersActive) {
      state.dom.listenersActive.textContent = countListeners();
    }
  };

  /* =========================================================
       9. DETECCIÓN DE DETACHED DOM NODES
       ---------------------------------------------------------
       No podemos ver directamente el heap, pero podemos:
         1. Crear nodos huérfanos intencionalmente (simulación).
         2. Contarlos con un WeakRef si el navegador lo soporta.
         3. Reportar cuántos siguen "vivos" tras un GC.
       ========================================================= */

  /**
   * Simula un memory leak: crea nodos DOM y los retiene en
   * state.leakRegistry, además de arrays grandes.
   */
  const simulateLeak = () => {
    const chunkMB = CONFIG.LEAK_CHUNK_MB;
    const currentMB = state.leakSimulatedBytes / 1048576;

    if (currentMB >= CONFIG.LEAK_MAX_MB) {
      logLine(
        `Tope de simulación alcanzado (${CONFIG.LEAK_MAX_MB} MB)`,
        "warn",
      );
      return;
    }

    // 1) Array grande de strings (~1 MB por cada 100k chars)
    const bigArray = new Array(1024).fill("X".repeat(1024)); // ~1 MB aprox
    state.leakRegistry.push(bigArray);

    // 2) Nodos DOM huérfanos (detached nodes)
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 50; i++) {
      const div = document.createElement("div");
      div.textContent = `Nodo huérfano #${state.leakRegistry.length}-${i}`;
      div.className = "leaked-node";
      fragment.appendChild(div);
    }
    // Retenemos el fragment (nunca lo insertamos → detached nodes)
    state.leakRegistry.push(fragment);

    state.leakSimulatedBytes += chunkMB * 1048576;

    // Refrescar métrica de "posibles leaks"
    refreshLeakCount();
    updateHealthBadge();

    logLine(
      `⚠ Leak simulado: +${chunkMB} MB (total: ${(state.leakSimulatedBytes / 1048576).toFixed(0)} MB)`,
      "warn",
    );
  };

  /**
   * Limpia todos los leaks simulados y fuerza un GC si es posible.
   */
  const cleanMemory = () => {
    const count = state.leakRegistry.length;
    state.leakRegistry = [];
    state.leakSimulatedBytes = 0;

    // En Chrome, exponer el registry a un WeakRef permite GC.
    // Además podemos forzar GC desde DevTools, pero desde JS
    // no es posible. Igual: al soltar las referencias, quedan
    // elegibles para el GC natural.

    refreshLeakCount();
    updateHealthBadge();

    logLine(
      `🧹 Memoria liberada: ${count} referencias soltadas (espera GC natural)`,
      "info",
    );

    // Refrescar memoria tras un tick por si performance.memory ya bajó
    setTimeout(() => {
      if (state.memorySupported) {
        const mb = formatMB(performance.memory.usedJSHeapSize);
        if (state.dom.memoryUsed) state.dom.memoryUsed.textContent = mb;
      }
    }, 300);
  };

  /**
   * Actualiza el contador de "posibles leaks" en la UI.
   */
  const refreshLeakCount = () => {
    if (state.dom.possibleLeaks) {
      state.dom.possibleLeaks.textContent = state.leakRegistry.length;
    }
  };

  /* =========================================================
       10. LONG TASKS OBSERVER
       ---------------------------------------------------------
       PerformanceObserver detecta tareas que bloquean el hilo
       principal > 50 ms. Muy útil para encontrar jank.
       ========================================================= */
  const startLongTaskObserver = () => {
    if (!("PerformanceObserver" in window)) {
      logLine("PerformanceObserver no soportado en este navegador", "warn");
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logLine(
            `🐌 Long Task detectada: ${formatMs(entry.duration)}`,
            "warn",
          );
        }
      });

      observer.observe({ entryTypes: ["longtask"] });
      state.longTaskObserver = observer;
      logLine("Observador de Long Tasks activo", "info");
    } catch (err) {
      logLine(`No se pudo iniciar Long Task Observer: ${err.message}`, "error");
    }
  };

  const stopLongTaskObserver = () => {
    if (state.longTaskObserver) {
      state.longTaskObserver.disconnect();
      state.longTaskObserver = null;
    }
  };

  /* =========================================================
       11. ANÁLISIS BAJO DEMANDA
       ---------------------------------------------------------
       Botón "Analizar Rendimiento": corre un pequeño benchmark
       y reporta en la consola del monitor.
       ========================================================= */
  const runAnalysis = () => {
    logLine("🔍 Iniciando análisis de rendimiento...", "info");

    const t0 = performance.now();

    // 1) FPS promedio últimos 60s
    const fpsAvg =
      state.fpsHistory.reduce((a, b) => a + b, 0) / state.fpsHistory.length;

    // 2) FPS mínimo
    const fpsMin = Math.min(...state.fpsHistory.filter((f) => f > 0));

    // 3) Memoria actual
    let memInfo = "no soportada";
    if (state.memorySupported) {
      const mem = performance.memory;
      memInfo = `${formatMB(mem.usedJSHeapSize)} MB / ${formatMB(mem.jsHeapSizeLimit)} MB`;
    }

    // 4) Listeners
    const listeners = countListeners();

    // 5) Leaks
    const leaks = state.leakRegistry.length;

    // 6) Uptime
    const uptime = ((performance.now() - state.startTime) / 1000).toFixed(0);

    const elapsed = performance.now() - t0;

    logLine(
      `📊 FPS promedio: ${fpsAvg.toFixed(1)}`,
      fpsAvg >= 50 ? "info" : "warn",
    );
    logLine(`📉 FPS mínimo: ${fpsMin || 0}`, fpsMin >= 30 ? "info" : "warn");
    logLine(`💾 Memoria: ${memInfo}`, "info");
    logLine(`🎧 Listeners activos: ${listeners}`, "info");
    logLine(`👻 Posibles leaks: ${leaks}`, leaks === 0 ? "info" : "warn");
    logLine(`⏱ Uptime: ${uptime}s · Análisis en ${formatMs(elapsed)}`, "info");
    logLine("✅ Análisis completado", "info");
  };

  /* =========================================================
       12. INIT
       ========================================================= */
  const init = () => {
    // --- Cacheo de DOM ---
    const d = state.dom;
    d.fpsCurrent = document.getElementById("fpsCurrent");
    d.memoryUsed = document.getElementById("memoryUsed");
    d.listenersActive = document.getElementById("listenersActive");
    d.possibleLeaks = document.getElementById("possibleLeaks");
    d.healthBadge = document.getElementById("healthBadge");
    d.memoryBar = document.getElementById("memoryBar");
    d.memoryPercent = document.getElementById("memoryPercent");
    d.fpsChart = document.getElementById("fpsChart");
    d.monitorConsole = document.getElementById("monitorConsole");
    d.btnAnalyze = document.getElementById("btnAnalyze");
    d.btnSimulateLeak = document.getElementById("btnSimulateLeak");
    d.btnCleanMemory = document.getElementById("btnCleanMemory");

    if (!d.fpsChart) {
      console.warn("[Paso 5] No se encontró #fpsChart");
      return;
    }

    // --- Contexto del canvas del gráfico ---
    state.chartCtx = d.fpsChart.getContext("2d");

    // --- Ajustar canvas al tamaño real (evita borrosidad) ---
    fitCanvasToDisplaySize(d.fpsChart);

    // --- Detectar soporte de performance.memory ---
    state.memorySupported = !!(
      performance.memory &&
      typeof performance.memory.usedJSHeapSize === "number"
    );

    // --- Timestamp de arranque ---
    state.startTime = performance.now();

    // --- Log de bienvenida ---
    logLine("🟢 Sistema de monitoreo iniciado", "info");

    if (!state.memorySupported) {
      logLine("⚠ performance.memory no soportado (usa Chrome/Edge)", "warn");
    }

    // --- Arrancar subsistemas ---
    startFpsLoop();
    startMemoryPoll();
    startLongTaskObserver();

    // --- Refrescar contadores iniciales ---
    refreshListenerCount();
    refreshLeakCount();

    // --- Listeners de los botones ---
    const registerOwn = (el, event, handler) => {
      if (!el) return;
      el.addEventListener(event, handler);
      state.ownListeners.push({ el, event, handler });
    };

    registerOwn(d.btnAnalyze, "click", () => {
      runAnalysis();
      refreshListenerCount();
    });

    registerOwn(d.btnSimulateLeak, "click", () => {
      simulateLeak();
      refreshListenerCount();
    });

    registerOwn(d.btnCleanMemory, "click", () => {
      cleanMemory();
      refreshListenerCount();
    });

    // --- Refrescar conteo de listeners cada 3 s ---
    state.listenerRefreshId = setInterval(refreshListenerCount, 3000);

    // --- Redibujar gráfico si cambia el tamaño ---
    window.addEventListener("resize", () => {
      fitCanvasToDisplaySize(d.fpsChart);
      drawFpsChart();
    });

    console.log(
      "%c[Paso 5] Monitor VAR activo. Abre DevTools → Performance para ver el profiling real.",
      "color:#3498db;font-weight:bold",
    );
  };

  /**
   * Ajusta la resolución interna del canvas a su tamaño CSS real
   * para que no se vea borroso en pantallas HiDPI.
   */
  const fitCanvasToDisplaySize = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayW = rect.width || canvas.clientWidth || 700;
    const displayH = rect.height || canvas.clientHeight || 120;

    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);

    // Escalar contexto (las coordenadas siguen siendo CSS px)
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ajustar constantes del gráfico al nuevo tamaño CSS
    state.chartCtx = ctx;
  };

  /* =========================================================
       13. CLEANUP
       --------------------------------------------------------- */
  const cleanup = () => {
    stopFpsLoop();
    stopMemoryPoll();
    stopLongTaskObserver();

    if (state.listenerRefreshId) {
      clearInterval(state.listenerRefreshId);
      state.listenerRefreshId = null;
    }

    // Remover listeners propios
    state.ownListeners.forEach(({ el, event, handler }) => {
      el.removeEventListener(event, handler);
    });
    state.ownListeners = [];

    // Soltar referencias para permitir GC
    state.leakRegistry = [];
    state.leakSimulatedBytes = 0;

    logLine("🔴 Sistema de monitoreo detenido", "warn");
  };

  /* =========================================================
       14. API PÚBLICA
       ========================================================= */
  return {
    init,
    cleanup,
    // Útil para que otros módulos reporten sus listeners:
    getListenerCount: () => state.ownListeners.length,
    getState: () => ({
      fpsAvg:
        state.fpsHistory.reduce((a, b) => a + b, 0) / state.fpsHistory.length,
      fpsMin: Math.min(...state.fpsHistory.filter((f) => f > 0)),
      memorySupported: state.memorySupported,
      leaks: state.leakRegistry.length,
      uptime: ((performance.now() - state.startTime) / 1000).toFixed(0),
    }),
    runAnalysis,
    simulateLeak,
    cleanMemory,
  };
})();
