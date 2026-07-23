/**
 * Gidede — Генератор простых прототипов кор-лупа.
 *
 * Превращает данные ProjectCoreLoop (шаги, ресурсы, тип) в интерактивный
 * HTML-прототип, который можно поиграть прямо в браузере, чтобы протестировать
 * «30 секунд веселья» (алгоритм 3.2, Этап 4).
 *
 * Поддерживает 3 структурных типа:
 * - engine: ресурс генерируется со временем → копится (farming-like)
 * - economy: конвертация ресурсов (crafting-like)
 * - ecology: конкуренция/давление (survival-like)
 *
 * Прототип — это self-contained HTML (canvas + vanilla JS), встраивается в
 * <iframe srcDoc=...> на странице /prototypes.
 */

interface CoreLoopStep {
  name?: string;
  description?: string;
  action?: string;
}

interface CoreLoopData {
  structuralType?: string; // engine | economy | ecology
  steps?: CoreLoopStep[] | string[];
  inputData?: string; // JSON с шагами
  stepsData?: string;
}

interface PrototypeConfig {
  type: "engine" | "economy" | "ecology";
  steps: string[];
  resourceName: string;
  resourceIcon: string;
  goalText: string;
}

const RESOURCE_PRESETS: Record<string, { name: string; icon: string }> = {
  engine: { name: "Энергия", icon: "⚡" },
  economy: { name: "Золото", icon: "💰" },
  ecology: { name: "Здоровье", icon: "❤️" },
};

/**
 * Извлечь человекочитаемые имена шагов из разных форматов данных кор-лупа.
 */
function extractSteps(data: CoreLoopData): string[] {
  const raw = data.steps || data.stepsData;
  if (!raw) return [];

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // не JSON — возможно, просто текст
      return raw
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map((s) =>
      typeof s === "string" ? s : (s as CoreLoopStep)?.name || (s as CoreLoopStep)?.description || "Шаг"
    );
  }

  // Fallback — входные данные
  if (data.inputData) {
    try {
      const inp = JSON.parse(data.inputData);
      if (Array.isArray(inp?.steps)) {
        return inp.steps.map((s: unknown) =>
          typeof s === "string" ? s : (s as CoreLoopStep)?.name || "Шаг"
        );
      }
    } catch {
      /* ignore */
    }
  }

  return [];
}

/**
 * Сгенерировать конфиг прототипа из данных кор-лупа проекта.
 */
export function buildPrototypeConfig(coreLoopData: CoreLoopData): PrototypeConfig {
  const type = (coreLoopData.structuralType || "engine").toLowerCase() as
    | "engine"
    | "economy"
    | "ecology";

  const steps = extractSteps(coreLoopData).slice(0, 5);
  const preset = RESOURCE_PRESETS[type] || RESOURCE_PRESETS.engine;

  const goals: Record<string, string> = {
    engine: "Накопите 50 энергии за 30 секунд",
    economy: "Заработайте 100 золота, конвертируя ресурсы",
    ecology: "Выживите 30 секунд, уклоняясь от угроз",
  };

  return {
    type,
    steps: steps.length > 0 ? steps : ["Собрать", "Преобразовать", "Использовать"],
    resourceName: preset.name,
    resourceIcon: preset.icon,
    goalText: goals[type] || goals.engine,
  };
}

/**
 * Сгенерировать self-contained HTML прототипа кор-лупа.
 * Встраивается в <iframe srcDoc={html}> на странице /prototypes.
 */
export function generatePrototypeHtml(config: PrototypeConfig): string {
  const { type, steps, resourceName, resourceIcon, goalText } = config;

  // Механика зависит от типа
  const mechanics: Record<string, string> = {
    engine: `
      // Engine: клик генерирует ресурс, ресурс растёт со временем
      let resource = 0;
      let autoRate = 0.5; // ресурс/сек автоматически
      const clickValue = 2;
      canvas.addEventListener('click', () => { resource += clickValue; spawnParticle(event); });
      function tick(dt) {
        resource += autoRate * dt;
        if (resource >= 50) { win(); }
      }
    `,
    economy: `
      // Economy: собираем сырье, конвертируем в золото
      let raw = 0;
      let gold = 0;
      canvas.addEventListener('click', () => { raw += 1; spawnParticle(event, '#3b82f6'); });
      window.convert = () => {
        if (raw >= 3) { raw -= 3; gold += 5; spawnParticle({clientX:canvas.width/2,clientY:canvas.height/2}, '#f59e0b'); }
      };
      function tick(dt) {
        if (gold >= 100) { win(); }
      }
    `,
    ecology: `
      // Ecology: уклоняемся от угроз, здоровье тает
      let health = 100;
      let threats = [];
      let player = { x: 200, y: 150 };
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        player.x = e.clientX - r.left;
        player.y = e.clientY - r.top;
      });
      setInterval(() => {
        threats.push({ x: Math.random()*canvas.width, y: -10, vy: 1+Math.random()*2 });
      }, 700);
      function tick(dt) {
        threats.forEach(t => t.y += t.vy);
        threats = threats.filter(t => t.y < canvas.height+10);
        threats.forEach(t => {
          const dx = t.x - player.x, dy = t.y - player.y;
          if (Math.sqrt(dx*dx+dy*dy) < 20) { health -= 0.5; }
        });
        if (health <= 0) { lose(); }
      }
    `,
  };

  const renderCode: Record<string, string> = {
    engine: `
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // Resource display
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('${resourceIcon} ' + Math.floor(resource), canvas.width/2, 80);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Клик: +${2} • Авто: +0.5/с', canvas.width/2, 110);
      // Progress bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(50, 130, canvas.width-100, 12);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(50, 130, (canvas.width-100)*Math.min(1,resource/50), 12);
    `,
    economy: `
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#3b82f6';
      ctx.fillText('Сырьё: ' + Math.floor(raw), canvas.width/2, 70);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('💰 ' + Math.floor(gold), canvas.width/2, 110);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Клик = +1 сырьё • Кнопка = конвертация (3→5💰)', canvas.width/2, 140);
    `,
    ecology: `
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // Player
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 10, 0, Math.PI*2);
      ctx.fill();
      // Threats
      ctx.fillStyle = '#ef4444';
      threats.forEach(t => { ctx.fillRect(t.x-5, t.y-5, 10, 10); });
      // Health bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, 20, 160, 14);
      ctx.fillStyle = health > 30 ? '#10b981' : '#ef4444';
      ctx.fillRect(20, 20, 160*Math.max(0,health/100), 14);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText('❤️ ' + Math.floor(health), 25, 31);
    `,
  };

  const extraButtons =
    type === "economy"
      ? `<button id="convertBtn" style="position:absolute;top:10px;right:10px;padding:8px 16px;background:#f59e0b;color:#000;border:none;border-radius:8px;font-weight:600;cursor:pointer">Конвертировать (3→5💰)</button>`
      : "";

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Прототип: ${type}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;padding:12px;min-height:100vh}
  h1{font-size:18px;margin-bottom:4px}
  .goal{color:#94a3b8;font-size:13px;margin-bottom:8px}
  .game-wrap{position:relative;width:100%;max-width:400px}
  canvas{background:#0f172a;border:1px solid #334155;border-radius:12px;display:block;width:100%;height:300px;cursor:crosshair}
  #convertBtn:hover{filter:brightness(1.1)}
  .overlay{position:absolute;inset:0;background:rgba(0,0,0,0.85);border-radius:12px;display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:12px}
  .overlay.show{display:flex}
  .overlay h2{font-size:24px}
  .overlay button{padding:10px 24px;background:#10b981;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer}
  .steps{margin-top:8px;font-size:11px;color:#64748b;text-align:center}
</style>
</head>
<body>
  <h1>🎮 Прототип кор-лупа (${type})</h1>
  <p class="goal">🎯 ${goalText}</p>
  <div class="game-wrap">
    <canvas id="game" width="400" height="300"></canvas>
    ${extraButtons}
    <div class="overlay" id="overlay">
      <h2 id="resultText"></h2>
      <button onclick="restart()">Заново</button>
    </div>
  </div>
  <p class="steps">Шаги: ${steps.join(" → ")}</p>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('overlay');
    const resultText = document.getElementById('resultText');
    let timeLeft = 30;
    let running = true;
    let particles = [];

    ${mechanics[type]}

    const convBtn = document.getElementById('convertBtn');
    if (convBtn) convBtn.addEventListener('click', () => window.convert && window.convert());

    function spawnParticle(e, color) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (canvas.width / r.width);
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      particles.push({x, y, life: 1, color: color || '#fbbf24'});
    }

    function win() {
      running = false;
      resultText.textContent = '🎉 Победа! Цель достигнута';
      overlay.classList.add('show');
    }
    function lose() {
      running = false;
      resultText.textContent = '💀 Поражение';
      overlay.classList.add('show');
    }
    window.restart = function() {
      location.reload();
    };

    let last = performance.now();
    function loop(now) {
      const dt = (now - last) / 1000;
      last = now;
      if (running) {
        tick(dt);
        timeLeft -= dt;
        if (timeLeft <= 0 && running) {
          running = false;
          ${type === "ecology" ? "win();" : "resultText.textContent = '⏰ Время вышло'; overlay.classList.add('show');"}
        }
      }
      // Render
      ${renderCode[type]}
      // Timer
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.fillText('⏱ ' + Math.max(0, Math.ceil(timeLeft)) + 'с', canvas.width - 12, 24);
      // Particles
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => {
        p.life -= dt * 2;
        p.y -= 30 * dt;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  </script>
</body>
</html>`;
}
