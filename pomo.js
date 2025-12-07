// Browser build: remove dev-only Electron reload import

//default timer
const timer = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakIntervals: 4,
  sessions:0,
  autoLoop: false
};
let soundEnabled = true;

// Shared token helpers (persisted in localStorage)
function getTokens(def = 10){
  try{
    const v = parseInt(localStorage.getItem('tokens'), 10);
    return Number.isFinite(v) ? Math.max(0, v) : def;
  }catch(_){ return def; }
}
function setTokens(n){
  const v = Math.max(0, parseInt(n,10)||0);
  try{ localStorage.setItem('tokens', String(v)); }catch(_){/* no-op */}
  // Update any token chip counters (there may be multiple in DOM)
  try{
    const els = document.querySelectorAll('.token-chip-count, #tokenCount');
    els.forEach(e => e.textContent = v);
  }catch(_){/* no-op */}
  try{ const sa = document.getElementById('spinAllCount'); if (sa) sa.textContent = v; }catch(_){}
  try{ const ti = document.getElementById('tokensInline'); if (ti) ti.textContent = `tokens: ${v}`; }catch(_){}
  try{ updateProgressTokenCounter(); }catch(_){}
  return v;
}
function addTokens(delta = 1){
  const cur = getTokens(10);
  const next = setTokens(cur + delta);
  try{ if (typeof showTokenFloater === 'function' && delta > 0) showTokenFloater(`+${delta}`); }catch(_){/* optional */}
  return next;
}

// Show tokens next to the session counter (e.g., "0/4 �?� tokens: 10")
function updateProgressTokenCounter(){
  try{
    const wrap = document.querySelector('#timer-screen .progress-text');
    if (!wrap) return;
    let t = document.getElementById('progressTokens');
    if (!t){
      t = document.createElement('span');
      t.id = 'progressTokens';
      t.style.marginLeft = '10px';
      t.style.color = '#6b705c';
      wrap.appendChild(t);
    }
    const value = getTokens(10);
    t.textContent = `�?� tokens: ${value}`;
  }catch(_){/* no-op */}
}

// Initialize inline tokens label on load
document.addEventListener('DOMContentLoaded', () => {
  try{
    const ti = document.getElementById('tokensInline');
    if (ti) ti.textContent = `tokens: ${getTokens(10)}`;
  }catch(_){/* no-op */}
  // Sync any token chip counters on initial load
  try{
    const v = getTokens(10);
    const els = document.querySelectorAll('.token-chip-count, #tokenCount');
    els.forEach(e => e.textContent = v);
  }catch(_){/* no-op */}
});

// Also attempt immediate sync in case DOMContentLoaded already fired
try{
  const _ti = document.getElementById('tokensInline');
  if (_ti) _ti.textContent = `tokens: ${getTokens(10)}`;
}catch(_){/* no-op */}
window.toggleSound = function () {
soundEnabled = !soundEnabled;
const btn = document.getElementById('soundBtn');
if (!btn) return;
btn.textContent = soundEnabled ? '�Y"S' : '�Y"�';
btn.setAttribute('aria-label', soundEnabled ? 'Sound on' : 'Sound muted');
btn.classList.toggle('is-muted', !soundEnabled);
};

//load timer settings from local storage
const savedSettings = JSON.parse(localStorage.getItem('timer'));
if (savedSettings) Object.assign(timer, savedSettings);
console.log(savedSettings);


//menu controls + / - buttons
function makeTimerControl(options) {
  const {
    minusSelector,
    plusSelector,
    displaySelector,
    initial = 25,
    step = 5,
    min = 1,
    max = 180
  } = options;

  const minusButton = document.querySelector(minusSelector);
  const plusButton = document.querySelector(plusSelector);
  const display = document.querySelector(displaySelector);

  let minutes = initial;

  

  function render() {
    display.textContent = minutes.toString().padStart(2, "0");
  }

  plusButton.addEventListener("click", () => {
    if (minutes < max) {
      minutes += step;
      render();
    }
  });

  minusButton.addEventListener("click", () => {
    if (minutes > min) {
      minutes -= step;
      render();
    }
  });

  // draw first time
  render();

  // return so you can read/update later if needed
  return {
    getMinutes: () => minutes,
    setMinutes: (value) => {
      minutes = Math.min(max, Math.max(min, value));
      render();
    },
  };
}

// for each timer
const focusControl = makeTimerControl({
  minusSelector: ".focus-button-minus",
  plusSelector: ".focus-button-plus",
  displaySelector: "#js-minutes",
  initial: timer.focus,
  step: 5,
  min: 5,
  max: 180,
});

const breakControl = makeTimerControl({
  minusSelector: ".break-button-minus",
  plusSelector: ".break-button-plus",
  displaySelector: "#js-break-minutes",
  initial: timer.shortBreak,
  step: 1,
  min: 1,
  max: 60,
});

const longBreakControl = makeTimerControl({
  minusSelector: ".js-long-break-button-minus",
  plusSelector: ".js-long-break-button-plus",
  displaySelector: "#js-long-break-minutes",
  initial: timer.longBreak,
  step: 5,
  min: 5,
  max: 180,
});

//sessions DOM + validation code
const sessionsInput = document.querySelector('.sessions');

//session validation
function enforceMinMax(el) {
  if (el.value != "") {
    if (parseInt(el.value) < parseInt(el.min)) {
      el.value = el.min;
    }
    if (parseInt(el.value) > parseInt(el.max)) {
      el.value = el.max;
    }
  }
}

//autoloop dom
const autoLoopCheckBox = document.querySelector('.switch input');

//pressing okey

const okButton = document.querySelector('.js-okey-button');
if (okButton) okButton.addEventListener('click', ()=>{
  timer.focus = focusControl.getMinutes();
  timer.shortBreak = breakControl.getMinutes();
  timer.longBreak = longBreakControl.getMinutes();
  timer.longBreakIntervals = Number(sessionsInput.value);
  timer.autoLoop = autoLoopCheckBox.checked;;
  timer.sessions = 0;
  localStorage.setItem('timer', JSON.stringify(timer));
  if (window.d3SetTotalSessions) window.d3SetTotalSessions(timer.longBreakIntervals);
  if (window.d3ResetProgress) window.d3ResetProgress();
  setTimerToFocus();
  showScreen('timer');
});

const screens  = {
  menu: document.getElementById('menu-screen'),
  timer: document.getElementById('timer-screen')
  //settings menu maybe if I ever wanted to add it, if I want to call menu then it would just be showScreen('menu')
};

function showScreen(which) {
  // object.value takes an object and  returns an array containing all of its property values ignoring the keys
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[which].classList.add('active');

  // a11y: hide non-active from SR/Tab -> this is accessibility screen reader and keyboard stuff
  Object.entries(screens).forEach(([name, el]) => {
    const active = name === which;
    el.setAttribute('aria-hidden', String(!active));
    el.querySelectorAll('button, [href], input, select, textarea')
      .forEach(node => node.tabIndex = active ? 0 : -1);
  });
}

// setting focus time to switched screen
const timerMinEl = document.getElementById('js-timer-min-final');
const timerSecEl = document.getElementById('js-timer-sec-final');
const two = n => String(n).padStart(2, '0');

function setTimerToFocus() {
  const minutes = focusControl.getMinutes();     
  timerMinEl.textContent = two(minutes);
  timerSecEl.textContent = '00';
  // if you track remainingSeconds, also update it here:
  // state.remainingSeconds = minutes * 60;
  // if I have a menu state then I need to getMinutes instead?
}

const modeButtons = document.querySelector('#js-mode-buttons');
modeButtons.addEventListener('click', handleMode);

// Show awake/sleeping coco based on current mode
function updateCocoPose(mode) {
  try {
    const awake = document.querySelector('.coco-spritesheet');
    const sleep = document.querySelector('.coco-sleeping-spritesheet');
    const gamble = document.querySelector('.coco-gambling-spritesheet, .coco-gambling');
    const arrow = document.getElementById('enterCasinoArrow');
    if (!awake || !sleep) return;
    const isFocus = mode === 'focus';
    // Class-based fade
    const isLong  = mode === 'longBreak';
    const isShort = mode === 'shortBreak';
    // Class-based fade for three poses
    awake.classList.toggle('visible', isFocus);
    sleep.classList.toggle('visible', !isFocus);
    sleep.classList.toggle('visible', isShort);
    if (gamble) gamble.classList.toggle('visible', isLong);
    // Inline safety to override any conflicting CSS
    awake.style.opacity = isFocus ? '1' : '0';
    sleep.style.opacity = isFocus ? '0' : '1';
    sleep.style.opacity = isShort ? '1' : '0';
    if (gamble) gamble.style.opacity = isLong ? '1' : '0';
    // Ensure the currently visible sprite sits on top
    awake.style.zIndex = isFocus ? '2' : '1';
    sleep.style.zIndex = isFocus ? '1' : '2';
    awake.style.zIndex = isFocus ? '3' : '1';
    sleep.style.zIndex = isShort ? '3' : '1';
    if (gamble) gamble.style.zIndex = isLong ? '3' : '1';
    awake.setAttribute('aria-hidden', String(!isFocus));
    sleep.setAttribute('aria-hidden', String(isFocus));
    sleep.setAttribute('aria-hidden', String(!isShort));
    if (gamble) gamble.setAttribute('aria-hidden', String(!isLong));
    if (arrow){
      const inCasino = (document.getElementById('timer-screen') && document.getElementById('timer-screen').classList.contains('casino-mode'));
      arrow.style.display = (isLong && !inCasino) ? 'block' : 'none';
    }
  } catch (_) {}
}

function enterCasino(){
  try{
    const screen = document.getElementById('timer-screen');
    if (!screen) return;
    screen.classList.add('casino-mode');
    const casino = document.getElementById('casino-area');
    if (casino) casino.setAttribute('aria-hidden','false');
    const arrow = document.getElementById('enterCasinoArrow');
    if (arrow) arrow.style.display = 'none';
  }catch(_){/* no-op */}
}
function exitCasino(){
  try{
    const screen = document.getElementById('timer-screen');
    if (!screen) return;
    screen.classList.remove('casino-mode');
    // Return to long break mode so gambling Coco is shown
    if (typeof switchMode === 'function') switchMode('longBreak');
    const casino = document.getElementById('casino-area');
    if (casino) casino.setAttribute('aria-hidden','true');
    updateCocoPose('longBreak');
  }catch(_){/* no-op */}
}


let interval;


function updateClock() {
  const { remainingTime } = timer;
  const minutes = `${remainingTime.minutes}`.padStart(2, '0');
  const seconds = `${remainingTime.seconds}`.padStart(2, '0');

  const min = document.getElementById('js-timer-min-final');
  const sec = document.getElementById('js-timer-sec-final');
  min.textContent = minutes;
  sec.textContent = seconds;

  //page title reflectinig coundown
  const text = timer.mode === 'focus' ? 'Time to focus!' : 'Take a break!';
  document.title = `${minutes}:${seconds} - ${text}`;

  const progress = document.getElementById('js-progress');
  progress.value = timer[timer.mode] * 60 - timer.remainingTime.total;

  // Ensure coco pose stays in sync even if mode changes elsewhere
  updateCocoPose(timer.mode);
}
function switchMode(mode) {
  timer.mode = mode;
  timer.remainingTime = {
    total: timer[mode] * 60,
    minutes: timer[mode],
    seconds: 0,
  };

  document
    .querySelectorAll('button[data-mode]')
    .forEach(e => e.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  //optionally change background colour
  // (define CSS variables like --focus, --shortBreak, --longBreak if you want)
  document.body.style.backgroundColor = `var(--${mode})`;
  document
    .getElementById('js-progress')
    .setAttribute('max', timer.remainingTime.total);

  updateClock();
  
  updateRingModeClass();
  updateRingProgress();
  updateCocoPose(mode);
}





function startTimer() {
  let { total } = timer.remainingTime;
  const endTime = Date.parse(new Date()) + total * 1000;



  mainButton.dataset.action = 'stop';
  mainButton.textContent = 'stop';
  mainButton.classList.add('active');
  renderStartButtonIcon(true);
  try{ const bc = document.querySelector('.button-container'); if (bc) bc.classList.add('running'); }catch(_){/* no-op */}

  interval = setInterval(function() {
    timer.remainingTime = getRemainingTime(endTime);
    updateClock();
    updateRingProgress();
    total = timer.remainingTime.total;
    if (total <= 0) {
      clearInterval(interval);

      const finishedMode = timer.mode;
      // increment completed focus sessions and show toast + sound immediately
      let playedEndSound = false;
      if (finishedMode === 'focus') {
        timer.sessions++;
        if (typeof showCocoToast === 'function') showCocoToast('+1');
        // Award a token for completing a focus session
        addTokens(1);
        // Show immediate +1 on the external counter while its animation runs
        window.d3ImmediateProgressOffset = 1;
        try { const el = document.getElementById('progressText'); if (el) el.textContent = `${timer.sessions}/${timer.longBreakIntervals}`; } catch(_){/* no-op */}
        // Mute tracker chime since we already played toast sound
        window.d3MuteNextChime = true;
        const endSoundEarly = document.querySelector(`[data-sound="${finishedMode}"]`);
        if (endSoundEarly) { try { endSoundEarly.currentTime = 0; endSoundEarly.play(); } catch(_){} playedEndSound = true; }
        if (window.d3AdvanceProgress) window.d3AdvanceProgress();
      }

      // checks if focus, if yes then completed a session
      let nextMode;
      if (finishedMode === 'focus') {
        nextMode = (timer.sessions % timer.longBreakIntervals === 0) ? 'longBreak' : 'shortBreak';
      } else {
        nextMode = 'focus';
      }

      // play sound for the phase that just ended (from the audio element in html)
      const endSound = document.querySelector(`[data-sound="${finishedMode}"]`);
      if (endSound && !playedEndSound) { try { endSound.currentTime = 0; endSound.play(); } catch(_){} }

      // switch to the next phase; auto-start only if autoLoop is on
      switchMode(nextMode);
      if (timer.autoLoop) {
        startTimer();
      } else {
        stopTimer();
      }
    }
  }, 1000);
}


function getRemainingTime(endTime) {
  const currentTime = Date.parse(new Date());
  const difference = endTime - currentTime;

  const total = Number.parseInt(difference / 1000, 10);
  const minutes = Number.parseInt((total / 60) % 60, 10);
  const seconds = Number.parseInt(total % 60, 10);

  return {
    total,
    minutes,
    seconds,
  };
}

const buttonSound = new Audio('button-sound.mp3');
const mainButton = document.getElementById('js-btn');
mainButton.addEventListener('click', () => {
  buttonSound.play();
  const { action } = mainButton.dataset;
  if (action === 'start') {
    startTimer();
  } else {
    stopTimer();
  }
});

function stopTimer() {
  clearInterval(interval);

  mainButton.dataset.action = 'start';
  mainButton.textContent = 'start';
  mainButton.classList.remove('active');
  renderStartButtonIcon(false);
  try{ const bc = document.querySelector('.button-container'); if (bc) bc.classList.remove('running'); }catch(_){/* no-op */}
}


function handleMode(event) {
  const { mode } = event.target.dataset;

  if (!mode) return;

  switchMode(mode);
  stopTimer();
}
//initial load
document.addEventListener('DOMContentLoaded', () => {
  switchMode('focus');
  updateRingModeClass();
  updateRingProgress();
  updateCocoPose('focus');
  renderStartButtonIcon(false);
  try{ updateProgressTokenCounter(); }catch(_){/* no-op */}

  const toCasino = document.getElementById('enterCasinoArrow');
  if (toCasino) toCasino.addEventListener('click', enterCasino);
  const exitLeftBtn = document.getElementById('exitCasinoArrowLeft');
  if (exitLeftBtn) exitLeftBtn.addEventListener('click', exitCasino);

  // Make D�?'pad LEFT act as "back":
  // - If in casino view, exit casino.
  // - Else if on timer screen, return to settings/menu screen.
  const dpadLeft = document.getElementById('dpad-left');
  if (dpadLeft) dpadLeft.addEventListener('click', () => {
    try{
      const timerScreen = document.getElementById('timer-screen');
      if (!timerScreen) return;
      if (timerScreen.classList.contains('casino-mode')) {
        if (typeof exitCasino === 'function') exitCasino();
        return;
      }
      const onTimer = timerScreen.classList.contains('active');
      if (onTimer) {
        if (typeof stopTimer === 'function') stopTimer();
        showScreen('menu');
      }
    }catch(_){/* no-op */}
  });

  // Keyboard shortcuts: Space toggles pause, Left goes back, Esc exits casino
  document.addEventListener('keydown', (e)=>{
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    const screen = document.getElementById('timer-screen');
    const onTimer = screen && screen.classList.contains('active');
    const inCasino = screen && screen.classList.contains('casino-mode');

    // Space: toggle timer (avoid interfering with form fields)
    if ((e.key === ' ' || e.code === 'Space') && !isTyping && onTimer){
      e.preventDefault();
      toggleTimer();
      return;
    }
    // Left arrow: go back (casino -> exit; timer -> menu)
    if (e.key === 'ArrowLeft' && !isTyping){
      e.preventDefault();
      if (inCasino) {
        exitCasino();
      } else if (onTimer) {
        stopTimer();
        showScreen('menu');
      }
      return;
    }
    // Right arrow: enter casino from timer screen
    if (e.key === 'ArrowRight' && !isTyping && onTimer && !inCasino){
      e.preventDefault();
      enterCasino();
      return;
    }
    // Escape: exit casino
    if (e.key === 'Escape' && inCasino){
      e.preventDefault();
      exitCasino();
    }
  });

});



const ringEl = document.getElementById('js-ring');

function updateRingProgress() {
  if (!timer || !timer.mode || !timer.remainingTime) return;
  const totalSecs = timer[timer.mode] * 60;                 // full block seconds
  const left = Math.max(0, timer.remainingTime.total);
  const done = Math.max(0, totalSecs - left);
  const percent = totalSecs ? (done / totalSecs) * 100 : 0; // 0�?"100
  ringEl.style.setProperty('--p', percent);
}

function updateRingModeClass() {
  ringEl.classList.remove('is-focus','is-shortBreak','is-longBreak');
  ringEl.classList.add(`is-${timer.mode}`);
}

// New control button handlers (cute circular buttons)
function toggleTimer(){
  try{
    const mainButton = document.getElementById('js-btn');
    if (mainButton) mainButton.click();
  }catch(_){/* no-op */}
}

function resetTimer(){
  try{
    // Prefer existing bridge wiring
    const rb = document.getElementById('resetBtn');
    if (rb) { rb.click(); return; }
    if (window.d3ResetProgress) { window.d3ResetProgress(); return; }
    // Fallback: stop and go to focus
    if (typeof stopTimer === 'function') stopTimer();
    if (typeof switchMode === 'function') switchMode('focus');
  }catch(_){/* no-op */}
}

function skipTimer(){
  try{
    if (typeof timer === 'undefined' || !timer || !timer.mode) return;
    const currentMode = timer.mode;
    if (typeof stopTimer === 'function') stopTimer();
    if (currentMode === 'focus') {
      // Treat skip as completing a focus session
      timer.sessions++;
      // Only play the toast sound (no timer end sound) and show toast immediately
      if (typeof showCocoToast === 'function') showCocoToast('+1');
      // Award a token for skipping-to-complete a focus session
      addTokens(1);
      try { const el = document.getElementById('progressText'); if (el) el.textContent = `${timer.sessions}/${timer.longBreakIntervals}`; } catch(_){/* no-op */}
      // Show immediate +1 on the external counter while its animation runs
      window.d3ImmediateProgressOffset = 1;
      // Mute tracker chime since we already played toast sound
      window.d3MuteNextChime = true;
      if (window.d3AdvanceProgress) window.d3AdvanceProgress();
      const nextMode = (timer.sessions % timer.longBreakIntervals === 0) ? 'longBreak' : 'shortBreak';
      if (typeof switchMode === 'function') switchMode(nextMode);
      if (timer.autoLoop && typeof startTimer === 'function') startTimer();
    } else {
      // From any break, go back to focus
      if (typeof switchMode === 'function') switchMode('focus');
      if (timer.autoLoop && typeof startTimer === 'function') startTimer();
    }
  }catch(_){/* no-op */}
}

// Swap the visible Start button icon between Play and Pause
function renderStartButtonIcon(isRunning){
  try{
    const btn = document.querySelector('.btn-start');
    if (!btn) return;
    const existing = btn.querySelector('.icon');
    if (existing) existing.remove();
    if (isRunning){
      const icon = document.createElement('div');
      icon.className = 'icon icon-pause';
      const bar1 = document.createElement('div');
      const bar2 = document.createElement('div');
      bar1.className = 'pause-bar';
      bar2.className = 'pause-bar';
      icon.appendChild(bar1);
      icon.appendChild(bar2);
      btn.insertBefore(icon, btn.firstChild);
    } else {
      const icon = document.createElement('div');
      icon.className = 'icon icon-play';
      btn.insertBefore(icon, btn.firstChild);
    }
  }catch(_){/* no-op */}
}

// Show a '+1' reward toast near the Coco sprite
function showCocoToast(text = '+1'){
  try{
    const layer = document.getElementById('toastLayer');
    const anchor = document.querySelector('.character');
    if(!layer || !anchor) return;
    // Play a short chime immediately with the toast
    try {
      if (typeof landChime === 'function') {
        landChime();
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          const ctx = window.__toastAC || new AC();
          window.__toastAC = ctx;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = 880;
          g.gain.value = 0.08;
          o.connect(g); g.connect(ctx.destination);
          const t0 = ctx.currentTime;
          o.start(t0);
          g.gain.setValueAtTime(0.08, t0);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
          o.stop(t0 + 0.16);
        }
      }
    } catch(_) {}
    const rect = anchor.getBoundingClientRect();
    // Create independent toast immediately near Coco
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    const x = rect.left + rect.width * 0.58;
    const y = rect.top  + rect.height * 0.28;
    wrapper.style.left = `${x}px`;
    wrapper.style.top  = `${y}px`;
    wrapper.style.transform = 'translate(-50%, -50%)';

    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.cssText = 'background: rgba(255,255,255,0.95); color:#6b705c; font-weight:700; font-size:14px; padding:6px 10px; border-radius:12px; border:1px solid rgba(0,0,0,0.08); box-shadow:0 8px 20px rgba(0,0,0,0.2);';

    // animate up and fade
    wrapper.style.opacity = '0';
    wrapper.style.transition = 'transform 700ms ease, opacity 700ms ease';
    layer.appendChild(wrapper);
    wrapper.appendChild(toast);
    requestAnimationFrame(() => {
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'translate(-50%, -120%)';
      setTimeout(() => {
        wrapper.style.opacity = '0';
        setTimeout(() => wrapper.remove(), 400);
      }, 900);
    });
  }catch(_){/* no-op */}
}
