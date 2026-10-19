/* ============================================================
   MÓDULO 01 · PANEL DE CÁMARA
   ------------------------------------------------------------
   Conceptos cubiertos:
     - Canvas API 2D
     - requestAnimationFrame (prohibido setInterval)
     - Delta time (dt) para movimiento uniforme
     - Arrow functions en handlers
     - Closure para estado de animación
     - Métricas en vivo: FPS, dt, frames
   ------------------------------------------------------------
   Regla del laboratorio:
     - Vanilla JS únicamente
     - Sin frameworks ni librerías
     - 70% del código escrito manualmente
   ============================================================ */

window.VAR = window.VAR || {};
window.VAR.modules = window.VAR.modules || {};

window.VAR.modules.camara = (() => {
  "use strict";

  /* =========================================================
       1. ESTADO PRIVADO DEL MÓDULO (closure)
       ========================================================= */
  const state = {
    // Contexto
    canvas: null,
    ctx: null,

    // Loop
    rafId: null,
    isPlaying: false,
    lastTime: 0,
    elapsed: 0, // tiempo acumulado (s) * velocidad
    speed: 5,
    playerName: "MESSI",

    // Balón
    ball: {
      x: 0,
      y: 0,
      baseY: 0,
      radius: 26,
      angle: 0,
      amplitude: 0,
      trail: [],
    },

    // Confeti
    confetti: [],

    // Métricas
    frames: 0, // frames desde el último segundo
    totalFrames: 0, // frames totales desde el inicio
    lastFpsTime: 0,
    lastDt: 0,

    // Referencias DOM
    dom: {},

    // Listeners para cleanup
    listeners: [],
  };

  /* =========================================================
       2. UTILIDADES INTERNAS
       ========================================================= */

  /**
   * Registra un listener y lo guarda para poder removerlo después.
   */
  const on = (el, event, handler, options = {}) => {
    if (!el) return;
    el.addEventListener(event, handler, options);
    state.listeners.push({ el, event, handler, options });
  };

  /**
   * Dibuja el balón de fútbol vectorial (sin imágenes externas).
   */
  const drawSoccerBall = (ctx, x, y, radius, rotation) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Sombra
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;

    // Cuerpo blanco con gradiente
    const grad = ctx.createRadialGradient(
      -radius * 0.3,
      -radius * 0.3,
      radius * 0.1,
      0,
      0,
      radius,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#c8c8c8");

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = "transparent";

    // Borde
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a1a1a";
    ctx.stroke();

    // Pentágono central
    const pentR = radius * 0.38;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(a) * pentR;
      const py = Math.sin(a) * pentR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    // Gajos
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * pentR, Math.sin(a) * pentR);
      ctx.lineTo(Math.cos(a) * radius * 0.95, Math.sin(a) * radius * 0.95);
      ctx.stroke();
    }

    ctx.restore();
  };

  /**
   * Dibuja el campo (cancha) con líneas, franjas y áreas.
   */
  const drawPitch = (ctx, canvas) => {
    // Fondo degradado
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#16873f");
    grad.addColorStop(1, "#0a3d1f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Franjas verticales
    const stripeW = 90;
    for (let x = 0; x < canvas.width; x += stripeW * 2) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.fillRect(x, 0, stripeW, canvas.height);
    }

    // Líneas
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;

    // Línea central
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // Círculo central
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Área izquierda
    ctx.strokeRect(0, canvas.height / 2 - 100, 100, 200);

    // Área derecha
    ctx.strokeRect(canvas.width - 100, canvas.height / 2 - 100, 100, 200);

    // Puntos de penalti
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(140, canvas.height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvas.width - 140, canvas.height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  /**
   * Haz de luz tipo estadio.
   */
  const drawStadiumLights = (ctx, canvas) => {
    const grad = ctx.createRadialGradient(
      canvas.width / 2,
      -50,
      50,
      canvas.width / 2,
      -50,
      canvas.height,
    );
    grad.addColorStop(0, "rgba(255, 255, 200, 0.16)");
    grad.addColorStop(1, "rgba(255, 255, 200, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  /**
   * Nombre del jugador con efecto LED púrpura.
   */
  const drawPlayerName = (ctx, canvas, name) => {
    if (!name) return;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "#c77dff";
    ctx.shadowBlur = 30;
    ctx.font = "bold 72px Impact, Arial Black, sans-serif";

    // Sombra dura
    ctx.fillStyle = "#000";
    ctx.fillText(name.toUpperCase(), canvas.width / 2 + 3, 73);

    // Texto principal con gradiente
    const grad = ctx.createLinearGradient(0, 30, 0, 110);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#c77dff");
    grad.addColorStop(1, "#7b2cbf");

    ctx.fillStyle = grad;
    ctx.fillText(name.toUpperCase(), canvas.width / 2, 70);

    ctx.restore();
  };

  /**
   * Estela dorada del balón.
   */
  const drawTrail = (ctx) => {
    const trail = state.ball.trail;
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const alpha = i / trail.length;
      const r = state.ball.radius * alpha * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.35})`;
      ctx.fill();
    }
  };

  /**
   * Confeti al hacer click en el canvas.
   */
  const drawConfetti = (ctx) => {
    for (let i = state.confetti.length - 1; i >= 0; i--) {
      const p = state.confetti[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.life -= 0.02;
      p.rotation += p.vr;

      if (p.life <= 0) {
        state.confetti.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  /**
   * HUD dentro del canvas: estado + velocidad.
   */
  const drawMiniHUD = (ctx) => {
    ctx.save();
    ctx.font = "bold 13px Consolas, monospace";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(12, 12, 170, 28);

    ctx.fillStyle = state.isPlaying ? "#2ecc71" : "#e63946";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${state.isPlaying ? "▶ REC" : "⏸ PAUSA"}  ·  ${state.speed}x`,
      22,
      27,
    );
    ctx.restore();
  };

  /* =========================================================
       3. FÍSICA Y LOOP DE RENDER
       ========================================================= */

  const updateBall = () => {
    const t = state.elapsed;
    const b = state.ball;
    const canvas = state.canvas;

    b.x = canvas.width / 2 + Math.sin(t * 1.2) * b.amplitude;
    b.y = b.baseY + Math.sin(t * 2.4) * 28;
    b.angle += 0.03 * state.speed;

    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 14) b.trail.shift();
  };

  const render = () => {
    const { ctx, canvas } = state;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPitch(ctx, canvas);
    drawStadiumLights(ctx, canvas);
    drawTrail(ctx);
    drawSoccerBall(
      ctx,
      state.ball.x,
      state.ball.y,
      state.ball.radius,
      state.ball.angle,
    );
    drawConfetti(ctx);
    drawPlayerName(ctx, canvas, state.playerName);
    drawMiniHUD(ctx);
  };

  /**
   * Loop principal con requestAnimationFrame.
   * Calcula dt para movimiento uniforme.
   */
  const loop = (timestamp) => {
    if (!state.lastTime) state.lastTime = timestamp;

    // dt en segundos, topado a 100 ms para evitar saltos
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.1);
    state.lastTime = timestamp;
    state.lastDt = dt;

    state.elapsed += dt * state.speed;

    updateBall();
    render();

    // Métricas
    state.frames++;
    state.totalFrames++;
    const elapsedMs = timestamp - state.lastFpsTime;
    if (elapsedMs >= 1000) {
      const fps = Math.round((state.frames * 1000) / elapsedMs);
      updateMetrics(fps, dt, state.totalFrames);
      state.frames = 0;
      state.lastFpsTime = timestamp;
    }

    state.rafId = requestAnimationFrame(loop);
  };

  /* =========================================================
       4. MÉTRICAS EN VIVO
       ========================================================= */

  const updateMetrics = (fps, dt, totalFrames) => {
    const { camFps, camDt, camFrames } = state.dom;
    if (camFps) camFps.textContent = fps;
    if (camDt) camDt.textContent = `${(dt * 1000).toFixed(1)} ms`;
    if (camFrames) camFrames.textContent = totalFrames;
  };

  /* =========================================================
       5. CONTROLES
       ========================================================= */

  const play = () => {
    if (state.isPlaying) return;
    state.isPlaying = true;
    state.lastTime = 0;
    state.lastFpsTime = performance.now();
    state.rafId = requestAnimationFrame(loop);
  };

  const pause = () => {
    if (!state.isPlaying) return;
    state.isPlaying = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    render(); // congelar frame limpio
  };

  const reset = () => {
    pause();
    state.elapsed = 0;
    state.totalFrames = 0;
    state.frames = 0;
    state.ball.trail = [];
    state.confetti = [];
    state.ball.angle = 0;
    state.ball.x = state.canvas.width / 2;
    state.ball.y = state.ball.baseY;

    updateMetrics(0, 0, 0);
    render();
  };

  /* =========================================================
       6. CONFETI
       ========================================================= */

  const spawnConfetti = (x, y) => {
    const colors = ["#ffd700", "#e63946", "#2ecc71", "#3498db", "#ffffff"];
    for (let i = 0; i < 28; i++) {
      state.confetti.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 7 - 2,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.32,
        life: 1,
      });
    }
  };

  /* =========================================================
       7. INIT (invocado por main.js cuando la sección entra en viewport)
       ========================================================= */
  const init = ({ updateScore, log }) => {
    // Cachear DOM
    state.dom = {
      canvas: document.getElementById("demoCanvas"),
      btnPlay: document.getElementById("btnPlay"),
      btnPause: document.getElementById("btnPause"),
      btnReset: document.getElementById("btnReset"),
      speedSlider: document.getElementById("speedSlider"),
      speedValue: document.getElementById("speedValue"),
      playerInput: document.getElementById("playerInput"),
      camFps: document.getElementById("camFps"),
      camDt: document.getElementById("camDt"),
      camFrames: document.getElementById("camFrames"),
    };

    if (!state.dom.canvas) {
      log?.("⚠ No se encontró #demoCanvas", "warn");
      return;
    }

    state.canvas = state.dom.canvas;
    state.ctx = state.canvas.getContext("2d");

    // Config inicial del balón
    const canvas = state.canvas;
    state.ball.baseY = canvas.height / 2 + 40;
    state.ball.x = canvas.width / 2;
    state.ball.y = state.ball.baseY;
    state.ball.amplitude = canvas.width / 2 - 100;

    // Render inicial
    render();

    // Auto-play
    state.lastFpsTime = performance.now();
    play();

    /* ---------- Handlers ---------- */

    on(state.dom.btnPlay, "click", () => {
      play();
      updateScore?.("local", 1);
    });

    on(state.dom.btnPause, "click", () => {
      pause();
    });

    on(state.dom.btnReset, "click", () => {
      reset();
    });

    on(state.dom.speedSlider, "input", (e) => {
      state.speed = Number(e.target.value);
      if (state.dom.speedValue) {
        state.dom.speedValue.textContent = state.speed;
      }
    });

    on(state.dom.playerInput, "input", (e) => {
      const raw = e.target.value;
      const clean = raw.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ]/g, "").slice(0, 15);
      state.playerName = clean || "JUGADOR";
      if (raw !== clean) e.target.value = clean;
      render();
    });

    on(state.canvas, "click", (e) => {
      const rect = state.canvas.getBoundingClientRect();
      const scaleX = state.canvas.width / rect.width;
      const scaleY = state.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      spawnConfetti(x, y);
      updateScore?.("local", 1);
    });

    // Pausa automática si la pestaña pierde visibilidad
    on(document, "visibilitychange", () => {
      if (document.hidden && state.isPlaying) pause();
    });

    log?.("📹 Módulo Cámara inicializado");
  };

  /* =========================================================
       8. CLEANUP (útil si en algún momento queremos desmontarlo)
       ========================================================= */
  const cleanup = () => {
    pause();
    state.listeners.forEach(({ el, event, handler, options }) => {
      el.removeEventListener(event, handler, options);
    });
    state.listeners = [];
  };

  /* =========================================================
       9. API PÚBLICA
       ========================================================= */
  return {
    init,
    cleanup,
    getState: () => ({
      isPlaying: state.isPlaying,
      speed: state.speed,
      playerName: state.playerName,
      totalFrames: state.totalFrames,
    }),
    getListenerCount: () => state.listeners.length,
  };
})();
