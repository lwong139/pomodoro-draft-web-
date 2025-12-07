/* ================== State ================== */
let sessions = 6;
let landedDots   = 0;               // sessions completed (0..sessions)
let activeLines  = 0;               // colored segments = landedDots

let isAnimating = false;
let spritePosition = 0;             // position along segments (0..sessions), 0 starts on first dot
let spriteJumpOffset = 0;
let animationSpeed = 1000;
let selectedSprite = '🐶';
let pulseOnLanding = false;
// View tracking: auto-pan the path to follow the sprite

const sprites = ['🌱','🐱','💚','⭐','🍄','🌸'];

/* ================== Audio ================== */
let audioCtx = null;
function ensureAudio(){
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function beep(freq=660, time=0.12, gain=0.06, type='sine', startAt=0){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  const t0 = audioCtx.currentTime + startAt;
  o.start(t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + time);
  o.stop(t0 + time);
}
function landChime(){
  ensureAudio();
  // pleasant two-note chime
  beep(660, 0.12, 0.06, 'sine', 0);
  beep(990, 0.14, 0.05, 'triangle', 0.1);
}
function finalFanfare(){
  ensureAudio();
  // little triad up
  beep(523.25, 0.12, 0.07, 'sine', 0);   // C5
  beep(659.25, 0.12, 0.07, 'sine', 0.12); // E5
  beep(783.99, 0.18, 0.07, 'triangle', 0.24); // G5
  // sparkle tail
  beep(1046.5, 0.20, 0.04, 'sine', 0.36); // C6
}

/* ================== Confetti ================== */
const confettiCanvas = document.getElementById('confettiCanvas');
const ctx = confettiCanvas.getContext('2d');
function resizeConfetti(){
  const card = confettiCanvas.parentElement.getBoundingClientRect();
  confettiCanvas.width = card.width;
  confettiCanvas.height = card.height;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function confettiBurst(){
  resizeConfetti();
  const W = confettiCanvas.width, H = confettiCanvas.height;
  const particles = [];
  const colors = ['#86efac','#a7f3d0','#fef3c7','#fca5a5','#93c5fd','#f5d0fe'];

  const N = 80;
  for(let i=0;i<N;i++){
    particles.push({
      x: W*0.5, y: H*0.18,               // near progress bar
      vx: (Math.random()*2-1)*3.2,       // velocity
      vy: (Math.random()*-2.5)-2,
      g:  0.085 + Math.random()*0.03,    // gravity
      s:  3 + Math.random()*3,           // size
      a:  1,
      color: colors[(Math.random()*colors.length)|0],
      rot: Math.random()*Math.PI,
      vr: (Math.random()*2-1)*0.2,
      shape: Math.random()<0.6 ? 'rect' : 'circle'
    });
  }

  let running = true;
  const start = performance.now();
  function tick(now){
    ctx.clearRect(0,0,W,H);
    particles.forEach(p=>{
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.a *= 0.992;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot);
      if(p.shape==='rect'){
        ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6);
      }else{
        ctx.beginPath(); ctx.arc(0,0,p.s/2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    if (now - start < 1800 && running) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0,0,W,H);
      running = false;
    }
  }
  requestAnimationFrame(tick);
}

/* ================== Geometry helpers ================== */
function getDotX(i){
  const dotCount = sessions + 1; // include Start and End
  if (dotCount === 1) return 50;
  // Add padding so dots/lines don’t get clipped at SVG edges
  const pad = 4; // viewBox units
  const spacing = (100 - pad * 2) / (dotCount - 1);
  return pad + i * spacing;
}

/* ================== Layout helpers (scrolling path) ================== */
function updateSvgWidth() {
  const svg = document.getElementById('progressSvg');
  const viewport = document.getElementById('progressViewport');
  if (!svg || !viewport) return;
  const perDotPx = 90; // width reserved per dot (smaller for compact path)
  const desired = Math.max(viewport.clientWidth, Math.round((sessions + 1) * perDotPx));
  svg.style.width = desired + 'px'; // inline style overrides CSS width:100%
}

function centerOnXUnits(xUnits) {
  const svg = document.getElementById('progressSvg');
  const viewport = document.getElementById('progressViewport');
  if (!svg || !viewport) return;
  const scaleX = svg.clientWidth / 100; // viewBox width is 100 units
  const targetPx = xUnits * scaleX;
  const maxLeft = Math.max(0, svg.clientWidth - viewport.clientWidth);
  const left = Math.max(0, Math.min(maxLeft, targetPx - viewport.clientWidth / 2));
  svg.style.transform = `translateX(${-left}px)`;
  svg.style.willChange = 'transform';
}
function pathPoints(i){
  const x1 = getDotX(i), x2 = getDotX(i+1);
  const dist = x2 - x1, segs = 3, A1 = 4, A2 = 2;
  const pts = [{x:x1, y:15}];
  for(let s=1;s<=segs;s++){
    const t = s/segs, x = x1 + dist*t;
    const wobble = Math.sin((i+s)*2)*A1 + Math.cos((i+s)*1.3)*A2;
    const y = s===segs ? 15 : 15 + wobble;
    pts.push({x,y});
  }
  return pts;
}
function pathD(pts){
  if(pts.length<2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length;i++){
    const prev=pts[i-1], cur=pts[i], nxt=pts[i+1];
    if(i===pts.length-1){
      const cpx = prev.x + (cur.x-prev.x)*0.5;
      const cpy = prev.y + (cur.y-prev.y)*0.5;
      d += ` Q ${cpx} ${cpy}, ${cur.x} ${cur.y}`;
    }else{
      const cpx = cur.x, cpy = cur.y;
      const ex = cur.x + (nxt.x-cur.x)*0.5;
      const ey = cur.y + (nxt.y-cur.y)*0.5;
      d += ` Q ${cpx} ${cpy}, ${ex} ${ey}`;
    }
  }
  return d;
}
function spritePoint(segIndex, t){
  const pts = pathPoints(Math.floor(segIndex));
  if(pts.length<2) return {x:0,y:15};
  const total = pts.length-1;
  const tt = Math.min(1, Math.max(0, t)) * total;
  const i = Math.floor(tt);
  const lt = tt - i;
  const p0 = pts[Math.max(0,i-1)];
  const p1 = pts[i];
  const p2 = pts[i+1] || p1;
  const p3 = pts[Math.min(pts.length-1,i+2)] || p2;
  const lt2 = lt*lt, lt3 = lt2*lt;
  const x = 0.5*(2*p1.x + (-p0.x+p2.x)*lt + (2*p0.x-5*p1.x+4*p2.x-p3.x)*lt2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*lt3);
  const y = 0.5*(2*p1.y + (-p0.y+p2.y)*lt + (2*p0.y-5*p1.y+4*p2.y-p3.y)*lt2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*lt3);
  return {x,y};
}

/* ================== Reward Toast ================== */
function showRewardToast(message = '+1 session', anchor){
  const layer = document.getElementById('toastLayer');
  if(!layer) return;
  const toast = document.createElement('div');
  toast.className = 'reward-pop inline-flex items-center gap-2 px-4 py-2 rounded-2xl shadow-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-emerald-50';
  toast.innerHTML = `
    <span class="text-lg">✨</span>
    <span class="text-emerald-700 font-bold">${message}</span>
  `;
  try { toast.style.color = '#6b705c'; var __sp=toast.querySelectorAll('span'); if(__sp[1]) __sp[1].style.color='#6b705c'; } catch(_) {}
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '50%';
  wrapper.style.top = '14%';
  wrapper.style.transform = 'translateX(-50%)';

  // If anchor (in SVG viewBox units) is provided, place toast above the dot
  if(anchor){
    const svg = document.getElementById('progressSvg');
    if(svg){
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : {x:0,y:0,width:100,height:30};
      const px = rect.left + ((anchor.x - vb.x) / vb.width) * rect.width;
      const py = rect.top  + ((anchor.y - vb.y) / vb.height) * rect.height;
      wrapper.style.left = `${px}px`;
      wrapper.style.top  = `${py}px`;
      wrapper.style.transform = 'translate(-50%, -120%)';
    }
  }
  wrapper.appendChild(toast);
  layer.appendChild(wrapper);
  toast.addEventListener('animationend', () => wrapper.remove(), { once: true });
}
window.showRewardToast = showRewardToast;

/* ================== Render ================== */
function render(){
  updateSvgWidth();
  const svg = document.getElementById('progressSvg');
  svg.innerHTML = '';

  // Lines (segments)
  for(let i=0;i<sessions;i++){
    const active = i < activeLines; // color completed segments
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d', pathD(pathPoints(i)));
    p.setAttribute('fill','none');
    p.setAttribute('stroke', active ? '#ddbea9' : '#b7b7a4');
    p.setAttribute('stroke-width','0.7');
    p.setAttribute('stroke-linecap','round');
    p.setAttribute('stroke-linejoin','round');
    p.style.transition = 'stroke .3s ease, filter .3s ease';
    if(active){
      p.style.filter = 'drop-shadow(0 0 2px #b7b7a4)';
      if(pulseOnLanding) p.classList.add('pulse');
    }
    svg.appendChild(p);
  }

  // Dots (sessions + 1, including Start and End)
  for(let i=0;i<sessions+1;i++){
    const x = getDotX(i);
    const done = i <= landedDots; // include the Start dot at 0 when progress is 0
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');

    if(done){
      const glow = document.createElementNS('http://www.w3.org/2000/svg','circle');
      glow.setAttribute('cx',x); glow.setAttribute('cy','15'); glow.setAttribute('r','1.6');
      glow.setAttribute('fill','#b7b7a4'); glow.setAttribute('opacity','0.3');
      if(pulseOnLanding) glow.classList.add('pulse');
      g.appendChild(glow);
    }
    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx',x); dot.setAttribute('cy','15'); dot.setAttribute('r','1.1');
    // Use olive palette: active #ddbea9, inactive #cb997e
    dot.setAttribute('fill', done ? '#ddbea9' : '#cb997e');
    dot.setAttribute('stroke', done ? '#ddbea9' : '#cb997e');
    dot.setAttribute('stroke-width','0.25');
    dot.style.transition = 'fill .3s ease, stroke .3s ease, filter .3s ease';
    dot.style.filter = done ? 'drop-shadow(0 0 1.4px #b7b7a4)' : 'drop-shadow(0 0.8px 0.8px rgba(0,0,0,0.1))';
    if(done && pulseOnLanding) dot.classList.add('pulse');
    g.appendChild(dot);

    svg.appendChild(g);
  }

  // Sprite
  let sx, sy;
  {
    const seg = Math.floor(spritePosition);
    const t   = spritePosition - seg;
    if (seg >= sessions){ // at or beyond last segment -> End dot
      sx = getDotX(sessions);
      sy = 15 - spriteJumpOffset*3;
    } else {
      const pt = spritePoint(seg, t);
      sx = pt.x; sy = pt.y - spriteJumpOffset*3;
    }
  }
  const spriteText = document.createElementNS('http://www.w3.org/2000/svg','text');
  spriteText.setAttribute('x',sx); spriteText.setAttribute('y',sy);
  // Smaller size for the dog emoji, default for others
  const spriteSize = (selectedSprite === '🐶') ? '8' : '12';
  spriteText.setAttribute('font-size', spriteSize);
  spriteText.setAttribute('text-anchor','middle');
  spriteText.setAttribute('dominant-baseline','middle');
  // Remove shadow for dog sprite; keep for others
  spriteText.style.filter = (selectedSprite === '🐶')
    ? 'none'
    : 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))';
  spriteText.textContent = selectedSprite;
  svg.appendChild(spriteText);

  // Auto-pan viewport to follow sprite x
  centerOnXUnits(sx);

  // Labels: Start / End
  const labelY = 27; // near bottom of viewBox (0..30)
  const startLabel = document.createElementNS('http://www.w3.org/2000/svg','text');
  startLabel.setAttribute('x', getDotX(0));
  startLabel.setAttribute('y', labelY);
  startLabel.setAttribute('font-size', '7');
  startLabel.setAttribute('text-anchor', 'middle');
  startLabel.setAttribute('fill', '#a16207');
  // Replace Start text with house emoji
  startLabel.textContent = '🏠';
  svg.appendChild(startLabel);

  const endLabel = document.createElementNS('http://www.w3.org/2000/svg','text');
  endLabel.setAttribute('x', getDotX(sessions));
  endLabel.setAttribute('y', labelY);
  endLabel.setAttribute('font-size', '7');
  endLabel.setAttribute('text-anchor', 'middle');
  endLabel.setAttribute('fill', '#a16207');
  // Replace End text with bone emoji
  endLabel.textContent = '🦴';
  svg.appendChild(endLabel);

  // UI
  // Allow external UI to show an immediate +1 during animation
  const offset = Math.max(0, Math.min(1, (window && window.d3ImmediateProgressOffset) ? 1 : 0));
  const displayed = Math.min(sessions, landedDots + offset);
  document.getElementById('progressText').textContent = `${displayed}/${sessions}`;
  const nextBtn = document.getElementById('completeBtn');
  nextBtn.disabled = isAnimating || landedDots >= sessions;
  nextBtn.textContent = landedDots >= sessions ? '🎉 Complete!' : '✨ Complete Session';
  document.getElementById('resetBtn').disabled = isAnimating;
  document.getElementById('sessionsSlider').disabled = isAnimating;
  document.getElementById('speedSlider').disabled = isAnimating;

  if(pulseOnLanding) setTimeout(()=> (pulseOnLanding=false), 0);
}

/* ================== Controls ================== */
function completeSession(){
  if(isAnimating || landedDots >= sessions) return;
  ensureAudio();
  isAnimating = true;

  // Move from current dot (landedDots) to next dot (landedDots+1)
  const isFirst = landedDots === 0;
  const startSeg = spritePosition;        // 0..sessions
  const endSeg   = Math.min(sessions, landedDots + 1);
  const dur = animationSpeed;
  const jumpDur = isFirst ? 200 : 0;
  const t0 = performance.now();

  function step(now){
    const elapsed = now - t0;
    const total = jumpDur + dur;
    const p = Math.min(1, elapsed / total);

    if(isFirst && elapsed < jumpDur){
      const jp = elapsed / jumpDur;
      spriteJumpOffset = Math.sin(jp * Math.PI) * 0.5;
    }else{
      const moveP = isFirst ? (elapsed - jumpDur) / dur : elapsed / dur;
      const ease = moveP < 0.5 ? 2*moveP*moveP : 1 - Math.pow(-2*moveP + 2, 2)/2;
      spritePosition = startSeg + (endSeg - startSeg) * ease;
      spriteJumpOffset = 0;
    }

    render();

    if(p < 1){ requestAnimationFrame(step); }
    else{
      // LAND: update paint state AFTER motion
      spritePosition = endSeg;
      landedDots  = Math.min(sessions, landedDots + 1);
      activeLines = landedDots; // completed segments
      pulseOnLanding = true;

      // sounds + confetti + toast
      if (landedDots >= sessions){
        finalFanfare();
        confettiBurst();
        showRewardToast('All sessions complete! 🎉');
      } else {
        // Optionally mute chime if external caller already played a toast sound
        if (!(window && window.d3MuteNextChime)) {
          landChime();
        } else {
          window.d3MuteNextChime = false;
        }
        // Anchor toast above the dot we just landed on
        showRewardToast('+1', { x: getDotX(landedDots), y: 15 });
      }

      isAnimating = false;
      if (window) window.d3ImmediateProgressOffset = 0;
      render();
    }
  }
  requestAnimationFrame(step);
}

function resetAll(){
  if(isAnimating) return;
  landedDots = 0;
  activeLines = 0;
  spritePosition = 0; // back to Start dot
  if (window) window.d3ImmediateProgressOffset = 0;
  render();
}

function initSpriteButtons(){
  const wrap = document.getElementById('spriteButtons');
  wrap.innerHTML = '';
  sprites.forEach(sp=>{
    const b = document.createElement('button');
    b.textContent = sp;
    b.className = `sprite-btn text-3xl p-3 rounded-xl transition-all duration-200 border-2 border-purple-300 ${
      selectedSprite===sp ? 'bg-purple-300 selected shadow-lg':'bg-white hover:bg-purple-100'
    }`;
    b.onclick = ()=>{
      if(isAnimating) return;
      selectedSprite = sp;
      initSpriteButtons();
      render();
    };
    wrap.appendChild(b);
  });
}

// Events
document.getElementById('completeBtn').addEventListener('click', completeSession);
document.getElementById('resetBtn').addEventListener('click', resetAll);
document.getElementById('sessionsSlider').addEventListener('input', e=>{
  sessions = parseInt(e.target.value,10);
  document.getElementById('sessionsValue').textContent = sessions;
  landedDots  = Math.min(landedDots, sessions); // clamp progress
  activeLines = landedDots;
  spritePosition = landedDots; // sit on the current dot
  render();
});

// Recenter on resize
window.addEventListener('resize', () => { render(); });
document.getElementById('speedSlider').addEventListener('input', e=>{
  animationSpeed = parseInt(e.target.value,10);
  document.getElementById('speedValue').textContent = animationSpeed;
});

// Boot
initSpriteButtons();
render();
