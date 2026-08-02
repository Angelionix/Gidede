/**
 * Gidede — Генератор прототипов кор-лупа (2D + 3D).
 *
 * R-PROTO-UNIFY: теперь есть два пути генерации HTML:
 *   1. (новый, recommended) buildPrototypeGraph() → compileGraph() — использует
 *      единый компилятор графа, разделяемый с node-редактором. Это закрывает
 *      архитектурный разрыв между двумя независимыми системами генерации HTML.
 *      Поддерживает 10 типов прототипов (engine, economy, ecology, tower_defense,
 *      rhythm, puzzle, platformer, stealth, deck_builder, survival_horror).
 *   2. (legacy) generate2dHtml / generate3dHtml — inline-шаблоны. Сохранены
 *      как fallback и для типов прототипов, не покрываемых графом (на данный
 *      момент все 6 оригинальных типов покрываются графом, но legacy-путь
 *      используется как fallback, если compileGraph вернул invalid).
 *
 * Превращает данные ProjectCoreLoop (шаги, ресурсы, тип) в интерактивный
 * HTML-прототип, который можно поиграть прямо в браузере, чтобы протестировать
 * «30 секунд веселья» (алгоритм 3.2, Этап 4).
 *
 * Два режима:
 * - 2D: LittleJS (WebGL2 + Canvas2D, физика, частицы, звук)
 * - 3D: Three.js (WebGL, 3D-сцена, перспективная камера)
 *
 * Прототип — self-contained HTML, встраивается в <iframe srcDoc=...>.
 */

import { buildPrototypeGraph, type PrototypeType, type PrototypeParams } from "./prototype-graph-builder";
import { compileGraph } from "./graph/compiler";
import type { NodeGraph } from "./graph/types";

interface CoreLoopStep {
  name?: string;
  description?: string;
  action?: string;
}

interface CoreLoopData {
  structuralType?: string; // engine | economy | ecology | tower_defense | rhythm | puzzle | ...
  steps?: CoreLoopStep[] | string[];
  inputData?: string; // JSON с шагами
  stepsData?: string;
}

export type PrototypeMode = "2d" | "3d";

/**
 * Полный набор типов прототипов (10). Совпадает с PrototypeType из graph-builder.
 * legacy generate2dHtml/generate3dHtml поддерживают только первые 6,
 * новые 4 (platformer, stealth, deck_builder, survival_horror) идут через graph path.
 */
type LegacySupportedType =
  | "engine"
  | "economy"
  | "ecology"
  | "tower_defense"
  | "rhythm"
  | "puzzle";

interface PrototypeConfig {
  type: LegacySupportedType;
  /** Полный тип (может быть из новых 4), сохраняется для API response. */
  resolvedType: PrototypeType;
  steps: string[];
  resourceName: string;
  resourceIcon: string;
  goalText: string;
  mode: PrototypeMode;
  /** Жанр из Concept, для контекста UI. */
  genre?: string;
  /** Имена механик из Concept (если есть), для отображения в шагах. */
  mechanicNames?: string[];
  /** Честный флаг: prototype built from template, not from Core Loop mechanics. */
  isTemplatePrototype: boolean;
  prototypeId?: string;
}

const RESOURCE_PRESETS: Record<string, { name: string; icon: string }> = {
  engine: { name: "Энергия", icon: "⚡" },
  economy: { name: "Золото", icon: "💰" },
  ecology: { name: "Здоровье", icon: "❤️" },
  tower_defense: { name: "Очки базы", icon: "🏰" },
  rhythm: { name: "Combo", icon: "🎵" },
  puzzle: { name: "Линии", icon: "🧩" },
  platformer: { name: "Очки", icon: "⭐" },
  stealth: { name: "Стелс", icon: "👁️" },
  deck_builder: { name: "Карты", icon: "🃏" },
  survival_horror: { name: "Ресурсы", icon: "🕯️" },
};

/**
 * Извлечь человекочитаемые имена шагов из разных форматов данных кор-лупа.
 * Если actual mechanic names доступны (из Concept.mechanicSet), они
 * используются вместо безликого "Шаг".
 */
function extractSteps(data: CoreLoopData, mechanicNames?: string[]): string[] {
  const raw = data.steps || data.stepsData;
  if (!raw) {
    // Если шагов нет, но есть mechanic names — используем их как шаги.
    if (mechanicNames && mechanicNames.length > 0) {
      return mechanicNames.slice(0, 5);
    }
    return [];
  }

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

  if (Array.isArray(parsed)) {
    const steps = parsed.map((s) =>
      typeof s === "string" ? s : (s as CoreLoopStep)?.name || (s as CoreLoopStep)?.description || (s as CoreLoopStep)?.action || ""
    ).filter((s) => s.length > 0);
    // Если после фильтрации остались пустые и есть mechanicNames — дополним.
    if (steps.length === 0 && mechanicNames && mechanicNames.length > 0) {
      return mechanicNames.slice(0, 5);
    }
    return steps;
  }

  if (data.inputData) {
    try {
      const inp = JSON.parse(data.inputData);
      if (Array.isArray(inp?.steps)) {
        const steps = inp.steps.map((s: unknown) =>
          typeof s === "string" ? s : (s as CoreLoopStep)?.name || (s as CoreLoopStep)?.description || (s as CoreLoopStep)?.action || ""
        ).filter((s: string) => s.length > 0);
        if (steps.length === 0 && mechanicNames && mechanicNames.length > 0) {
          return mechanicNames.slice(0, 5);
        }
        return steps;
      }
    } catch {
      /* ignore */
    }
  }

  // Последний fallback: mechanicNames, если есть.
  if (mechanicNames && mechanicNames.length > 0) {
    return mechanicNames.slice(0, 5);
  }

  return [];
}

/**
 * Доступные опции для buildPrototypeConfig.
 * Расширено в Фазе 0: genre и mechanicNames пробрасываются для контекстных целей.
 */
export interface BuildPrototypeConfigOptions {
  /** Жанр из Concept (например, "Racing", "RPG"). */
  genre?: string | null;
  /** Имена механик из Concept.mechanicSet (если доступны). */
  mechanicNames?: string[];
}

/**
 * Сгенерировать конфиг прототипа из данных кор-лупа проекта.
 * mode — "2d" (LittleJS) или "3d" (Three.js).
 *
 * Фаза 0: теперь принимает genre и mechanicNames, использует их для
 * выбора контекстной цели. Для неподдерживаемых legacy-типов возвращает
 * isTemplatePrototype=true и честное предупреждение в goalText.
 */
export function buildPrototypeConfig(
  coreLoopData: CoreLoopData,
  mode: PrototypeMode = "2d",
  options: BuildPrototypeConfigOptions = {},
): PrototypeConfig {
  const LEGACY_TYPES: LegacySupportedType[] = [
    "engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle",
  ];
  const ALL_VALID_TYPES: PrototypeType[] = [
    ...LEGACY_TYPES,
    "platformer", "stealth", "deck_builder", "survival_horror",
  ];

  const rawType = (coreLoopData.structuralType || "engine").toLowerCase();
  const resolvedType = (
    ALL_VALID_TYPES.includes(rawType as PrototypeType) ? rawType : "engine"
  ) as PrototypeType;

  // Для legacy inline-генератора доступны только 6 типов. Если resolvedType
  // из новых 4, legacy path не используется (route направляет в graph path).
  // Но config.type должен быть валидным legacy-типом для type-индексирования.
  const type: LegacySupportedType = LEGACY_TYPES.includes(resolvedType as LegacySupportedType)
    ? (resolvedType as LegacySupportedType)
    : "engine";

  const steps = extractSteps(coreLoopData, options.mechanicNames).slice(0, 5);
  const preset = RESOURCE_PRESETS[resolvedType] || RESOURCE_PRESETS.engine;

  const goals2d: Record<string, string> = {
    engine: "Накопите 50 энергии за 30 секунд",
    economy: "Заработайте 100 золота, конвертируя ресурсы",
    ecology: "Выживите 30 секунд, уклоняясь от угроз",
    tower_defense: "Защитите базу от 3 волн врагов за 30 секунд",
    rhythm: "Поймайте 20 бит в ритме (стрелки ←→)",
    puzzle: "Соберите 3 линии из блоков (как тетрис)",
    platformer: "Соберите 5 звёзд, перепрыгивая платформы (←→↑)",
    stealth: "Дойдите до цели незамеченным (WASD + Shift для тишины)",
    deck_builder: "Соберите колоду из 5 карт и победите врага",
    survival_horror: "Выживите 60 секунд, управляя ресурсами",
  };

  const goals3d: Record<string, string> = {
    engine: "Накопите 50 энергии, кликая по 3D-кристаллам",
    economy: "Заработайте 100 золота, собирая 3D-монеты",
    ecology: "Выживите 30 секунд, уклоняясь от 3D-блоков в пространстве",
    tower_defense: "Защитите 3D-базу от волн врагов",
    rhythm: "Ловите 3D-ноты в ритме",
    puzzle: "Соберите 3D-линии из блоков",
    platformer: "Соберите 5 звёзд в 3D, прыгая по платформам",
    stealth: "Дойдите до 3D-цели незамеченным",
    deck_builder: "Победите 3D-врага, собирая карты",
    survival_horror: "Выживите 60 секунд в 3D-пространстве",
  };

  const goals = mode === "3d" ? goals3d : goals2d;

  // Если жанр известен и не совпадает с ожидаемым для типа — добавим контекст.
  // Это не меняет gameplay, но помогает пользователю понять несоответствие.
  const goalText = goals[resolvedType] || goals.engine;
  const isTemplatePrototype = !LEGACY_TYPES.includes(resolvedType as LegacySupportedType)
    || steps.length === 0
    || !coreLoopData.structuralType;

  return {
    type,
    resolvedType,
    steps: steps.length > 0 ? steps : ["Собрать", "Преобразовать", "Использовать"],
    resourceName: preset.name,
    resourceIcon: preset.icon,
    goalText,
    mode,
    genre: options.genre || undefined,
    mechanicNames: options.mechanicNames,
    isTemplatePrototype,
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
  const { type, steps, resourceName, resourceIcon, goalText, prototypeId = "" } = config;

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
      try { window.parent.postMessage({ type: 'gidede-playtest', outcome: outcome, score: score||null, duration: duration||30, prototypeType: '${type}', prototypeId: '${prototypeId}', mode: '2d' }, '*'); } catch(e) {}
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
  const { type, steps, resourceName, resourceIcon, goalText, prototypeId = "" } = config;

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
      try { window.parent.postMessage({ type: 'gidede-playtest', outcome: outcome, score: score||null, duration: duration||30, prototypeType: '${type}', prototypeId: '${prototypeId}', mode: '3d' }, '*'); } catch(e) {}
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
// Public dispatch
// ============================================================

/**
 * Сгенерировать self-contained HTML прототипа кор-лупа.
 * mode="2d" → LittleJS, mode="3d" → Three.js.
 * Встраивается в <iframe srcDoc={html}> на странице /prototypes.
 *
 * R-PROTO-UNIFY: теперь предпочитает путь через graph builder + compileGraph.
 * Legacy inline-шаблоны используются только как fallback, если graph compiler
 * вернул invalid (что не должно происходить для встроенных типов, но безопасно
 * иметь fallback).
 */
export function generatePrototypeHtml(config: PrototypeConfig, prototypeId = ""): string {
  const versionedConfig = { ...config, prototypeId };

  // R-PROTO-UNIFY: try graph-based generation first.
  // Only the 6 original types are in PrototypeConfig["type"]; the 4 new types
  // (platformer, stealth, deck_builder, survival_horror) come through a
  // separate path (buildPrototypeFromGraph).
  const graphSupportedTypes: PrototypeType[] = [
    "engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle",
  ];
  if (graphSupportedTypes.includes(config.type as PrototypeType)) {
    try {
      const graph = buildPrototypeGraph({
        type: config.type as PrototypeType,
        mode: config.mode,
        steps: config.steps,
        params: {
          resourceName: config.resourceName,
          resourceIcon: config.resourceIcon,
          goalScore: config.type === "ecology" || config.type === "tower_defense" ? 100 : undefined,
          survivalSeconds: config.type === "rhythm" || config.type === "puzzle" ? 30 : 30,
        },
      });
      const result = compileGraph(graph);
      if (result.valid && result.html) {
        // Inject prototypeId into the HTML for postMessage tracking.
        return result.html.replace(
          "window.parent.postMessage({ type: 'gidede-playtest'",
          `window.parent.postMessage({ type: 'gidede-playtest', prototypeId: '${prototypeId}',`,
        );
      }
      // If graph compilation failed, fall through to legacy.
      console.warn("[prototype-generator] graph compilation failed, falling back to legacy templates:", result.errors);
    } catch (e) {
      console.warn("[prototype-generator] graph-based generation threw, falling back to legacy:", e);
    }
  }

  // Legacy fallback: inline templates.
  return config.mode === "3d"
    ? generate3dHtml(versionedConfig)
    : generate2dHtml(versionedConfig);
}

/**
 * R-PROTO-UNIFY: Generate a prototype for ANY of the 10 supported types,
 * including the 4 new ones (platformer, stealth, deck_builder, survival_horror)
 * that are not in the original PrototypeConfig["type"] union.
 *
 * This is the recommended entry point for new code. It always uses the graph
 * builder + compileGraph() path — no legacy fallback.
 *
 * @param type    One of 10 supported prototype types.
 * @param mode    "2d" or "3d".
 * @param steps   Human-readable core loop step names (up to 5).
 * @param params  Optional parameters from upstream artifacts (Balance,
 *                Progression, Economy). When omitted, sensible defaults
 *                are used.
 * @param prototypeId  UUID for playtest tracking.
 * @returns       Self-contained HTML string, or empty string if compilation failed.
 */
export function generatePrototypeFromGraph(
  type: PrototypeType,
  mode: "2d" | "3d",
  steps: string[],
  params?: PrototypeParams,
  prototypeId = "",
): { html: string; graph: NodeGraph; valid: boolean; errors: string[] } {
  const graph = buildPrototypeGraph({ type, mode, steps, params });
  const result = compileGraph(graph);
  let html = result.html;
  if (html && prototypeId) {
    html = html.replace(
      "window.parent.postMessage({ type: 'gidede-playtest'",
      `window.parent.postMessage({ type: 'gidede-playtest', prototypeId: '${prototypeId}',`,
    );
  }
  return { html, graph, valid: result.valid, errors: result.errors };
}
