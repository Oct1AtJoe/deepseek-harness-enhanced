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

// ---- Drag handler ----
// Tauri 2 IPC: __TAURI_INTERNALS__.invoke('plugin:window|start_dragging')
// 权限: core:window:allow-start-dragging（capabilities/default.json）
// 拖拽期间设 dragging=true 暂停帧动画，避免视觉抖动。
async function startDrag() {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== 'function') return;
  dragging = true;
  pet.style.cursor = 'grabbing';
  try {
    await invoke('plugin:window|start_dragging');
  } catch (e) {
    console.warn('[pet] start_dragging failed:', e);
  }
  dragging = false;
  pet.style.cursor = 'grab';
}

function setupDrag() {
  pet.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void startDrag();
  });
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
void loadManifest();
void pollConfig();
setInterval(() => void pollConfig(), POLL_MS);
setInterval(tick, 200);
