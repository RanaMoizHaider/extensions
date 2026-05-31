const STORAGE_KEY = "stopwatch.state";

function defaultState() {
  return { running: false, startedAt: 0, accumulatedMs: 0 };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    return {
      running: !!s.running,
      startedAt: Number(s.startedAt) || 0,
      accumulatedMs: Number(s.accumulatedMs) || 0,
    };
  } catch (e) {
    return defaultState();
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) {
    // Persistence is best-effort: private-mode or quota errors must not
    // interrupt the start/stop/restart handlers.
    console.warn("stopwatch: failed to persist state", e);
  }
}

let state = loadState();

function elapsedMs() {
  const base = state.accumulatedMs;
  return state.running ? base + (Date.now() - state.startedAt) : base;
}

// Format ms as HH:MM:SS.
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hrs = Math.floor(totalMin / 60);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(hrs)}:${p2(min)}:${p2(sec)}`;
}

const displayEl = document.getElementById("display");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const restartBtn = document.getElementById("restart");

let tickHandle = null;

function renderDisplay() {
  displayEl.textContent = formatTime(elapsedMs());
}

function renderButtons() {
  startBtn.disabled = state.running;
  startBtn.classList.toggle("primary", !state.running);
  stopBtn.disabled = !state.running;
}

function startTicking() {
  if (tickHandle !== null) return;
  tickHandle = setInterval(renderDisplay, 250);
}

function stopTicking() {
  if (tickHandle === null) return;
  clearInterval(tickHandle);
  tickHandle = null;
}

function render() {
  renderDisplay();
  renderButtons();
}

function start() {
  if (state.running) return;
  state.startedAt = Date.now();
  state.running = true;
  saveState(state);
  render();
  startTicking();
}

function stop() {
  if (!state.running) return;
  state.accumulatedMs += Date.now() - state.startedAt;
  state.running = false;
  saveState(state);
  stopTicking();
  render();
}

function restart() {
  state.accumulatedMs = 0;
  state.startedAt = Date.now();
  state.running = true;
  saveState(state);
  render();
  startTicking();
}

startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);
restartBtn.addEventListener("click", restart);

render();
if (state.running) startTicking();

window.addEventListener("load", () => {
  if (window.muxy && muxy.popover && muxy.popover.resize) {
    muxy.popover.resize(
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight
    );
  }
});
