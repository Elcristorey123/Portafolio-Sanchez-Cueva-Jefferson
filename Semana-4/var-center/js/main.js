/* ============================================================
   VAR CENTER · MAIN.JS
   Orquestador principal
   ------------------------------------------------------------
   Responsabilidades:
     1. Aislar el scope global con IIFE
     2. Marcar la sección activa en el sidebar (IntersectionObserver)
     3. Actualizar la barra de progreso de scroll
     4. Hacer lazy init de cada módulo cuando entra en viewport
     5. Actualizar el reloj en vivo del header
     6. Exponer API mínima window.VAR
   ------------------------------------------------------------
   Regla del laboratorio: 70% del código escrito manualmente.
   IA usada solo para revisar patrones de IIFE y Observer.
   ============================================================ */

(() => {
  "use strict";

  /* =========================================================
       1. ESTADO GLOBAL DE LA APP (privado del closure)
       ========================================================= */
  const State = {
    activeSection: null,
    initializedSections: new Set(),
    score: { local: 0, visitante: 0 },
    clockInterval: null,
    matchStartTime: null,
    totalSections: 5,
  };

  /* =========================================================
       2. REFERENCIAS AL DOM (cacheadas al inicio)
       ========================================================= */
  const DOM = {
    // Header
    liveClock: document.getElementById("liveClock"),
    liveMatch: document.getElementById("liveMatch"),
    scoreLocal: document.getElementById("scoreLocal"),
    scoreVisitante: document.getElementById("scoreVisitante"),

    // Sidebar
    sidebarItems: document.querySelectorAll(".sidebar__item"),
    scrollProgressBar: document.getElementById("scrollProgress"),
    scrollPercent: document.getElementById("scrollPercent"),

    // Secciones
    sections: document.querySelectorAll(".var-section"),
  };

  /* =========================================================
       3. UTILIDADES INTERNAS
       ========================================================= */

  /**
   * Log con prefijo consistente para debug.
   */
  const log = (msg, level = "info") => {
    const prefix = "%c[VAR Center]";
    const style = "color:#ffd700;font-weight:bold";
    if (level === "warn") console.warn(prefix, style, msg);
    else if (level === "error") console.error(prefix, style, msg);
    else console.log(prefix, style, msg);
  };

  /**
   * Formatea segundos a "MM:SS".
   */
  const formatClock = (totalSeconds) => {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  /* =========================================================
       4. RELOJ EN VIVO DEL HEADER
       ---------------------------------------------------------
       Simula un cronómetro de partido (00:00 → 90:00 → 00:00).
       ========================================================= */
  const startMatchClock = () => {
    if (State.clockInterval) return;

    State.matchStartTime = Date.now();
    let matchSeconds = 0;

    const tick = () => {
      matchSeconds++;
      // Se reinicia a los 90 minutos (5400 seg)
      if (matchSeconds > 5400) matchSeconds = 0;
      if (DOM.liveClock) {
        DOM.liveClock.textContent = formatClock(matchSeconds);
      }
    };

    State.clockInterval = setInterval(tick, 1000);
    log("Reloj del partido iniciado");
  };

  /* =========================================================
       5. MARCADOR DEL HEADER
       ---------------------------------------------------------
       Expuesto a los módulos mediante window.VAR.updateScore.
       ========================================================= */
  const updateScore = (team, delta = 1) => {
    if (!(team in State.score)) return;

    State.score[team] += delta;
    const el = team === "local" ? DOM.scoreLocal : DOM.scoreVisitante;
    if (!el) return;

    el.textContent = State.score[team];

    // Animación de "pop"
    el.style.transform = "scale(1.6)";
    el.style.color = team === "local" ? "#2ecc71" : "#e63946";

    setTimeout(() => {
      el.style.transform = "scale(1)";
      el.style.color = "";
    }, 300);
  };

  /* =========================================================
       6. NAVEGACIÓN POR SCROLL
       ---------------------------------------------------------
       - IntersectionObserver marca la sección visible
       - Click en el sidebar hace scroll suave
       - Barra de progreso se actualiza en el evento scroll
       ========================================================= */

  /**
   * Marca en el sidebar el ítem correspondiente a la sección activa.
   */
  const setActiveSection = (sectionId) => {
    if (State.activeSection === sectionId) return;
    State.activeSection = sectionId;

    DOM.sidebarItems.forEach((item) => {
      const isActive = item.dataset.section === sectionId;
      item.classList.toggle("active", isActive);
    });
  };

  /**
   * Configura IntersectionObserver para detectar la sección visible.
   * Usamos un rootMargin negativo para que la sección se marque activa
   * cuando está en el "centro" de la pantalla.
   */
  const setupIntersectionObserver = () => {
    if (!("IntersectionObserver" in window)) {
      log("IntersectionObserver no soportado. Usando fallback scroll.", "warn");
      setupScrollFallback();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Nos quedamos con la entrada más visible
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const section = visible[0].target;
          const moduleName = section.dataset.module;
          setActiveSection(moduleName);
        }

        // Lazy init: cuando la sección entra en viewport,
        // inicializamos su módulo si no lo estaba ya.
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const moduleName = entry.target.dataset.module;
            initModuleIfNeeded(moduleName);
          }
        });
      },
      {
        root: null,
        rootMargin: "-30% 0px -50% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    DOM.sections.forEach((section) => observer.observe(section));
  };

  /**
   * Fallback si IntersectionObserver no existe.
   * Calcula la sección activa según la posición del scroll.
   */
  const setupScrollFallback = () => {
    const check = () => {
      const scrollY = window.scrollY + window.innerHeight / 3;
      let active = null;

      DOM.sections.forEach((section) => {
        if (section.offsetTop <= scrollY) {
          active = section.dataset.module;
        }
      });

      if (active) {
        setActiveSection(active);
        initModuleIfNeeded(active);
      }
    };

    window.addEventListener("scroll", check, { passive: true });
    check();
  };

  /**
   * Click en el sidebar → smooth scroll a la sección.
   */
  const setupSidebarNavigation = () => {
    DOM.sidebarItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = item.getAttribute("href");
        const target = document.querySelector(targetId);

        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          // Actualiza la URL sin recargar
          history.replaceState(null, "", targetId);
        }
      });
    });
  };

  /**
   * Barra de progreso de scroll (sidebar footer).
   */
  const setupScrollProgress = () => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const percent =
        docHeight > 0
          ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100))
          : 0;

      if (DOM.scrollProgressBar) {
        DOM.scrollProgressBar.style.width = `${percent}%`;
      }
      if (DOM.scrollPercent) {
        DOM.scrollPercent.textContent = `${Math.round(percent)}%`;
      }
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  };

  /* =========================================================
       7. LAZY INIT DE MÓDULOS
       ---------------------------------------------------------
       Cada módulo se auto-registra en window.VAR.modules.X
       y expone un método init(). Lo invocamos solo la primera
       vez que su sección entra en viewport.
       ========================================================= */
  const initModuleIfNeeded = (moduleName) => {
    if (State.initializedSections.has(moduleName)) return;

    const modules = window.VAR?.modules || {};
    const mod = modules[moduleName];

    if (!mod) {
      // Puede pasar si el script del módulo aún no cargó
      // (defer respeta orden pero por seguridad reintentamos)
      setTimeout(() => initModuleIfNeeded(moduleName), 100);
      return;
    }

    if (typeof mod.init === "function") {
      try {
        mod.init({
          updateScore,
          log,
        });
        State.initializedSections.add(moduleName);
        log(`✅ Módulo "${moduleName}" inicializado`);
      } catch (err) {
        log(`❌ Error en módulo "${moduleName}": ${err.message}`, "error");
      }
    } else {
      log(`⚠ Módulo "${moduleName}" no expone init()`, "warn");
    }
  };

  /**
   * Fuerza la inicialización de TODOS los módulos.
   * Útil como red de seguridad si algún observer falla.
   */
  const initAllModules = () => {
    DOM.sections.forEach((section) => {
      const moduleName = section.dataset.module;
      if (moduleName) initModuleIfNeeded(moduleName);
    });
  };

  /* =========================================================
       8. EFECTOS VISUALES GLOBALES
       ---------------------------------------------------------
       - Añade .in-view a las secciones visibles (opacity)
       - Actualiza la fecha/hora del header (opcional)
       ========================================================= */

  /**
   * Añade la clase .in-view cuando una sección entra en pantalla.
   * Ya lo hace IntersectionObserver arriba, pero aquí lo desacoplamos.
   */
  const setupSectionVisibility = () => {
    if (!("IntersectionObserver" in window)) {
      DOM.sections.forEach((s) => s.classList.add("in-view"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("in-view", entry.isIntersecting);
        });
      },
      { threshold: 0.1 },
    );

    DOM.sections.forEach((section) => observer.observe(section));
  };

  /* =========================================================
       9. ATAJOS DE TECLADO GLOBALES
       ---------------------------------------------------------
       1-5 → scroll a la sección correspondiente
       ========================================================= */
  const setupKeyboardShortcuts = () => {
    document.addEventListener("keydown", (e) => {
      // Ignorar si el usuario está escribiendo
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const n = Number(e.key);
      if (n >= 1 && n <= State.totalSections) {
        const section = DOM.sections[n - 1];
        if (section) {
          section.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  };

  /* =========================================================
       10. API PÚBLICA
       ---------------------------------------------------------
       Expuesta en window.VAR para que los módulos la usen.
       ========================================================= */
  const exposeAPI = () => {
    window.VAR = window.VAR || {};
    window.VAR.modules = window.VAR.modules || {};
    window.VAR.updateScore = updateScore;
    window.VAR.log = log;
    window.VAR.getState = () => ({
      activeSection: State.activeSection,
      initialized: Array.from(State.initializedSections),
      score: { ...State.score },
    });
  };

  /* =========================================================
       11. BOOTSTRAP
       --------------------------------------------------------- */
  const bootstrap = () => {
    log("⚽ VAR Center arrancando...");

    // 1. API primero (los módulos la necesitan)
    exposeAPI();

    // 2. Reloj del header
    startMatchClock();

    // 3. Navegación y observers
    setupSidebarNavigation();
    setupIntersectionObserver();
    setupSectionVisibility();
    setupScrollProgress();
    setupKeyboardShortcuts();

    // 4. Marcar la primera sección como activa
    if (DOM.sections.length > 0) {
      const first = DOM.sections[0];
      setActiveSection(first.dataset.module);
    }

    // 5. Red de seguridad: si a los 800ms algún módulo
    //    aún no se ha inicializado, forzamos initAll.
    setTimeout(() => {
      const pending = Array.from(DOM.sections)
        .map((s) => s.dataset.module)
        .filter((m) => m && !State.initializedSections.has(m));

      if (pending.length > 0) {
        log(`⏳ Forzando init de: ${pending.join(", ")}`, "warn");
        initAllModules();
      }
    }, 800);

    log("✅ VAR Center listo");
  };

  // Arrancar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
