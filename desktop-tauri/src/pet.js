// Desktop pet window renderer - transparent, draggable.
const DSH_BASE = 'http://127.0.0.1:3080';
const CONFIG_URL = `${DSH_BASE}/kanye-pet/config`;
const ASSETS = `${DSH_BASE}/kanye-pet/assets`;
const MANIFEST_URL = `${ASSETS}/manifest.json`;
const POLL_MS = 2000;

const pet = document.getElementById('pet');

let manifest = null;
let manifestReady = false;
let characterId = 'kanye';
let animState = null;
let frame = 0;
let frameDir = 1;
let lastFrameAt = 0;
let currentConfig = { enabled: true, size: 200, character: 'kanye', opacity: 1 };
let dragging = false;

// ---- Drag handler (manual set_position, no Windows Snap) ----
// 不用 Tauri start_dragging（触 Windows Aero Snap），改用 pointer events +
// set_position 手动移窗。程序化 SetWindowPos 不触发 Snap。
// 权限: core:window:allow-set-position / allow-outer-position
let winX = 0, winY = 0;         // 当前窗口位置（逻辑像素，本地追踪）
let dragState = null;            // { offsetX, offsetY } 拖拽中鼠标相对窗口偏移
let dragRafId = null;            // requestAnimationFrame id（节流 set_position）
let pendingPos = null;           // { x, y } 等待 flush 的位置

// 启动时同步窗口位置（窗口状态插件可能已恢复上次位置）
async function queryPosition() {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== 'function') return;
  try {
    const pos = await invoke('plugin:window|outer_position');
    const p = pos?.value ?? pos ?? {};
    winX = Number(p.x) ?? 0;
    winY = Number(p.y) ?? 0;
  } catch (e) {
    console.warn('[pet] query outer_position failed:', e);
  }
}

// RAF 节流：只发最后一帧位置，避免 IPC 风暴
function scheduleSetPosition(x, y) {
  pendingPos = { x: Math.round(x), y: Math.round(y) };
  if (!dragRafId) {
    dragRafId = requestAnimationFrame(() => {
      dragRafId = null;
      if (!pendingPos) return;
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (typeof invoke !== 'function') return;
      invoke('plugin:window|set_position', {
        value: { Logical: { x: pendingPos.x, y: pendingPos.y } },
      }).catch(() => {});
      pendingPos = null;
    });
  }
}

function handlePointerDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  // 记录鼠标相对窗口偏移（screenX/Y 逻辑像素）
  dragState = {
    offsetX: e.screenX - winX,
    offsetY: e.screenY - winY,
  };
  dragging = true;
  pet.style.cursor = 'grabbing';
  pet.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
  if (!dragState) return;
  const newX = e.screenX - dragState.offsetX;
  const newY = e.screenY - dragState.offsetY;
  winX = newX;
  winY = newY;
  scheduleSetPosition(newX, newY);
}

function handlePointerUp(e) {
  if (!dragState) return;
  // 刷掉最后挂起的位置
  if (dragRafId) {
    cancelAnimationFrame(dragRafId);
    dragRafId = null;
  }
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke === 'function' && pendingPos) {
    invoke('plugin:window|set_position', {
      value: { Logical: { x: pendingPos.x, y: pendingPos.y } },
    }).catch(() => {});
    pendingPos = null;
  }
  dragState = null;
  dragging = false;
  pet.style.cursor = 'grab';
}

function setupDrag() {
  // pointerdown → capture → pointermove/up（setPointerCapture 保证移出元素仍收事件）
  pet.addEventListener('pointerdown', handlePointerDown);
  pet.addEventListener('pointermove', handlePointerMove);
  pet.addEventListener('pointerup', handlePointerUp);
  pet.addEventListener('pointercancel', handlePointerUp);
}

// ---- Config ----
// enabled: 控制 Web GUI 内浮宠（浏览器 client half）
// desktopPetEnabled: 控制 Tauri 桌面窗口宠物（本文件）
async function applyConfig(config) {
  currentConfig = { ...currentConfig, ...config };
  const show = config.desktopPetEnabled !== false;
  document.body.style.opacity = show ? String(config.opacity ?? 1) : '0';
  document.body.style.pointerEvents = show ? 'auto' : 'none';
  // 尺寸变更：resize Tauri 窗口（上限 600）
  const newSize = Math.min(600, Number(config.size));
  if (Number.isFinite(newSize) && newSize > 0) {
    const winSize = Math.round(newSize * 1.02);
    const invoke = window.__TAURI_INTERNALS__?.invoke;
    if (invoke) {
      try {
        await invoke('plugin:window|set_size', {
          value: { Logical: { width: winSize, height: winSize } },
        });
      } catch (e) {
        console.warn('[pet] resize failed:', e);
      }
    }
  }
}

// ---- Asset loading ----
async function loadSheet(sheet) {
  try {
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = `${ASSETS}/characters/${characterId}/${sheet}`;
    });
  } catch {}
}

async function switchCharacter(nextId) {
  if (nextId === characterId) return;
  characterId = nextId;
  animState = null;
  frame = 0;
}

function resolveCharacterFromConfig(config) {
  const fallback = manifest?.default || 'kanye';
  const id = config?.character && manifest?.characters?.[config.character]
    ? config.character
    : fallback;
  if (id !== characterId) void switchCharacter(id);
}

async function loadManifest() {
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) return;
    manifest = await res.json();
    manifestReady = true;
    resolveCharacterFromConfig(currentConfig);
  } catch {}
}

// ---- Rendering ----
function showState(name) {
  const character = manifest?.characters?.[characterId];
  const set = character?.states?.[name];
  if (!set) return;
  void loadSheet(set.sheet);
  pet.style.backgroundImage = `url("${ASSETS}/characters/${characterId}/${set.sheet}")`;
  pet.style.backgroundSize = `${set.frames * 100}% 100%`;
  applyFrame(set.frames);
}

function applyFrame(frames) {
  if (frames <= 1) {
    pet.style.backgroundPosition = '0 0';
  } else {
    const pct = (frame / (frames - 1)) * 100;
    pet.style.backgroundPosition = `${pct}% 0`;
  }
}

function tick() {
  if (!manifest || !currentConfig.enabled || dragging) return;
  if (currentConfig.desktopPetEnabled === false) return;
  const character = manifest.characters?.[characterId];
  if (!character) return;
  const state = animState || 'idle';
  if (animState === null) {
    animState = state;
    frame = 0;
    frameDir = 1;
    lastFrameAt = 0;
    showState(state);
    return;
  }
  const set = character.states?.[state];
  if (!set || set.frames <= 1) return;
  const now = Date.now();
  if (now - lastFrameAt < 1000 / set.fps) return;
  lastFrameAt = now;
  frame += frameDir;
  if (set.playback === 'pingpong') {
    if (frame >= set.frames - 1 || frame <= 0) frameDir *= -1;
    frame = Math.max(0, Math.min(set.frames - 1, frame));
  } else if (frame >= set.frames) {
    frame = set.playback === 'once' ? set.frames - 1 : 0;
  }
  applyFrame(set.frames);
}

// ---- Config polling ----
// 响应格式: { config: { enabled, desktopPetEnabled, size, opacity, character, ... }, revision }
async function pollConfig() {
  try {
    const res = await fetch(CONFIG_URL);
    if (!res.ok) return;
    const body = await res.json();
    const config = body?.config ?? body;
    applyConfig(config);
    if (manifestReady) resolveCharacterFromConfig(config);
  } catch {}
}

// ---- Init ----
setupDrag();
void queryPosition();
void loadManifest();
void pollConfig();
setInterval(() => void pollConfig(), POLL_MS);
setInterval(tick, 200);
