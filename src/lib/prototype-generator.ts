/**
 * Gidede — Генератор прототипов кор-лупа (2D + 3D).
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
 * Два режима:
 * - 2D: LittleJS (WebGL2 + Canvas2D, физика, частицы, звук)
 * - 3D: Three.js (WebGL, 3D-сцена, перспективная камера)
 *
 * Прототип — self-contained HTML, встраивается в <iframe srcDoc=...>.
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

export type PrototypeMode = "2d" | "3d";

interface PrototypeConfig {
  type: "engine" | "economy" | "ecology" | "tower_defense" | "rhythm" | "puzzle";
  steps: string[];
  resourceName: string;
  resourceIcon: string;
  goalText: string;
  mode: PrototypeMode;
  /**
   * Жанр проекта (например "platformer", "shooter", "rpg", "racing", "puzzle",
   * "tower_defense", "strategy", "action", "action_rpg", "roguelike", "rts").
   * Если задан и соответствует одному из genre-шаблонов, прототип генерируется
   * по жанру (реальные механики жанра на чистом Canvas). Иначе — fallback на
   * engine/economy/ecology (LittleJS/Three.js).
   */
  genre?: string;
}

const RESOURCE_PRESETS: Record<string, { name: string; icon: string }> = {
  engine: { name: "Энергия", icon: "⚡" },
  economy: { name: "Золото", icon: "💰" },
  ecology: { name: "Здоровье", icon: "❤️" },
  tower_defense: { name: "Очки базы", icon: "🏰" },
  rhythm: { name: "Combo", icon: "🎵" },
  puzzle: { name: "Линии", icon: "🧩" },
};

/**
 * Извлечь человекочитаемые имена шагов из разных форматов данных кор-лупа.
 *
 * Источники шагов (в порядке приоритета):
 *  1. data.steps / data.stepsData — JSON-строка (или массив) с шагами.
 *     Это каноничная форма, в которой Block 2 persist'ит CoreStep[] в
 *     колонку ProjectCoreLoop.stepsData.
 *  2. data.inputData.steps — запасной источник: в inputData Block 2 хранит
 *     `{ concept_id, mechanics, genre, custom_steps }`. custom_steps — массив
 *     строк, заданный пользователем перед генерацией.
 *  3. data.inputData.custom_steps — те же строки по другому ключу.
 *  4. data.inputData.mechanics — если ничего больше нет, используем механики
 *     как основу для прототипа (лучше, чем дефолтные «Собрать/Преобразовать»).
 */
function extractSteps(data: CoreLoopData): string[] {
  const raw = data.steps || data.stepsData;
  if (raw) {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return raw
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      const out = parsed
        .map((s) =>
          typeof s === "string"
            ? s
            : (s as CoreLoopStep)?.name ||
              (s as CoreLoopStep)?.action ||
              (s as CoreLoopStep)?.description ||
              ""
        )
        .filter((s) => s.length > 0);
      if (out.length > 0) return out;
    }
  }

  // Fallback: inputData.custom_steps / steps / mechanics.
  if (data.inputData) {
    try {
      const inp =
        typeof data.inputData === "string"
          ? JSON.parse(data.inputData)
          : data.inputData;
      const tryArray = (arr: unknown): string[] | null => {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const mapped = arr
          .map((s) =>
            typeof s === "string"
              ? s
              : (s as CoreLoopStep)?.name ||
                (s as CoreLoopStep)?.action ||
                (s as CoreLoopStep)?.description ||
                ""
          )
          .filter((s) => s.length > 0);
        return mapped.length > 0 ? mapped : null;
      };
      const fromSteps = tryArray(inp?.steps);
      if (fromSteps) return fromSteps;
      const fromCustomSteps = tryArray(inp?.custom_steps);
      if (fromCustomSteps) return fromCustomSteps;
      const fromMechanics = tryArray(inp?.mechanics);
      if (fromMechanics) return fromMechanics;
    } catch {
      /* ignore */
    }
  }

  return [];
}

/**
 * Сгенерировать конфиг прототипа из данных кор-лупа проекта.
 * mode — "2d" (LittleJS) или "3d" (Three.js).
 * genre — жанр проекта (project.genre). Если задан и соответствует одному
 *         из genre-шаблонов (platformer/shooter/rpg/racing/puzzle/tower_defense),
 *         генератор выдаст жанровый прототип на чистом Canvas с реальными
 *         механиками жанра. Иначе — fallback на engine/economy/ecology.
 */
export function buildPrototypeConfig(
  coreLoopData: CoreLoopData,
  mode: PrototypeMode = "2d",
  genre?: string
): PrototypeConfig {
  const validTypes = ["engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle"];
  const rawType = (coreLoopData.structuralType || "engine").toLowerCase();
  const type = (validTypes.includes(rawType) ? rawType : "engine") as PrototypeConfig["type"];

  const steps = extractSteps(coreLoopData).slice(0, 5);
  const preset = RESOURCE_PRESETS[type] || RESOURCE_PRESETS.engine;

  const goals2d: Record<string, string> = {
    engine: "Накопите 50 энергии за 30 секунд",
    economy: "Заработайте 100 золота, конвертируя ресурсы",
    ecology: "Выживите 30 секунд, уклоняясь от угроз",
    tower_defense: "Защитите базу от 3 волн врагов за 30 секунд",
    rhythm: "Поймайте 20 бит в ритме (стрелки ←→)",
    puzzle: "Соберите 3 линии из блоков (как тетрис)",
  };

  const goals3d: Record<string, string> = {
    engine: "Накопите 50 энергии, кликая по 3D-кристаллам",
    economy: "Заработайте 100 золота, собирая 3D-монеты",
    ecology: "Выживите 30 секунд, уклоняясь от 3D-блоков в пространстве",
    tower_defense: "Защитите 3D-базу от волн врагов",
    rhythm: "Ловите 3D-ноты в ритме",
    puzzle: "Соберите 3D-линии из блоков",
  };

  const goals = mode === "3d" ? goals3d : goals2d;

  return {
    type,
    steps: steps.length > 0 ? steps : ["Собрать", "Преобразовать", "Использовать"],
    resourceName: preset.name,
    resourceIcon: preset.icon,
    goalText: goals[type] || goals.engine,
    mode,
    genre: genre || undefined,
  };
}

// ============================================================
// WebAudio sound effects (shared, no files needed)
// ============================================================

const SFX_SNIPPET = `
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  function sfx(freq, dur, type='sine', vol=0.15) {
    try {
      if (!actx) actx = new AC();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.stop(actx.currentTime + dur);
    } catch(e) {}
  }
  function sfxCollect() { sfx(880, 0.12, 'square'); setTimeout(()=>sfx(1320, 0.1, 'square'), 60); }
  function sfxConvert() { sfx(523, 0.08, 'triangle'); setTimeout(()=>sfx(784, 0.12, 'triangle'), 70); }
  function sfxHit() { sfx(120, 0.25, 'sawtooth', 0.2); }
  function sfxWin() { sfx(523,0.15); setTimeout(()=>sfx(659,0.15),150); setTimeout(()=>sfx(784,0.3),300); }
  function sfxLose() { sfx(220,0.2,'sawtooth'); setTimeout(()=>sfx(110,0.4,'sawtooth'),200); }
`;

// ============================================================
// Touch controls (shared, for mobile)
// ============================================================

const TOUCH_SNIPPET = `
  // Touch controls: emit synthetic key events for mobile
  let touchStartX = 0, touchStartY = 0, touchActive = false;
  function emitKey(code, type) {
    const ev = new KeyboardEvent(type, { code: code, bubbles: true });
    window.dispatchEvent(ev);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(ev);
    }
  }
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchActive = true;
    }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absX < 20 && absY < 20) return; // tap, not swipe
    if (absX > absY) {
      // Horizontal swipe
      emitKey(dx > 0 ? 'ArrowRight' : 'ArrowLeft', 'keydown');
    } else {
      // Vertical swipe
      emitKey(dy > 0 ? 'ArrowDown' : 'ArrowUp', 'keydown');
    }
  }, { passive: true });
`;

// ============================================================
// 2D прототип на LittleJS
// ============================================================

function generate2dHtml(config: PrototypeConfig): string {
  const { type, steps, resourceName, resourceIcon, goalText } = config;

  const mechanics: Record<string, string> = {
    engine: `
      let resource = 0;
      const autoRate = 0.6;
      const clickValue = 3;
      let crystals = [];
      // Spawn clickable crystals
      for (let i=0; i<3; i++) {
        const c = new vec2(100+i*120, 200);
        crystals.push({pos:c, pulse:0});
      }
      function gameUpdate() {
        resource += autoRate * timeDelta;
        crystals.forEach(c => { c.pulse = (c.pulse + timeDelta*2) % (Math.PI*2); });
        if (mouseWasPressed(0)) {
          crystals.forEach(c => {
            const d = mousePos.subtract(c.pos).length();
            if (d < 30) {
              resource += clickValue;
              sfxCollect();
              spawnParticles(c.pos, 8, new Color(1,0.8,0.2,1));
            }
          });
        }
        if (resource >= 50) { sfxWin(); win(); }
      }
      function gameRender() {
        drawRect(vec2(0,0), new Color(0.06,0.09,0.16), 0, 0);
        // Crystals
        crystals.forEach(c => {
          const s = 22 + Math.sin(c.pulse)*3;
          drawPolygon(c.pos, 6, s, new Color(1,0.8,0.2,1), 0, new Color(1,1,0.4,1), 2);
        });
        // Resource big display
        drawText('${resourceIcon} ' + Math.floor(resource), vec2(canvasWidth/2, canvasHeight-60), 64, new Color(1,0.85,0.2));
        drawText('Клик по кристаллам: +' + clickValue + ' • Авто: +0.6/с', vec2(canvasWidth/2, canvasHeight-100), 18, new Color(0.6,0.7,0.8));
        // Progress bar
        const w = canvasWidth-100;
        drawRect(vec2(canvasWidth/2, canvasHeight-130), vec2(w, 8), new Color(0.15,0.2,0.3));
        drawRect(vec2(50+w/2*Math.min(1,resource/50), canvasHeight-130), vec2(w*Math.min(1,resource/50), 8), new Color(0.2,0.9,0.5));
      }
    `,
    economy: `
      let raw = 0, gold = 0;
      let nodes = [];
      for (let i=0; i<4; i++) nodes.push({pos:new vec2(80+i*100,180), pulse:0});
      function gameUpdate() {
        nodes.forEach(n => { n.pulse = (n.pulse + timeDelta*2.5) % (Math.PI*2); });
        if (mouseWasPressed(0)) {
          nodes.forEach(n => {
            if (mousePos.subtract(n.pos).length() < 28) {
              raw += 1;
              sfxCollect();
              spawnParticles(n.pos, 6, new Color(0.3,0.5,1,1));
            }
          });
        }
        if (mouseWasPressed(2) || keyWasPressed('KeyC')) {
          if (raw >= 3) { raw -= 3; gold += 5; sfxConvert(); spawnParticles(vec2(canvasWidth/2,canvasHeight/2), 12, new Color(1,0.7,0.1,1)); }
        }
        if (gold >= 100) { sfxWin(); win(); }
      }
      function gameRender() {
        drawRect(vec2(0,0), new Color(0.06,0.09,0.16), 0, 0);
        nodes.forEach(n => {
          const s = 26 + Math.sin(n.pulse)*3;
          drawCircle(n.pos, s, new Color(0.3,0.5,1,1), 0, new Color(0.5,0.7,1,1), 2);
        });
        drawText('Сырьё: ' + Math.floor(raw), vec2(canvasWidth/2, canvasHeight-70), 36, new Color(0.4,0.6,1));
        drawText('${resourceIcon} ' + Math.floor(gold), vec2(canvasWidth/2, canvasHeight-110), 48, new Color(1,0.75,0.1));
        drawText('ЛКМ = +1 сырьё • ПКМ/C = конвертация (3→5💰)', vec2(canvasWidth/2, canvasHeight-145), 16, new Color(0.6,0.7,0.8));
      }
    `,
    ecology: `
      let health = 100;
      let threats = [];
      let player = { pos: vec2(canvasWidth/2, 100), vel: vec2() };
      let spawnTimer = 0;
      function gameUpdate() {
        // Movement: WASD / arrows
        const move = vec2();
        if (keyIsDown('KeyA')||keyIsDown('ArrowLeft')) move.x -= 1;
        if (keyIsDown('KeyD')||keyIsDown('ArrowRight')) move.x += 1;
        if (keyIsDown('KeyW')||keyIsDown('ArrowUp')) move.y += 1;
        if (keyIsDown('KeyS')||keyIsDown('ArrowDown')) move.y -= 1;
        player.pos = player.pos.add(move.normalize().multiply(220*timeDelta));
        player.pos.x = clamp(player.pos.x, 30, canvasWidth-30);
        player.pos.y = clamp(player.pos.y, 30, canvasHeight-30);
        // Spawn threats
        spawnTimer -= timeDelta;
        if (spawnTimer <= 0) {
          spawnTimer = 0.6;
          threats.push({pos: vec2(Math.random()*canvasWidth, canvasHeight+10), vel: vec2((Math.random()-0.5)*40, -120-Math.random()*60), size: 14+Math.random()*8});
        }
        // Update threats
        threats.forEach(t => { t.pos = t.pos.add(t.vel.multiply(timeDelta)); });
        threats = threats.filter(t => t.pos.y > -20);
        // Collisions
        threats.forEach(t => {
          if (t.pos.subtract(player.pos).length() < t.size+12) {
            health -= 30*timeDelta;
            spawnParticles(player.pos, 4, new Color(1,0.3,0.3,1));
            if (Math.random()<0.1) sfxHit();
          }
        });
        if (health <= 0) { health = 0; sfxLose(); lose(); }
      }
      function gameRender() {
        drawRect(vec2(0,0), new Color(0.06,0.09,0.16), 0, 0);
        // Player (green circle)
        drawCircle(player.pos, 14, new Color(0.2,0.9,0.5,1), 0, new Color(0.5,1,0.7,1), 2);
        // Threats (red squares)
        threats.forEach(t => {
          drawRect(t.pos, vec2(t.size*2), new Color(0.9,0.2,0.2,1), 0, new Color(1,0.5,0.5,1), 2);
        });
        // Health bar
        drawRect(vec2(90,canvasHeight-25), vec2(160,12), new Color(0.15,0.2,0.3));
        drawRect(vec2(10+80*Math.max(0,health/100),canvasHeight-25), vec2(160*Math.max(0,health/100),12), health>30?new Color(0.2,0.9,0.5):new Color(0.9,0.2,0.2));
        drawText('${resourceIcon} ' + Math.floor(health), vec2(20, canvasHeight-25), 16, new Color(1,1,1));
      }
    `,
    tower_defense: `
      let baseHp = 100;
      let enemies = [];
      let wave = 1;
      let waveTimer = 0;
      let enemiesInWave = 0;
      let spawnTimer = 0;
      function gameUpdate() {
        // Spawn waves
        if (wave <= 3) {
          spawnTimer -= timeDelta;
          if (spawnTimer <= 0 && enemiesInWave < 5*wave) {
            spawnTimer = 1.2;
            enemiesInWave++;
            enemies.push({pos: vec2(-20, 50+Math.random()*(canvasHeight-100)), hp:1, t:0});
          }
          if (enemiesInWave >= 5*wave && enemies.length === 0) {
            wave++; enemiesInWave = 0; spawnTimer = 1;
          }
        } else if (baseHp > 0) {
          sfxWin(); win();
        }
        // Update enemies (move right toward base at x=canvasWidth)
        enemies.forEach(e => { e.t += timeDelta; e.pos.x += 25*timeDelta; });
        // Click to shoot
        if (mouseWasPressed(0)) {
          sfxConvert();
          for (let i=enemies.length-1;i>=0;i--) {
            if (enemies[i].pos.subtract(mousePos).length() < 30) {
              spawnParticles(enemies[i].pos, 8, new Color(0.9,0.5,0.1,1));
              enemies.splice(i,1);
              break;
            }
          }
        }
        // Enemies reaching base
        for (let i=enemies.length-1;i>=0;i--) {
          if (enemies[i].pos.x >= canvasWidth-20) {
            baseHp -= 20; sfxHit(); enemies.splice(i,1);
            if (baseHp <= 0) { baseHp=0; sfxLose(); lose(); }
          }
        }
      }
      function gameRender() {
        drawRect(vec2(0,0), new Color(0.06,0.09,0.16), 0, 0);
        // Base emoji + rect
        drawRect(vec2(canvasWidth-15, canvasHeight/2), vec2(20, 80), new Color(0.2,0.5,1,1), 0, new Color(0.5,0.7,1,1), 2);
        drawText('🏰', vec2(canvasWidth-15, canvasHeight/2), 32, new Color(1,1,1,1));
        // Enemies emoji + circle
        enemies.forEach(e => {
          drawCircle(e.pos, 12, new Color(0.9,0.5,0.1,0.3), 0, new Color(1,0.7,0.3,1), 2);
          drawText('👾', e.pos, 24, new Color(1,1,1,1));
        });
        // Wave info
        drawText('Волна ' + Math.min(wave,3) + '/3', vec2(canvasWidth/2, canvasHeight-60), 24, new Color(0.4,0.6,1));
        drawText('${resourceIcon} ' + Math.floor(baseHp), vec2(canvasWidth/2, canvasHeight-95), 36, new Color(0.4,0.7,1));
        drawText('ЛКМ = выстрел по врагу', vec2(canvasWidth/2, canvasHeight-130), 14, new Color(0.6,0.7,0.8));
      }
    `,
    rhythm: `
      let combo = 0;
      let beats = [];
      let beatTimer = 0;
      let notesHit = 0;
      let side = 0; // 0=left, 1=right
      function gameUpdate() {
        beatTimer -= timeDelta;
        if (beatTimer <= 0) {
          beatTimer = 0.7;
          side = 1 - side;
          beats.push({pos: vec2(side? canvasWidth-40 : 40, canvasHeight+20), fromLeft: side===0, hit:false});
        }
        beats.forEach(b => { b.pos.y -= 180*timeDelta; });
        beats = beats.filter(b => b.pos.y > -20);
        // Hit: ← for left side, → for right side
        if (keyWasPressed('ArrowLeft')) {
          const b = beats.find(x => x.fromLeft && !x.hit && Math.abs(x.pos.y-150)<40);
          if (b) { b.hit=true; combo++; notesHit++; sfxCollect(); spawnParticles(b.pos, 6, new Color(0.2,0.9,0.5,1)); }
          else { combo=0; sfxHit(); }
        }
        if (keyWasPressed('ArrowRight')) {
          const b = beats.find(x => !x.fromLeft && !x.hit && Math.abs(x.pos.y-150)<40);
          if (b) { b.hit=true; combo++; notesHit++; sfxCollect(); spawnParticles(b.pos, 6, new Color(0.2,0.9,0.5,1)); }
          else { combo=0; sfxHit(); }
        }
        if (notesHit >= 20) { sfxWin(); win(); }
      }
      function gameRender() {
        drawRect(vec2(0,0), new Color(0.06,0.09,0.16), 0, 0);
        // Hit zone (y=150)
        drawRect(vec2(canvasWidth/2, 150), vec2(canvasWidth, 4), new Color(0.4,0.6,0.8,0.5));
        drawRect(vec2(40, 150), vec2(30, 4), new Color(0.2,0.9,0.5));
        drawRect(vec2(canvasWidth-40, 150), vec2(30, 4), new Color(0.2,0.9,0.5));
        // Beats with emoji
        beats.forEach(b => {
          if (!b.hit) {
            drawCircle(b.pos, 14, b.fromLeft?new Color(0.2,0.9,0.5,0.3):new Color(0.9,0.5,0.2,0.3), 0, new Color(1,1,1,1), 2);
            drawText('🎵', b.pos, 22, new Color(1,1,1,1));
          }
        });
        // Combo
        drawText('${resourceIcon} ' + combo + '  •  ' + notesHit + '/20', vec2(canvasWidth/2, canvasHeight-50), 32, combo>0?new Color(1,0.85,0.2):new Color(0.5,0.5,0.5));
        drawText('← левая нота  •  → правая нота', vec2(canvasWidth/2, canvasHeight-90), 14, new Color(0.6,0.7,0.8));
      }
    `,
    puzzle: `
      // Simple tetris-like: blocks fall, click to place, complete rows
      const COLS = 8, ROWS = 10, CELL = 30;
      let grid = [];
      for (let r=0;r<ROWS;r++) grid.push(new Array(COLS).fill(0));
      let lines = 0;
      let current = {col: 3, row: 0, fall: 0};
      let fallSpeed = 0.8;
      function gameUpdate() {
        current.fall -= timeDelta;
        if (current.fall <= 0) {
          current.fall = fallSpeed;
          if (current.row < ROWS-1 && grid[current.row+1][current.col] === 0) {
            current.row++;
          } else {
            grid[current.row][current.col] = 1;
            // Check line
            for (let r=0;r<ROWS;r++) {
              if (grid[r].every(c => c===1)) {
                grid.splice(r,1); grid.unshift(new Array(COLS).fill(0));
                lines++; sfxConvert(); spawnParticles(vec2(canvasWidth/2,canvasHeight/2), 15, new Color(0.2,0.9,0.5,1));
                if (lines >= 3) { sfxWin(); win(); }
              }
            }
            current = {col: 3, row: 0, fall: 0};
            if (grid[0][3] === 1) { sfxLose(); lose(); } // game over
          }
        }
        // Controls: ← → move, ↓ drop
        if (keyWasPressed('ArrowLeft') && current.col > 0 && grid[current.row][current.col-1]===0) current.col--;
        if (keyWasPressed('ArrowRight') && current.col < COLS-1 && grid[current.row][current.col+1]===0) current.col++;
        if (keyIsDown('ArrowDown')) current.fall = 0;
      }
      function gameRender() {
        drawRect(vec2(0,0), new Color(0.06,0.09,0.16), 0, 0);
        const ox = canvasWidth/2 - COLS*CELL/2;
        const oy = 20;
        // Grid with emoji blocks
        for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
          if (grid[r][c]) {
            drawRect(vec2(ox+c*CELL+CELL/2, oy+r*CELL+CELL/2), vec2(CELL-2), new Color(0.4,0.6,1,0.5), 0, new Color(0.6,0.8,1,1), 1);
            drawText('🟦', vec2(ox+c*CELL+CELL/2, oy+r*CELL+CELL/2), CELL-4, new Color(1,1,1,1));
          }
        }
        // Current piece with emoji
        drawRect(vec2(ox+current.col*CELL+CELL/2, oy+current.row*CELL+CELL/2), vec2(CELL-2), new Color(1,0.85,0.2,0.5), 0, new Color(1,1,0.4,1), 2);
        drawText('🟨', vec2(ox+current.col*CELL+CELL/2, oy+current.row*CELL+CELL/2), CELL-4, new Color(1,1,1,1));
        // Lines
        drawText('${resourceIcon} ' + lines + '/3', vec2(canvasWidth/2, canvasHeight-25), 28, new Color(1,0.85,0.2));
        drawText('← → движение  •  ↓ ускорить', vec2(canvasWidth/2, canvasHeight-55), 12, new Color(0.6,0.7,0.8));
      }
    `,
  };

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Прототип 2D: ${type}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;padding:8px;min-height:100vh;overflow:hidden}
  h1{font-size:16px;margin-bottom:2px}
  .goal{color:#94a3b8;font-size:12px;margin-bottom:4px}
  .steps{font-size:10px;color:#64748b;margin-top:4px;text-align:center}
  #gameContainer{position:relative;width:100%;max-width:400px}
  canvas{display:block;border-radius:8px;border:1px solid #334155}
  .overlay{position:absolute;inset:0;background:rgba(0,0,0,0.88);border-radius:8px;display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:10px}
  .overlay.show{display:flex}
  .overlay h2{font-size:22px}
  .overlay button{padding:8px 20px;background:#10b981;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer}
  .hint{font-size:10px;color:#475569;margin-top:2px;text-align:center}
</style>
</head>
<body>
  <h1>🎮 Прототип кор-лупа (2D • ${type})</h1>
  <p class="goal">🎯 ${goalText}</p>
  <div id="gameContainer">
    <div class="overlay" id="overlay">
      <h2 id="resultText"></h2>
      <button onclick="restart()">Заново</button>
    </div>
  </div>
  <p class="steps">Шаги: ${steps.join(" → ")}</p>
  <p class="hint">Powered by LittleJS • WASD/стрелки • ЛКМ${(type === "rhythm" || type === "puzzle" || type === "ecology") ? " • swipe на мобильных" : ""}</p>
  <script src="/littlejs.min.js"></script>
  <script>
    ${SFX_SNIPPET}
    ${(type === "rhythm" || type === "puzzle" || type === "ecology") ? TOUCH_SNIPPET : ""}
    let timeLeft = 30;
    let running = true;
    const overlay = document.getElementById('overlay');
    const resultText = document.getElementById('resultText');
    let particles = [];

    function spawnParticles(pos, n, color) {
      for (let i=0;i<n;i++) {
        const a = Math.random()*Math.PI*2;
        const s = 50+Math.random()*100;
        particles.push({pos:pos.add(vec2(Math.cos(a)*s,Math.sin(a)*s)), vel: vec2(Math.cos(a)*s, Math.sin(a)*s), life:1, color:color});
      }
    }

    function notifyParent(outcome, score, duration) {
      try { window.parent.postMessage({ type: 'gidede-playtest', outcome: outcome, score: score||null, duration: duration||30, prototypeType: '${type}', mode: '2d' }, '*'); } catch(e) {}
    }
    function win(score) { running=false; resultText.textContent='🎉 Победа!'; overlay.classList.add('show'); notifyParent('win', score, Math.max(0, 30-timeLeft)); }
    function lose(score) { running=false; resultText.textContent='💀 Поражение'; overlay.classList.add('show'); notifyParent('lose', score, Math.max(0, 30-timeLeft)); }
    window.restart = function() { location.reload(); };

    ${mechanics[type]}

    function gameUpdatePost() {
      if (running) {
        timeLeft -= timeDelta;
        if (timeLeft <= 0) {
          running = false;
          ${type === "ecology" || type === "tower_defense" ? `if (${type === "ecology" ? "health" : "baseHp"} > 0) { sfxWin(); resultText.textContent='⏰ Выживали — победа!'; } else { sfxLose(); resultText.textContent='⏰ Время вышло'; }` : "sfxLose(); resultText.textContent='⏰ Время вышло';"}
          overlay.classList.add('show');
        }
      }
      // Particles
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => {
        p.life -= timeDelta*1.5;
        p.pos = p.pos.add(p.vel.multiply(timeDelta));
        p.vel = p.vel.multiply(0.95);
      });
    }

    function gameRenderPost() {
      // Particles
      particles.forEach(p => {
        if (p.life > 0) {
          drawCircle(p.pos, 4*p.life, p.color);
        }
      });
      // Timer
      drawText('⏱ ' + Math.max(0,Math.ceil(timeLeft)) + 'с', vec2(canvasWidth-30, canvasHeight-25), 18, new Color(0.6,0.7,0.8), 0, 'right');
    }

    function gameInit() {
      // disable right-click context menu
      document.addEventListener('contextmenu', e => e.preventDefault());
      canvasFixedSize = vec2(400, 300);
    }

    engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
  </script>
</body>
</html>`;
}

// ============================================================
// 3D прототип на Three.js
// ============================================================

function generate3dHtml(config: PrototypeConfig): string {
  const { type, steps, resourceName, resourceIcon, goalText } = config;

  const mechanics3d: Record<string, string> = {
    engine: `
      // 3D crystals to click for energy
      let resource = 0;
      const crystals = [];
      const crystalGeo = new THREE.OctahedronGeometry(0.5, 0);
      for (let i=0; i<5; i++) {
        const m = new THREE.MeshStandardMaterial({color:0xfbbf24, emissive:0xfbbf24, emissiveIntensity:0.3, metalness:0.6, roughness:0.2});
        const mesh = new THREE.Mesh(crystalGeo, m);
        mesh.position.set(-4+i*2, 1, -2);
        mesh.userData = {clicked:false, pulse:Math.random()*Math.PI*2};
        scene.add(mesh);
        crystals.push(mesh);
      }
      const raycaster = new THREE.Raycaster();
      const mouseV = new THREE.Vector2();
      window.addEventListener('click', (e) => {
        const r = renderer.domElement.getBoundingClientRect();
        mouseV.x = ((e.clientX-r.left)/r.width)*2-1;
        mouseV.y = -((e.clientY-r.top)/r.height)*2+1;
        raycaster.setFromCamera(mouseV, camera);
        const hits = raycaster.intersectObjects(crystals);
        if (hits.length>0) {
          resource += 3;
          sfxCollect();
          const h = hits[0].object;
          h.position.y += 0.3;
          setTimeout(()=>{h.position.y=1;}, 150);
          if (resource >= 50) { sfxWin(); win(); }
        }
      });
      function tick(dt) {
        crystals.forEach(c => {
          c.rotation.y += dt*1.5;
          c.userData.pulse += dt*2;
          c.position.y = 1 + Math.sin(c.userData.pulse)*0.15;
        });
      }
      function render3d() {
        document.getElementById('hud').innerHTML = '${resourceIcon} ' + Math.floor(resource) + ' / 50';
      }
    `,
    economy: `
      // 3D coins to collect
      let gold = 0;
      const coins = [];
      const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
      const coinMat = new THREE.MeshStandardMaterial({color:0xf59e0b, metalness:0.9, roughness:0.2});
      function spawnCoin() {
        const m = new THREE.Mesh(coinGeo, coinMat);
        m.position.set((Math.random()-0.5)*8, 1+Math.random()*2, (Math.random()-0.5)*4);
        m.rotation.x = Math.PI/2;
        m.userData = {pulse:Math.random()*Math.PI*2};
        scene.add(m);
        coins.push(m);
        if (coins.length > 8) { scene.remove(coins.shift()); }
      }
      setInterval(spawnCoin, 800);
      const raycaster = new THREE.Raycaster();
      const mouseV = new THREE.Vector2();
      window.addEventListener('click', (e) => {
        const r = renderer.domElement.getBoundingClientRect();
        mouseV.x = ((e.clientX-r.left)/r.width)*2-1;
        mouseV.y = -((e.clientY-r.top)/r.height)*2+1;
        raycaster.setFromCamera(mouseV, camera);
        const hits = raycaster.intersectObjects(coins);
        if (hits.length>0) {
          gold += 10;
          sfxConvert();
          scene.remove(hits[0].object);
          coins.splice(coins.indexOf(hits[0].object), 1);
          if (gold >= 100) { sfxWin(); win(); }
        }
      });
      function tick(dt) {
        coins.forEach(c => { c.rotation.z += dt*2; c.userData.pulse += dt*2; c.position.y = 1 + Math.sin(c.userData.pulse)*0.3; });
      }
      function render3d() {
        document.getElementById('hud').innerHTML = '${resourceIcon} ' + Math.floor(gold) + ' / 100';
      }
    `,
    ecology: `
      // 3D dodge falling blocks
      let health = 100;
      const player = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 24, 24),
        new THREE.MeshStandardMaterial({color:0x10b981, emissive:0x10b981, emissiveIntensity:0.2})
      );
      player.position.y = 0.5;
      scene.add(player);
      const playerLight = new THREE.PointLight(0x10b981, 1, 8);
      playerLight.position.copy(player.position);
      scene.add(playerLight);
      const blocks = [];
      const blockGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
      const blockMat = emojiMaterial('💥', 0xef4444);
      let spawnTimer = 0;
      const keys = {};
      window.addEventListener('keydown', e => keys[e.code]=true);
      window.addEventListener('keyup', e => keys[e.code]=false);
      // Virtual joystick for mobile
      let joystick = { active: false, x: 0, y: 0, dx: 0, dy: 0 };
      const joystickEl = document.getElementById('joystick');
      if (joystickEl) {
        joystickEl.style.display = 'block';
        joystickEl.addEventListener('touchstart', (e) => {
          e.preventDefault();
          const r = joystickEl.getBoundingClientRect();
          joystick.active = true;
          joystick.x = r.left + r.width/2;
          joystick.y = r.top + r.height/2;
        }, { passive: false });
        joystickEl.addEventListener('touchmove', (e) => {
          e.preventDefault();
          if (!joystick.active || !e.touches[0]) return;
          const t = e.touches[0];
          joystick.dx = (t.clientX - joystick.x) / 50;
          joystick.dy = (t.clientY - joystick.y) / 50;
          joystick.dx = Math.max(-1, Math.min(1, joystick.dx));
          joystick.dy = Math.max(-1, Math.min(1, joystick.dy));
          const knob = document.getElementById('joystickKnob');
          if (knob) { knob.style.transform = 'translate(' + (joystick.dx*20) + 'px,' + (joystick.dy*20) + 'px)'; }
        }, { passive: false });
        joystickEl.addEventListener('touchend', (e) => {
          e.preventDefault();
          joystick.active = false; joystick.dx = 0; joystick.dy = 0;
          const knob = document.getElementById('joystickKnob');
          if (knob) { knob.style.transform = 'translate(0,0)'; }
        }, { passive: false });
      }
      function tick(dt) {
        // Movement (keyboard + joystick)
        const speed = 6*dt;
        let mx = 0, mz = 0;
        if (keys['KeyA']||keys['ArrowLeft']) mx -= 1;
        if (keys['KeyD']||keys['ArrowRight']) mx += 1;
        if (keys['KeyW']||keys['ArrowUp']) mz -= 1;
        if (keys['KeyS']||keys['ArrowDown']) mz += 1;
        if (joystick.active) { mx += joystick.dx; mz += joystick.dy; }
        player.position.x = Math.max(-5, Math.min(5, player.position.x + mx*speed));
        player.position.z = Math.max(-3, Math.min(3, player.position.z + mz*speed));
        playerLight.position.copy(player.position);
        playerLight.position.y = 1.5;
        // Spawn blocks
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnTimer = 0.7;
          const b = new THREE.Mesh(blockGeo, blockMat);
          b.position.set((Math.random()-0.5)*10, 8, (Math.random()-0.5)*6);
          b.userData = {vy: -4-Math.random()*2};
          scene.add(b);
          blocks.push(b);
        }
        // Update blocks + collisions
        for (let i=blocks.length-1; i>=0; i--) {
          const b = blocks[i];
          b.position.y += b.userData.vy*dt;
          b.rotation.x += dt*2; b.rotation.y += dt*1.5;
          if (b.position.y < -2) { scene.remove(b); blocks.splice(i,1); continue; }
          const dx = b.position.x-player.position.x, dy=b.position.y-player.position.y, dz=b.position.z-player.position.z;
          if (Math.abs(dx)<0.55 && Math.abs(dy)<0.55 && Math.abs(dz)<0.55) {
            health -= 25*dt*3;
            sfxHit();
            scene.remove(b); blocks.splice(i,1);
            if (health <= 0) { health=0; sfxLose(); lose(); }
          }
        }
      }
      function render3d() {
        document.getElementById('hud').innerHTML = '${resourceIcon} ' + Math.floor(health) + '%';
        const bar = document.getElementById('hpbar');
        bar.style.width = Math.max(0,health) + '%';
        bar.style.background = health>30?'#10b981':'#ef4444';
      }
    `,
    tower_defense: `
      // 3D tower defense: base + waves of enemies, click to shoot
      let baseHp = 100;
      let wave = 1, enemiesInWave = 0, spawnTimer = 0;
      const enemies = [];
      const enemyGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const enemyMat = emojiMaterial('👾', 0xf59e0b);
      // Base (blue tower)
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.2, 2, 8),
        new THREE.MeshStandardMaterial({color:0x3b82f6, emissive:0x3b82f6, emissiveIntensity:0.2})
      );
      base.position.set(5, 1, 0);
      scene.add(base);
      const baseLight = new THREE.PointLight(0x3b82f6, 1, 10);
      baseLight.position.set(5, 3, 0);
      scene.add(baseLight);
      const raycaster = new THREE.Raycaster();
      const mouseV = new THREE.Vector2();
      window.addEventListener('click', (e) => {
        const r = renderer.domElement.getBoundingClientRect();
        mouseV.x = ((e.clientX-r.left)/r.width)*2-1;
        mouseV.y = -((e.clientY-r.top)/r.height)*2+1;
        raycaster.setFromCamera(mouseV, camera);
        const hits = raycaster.intersectObjects(enemies);
        if (hits.length > 0) {
          sfxConvert();
          scene.remove(hits[0].object);
          enemies.splice(enemies.indexOf(hits[0].object), 1);
        }
      });
      function tick(dt) {
        if (wave <= 3) {
          spawnTimer -= dt;
          if (spawnTimer <= 0 && enemiesInWave < 4*wave) {
            spawnTimer = 1.5;
            enemiesInWave++;
            const e = new THREE.Mesh(enemyGeo, enemyMat);
            e.position.set(-5, 0.5, (Math.random()-0.5)*4);
            e.userData = {speed: 0.8 + wave*0.2};
            scene.add(e);
            enemies.push(e);
          }
          if (enemiesInWave >= 4*wave && enemies.length === 0) {
            wave++; enemiesInWave = 0; spawnTimer = 1.5;
          }
        } else if (baseHp > 0) {
          sfxWin(); win();
        }
        enemies.forEach(e => { e.position.x += e.userData.speed * dt; e.rotation.y += dt*2; });
        for (let i=enemies.length-1;i>=0;i--) {
          if (enemies[i].position.x >= 4.5) {
            baseHp -= 20; sfxHit();
            scene.remove(enemies[i]); enemies.splice(i,1);
            if (baseHp <= 0) { baseHp=0; sfxLose(); lose(); }
          }
        }
      }
      function render3d() {
        document.getElementById('hud').innerHTML = '${resourceIcon} ' + Math.floor(baseHp) + '%  •  Волна ' + Math.min(wave,3) + '/3';
        const bar = document.getElementById('hpbar');
        bar.style.width = Math.max(0,baseHp) + '%';
        bar.style.background = baseHp>30?'#3b82f6':'#ef4444';
      }
    `,
    rhythm: `
      // 3D rhythm: 3D notes approach a hit zone, ← / → to hit
      let combo = 0, notesHit = 0;
      const notes = [];
      const noteGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const noteMatL = emojiMaterial('🎵', 0x10b981);
      const noteMatR = emojiMaterial('🎵', 0xf59e0b);
      // Hit zone markers (two glowing pillars)
      const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), new THREE.MeshStandardMaterial({color:0x10b981, emissive:0x10b981, emissiveIntensity:0.5}));
      pillarL.position.set(-2, 1.5, 4); scene.add(pillarL);
      const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), new THREE.MeshStandardMaterial({color:0xf59e0b, emissive:0xf59e0b, emissiveIntensity:0.5}));
      pillarR.position.set(2, 1.5, 4); scene.add(pillarR);
      let spawnTimer = 0;
      let side = 0;
      window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
          const wantLeft = e.code === 'ArrowLeft';
          for (let i=notes.length-1; i>=0; i--) {
            const n = notes[i];
            if (n.userData.fromLeft === wantLeft && n.position.z > 3.5 && n.position.z < 4.5) {
              combo++; notesHit++; sfxCollect();
              scene.remove(n); notes.splice(i,1);
              if (notesHit >= 15) { sfxWin(); win(); }
              return;
            }
          }
          combo = 0; sfxHit();
        }
      });
      function tick(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnTimer = 0.8;
          side = 1 - side;
          const n = new THREE.Mesh(noteGeo, side === 0 ? noteMatL : noteMatR);
          n.position.set(side === 0 ? -2 : 2, 0.5, -8);
          n.userData = {fromLeft: side === 0, speed: 4};
          scene.add(n);
          notes.push(n);
        }
        for (let i=notes.length-1; i>=0; i--) {
          notes[i].position.z += notes[i].userData.speed * dt;
          notes[i].rotation.y += dt*3;
          if (notes[i].position.z > 6) {
            combo = 0; scene.remove(notes[i]); notes.splice(i,1);
          }
        }
      }
      function render3d() {
        document.getElementById('hud').innerHTML = '${resourceIcon} ' + combo + '  •  ' + notesHit + '/15';
      }
    `,
    puzzle: `
      // 3D puzzle: blocks stack on a 3D grid, complete layers to score
      const COLS = 5, ROWS = 6;
      let lines = 0;
      const grid = [];
      for (let y=0; y<ROWS; y++) grid.push(new Array(COLS).fill(null));
      const blockGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const blockMats = [
        emojiMaterial('🟦', 0x3b82f6),
        emojiMaterial('🟩', 0x10b981),
        emojiMaterial('🟧', 0xf59e0b),
      ];
      let current = null;
      let fallTimer = 0;
      function spawnBlock() {
        const col = 2;
        const m = blockMats[Math.floor(Math.random()*blockMats.length)];
        const b = new THREE.Mesh(blockGeo, m);
        b.position.set((col-2)*1, 0.5, 0);
        b.userData = {col, y: 0, mat: m};
        scene.add(b);
        current = b;
        fallTimer = 0.8;
      }
      spawnBlock();
      window.addEventListener('keydown', (e) => {
        if (!current) return;
        if (e.code === 'ArrowLeft' && current.userData.col > 0) {
          current.userData.col--;
          current.position.x = (current.userData.col-2)*1;
          if (grid[current.userData.y][current.userData.col]) {
            current.userData.col++; current.position.x = (current.userData.col-2)*1;
          }
        }
        if (e.code === 'ArrowRight' && current.userData.col < COLS-1) {
          current.userData.col++;
          current.position.x = (current.userData.col-2)*1;
          if (grid[current.userData.y][current.userData.col]) {
            current.userData.col--; current.position.x = (current.userData.col-2)*1;
          }
        }
        if (e.code === 'ArrowDown') fallTimer = 0;
      });
      function tick(dt) {
        if (!current) return;
        fallTimer -= dt;
        if (fallTimer <= 0) {
          fallTimer = 0.8;
          if (current.userData.y < ROWS-1 && !grid[current.userData.y+1][current.userData.col]) {
            current.userData.y++;
            current.position.y = current.userData.y + 0.5;
          } else {
            grid[current.userData.y][current.userData.col] = current;
            // Check line (full row at any y level)
            for (let y=0; y<ROWS; y++) {
              if (grid[y].every(c => c !== null)) {
                grid[y].forEach(b => scene.remove(b));
                grid[y] = new Array(COLS).fill(null);
                lines++; sfxConvert();
                if (lines >= 3) { sfxWin(); win(); }
              }
            }
            if (grid[0].some(c => c !== null)) { sfxLose(); lose(); return; }
            spawnBlock();
          }
        }
        if (current) current.rotation.y += dt;
      }
      function render3d() {
        document.getElementById('hud').innerHTML = '${resourceIcon} ' + lines + '/3';
      }
    `,
  };

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Прототип 3D: ${type}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;padding:8px;min-height:100vh;overflow:hidden}
  h1{font-size:16px;margin-bottom:2px}
  .goal{color:#94a3b8;font-size:12px;margin-bottom:4px}
  #gameContainer{position:relative;width:100%;max-width:400px;height:300px;border-radius:8px;overflow:hidden;border:1px solid #334155}
  canvas{display:block;width:100%;height:100%}
  #hud{position:absolute;top:8px;left:8px;color:#fbbf24;font-size:20px;font-weight:bold;text-shadow:0 2px 4px rgba(0,0,0,0.8)}
  #timer{position:absolute;top:8px;right:8px;color:#94a3b8;font-size:14px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8)}
  #hpWrap{position:absolute;bottom:8px;left:8px;width:140px;height:10px;background:rgba(15,23,42,0.7);border-radius:5px;overflow:hidden;display:${type === "ecology" || type === "tower_defense" ? "block" : "none"}}
  #hpbar{height:100%;width:100%;background:#10b981;transition:width 0.2s}
  .overlay{position:absolute;inset:0;background:rgba(0,0,0,0.88);display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:10px}
  .overlay.show{display:flex}
  .overlay h2{font-size:22px}
  .overlay button{padding:8px 20px;background:#10b981;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer}
  .steps{font-size:10px;color:#64748b;margin-top:4px;text-align:center}
  .hint{font-size:10px;color:#475569;margin-top:2px;text-align:center}
</style>
</head>
<body>
  <h1>🎮 Прототип кор-лупа (3D • ${type})</h1>
  <p class="goal">🎯 ${goalText}</p>
  <div id="gameContainer">
    <div id="hud">${resourceIcon} 0</div>
    <div id="timer">⏱ 30с</div>
    <div id="hpWrap"><div id="hpbar"></div></div>
    <div id="joystick" style="display:none;position:absolute;bottom:15px;left:15px;width:80px;height:80px;background:rgba(15,23,42,0.5);border:2px solid rgba(148,163,184,0.4);border-radius:50%;touch-action:none;z-index:10">
      <div id="joystickKnob" style="position:absolute;top:50%;left:50%;width:30px;height:30px;margin:-15px 0 0 -15px;background:rgba(16,185,129,0.6);border:2px solid #10b981;border-radius:50%;transition:transform 0.05s"></div>
    </div>
    <div class="overlay" id="overlay">
      <h2 id="resultText"></h2>
      <button onclick="location.reload()">Заново</button>
    </div>
  </div>
  <p class="steps">Шаги: ${steps.join(" → ")}</p>
  <p class="hint">Powered by Three.js • ${
    type === "ecology" ? "WASD/стрелки • joystick на мобильных" :
    type === "tower_defense" ? "ЛКМ по врагам" :
    type === "rhythm" ? "← → по нотам" :
    type === "puzzle" ? "← → движение • ↓ ускорить" :
    "ЛКМ по объектам"
  }</p>
  <script src="/three.min.js"></script>
  <script>
    ${SFX_SNIPPET}
    ${(type === "rhythm" || type === "puzzle" || type === "ecology") ? TOUCH_SNIPPET : ""}
    const THREE = window.THREE;
    const container = document.getElementById('gameContainer');
    const overlay = document.getElementById('overlay');
    const resultText = document.getElementById('resultText');
    const timerEl = document.getElementById('timer');

    // Helper: create emoji texture for 3D sprites
    function emojiTexture(emoji, size) {
      size = size || 128;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.font = (size*0.8) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, size/2, size/2);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }
    function emojiMaterial(emoji, color, size) {
      const m = new THREE.MeshStandardMaterial({ color: color || 0xffffff, transparent: true });
      m.map = emojiTexture(emoji, size);
      return m;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 10, 30);

    const camera = new THREE.PerspectiveCamera(60, 400/300, 0.1, 100);
    camera.position.set(${
      type === "ecology" ? "0, 6, 8" :
      type === "tower_defense" ? "0, 5, 10" :
      type === "rhythm" ? "0, 3, 10" :
      type === "puzzle" ? "0, 4, 9" :
      "0, 4, 8"
    });
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(400, 300);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Ground / arena
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({color:0x1e293b, metalness:0.1, roughness:0.9});
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    scene.add(ground);

    // Grid helper for spatial reference
    const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    let timeLeft = 30;
    let running = true;
    function notifyParent(outcome, score, duration) {
      try { window.parent.postMessage({ type: 'gidede-playtest', outcome: outcome, score: score||null, duration: duration||30, prototypeType: '${type}', mode: '3d' }, '*'); } catch(e) {}
    }
    function win(score) { running=false; resultText.textContent='🎉 Победа!'; overlay.classList.add('show'); notifyParent('win', score, Math.max(0, 30-timeLeft)); }
    function lose(score) { running=false; resultText.textContent='💀 Поражение'; overlay.classList.add('show'); notifyParent('lose', score, Math.max(0, 30-timeLeft)); }

    ${mechanics3d[type]}

    let last = performance.now();
    function animate(now) {
      const dt = Math.min(0.05, (now-last)/1000);
      last = now;
      if (running) {
        tick(dt);
        timeLeft -= dt;
        timerEl.textContent = '⏱ ' + Math.max(0,Math.ceil(timeLeft)) + 'с';
        if (timeLeft <= 0) {
          running = false;
          ${type === "ecology" || type === "tower_defense" ? `if (${type === "ecology" ? "health" : "baseHp"} > 0) { sfxWin(); resultText.textContent='⏰ Выживали — победа!'; } else { sfxLose(); resultText.textContent='⏰ Время вышло'; }` : "sfxLose(); resultText.textContent='⏰ Время вышло';"}
          overlay.classList.add('show');
        }
      }
      // Camera orbit for non-ecology
      ${type !== "ecology" ? "camera.position.x = Math.sin(now*0.0002)*3; camera.lookAt(0,1,0);" : ""}
      render3d && render3d();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  </script>
</body>
</html>`;
}

// ============================================================
// Жанровые прототипы на чистом Canvas (без LittleJS/Three.js)
// ============================================================
//
// Каждый жанр — самодостаточный HTML с настоящими механиками:
// платформер (гравитация/прыжки/платформы), шутер (полёт пуль/спавн врагов),
// RPG (ближний бой/XP/уровни), гонки (скроллинг/полосы), puzzle (match-3),
// Tower Defense (волны/башни/золото). Весь UI на русском.
//
// Общая структура каждого жанрового HTML:
//   - <head> с viewport meta
//   - canvas 800x600 (адаптивный)
//   - requestAnimationFrame game loop
//   - keyboard + touch listeners
//   - win/lose → window.parent.postMessage({type:'gidede-playtest',...})
//   - кнопка «Заново», оверлей с инструкцией в начале

/** Общая шапка для жанровых прототипов (стили + пост-мессадж + sfx). */
function genreShell(title: string, goalText: string, instructions: string, genreType: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;padding:6px;min-height:100vh;overflow:hidden;-webkit-user-select:none;user-select:none}
  h1{font-size:14px;margin-bottom:2px;color:#fbbf24}
  .goal{color:#94a3b8;font-size:11px;margin-bottom:4px;text-align:center}
  #wrap{position:relative;width:100%;max-width:800px;aspect-ratio:4/3;border-radius:10px;overflow:hidden;border:1px solid #334155;box-shadow:0 4px 20px rgba(0,0,0,0.5)}
  canvas{display:block;width:100%;height:100%;background:#1e293b;touch-action:none}
  #hud{position:absolute;top:8px;left:8px;display:flex;gap:12px;align-items:center;color:#fbbf24;font-size:14px;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.9);z-index:5;pointer-events:none}
  #timer{position:absolute;top:8px;right:8px;color:#94a3b8;font-size:14px;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.9);z-index:5}
  .overlay{position:absolute;inset:0;background:rgba(2,6,23,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:14px;padding:18px;z-index:10;text-align:center}
  .overlay.hidden{display:none}
  .overlay h2{font-size:22px;color:#fbbf24}
  .overlay p{font-size:13px;color:#cbd5e1;max-width:520px;line-height:1.5;white-space:pre-line}
  .overlay button{padding:10px 28px;background:#10b981;color:#042f1e;border:none;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;transition:transform .15s}
  .overlay button:hover{transform:scale(1.05)}
  .overlay button.secondary{background:#475569;color:#fff;margin-left:8px}
  .hint{font-size:10px;color:#64748b;margin-top:4px;text-align:center}
  .controls{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
  .btn{padding:8px 16px;background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600}
  .btn:active{background:#334155}
</style>
</head>
<body>
  <h1>${title}</h1>
  <p class="goal">🎯 ${goalText}</p>
  <div id="wrap">
    <div id="hud"></div>
    <div id="timer"></div>
    <canvas id="game" width="800" height="600"></canvas>
    <div class="overlay" id="startOverlay">
      <h2>${title}</h2>
      <p>${instructions}</p>
      <div class="controls">
        <button class="btn" id="startBtn">▶ Играть</button>
      </div>
    </div>
    <div class="overlay hidden" id="endOverlay">
      <h2 id="endTitle"></h2>
      <p id="endStats"></p>
      <button class="btn" id="restartBtn">↻ Заново</button>
    </div>
  </div>
  <p class="hint">${title} • чистый Canvas • клавиатура + тач</p>
<script>
"use strict";
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const hudEl = document.getElementById('hud');
const timerEl = document.getElementById('timer');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const endTitle = document.getElementById('endTitle');
const endStats = document.getElementById('endStats');

// WebAudio sfx (без файлов)
let actx = null;
function sfx(freq, dur, type='sine', vol=0.12) {
  try {
    if (!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(actx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.stop(actx.currentTime + dur);
  } catch(e) {}
}
function sfxCollect(){ sfx(880,0.1,'square'); setTimeout(()=>sfx(1320,0.1,'square'),50); }
function sfxHit(){ sfx(120,0.2,'sawtooth',0.18); }
function sfxShoot(){ sfx(660,0.06,'square',0.08); }
function sfxKill(){ sfx(440,0.08,'triangle'); setTimeout(()=>sfx(660,0.1,'triangle'),60); }
function sfxWin(){ sfx(523,0.15); setTimeout(()=>sfx(659,0.15),150); setTimeout(()=>sfx(784,0.3),300); }
function sfxLose(){ sfx(220,0.2,'sawtooth'); setTimeout(()=>sfx(110,0.4,'sawtooth'),200); }

// --- состояние ---
let running = false;
let startTime = 0;
let elapsed = 0;
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Тач-управление: кнопки на экране (рисуются canvas'ом, обрабатываются здесь)
const touchState = { left:false, right:false, up:false, down:false, fire:false };
function setupTouchButtons() {
  // Простые невидимые зоны: левая половина — D-pad-стиль, правая — action
  const btns = [
    {x:0, y:H*0.7, w:W*0.25, h:H*0.3, key:'left', label:'◀'},
    {x:W*0.25, y:H*0.7, w:W*0.25, h:H*0.3, key:'right', label:'▶'},
    {x:W*0.5, y:H*0.7, w:W*0.25, h:H*0.3, key:'up', label:'▲'},
    {x:W*0.75, y:H*0.7, w:W*0.25, h:H*0.3, key:'fire', label:'⚡'},
  ];
  return btns;
}
const touchBtns = setupTouchButtons();
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (const t of e.touches) {
    const r = canvas.getBoundingClientRect();
    const x = (t.clientX - r.left) * (W / r.width);
    const y = (t.clientY - r.top) * (H / r.height);
    for (const b of touchBtns) {
      if (x >= b.x && x < b.x+b.w && y >= b.y && y < b.y+b.h) {
        touchState[b.key] = true;
      }
    }
  }
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  // снимаем все, что не нажато
  const stillPressed = new Set();
  for (const t of e.touches) {
    const r = canvas.getBoundingClientRect();
    const x = (t.clientX - r.left) * (W / r.width);
    const y = (t.clientY - r.top) * (H / r.height);
    for (const b of touchBtns) {
      if (x >= b.x && x < b.x+b.w && y >= b.y && y < b.y+b.h) stillPressed.add(b.key);
    }
  }
  for (const b of touchBtns) touchState[b.key] = stillPressed.has(b.key);
}, { passive: false });

function notifyParent(outcome, score, duration) {
  try {
    window.parent.postMessage({
      type: 'gidede-playtest',
      outcome: outcome,
      score: score != null ? score : null,
      duration: duration || Math.round(elapsed),
      mode: '2d',
      prototypeType: '${genreType}'
    }, '*');
  } catch(e) {}
}
function endGame(outcome, score, msg) {
  if (!running) return;
  running = false;
  elapsed = (performance.now() - startTime) / 1000;
  if (outcome === 'win') { sfxWin(); endTitle.textContent = '🎉 Победа!'; }
  else { sfxLose(); endTitle.textContent = '💀 Поражение'; }
  endStats.textContent = (msg || '') + (score != null ? '  •  Счёт: ' + score : '') + '  •  Время: ' + Math.round(elapsed) + 'с';
  endOverlay.classList.remove('hidden');
  notifyParent(outcome, score, Math.round(elapsed));
}

function drawTouchButtons() {
  // Подсказки тач-кнопок (полупрозрачные)
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (const b of touchBtns) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w/2, b.y + b.h/2);
  }
  ctx.restore();
}

document.getElementById('startBtn').addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  if (actx && actx.state === 'suspended') actx.resume();
  startGame();
});
document.getElementById('restartBtn').addEventListener('click', () => {
  endOverlay.classList.add('hidden');
  startGame();
});
`;
}

/** Общий хвост жанровых прототипов: пустой game-loop + автостарт-ожидание. */
function genreFooter(): string {
  return `
let lastFrame = 0;
function frame(now) {
  if (!running) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script>
</body>
</html>`;
}

// ----------------------------------------------------------------
// ПЛАТФОРМЕР
// ----------------------------------------------------------------

function generatePlatformerHtml(config: PrototypeConfig): string {
  return genreShell(
    "🎮 Платформер",
    "Соберите все монеты за 60 секунд. Прыгайте по платформам, остерегайтесь врагов.",
    "Управление:\n• A/D или ←/→ — движение\n• Space/W/↑ — прыжок\n• Цель: собрать все монеты\n• Поражение: падение вниз или касание врага\n\nНа мобильных: тач-кнопки внизу экрана",
    "platformer"
  )
  + `
let player, platforms, coins, enemies, coinsTotal, coinsCollected, timeLeft;
const GRAVITY = 1400;
const MOVE = 260;
const JUMP = 540;

function reset() {
  player = { x: 60, y: 400, w: 26, h: 30, vx: 0, vy: 0, onGround: false };
  platforms = [
    { x: 0,   y: 560, w: 800, h: 40 },   // земля
    { x: 80,  y: 460, w: 140, h: 16 },
    { x: 280, y: 400, w: 120, h: 16 },
    { x: 460, y: 340, w: 140, h: 16 },
    { x: 640, y: 420, w: 140, h: 16 },
    { x: 380, y: 250, w: 120, h: 16 },
    { x: 160, y: 200, w: 100, h: 16 },
    { x: 540, y: 180, w: 100, h: 16 },
  ];
  coins = [
    { x: 130, y: 430 }, { x: 330, y: 370 }, { x: 520, y: 310 },
    { x: 700, y: 390 }, { x: 430, y: 220 }, { x: 200, y: 170 },
    { x: 580, y: 150 }, { x: 380, y: 470 }
  ];
  coinsTotal = coins.length;
  coinsCollected = 0;
  enemies = [
    { x: 290, y: 380, w: 26, h: 24, dir: 1, minX: 280, maxX: 390 },
    { x: 660, y: 400, w: 26, h: 24, dir: 1, minX: 640, maxX: 770 },
    { x: 170, y: 180, w: 26, h: 24, dir: -1, minX: 160, maxX: 250 }
  ];
  timeLeft = 60;
}
reset();

function startGame() {
  reset();
  running = true;
  startTime = performance.now();
  lastFrame = startTime;
}

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) { endGame('lose', coinsCollected, 'Время вышло!'); return; }

  // Горизонталь
  let dx = 0;
  if (keys['KeyA'] || keys['ArrowLeft'] || touchState.left) dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight'] || touchState.right) dx += 1;
  player.vx = dx * MOVE;
  player.x += player.vx * dt;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;

  // Гравитация
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
  player.onGround = false;
  for (const p of platforms) {
    if (rectOverlap(player, p)) {
      // приоритет — посадка сверху
      if (player.vy > 0 && player.y + player.h - player.vy * dt <= p.y + 4) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0 && player.y >= p.y + p.h - 4) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }

  // Прыжок
  if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp'] || touchState.up) && player.onGround) {
    player.vy = -JUMP;
    player.onGround = false;
    sfxShoot();
  }

  // Падение в пропасть
  if (player.y > H + 50) { endGame('lose', coinsCollected, 'Упали вниз!'); return; }

  // Монеты
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const cr = { x: c.x - 10, y: c.y - 10, w: 20, h: 20 };
    if (rectOverlap(player, cr)) {
      coins.splice(i, 1);
      coinsCollected++;
      sfxCollect();
    }
  }
  if (coins.length === 0) { endGame('win', coinsCollected, 'Все монеты собраны!'); return; }

  // Враги (патрулируют по платформе)
  for (const e of enemies) {
    e.x += e.dir * 70 * dt;
    if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
    if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
    if (rectOverlap(player, e)) { endGame('lose', coinsCollected, 'Касание врага!'); return; }
  }
}

function draw() {
  // фон
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, W, H);
  // небо градиент
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // платформы
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  for (const p of platforms) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    // верхняя «трава»
    ctx.fillStyle = '#10b981';
    ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.fillStyle = '#475569';
  }

  // монеты (золотые круги)
  for (const c of coins) {
    ctx.beginPath();
    ctx.fillStyle = '#fbbf24';
    ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', c.x, c.y);
  }

  // враги (красные квадраты с глазами)
  for (const e of enemies) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x + 5, e.y + 6, 5, 5);
    ctx.fillRect(e.x + 15, e.y + 6, 5, 5);
    ctx.fillStyle = '#000';
    const eyeOffX = e.dir > 0 ? 2 : 0;
    ctx.fillRect(e.x + 6 + eyeOffX, e.y + 8, 2, 2);
    ctx.fillRect(e.x + 16 + eyeOffX, e.y + 8, 2, 2);
  }

  // игрок (синий квадрат)
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(player.x + 4, player.y + 6, 6, 6);
  ctx.fillRect(player.x + 16, player.y + 6, 6, 6);

  // HUD
  hudEl.innerHTML = '🪙 ' + coinsCollected + ' / ' + coinsTotal;
  timerEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft)) + 'с';

  drawTouchButtons();
}
` + genreFooter();
}

// ----------------------------------------------------------------
// ШУТЕР (top-down)
// ----------------------------------------------------------------

function generateShooterHtml(config: PrototypeConfig): string {
  return genreShell(
    "🎮 Шутер (top-down)",
    "Выживите 30 секунд или убейте 20 врагов. Стреляйте по врагам мышью.",
    "Управление:\n• WASD — движение\n• Мышь — прицел\n• ЛКМ — выстрел\n• Цель: 20 убийств или выживание 30с\n• HP: 100, −10 за касание врага\n\nНа мобильных: D-pad + кнопка ⚡",
    "shooter"
  )
  + `
let player, enemies, bullets, mouseX, mouseY, mouseDown, hp, kills, timeLeft, spawnT, fireT;
const MOVE = 220;
const BULLET_SPEED = 480;
const FIRE_RATE = 0.18;

function reset() {
  player = { x: W/2, y: H/2, r: 14 };
  enemies = [];
  bullets = [];
  mouseX = W/2; mouseY = 0;
  mouseDown = false;
  hp = 100;
  kills = 0;
  timeLeft = 30;
  spawnT = 0;
  fireT = 0;
}
reset();
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouseX = (e.clientX - r.left) * (W / r.width);
  mouseY = (e.clientY - r.top) * (H / r.height);
});
canvas.addEventListener('mousedown', (e) => { mouseDown = true; if (actx && actx.state==='suspended') actx.resume(); });
canvas.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('mouseleave', () => { mouseDown = false; });

function startGame() {
  reset();
  running = true;
  startTime = performance.now();
  lastFrame = startTime;
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * W; y = -20; }
  else if (side === 1) { x = W + 20; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = H + 20; }
  else { x = -20; y = Math.random() * H; }
  enemies.push({ x, y, r: 12, speed: 60 + Math.random() * 40, hp: 1 });
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) { endGame('win', kills, 'Выживали 30 секунд!'); return; }
  if (kills >= 20) { endGame('win', kills, '20 убийств!'); return; }

  // движение игрока
  let dx = 0, dy = 0;
  if (keys['KeyA'] || touchState.left) dx -= 1;
  if (keys['KeyD'] || touchState.right) dx += 1;
  if (keys['KeyW'] || touchState.up) dy -= 1;
  if (keys['KeyS'] || touchState.down) dy += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    player.x += dx * MOVE * dt;
    player.y += dy * MOVE * dt;
  }
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  // стрельба
  fireT -= dt;
  if ((mouseDown || touchState.fire) && fireT <= 0) {
    fireT = FIRE_RATE;
    const ang = Math.atan2(mouseY - player.y, mouseX - player.x);
    // если тач-fire и нет мыши — стреляем вверх
    const targetAng = touchState.fire && !mouseDown ? -Math.PI/2 : ang;
    bullets.push({ x: player.x, y: player.y, vx: Math.cos(targetAng) * BULLET_SPEED, vy: Math.sin(targetAng) * BULLET_SPEED, life: 1.5 });
    sfxShoot();
  }

  // обновление пуль
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) bullets.splice(i, 1);
  }

  // спавн врагов
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = Math.max(0.4, 1.2 - (30 - timeLeft) * 0.025);
    spawnEnemy();
  }

  // движение врагов к игроку
  for (const e of enemies) {
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(ang) * e.speed * dt;
    e.y += Math.sin(ang) * e.speed * dt;
  }

  // пули vs враги
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 4) {
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        kills++;
        sfxKill();
        break;
      }
    }
  }

  // враги vs игрок
  for (const e of enemies) {
    if (Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r) {
      hp -= 25 * dt;
      sfxHit();
      if (hp <= 0) { hp = 0; endGame('lose', kills, 'HP закончилось!'); return; }
    }
  }
}

function draw() {
  // фон
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);
  // сетка
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // пули (жёлтые)
  ctx.fillStyle = '#fbbf24';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // враги (красные круги)
  for (const e of enemies) {
    ctx.beginPath();
    ctx.fillStyle = '#ef4444';
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // игрок (треугольник-указатель)
  const ang = Math.atan2(mouseY - player.y, mouseX - player.x);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(ang);
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // HP бар над игроком
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(player.x - 25, player.y - 26, 50, 6);
  ctx.fillStyle = hp > 30 ? '#10b981' : '#ef4444';
  ctx.fillRect(player.x - 25, player.y - 26, 50 * (hp / 100), 6);

  // HUD
  hudEl.innerHTML = '❤️ ' + Math.ceil(hp) + '  •  💀 ' + kills + '/20';
  timerEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft)) + 'с';

  drawTouchButtons();
}
` + genreFooter();
}

// ----------------------------------------------------------------
// RPG / DUNGEON CRAWLER
// ----------------------------------------------------------------

function generateRpgHtml(config: PrototypeConfig): string {
  return genreShell(
    "🎮 RPG (подземелье)",
    "Зачистите комнату от 5 врагов. Качайтесь: убийство даёт XP, уровень — +урон.",
    "Управление:\n• WASD — движение\n• ЛКМ или Space — атака (ближний бой)\n• Цель: убить всех врагов\n• Атака бьёт по врагам в радиусе перед героем\n• Каждый уровень: +10 к урону\n\nНа мобильных: D-pad + кнопка ⚡",
    "rpg"
  )
  + `
let player, enemies, hp, maxHp, mana, maxMana, xp, level, dmg, attackT, attackAnim, timeLeft;
const MOVE = 180;
const ATTACK_RANGE = 60;
const ATTACK_ARC = Math.PI / 2;

function reset() {
  player = { x: W/2, y: H/2, r: 16, facing: 0 };
  enemies = [
    { x: 100, y: 100, r: 14, hp: 30, maxHp: 30, speed: 50, dmg: 8, alive: true },
    { x: 700, y: 120, r: 14, hp: 30, maxHp: 30, speed: 50, dmg: 8, alive: true },
    { x: 150, y: 500, r: 14, hp: 40, maxHp: 40, speed: 60, dmg: 10, alive: true },
    { x: 680, y: 480, r: 14, hp: 40, maxHp: 40, speed: 60, dmg: 10, alive: true },
    { x: 400, y: 80,  r: 18, hp: 60, maxHp: 60, speed: 70, dmg: 14, alive: true }
  ];
  hp = 100; maxHp = 100;
  mana = 50; maxMana = 50;
  xp = 0; level = 1; dmg = 20;
  attackT = 0; attackAnim = 0;
  timeLeft = 90;
}
reset();

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (W / r.width);
  const my = (e.clientY - r.top) * (H / r.height);
  player.facing = Math.atan2(my - player.y, mx - player.x);
});
canvas.addEventListener('mousedown', () => { tryAttack(); if (actx && actx.state==='suspended') actx.resume(); });

function startGame() {
  reset();
  running = true;
  startTime = performance.now();
  lastFrame = startTime;
}

function tryAttack() {
  if (attackT > 0) return;
  attackT = 0.4;
  attackAnim = 0.2;
  sfxShoot();
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d > ATTACK_RANGE + e.r) continue;
    const ang = Math.atan2(e.y - player.y, e.x - player.x);
    let diff = Math.abs(ang - player.facing);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < ATTACK_ARC / 2) {
      e.hp -= dmg;
      if (e.hp <= 0) {
        e.alive = false;
        xp += 30;
        sfxKill();
        // уровень
        if (xp >= level * 100) {
          xp -= level * 100;
          level++;
          dmg += 10;
          hp = Math.min(maxHp, hp + 30);
          sfxWin();
        }
      }
    }
  }
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) { endGame('lose', 5 - enemies.filter(e=>e.alive).length, 'Время вышло!'); return; }
  if (enemies.every(e => !e.alive)) { endGame('win', 5, 'Все враги повержены!'); return; }

  attackT = Math.max(0, attackT - dt);
  attackAnim = Math.max(0, attackAnim - dt);
  mana = Math.min(maxMana, mana + 5 * dt);

  // движение
  let dx = 0, dy = 0;
  if (keys['KeyA'] || touchState.left) dx -= 1;
  if (keys['KeyD'] || touchState.right) dx += 1;
  if (keys['KeyW'] || touchState.up) dy -= 1;
  if (keys['KeyS'] || touchState.down) dy += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    player.x += dx * MOVE * dt;
    player.y += dy * MOVE * dt;
    player.facing = Math.atan2(dy, dx);
  }
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  if (keys['Space'] || touchState.fire) tryAttack();

  // враги: движутся к игроку, атакуют вблизи
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    if (d > e.r + player.r + 4) {
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;
    } else {
      hp -= e.dmg * dt;
      sfxHit();
      if (hp <= 0) { hp = 0; endGame('lose', 5 - enemies.filter(x=>x.alive).length, 'HP закончилось!'); return; }
    }
  }
}

function draw() {
  // фон-пол
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // стены-рамка
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // враги (тёмно-красные с HP-баром)
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.beginPath();
    ctx.fillStyle = '#dc2626';
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.stroke();
    // HP бар
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - 18, e.y - e.r - 10, 36, 5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(e.x - 18, e.y - e.r - 10, 36 * (e.hp / e.maxHp), 5);
  }

  // игрок (зелёный круг с «оружием»)
  ctx.beginPath();
  ctx.fillStyle = '#10b981';
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 2;
  ctx.stroke();
  // оружие
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  ctx.fillStyle = '#fbbf24';
  if (attackAnim > 0) {
    ctx.fillRect(0, -8, 30, 16);
  } else {
    ctx.fillRect(0, -3, 22, 6);
  }
  ctx.restore();
  // дуга атаки
  if (attackAnim > 0) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facing);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ATTACK_RANGE, -ATTACK_ARC/2, ATTACK_ARC/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // HUD: HP/Mana/XP/Level
  hudEl.innerHTML =
    '❤️ ' + Math.ceil(hp) + '/' + maxHp +
    '  •  🔷 ' + Math.ceil(mana) +
    '  •  Ур.' + level +
    '  •  XP ' + Math.floor(xp) + '/' + (level * 100) +
    '  •  💀 ' + (5 - enemies.filter(e=>e.alive).length) + '/5';
  timerEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft)) + 'с';

  // полоска HP над игроком
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(player.x - 20, player.y - player.r - 12, 40, 5);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(player.x - 20, player.y - player.r - 12, 40 * (hp / maxHp), 5);

  drawTouchButtons();
}
` + genreFooter();
}

// ----------------------------------------------------------------
// ГОНКИ (скроллящийся road, 3 полосы)
// ----------------------------------------------------------------

function generateRacingHtml(config: PrototypeConfig): string {
  return genreShell(
    "🎮 Гонки",
    "Достигните дистанции 1000. Уклоняйтесь от препятствий, меняя полосу.",
    "Управление:\n• ←/→ или A/D — сменить полосу\n• Цель: проехать 1000 м\n• Поражение: столкновение с препятствием\n• Скорость растёт со временем\n\nНа мобильных: кнопки ◀ ▶ внизу",
    "racing"
  )
  + `
let player, obstacles, distance, speed, laneSwitchT, roadOffset, timeLeft;
const LANES = [W/2 - 130, W/2, W/2 + 130];
const LANE_W = 110;

function reset() {
  player = { lane: 1, y: H - 100, w: 50, h: 80, targetX: LANES[1] };
  obstacles = [];
  distance = 0;
  speed = 220;
  laneSwitchT = 0;
  roadOffset = 0;
  timeLeft = 90;
}
reset();

function startGame() {
  reset();
  running = true;
  startTime = performance.now();
  lastFrame = startTime;
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  obstacles.push({ lane, y: -80, w: 50, h: 80 });
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) { endGame('lose', Math.floor(distance), 'Время вышло!'); return; }
  if (distance >= 1000) { endGame('win', Math.floor(distance), 'Дистанция 1000 пройдена!'); return; }

  // ускорение со временем
  speed = 220 + Math.min(280, distance * 0.25);
  distance += speed * dt * 0.06;
  roadOffset = (roadOffset + speed * dt) % 80;

  // смена полосы
  laneSwitchT = Math.max(0, laneSwitchT - dt);
  if (laneSwitchT === 0) {
    if (keys['ArrowLeft'] || keys['KeyA'] || touchState.left) {
      if (player.lane > 0) { player.lane--; laneSwitchT = 0.15; sfxShoot(); }
    } else if (keys['ArrowRight'] || keys['KeyD'] || touchState.right) {
      if (player.lane < 2) { player.lane++; laneSwitchT = 0.15; sfxShoot(); }
    }
  }
  player.targetX = LANES[player.lane];
  player.x = player.targetX - player.w / 2;

  // спавн препятствий
  if (Math.random() < 0.018 + distance * 0.00001) spawnObstacle();
  // обновление препятствий
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.y += speed * dt;
    if (o.y > H + 50) { obstacles.splice(i, 1); continue; }
    // столкновение
    const ox = LANES[o.lane] - o.w / 2;
    if (o.lane === player.lane &&
        o.y + o.h > player.y &&
        o.y < player.y + player.h) {
      sfxHit();
      endGame('lose', Math.floor(distance), 'Столкновение!');
      return;
    }
  }
}

function draw() {
  // фон
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);
  // трава по бокам
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, W * 0.15, H);
  ctx.fillRect(W * 0.85, 0, W * 0.15, H);
  // дорога
  ctx.fillStyle = '#334155';
  ctx.fillRect(W * 0.15, 0, W * 0.7, H);
  // полосы разметки
  ctx.fillStyle = '#fbbf24';
  // боковые сплошные
  ctx.fillRect(W * 0.15 - 4, 0, 4, H);
  ctx.fillRect(W * 0.85, 0, 4, H);
  // пунктирные между полосами
  for (let i = -1; i < H / 80 + 1; i++) {
    const y = i * 80 + roadOffset;
    ctx.fillRect(W/2 - 130 - 2, y, 4, 40);
    ctx.fillRect(W/2 + 130 - 2, y, 4, 40);
  }

  // препятствия (другие машины — красные)
  for (const o of obstacles) {
    const ox = LANES[o.lane] - o.w / 2;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox, o.y, o.w, o.h);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(ox + 6, o.y + 10, o.w - 12, 20);
    ctx.fillRect(ox + 6, o.y + 50, o.w - 12, 20);
  }

  // игрок (синяя машина)
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(player.x + 6, player.y + 10, player.w - 12, 20);
  ctx.fillRect(player.x + 6, player.y + 50, player.w - 12, 20);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(player.x + 4, player.y + player.h - 6, 8, 4);
  ctx.fillRect(player.x + player.w - 12, player.y + player.h - 6, 8, 4);

  // HUD
  hudEl.innerHTML = '🏁 ' + Math.floor(distance) + ' / 1000 м';
  timerEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft)) + 'с';

  drawTouchButtons();
}
` + genreFooter();
}

// ----------------------------------------------------------------
// PUZZLE (match-3)
// ----------------------------------------------------------------

function generatePuzzleHtml(config: PrototypeConfig): string {
  return genreShell(
    "🎮 Головоломка (match-3)",
    "Наберите 100 очков за 60 секунд. Составляйте ряды из 3+ одинаковых.",
    "Управление:\n• Кликните клетку, затем соседнюю — поменять местами\n• Ряд/столбец из 3+ одинаковых цветов исчезает\n• Новые клетки падают сверху\n• Очки: 3 в ряд = 10, 4 = 25, 5+ = 50\n\nЦель: 100 очков за 60 секунд",
    "puzzle"
  )
  + `
const COLS = 6, ROWS = 6, CELL = 60;
const COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#a855f7'];
let grid, selected, score, timeLeft, swapBack, animTime;

function randCell() { return Math.floor(Math.random() * COLORS.length); }

function newGrid() {
  const g = [];
  for (let r = 0; r < ROWS; r++) {
    g.push([]);
    for (let c = 0; c < COLS; c++) g[r].push(randCell());
  }
  // избегаем готовых матчей в стартовой раскладке
  let tries = 0;
  while (findMatches(g).length > 0 && tries < 50) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g[r][c] = randCell();
    tries++;
  }
  return g;
}

function reset() {
  grid = newGrid();
  selected = null;
  score = 0;
  timeLeft = 60;
  swapBack = null;
  animTime = 0;
}
reset();

function startGame() {
  reset();
  running = true;
  startTime = performance.now();
  lastFrame = startTime;
}

function findMatches(g) {
  const matches = new Set();
  // горизонтали
  for (let r = 0; r < ROWS; r++) {
    let cnt = 1;
    for (let c = 1; c < COLS; c++) {
      if (g[r][c] !== -1 && g[r][c] === g[r][c-1]) cnt++;
      else {
        if (cnt >= 3) for (let k = 0; k < cnt; k++) matches.add(r + ',' + (c-1-k));
        cnt = 1;
      }
    }
    if (cnt >= 3) for (let k = 0; k < cnt; k++) matches.add(r + ',' + (COLS-1-k));
  }
  // вертикали
  for (let c = 0; c < COLS; c++) {
    let cnt = 1;
    for (let r = 1; r < ROWS; r++) {
      if (g[r][c] !== -1 && g[r][c] === g[r-1][c]) cnt++;
      else {
        if (cnt >= 3) for (let k = 0; k < cnt; k++) matches.add((r-1-k) + ',' + c);
        cnt = 1;
      }
    }
    if (cnt >= 3) for (let k = 0; k < cnt; k++) matches.add((ROWS-1-k) + ',' + c);
  }
  return Array.from(matches).map(s => s.split(',').map(Number));
}

function applyGravity(g) {
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (g[r][c] !== -1) {
        if (writeRow !== r) { g[writeRow][c] = g[r][c]; g[r][c] = -1; }
        writeRow--;
      }
    }
    // заполнение сверху
    for (let r = writeRow; r >= 0; r--) g[r][c] = randCell();
  }
}

function gridOffsetX() { return (W - COLS * CELL) / 2; }
function gridOffsetY() { return (H - ROWS * CELL) / 2; }

canvas.addEventListener('click', (e) => {
  if (animTime > 0) return;
  if (actx && actx.state === 'suspended') actx.resume();
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  const ox = gridOffsetX(), oy = gridOffsetY();
  const c = Math.floor((x - ox) / CELL);
  const rr = Math.floor((y - oy) / CELL);
  if (c < 0 || c >= COLS || rr < 0 || rr >= ROWS) return;
  if (!selected) {
    selected = { r: rr, c: c };
  } else {
    const dr = Math.abs(selected.r - rr), dc = Math.abs(selected.c - c);
    if (dr + dc === 1) {
      // swap
      const tmp = grid[selected.r][selected.c];
      grid[selected.r][selected.c] = grid[rr][c];
      grid[rr][c] = tmp;
      const matches = findMatches(grid);
      if (matches.length === 0) {
        // вернуть назад
        swapBack = { a: { r: selected.r, c: selected.c }, b: { r: rr, c: c } };
        animTime = 0.25;
      } else {
        animTime = 0.2;
      }
      selected = null;
    } else {
      selected = { r: rr, c: c };
    }
  }
});

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) {
    if (score >= 100) endGame('win', score, 'Набрали ' + score + ' очков!');
    else endGame('lose', score, 'Время вышло, очков: ' + score);
    return;
  }
  if (score >= 100) { endGame('win', score, '100 очков!'); return; }

  if (animTime > 0) {
    animTime -= dt;
    if (animTime <= 0) {
      // завершение анимации
      if (swapBack) {
        const tmp = grid[swapBack.a.r][swapBack.a.c];
        grid[swapBack.a.r][swapBack.a.c] = grid[swapBack.b.r][swapBack.b.c];
        grid[swapBack.b.r][swapBack.b.c] = tmp;
        swapBack = null;
      }
      // обработка матчей
      const matches = findMatches(grid);
      if (matches.length > 0) {
        // очки
        if (matches.length >= 5) score += 50;
        else if (matches.length === 4) score += 25;
        else score += 10;
        for (const [r, c] of matches) grid[r][c] = -1;
        sfxCollect();
        applyGravity(grid);
        animTime = 0.15;
      }
    }
  }
}

function draw() {
  // фон
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  const ox = gridOffsetX(), oy = gridOffsetY();
  // подложка сетки
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(ox - 6, oy - 6, COLS * CELL + 12, ROWS * CELL + 12);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = ox + c * CELL, y = oy + r * CELL;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      const v = grid[r][c];
      if (v >= 0) {
        ctx.fillStyle = COLORS[v];
        ctx.fillRect(x + 6, y + 6, CELL - 12, CELL - 12);
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, y + 6, CELL - 12, CELL - 12);
        ctx.globalAlpha = 1;
      }
      // выделение выбранной
      if (selected && selected.r === r && selected.c === c) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }

  // HUD
  hudEl.innerHTML = '⭐ ' + score + ' / 100';
  timerEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft)) + 'с';
}
` + genreFooter();
}

// ----------------------------------------------------------------
// TOWER DEFENSE
// ----------------------------------------------------------------

function generateTowerDefenseHtml(config: PrototypeConfig): string {
  return genreShell(
    "🎮 Tower Defense",
    "Выживите 5 волн. Стройте башни, чтобы остановить врагов на пути.",
    "Управление:\n• Кликните по строительной площадке (□), чтобы поставить башню (50💰)\n• Башни сами стреляют по ближайшему врагу\n• Волны: 5, в каждой всё больше врагов\n• Жизни: 10 (−1 за врага, дошедшего до конца)\n• Золото: 100 старт, +10 за убийство\n\nЦель: пережить 5 волн",
    "tower_defense"
  )
  + `
// путь: змейка слева направо
const PATH = [
  {x: 0,   y: 120},
  {x: 200, y: 120},
  {x: 200, y: 320},
  {x: 500, y: 320},
  {x: 500, y: 120},
  {x: 700, y: 120},
  {x: 700, y: 500},
  {x: 800, y: 500}
];
// строительные площадки рядом с путём
const SPOTS = [
  {x: 130, y: 220}, {x: 280, y: 220},
  {x: 130, y: 420}, {x: 280, y: 420},
  {x: 400, y: 220}, {x: 560, y: 220},
  {x: 400, y: 420}, {x: 560, y: 420},
  {x: 760, y: 220}, {x: 760, y: 420}
];
let enemies, towers, bullets, gold, lives, wave, waveT, spawnT, enemiesInWave, totalWaves, timeLeft;

function reset() {
  enemies = []; towers = []; bullets = [];
  gold = 100; lives = 10;
  wave = 1; totalWaves = 5;
  waveT = 2; spawnT = 0; enemiesInWave = 0;
  timeLeft = 180;
}
reset();

function startGame() {
  reset();
  running = true;
  startTime = performance.now();
  lastFrame = startTime;
}

canvas.addEventListener('click', (e) => {
  if (actx && actx.state === 'suspended') actx.resume();
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  for (const s of SPOTS) {
    if (towers.find(t => t.spot === s)) continue;
    if (Math.hypot(x - s.x, y - s.y) < 22) {
      if (gold >= 50) {
        gold -= 50;
        towers.push({ spot: s, x: s.x, y: s.y, range: 130, fireT: 0, dmg: 12 });
        sfxConvert();
      } else {
        sfxHit();
      }
      return;
    }
  }
});

function spawnEnemy() {
  enemies.push({ pi: 0, t: 0, hp: 30 + wave * 15, maxHp: 30 + wave * 15, speed: 60 + wave * 8, x: PATH[0].x, y: PATH[0].y });
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) { endGame('lose', 5 - wave + 1, 'Время вышло!'); return; }

  // волны
  if (wave <= totalWaves) {
    waveT -= dt;
    if (waveT <= 0) {
      spawnT -= dt;
      const targetCount = 3 + wave * 2;
      if (enemiesInWave < targetCount) {
        if (spawnT <= 0) {
          spawnT = Math.max(0.5, 1.5 - wave * 0.1);
          spawnEnemy();
          enemiesInWave++;
        }
      } else if (enemies.length === 0) {
        wave++;
        waveT = 2.5;
        enemiesInWave = 0;
        spawnT = 0;
        gold += 30; // бонус за волну
      }
    }
  } else if (lives > 0) {
    endGame('win', totalWaves, 'Все ' + totalWaves + ' волн отражены!');
    return;
  }

  if (lives <= 0) { endGame('lose', wave - 1, 'База разрушена!'); return; }

  // движение врагов по пути
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += e.speed * dt;
    // пройти до следующей точки
    while (e.pi < PATH.length - 1) {
      const a = PATH[e.pi], b = PATH[e.pi + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (e.t >= segLen) {
        e.t -= segLen;
        e.pi++;
      } else {
        const f = e.t / segLen;
        e.x = a.x + (b.x - a.x) * f;
        e.y = a.y + (b.y - a.y) * f;
        break;
      }
    }
    if (e.pi >= PATH.length - 1) {
      // дошёл до конца
      lives--;
      sfxHit();
      enemies.splice(i, 1);
    }
  }

  // башни стреляют
  for (const t of towers) {
    t.fireT -= dt;
    // ближайший к базе враг в радиусе
    let best = null, bestPi = -1;
    for (const e of enemies) {
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d <= t.range && e.pi > bestPi) { best = e; bestPi = e.pi; }
    }
    if (best && t.fireT <= 0) {
      t.fireT = 0.6;
      bullets.push({ x: t.x, y: t.y, tx: best.x, ty: best.y, target: best, speed: 400, life: 1.5, dmg: t.dmg });
      sfxShoot();
    }
  }

  // пули
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    if (!b.target || enemies.indexOf(b.target) === -1) {
      // летим к последней точке
      const dx = b.tx - b.x, dy = b.ty - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 5 || b.life <= 0) { bullets.splice(i, 1); continue; }
      b.x += dx / d * b.speed * dt;
      b.y += dy / d * b.speed * dt;
    } else {
      const dx = b.target.x - b.x, dy = b.target.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 8 || b.life <= 0) {
        b.target.hp -= b.dmg;
        sfxKill();
        if (b.target.hp <= 0) {
          const idx = enemies.indexOf(b.target);
          if (idx >= 0) enemies.splice(idx, 1);
          gold += 10;
        }
        bullets.splice(i, 1);
        continue;
      }
      b.x += dx / d * b.speed * dt;
      b.y += dy / d * b.speed * dt;
    }
  }
}

function draw() {
  // фон — трава
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, W, H);
  // текстура травы (точки)
  ctx.fillStyle = '#166534';
  for (let i = 0; i < 60; i++) {
    const x = (i * 137) % W, y = (i * 211) % H;
    ctx.fillRect(x, y, 3, 3);
  }

  // путь
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 36;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  // внутренняя часть пути
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  // старт/финиш
  ctx.fillStyle = '#10b981';
  ctx.beginPath(); ctx.arc(PATH[0].x + 10, PATH[0].y, 12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath(); ctx.arc(PATH[PATH.length-1].x - 10, PATH[PATH.length-1].y, 12, 0, Math.PI*2); ctx.fill();

  // площадки для строительства
  for (const s of SPOTS) {
    const taken = towers.find(t => t.spot === s);
    if (taken) continue;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(s.x - 16, s.y - 16, 32, 32);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(s.x - 16, s.y - 16, 32, 32);
    ctx.setLineDash([]);
  }

  // башни
  for (const t of towers) {
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2;
    ctx.stroke();
    // радиус (полупрозрачный)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.stroke();
  }

  // враги
  for (const e of enemies) {
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.stroke();
    // HP бар
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 20, 28, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(e.x - 14, e.y - 20, 28 * (e.hp / e.maxHp), 4);
  }

  // пули
  ctx.fillStyle = '#fde047';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD
  hudEl.innerHTML = '💰 ' + gold + '  •  ❤️ ' + lives + '  •  Волна ' + Math.min(wave, totalWaves) + '/' + totalWaves;
  timerEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft)) + 'с';
}
` + genreFooter();
}

// ============================================================
// Public dispatch
// ============================================================

/**
 * Карта жанр → генератор. Если у проекта задан жанр, соответствующий одному
 * из ключей, прототип строится по жанровому шаблону (реальные механики на
 * чистом Canvas). Иначе — fallback на engine/economy/ecology (LittleJS/3D).
 *
 * Жанр нормализуется: lower-case, trim, синонимы (action→shooter,
 * roguelike→rpg, strategy/rts→tower_defense, action_rpg→rpg).
 */
const GENRE_TEMPLATES: Record<string, (config: PrototypeConfig) => string> = {
  platformer: generatePlatformerHtml,
  shooter: generateShooterHtml,
  action: generateShooterHtml,
  fps: generateShooterHtml,
  rpg: generateRpgHtml,
  action_rpg: generateRpgHtml,
  arpg: generateRpgHtml,
  roguelike: generateRpgHtml,
  roguelite: generateRpgHtml,
  dungeon: generateRpgHtml,
  racing: generateRacingHtml,
  race: generateRacingHtml,
  puzzle: generatePuzzleHtml,
  match3: generatePuzzleHtml,
  "match-3": generatePuzzleHtml,
  tower_defense: generateTowerDefenseHtml,
  td: generateTowerDefenseHtml,
  strategy: generateTowerDefenseHtml,
  rts: generateTowerDefenseHtml,
};

/** Нормализовать жанр проекта (свободный текст) в ключ GENRE_TEMPLATES. */
function normalizeGenre(raw: string | undefined): string | null {
  if (!raw) return null;
  let g = raw.toLowerCase().trim();
  // удаляем пробелы/дефисы для основной нормализации
  const compact = g.replace(/[\s-]+/g, "_");
  if (GENRE_TEMPLATES[compact]) return compact;
  if (GENRE_TEMPLATES[g]) return g;
  // эвристика по подстрокам
  if (g.includes("platform")) return "platformer";
  if (g.includes("shoot") || g.includes("fps") || g.includes("action")) return "shooter";
  if (g.includes("rpg") || g.includes("rogue") || g.includes("dungeon")) return "rpg";
  if (g.includes("rac") || g.includes("driv")) return "racing";
  if (g.includes("puzzle") || g.includes("match") || g.includes("match3")) return "puzzle";
  if (g.includes("tower") || g.includes("defense") || g.includes("defence") ||
      g.includes("strateg") || g.includes("rts")) return "tower_defense";
  return null;
}

/**
 * Сгенерировать self-contained HTML прототипа кор-лупа.
 *
 * Порядок выбора шаблона:
 *  1. Если config.genre задан и соответствует жанровому шаблону —> жанровый
 *     прототип на чистом Canvas (platformer/shooter/rpg/racing/puzzle/TD).
 *  2. Иначе — fallback на engine/economy/ecology (LittleJS для 2D, Three.js для 3D).
 *
 * Встраивается в <iframe srcDoc={html}> на странице /prototypes.
 */
export function generatePrototypeHtml(config: PrototypeConfig): string {
  const genreKey = normalizeGenre(config.genre);
  if (genreKey && GENRE_TEMPLATES[genreKey]) {
    return GENRE_TEMPLATES[genreKey](config);
  }
  return config.mode === "3d"
    ? generate3dHtml(config)
    : generate2dHtml(config);
}
