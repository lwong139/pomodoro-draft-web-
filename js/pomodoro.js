// --- Minimal Pomodoro controller with state-driven animation ---
const app = document.getElementById('app');
const timeEl = document.getElementById('time');
const statePill = document.getElementById('statePill');
const startPauseBtn = document.getElementById('startPause');
const resetBtn = document.getElementById('reset');
const toggleBtn = document.getElementById('toggleMode');
const focusLen = document.getElementById('focusLen');
const breakLen = document.getElementById('breakLen');
const longBreakLen = document.getElementById('longBreakLen');

let state = 'focus'; // 'focus' | 'break'
let breakType = 'short'; // 'short' | 'long' (when state === 'break')
let sessionCount = 0; // completed focus sessions
let running = false;
let remaining = (+focusLen.value) * 60; // seconds
let tickHandle = null;

function fmt(s) {
  const m = Math.floor(s/60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function render() {
  timeEl.textContent = fmt(remaining);
  statePill.textContent = state === 'focus' ? 'Focus' : 'Break';
  document.title = `${fmt(remaining)} · ${state === 'focus' ? 'Focus' : 'Break'} · Pomodoro`;
  // Update visual theme
  app.classList.toggle('is-break', state === 'break');
  // Animation pause state
  app.classList.toggle('paused', !running);
  startPauseBtn.textContent = running ? 'Pause' : 'Start';
  toggleBtn.textContent = state === 'focus' ? 'Break' : 'Focus';
}

function start() {
  if (running) return;
  running = true;
  tickHandle = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      // Transition: short break after focus; long break every 4th focus
      if (state === 'focus') {
        sessionCount += 1;
        state = 'break';
        breakType = (sessionCount % 4 === 0) ? 'long' : 'short';
        const lenMin = breakType === 'long' ? (+ (longBreakLen ? longBreakLen.value : breakLen.value)) : +breakLen.value;
        remaining = lenMin * 60;
      } else {
        state = 'focus';
        remaining = (+focusLen.value) * 60;
      }
    }
    render();
  }, 1000);
  render();
}

function pause() {
  running = false;
  clearInterval(tickHandle);
  render();
}

function reset() {
  if (state === 'focus') {
    remaining = (+focusLen.value) * 60;
  } else {
    const lenMin = breakType === 'long' ? (+ (longBreakLen ? longBreakLen.value : breakLen.value)) : +breakLen.value;
    remaining = lenMin * 60;
  }
  render();
}

function toggleMode() {
  if (state === 'focus') {
    breakType = ((sessionCount + 1) % 4 === 0) ? 'long' : 'short';
    state = 'break';
    const lenMin = breakType === 'long' ? (+ (longBreakLen ? longBreakLen.value : breakLen.value)) : +breakLen.value;
    remaining = lenMin * 60;
  } else {
    state = 'focus';
    remaining = (+focusLen.value) * 60;
  }
  render();
}

// Wire up controls
startPauseBtn.addEventListener('click', () => running ? pause() : start());
resetBtn.addEventListener('click', reset);
toggleBtn.addEventListener('click', toggleMode);
focusLen.addEventListener('change', () => { if (state==='focus' && !running) reset(); });
breakLen.addEventListener('change', () => { if (state==='break' && !running) reset(); });
if (longBreakLen) {
  longBreakLen.addEventListener('change', () => { if (state==='break' && breakType==='long' && !running) reset(); });
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); running ? pause() : start(); }
  if (e.key.toLowerCase() === 'r') { reset(); }
  if (e.key.toLowerCase() === 'b') { toggleMode(); }
});

// Initial render
render();
