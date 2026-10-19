/* ============================================================
   PASO 1: Setup HTML + UI con Canvas y Controles
   ------------------------------------------------------------
   Conceptos cubiertos:
     - Canvas API 2D
     - requestAnimationFrame (NO setInterval)
     - Delta time (dt) para movimiento uniforme
     - Arrow functions para handlers
     - Control de velocidad con slider
     - Play / Pause / Reset
     - Input en vivo (nombre del jugador)
   ------------------------------------------------------------
   Restricciones respetadas:
     ✅ Vanilla JS únicamente
     ✅ Sin frameworks ni librerías
     ✅ Prohibido setInterval para la animación
     ✅ Delta time aplicado al movimiento
   ============================================================ */

// Se auto-registra en window.__modules (el orquestador lo invocará)
window.__modules = window.__modules || {};

window.__modules.paso1 = (function () {
  "use strict";

  /* =========================================================
       1. ESTADO DEL MÓDULO (encapsulado en closure)
       ========================================================= */
  const state = {
    ctx: null,
    canvas: null,
    animationId: null,
    isPlaying: false,
    lastTime: 0,
    elapsed: 0, // tiempo acumulado (s)
    speed: 5, // multiplicador de velocidad
    playerName: "MESSI",
    ball: {
      x: 0,
      y: 0,
      radius: 22,
      angle: 0, // rotación del balón
      baseX: 0,
      baseY: 0,
      amplitude: 0, // se calcula al inicializar
      trail: [], // estela para efecto visual
    },
    stars: [], // "estrellas" decorativas tipo estadio
    confetti: [], // confeti al hacer click
  };

  /* =========================================================
       2. UTILIDADES INTERNAS
       ========================================================= */

  /**
   * Dibuja un balón de fútbol vectorial (sin imágenes externas).
   * Combina arc() para el círculo base + hexágonos simples.
   */
  const drawSoccerBall = (ctx, x, y, radius, rotation) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // --- Sombra del balón ---
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;

    // --- Cuerpo blanco del balón ---
    const gradient = ctx.createRadialGradient(
      -radius * 0.3,
      -radius * 0.3,
      radius * 0.1,
      0,
      0,
      radius,
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#c8c8c8");

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.shadowColor = "transparent";

    // --- Borde ---
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a1a1a";
    ctx.stroke();

    // --- Pentágono central (negro) ---
    const pentRadius = radius * 0.38;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(angle) * pentRadius;
      const py = Math.sin(angle) * pentRadius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    // --- Líneas que salen del pentágono (los "gajos") ---
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * pentRadius, Math.sin(angle) * pentRadius);
      ctx.lineTo(
        Math.cos(angle) * radius * 0.95,
        Math.sin(angle) * radius * 0.95,
      );
      ctx.stroke();
    }

    ctx.restore();
  };

  /**
   * Dibuja el césped con franjas tipo cancha.
   */
  const drawPitch = (ctx, canvas) => {
    // Fondo verde
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#16873f");
    grad.addColorStop(1, "#0a3d1f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Franjas verticales de corte del césped
    const stripeWidth = 80;
    for (let x = 0; x < canvas.width; x += stripeWidth * 2) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.fillRect(x, 0, stripeWidth, canvas.height);
    }

    // Línea central
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // Círculo central
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Área grande izquierda
    ctx.strokeRect(0, canvas.height / 2 - 90, 80, 180);

    // Área grande derecha
    ctx.strokeRect(canvas.width - 80, canvas.height / 2 - 90, 80, 180);

    // Punto de penalti izquierdo
    ctx.beginPath();
    ctx.arc(120, canvas.height / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();

    // Punto de penalti derecho
    ctx.beginPath();
    ctx.arc(canvas.width - 120, canvas.height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  /**
   * Dibuja un haz de luz tipo estadio desde la parte superior.
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
    grad.addColorStop(0, "rgba(255, 255, 200, 0.15)");
    grad.addColorStop(1, "rgba(255, 255, 200, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  /**
   * Dibuja el nombre del jugador con efecto "LED scoreboard".
   */
  const drawPlayerName = (ctx, canvas, name) => {
    if (!name) return;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Efecto glow tipo LED
    ctx.shadowColor = "#c77dff";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#e0aaff";
    ctx.font = "bold 64px Impact, Arial Black, sans-serif";

    // Sombra dura (offset) para look "arcade"
    ctx.fillStyle = "#000";
    ctx.fillText(name.toUpperCase(), canvas.width / 2 + 3, 63);

    // Texto principal con gradiente
    const grad = ctx.createLinearGradient(0, 30, 0, 90);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#c77dff");
    grad.addColorStop(1, "#7b2cbf");

    ctx.fillStyle = grad;
    ctx.fillText(name.toUpperCase(), canvas.width / 2, 60);

    ctx.restore();
  };

  /**
   * Dibuja la estela del balón (trail) para sensación de movimiento.
   */
  const drawTrail = (ctx) => {
    if (state.ball.trail.length < 2) return;

    for (let i = 0; i < state.ball.trail.length; i++) {
      const p = state.ball.trail[i];
      const alpha = i / state.ball.trail.length;
      const radius = state.ball.radius * alpha * 0.6;

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
      ctx.fill();
    }
  };

  /**
   * Dibuja el confeti (partículas que aparecen al hacer click).
   */
  const drawConfetti = (ctx) => {
    for (let i = state.confetti.length - 1; i >= 0; i--) {
      const p = state.confetti[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3; // gravedad
      p.life -= 0.02;
      p.rotation += p.vr;

      if (p.life <= 0) {
        state.confetti.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  /* =========================================================
       3. LOOP DE RENDER (con delta time)
       ========================================================= */

  /**
   * Loop principal con requestAnimationFrame.
   * dt (delta time) garantiza movimiento uniforme a cualquier FPS.
   */
  const loop = (timestamp) => {
    if (!state.lastTime) state.lastTime = timestamp;

    // dt en segundos (máximo 100ms para evitar saltos tras pestañas inactivas)
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.1);
    state.lastTime = timestamp;

    // Acumulamos el tiempo según la velocidad elegida por el usuario
    state.elapsed += dt * state.speed;

    // Actualizamos física
    updateBall();

    // Renderizamos todo
    render();

    // Continuamos el loop
    state.animationId = requestAnimationFrame(loop);
  };

  /**
   * Física del balón: movimiento oscilante horizontal + leve vertical.
   * Todo basado en state.elapsed (no en el timestamp directo) para
   * que el cambio de velocidad sea suave.
   */
  const updateBall = () => {
    const t = state.elapsed;
    const canvas = state.canvas;
    const b = state.ball;

    // Movimiento horizontal (vaivén)
    b.x = canvas.width / 2 + Math.sin(t * 1.2) * b.amplitude;

    // Movimiento vertical (rebote suave)
    b.y = b.baseY + Math.sin(t * 2.4) * 25;

    // Rotación proporcional al movimiento
    b.angle += 0.03 * state.speed;

    // Estela
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 12) b.trail.shift();
  };

  /**
   * Render completo del frame.
   */
  const render = () => {
    const { ctx, canvas } = state;

    // Limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Capas (de fondo a frente)
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

    // FPS inline (mini HUD dentro del canvas)
    drawMiniHUD(ctx);
  };

  /**
   * Mini HUD dentro del canvas con el estado (play/pause, velocidad).
   */
  const drawMiniHUD = (ctx) => {
    ctx.save();
    ctx.font = "12px Consolas, monospace";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(10, 10, 130, 24);
    ctx.fillStyle = state.isPlaying ? "#2ecc71" : "#e63946";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${state.isPlaying ? "▶ PLAYING" : "⏸ PAUSED"}  x${state.speed}`,
      18,
      23,
    );
    ctx.restore();
  };

  /* =========================================================
       4. CONTROLES
       ========================================================= */

  const play = () => {
    if (state.isPlaying) return;
    state.isPlaying = true;
    state.lastTime = 0; // para que dt no explote al reanudar
    state.animationId = requestAnimationFrame(loop);
  };

  const pause = () => {
    if (!state.isPlaying) return;
    state.isPlaying = false;
    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }
    // Un último render para dejar el frame "congelado" limpio
    render();
  };

  const reset = () => {
    pause();
    state.elapsed = 0;
    state.ball.trail = [];
    state.confetti = [];
    state.ball.angle = 0;
    // Forzar posición inicial
    state.ball.x = state.canvas.width / 2;
    state.ball.y = state.ball.baseY;
    render();
  };

  /* =========================================================
       5. INIT (llamado por app.js)
       ========================================================= */

  const init = ({ updateScoreboard }) => {
    const canvas = document.getElementById("demoCanvas");
    if (!canvas) return;

    state.canvas = canvas;
    state.ctx = canvas.getContext("2d");

    // Configuración inicial del balón
    state.ball.baseY = canvas.height / 2 + 30;
    state.ball.x = canvas.width / 2;
    state.ball.y = state.ball.baseY;
    state.ball.amplitude = canvas.width / 2 - 80;

    // Generar estrellas decorativas (una vez)
    state.stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
    }));

    // Render inicial
    render();

    // Auto-play para que se vea la animación de una vez
    play();

    /* ---------- Controles ---------- */
    const btnPlay = document.getElementById("btnPlay");
    const btnPause = document.getElementById("btnPause");
    const btnReset = document.getElementById("btnReset");
    const slider = document.getElementById("speedSlider");
    const speedValue = document.getElementById("speedValue");
    const playerInput = document.getElementById("playerInput");

    btnPlay?.addEventListener("click", () => {
      play();
      updateScoreboard("vanilla", 1);
    });

    btnPause?.addEventListener("click", () => {
      pause();
    });

    btnReset?.addEventListener("click", () => {
      reset();
    });

    slider?.addEventListener("input", (e) => {
      state.speed = Number(e.target.value);
      if (speedValue) speedValue.textContent = state.speed;
    });

    playerInput?.addEventListener("input", (e) => {
      // Sanitizamos un poco: solo letras, números y espacios
      const raw = e.target.value;
      const clean = raw.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ]/g, "").slice(0, 15);
      state.playerName = clean || "JUGADOR";
      if (raw !== clean) e.target.value = clean;

      // Re-render para mostrar el nombre actualizado sin esperar al loop
      render();
    });

    // Click en el canvas → confeti en la posición del click
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      spawnConfetti(x, y);
      updateScoreboard("vanilla", 1);
    });

    // Pausar automáticamente si la pestaña pierde visibilidad
    // (buena práctica: ahorra CPU/batería)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.isPlaying) {
        pause();
      }
    });
  };

  /**
   * Genera confeti en la posición (x, y) del canvas.
   */
  const spawnConfetti = (x, y) => {
    const colors = ["#ffd700", "#e63946", "#2ecc71", "#3498db", "#ffffff"];
    for (let i = 0; i < 25; i++) {
      state.confetti.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 2,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
      });
    }
  };

  /* =========================================================
       6. API PÚBLICA DEL MÓDULO
       ========================================================= */
  return {
    getListenerCount: () => 0, // Paso 1 usa listeners directos; contamos 0 por simplicidad
    init,
  };
})();
