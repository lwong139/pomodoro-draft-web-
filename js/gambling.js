
    // Token state persisted in localStorage so it shares with the timer
    function getStoredTokens(def = 10){
      try{
        const v = parseInt(localStorage.getItem('tokens'), 10);
        return Number.isFinite(v) ? Math.max(0, v) : def;
      }catch(_){ return def; }
    }
    function updateTokenDisplays(v){
      try{ document.querySelectorAll('.token-chip-count, #tokenCount').forEach(e => e.textContent = v); }catch(_){}
      try{ const saEl = document.getElementById('spinAllCount'); if (saEl) saEl.textContent = v; }catch(_){}
      // keep inline timer-screen label in sync as a fallback
      try{ const ti = document.getElementById('tokensInline'); if (ti) ti.textContent = `tokens: ${v}`; }catch(_){}
    }
    function setStoredTokens(v){
      const n = Math.max(0, parseInt(v,10)||0);
      try{
        if (typeof window.setTokens === 'function' && window.setTokens !== setStoredTokens){
          tokens = window.setTokens(n);
        } else {
          tokens = n;
          try{ localStorage.setItem('tokens', String(tokens)); }catch(_){/* no-op */}
        }
      }catch(_){ tokens = n; }
      updateTokenDisplays(tokens);
      try{ if (typeof window.updateProgressTokenCounter === 'function') window.updateProgressTokenCounter(); }catch(_){}
      return tokens;
    }
    // expose helpers if not already defined
    if (!window.getTokens) window.getTokens = getStoredTokens;
    if (!window.setTokens) window.setTokens = setStoredTokens;

    let tokens = getStoredTokens(10);

    // Daily random jackpot cap (15–40%) + persistent pity (+1% per non-jackpot spin)
    function __todayStr(){ try{ return new Date().toISOString().slice(0,10); }catch(_){ return ''; } }
    function getDailyJackpotCap(){
      try{
        const KD = 'jackpotDailyCapDate';
        const KV = 'jackpotDailyCap';
        const today = __todayStr();
        const last = localStorage.getItem(KD);
        let cap = parseFloat(localStorage.getItem(KV));
        if (!last || last !== today || !isFinite(cap)){
          // pick integer between 15 and 40 inclusive
          cap = Math.floor(Math.random()*26) + 15;
          localStorage.setItem(KD, today);
          localStorage.setItem(KV, String(cap));
        }
        return Math.max(0, Math.min(100, cap));
      }catch(_){ return 25; }
    }
    function getJackpotPity(){
      try{ return Math.max(0, parseInt(localStorage.getItem('jackpotPity'),10) || 0); }catch(_){ return 0; }
    }
    function setJackpotPity(n){
      try{ localStorage.setItem('jackpotPity', String(Math.max(0, Math.min(100, n|0)))); }catch(_){/* no-op */}
    }

    // Rolling block cap: every 4 spins, pick a new active cap ~ base ±5%
    function randInt(min, max){ return (Math.floor(Math.random()*(max-min+1)) + min)|0; }
    function clamp01_100(x){ return Math.max(0, Math.min(100, x)); }
    function getAndBumpActiveCap(){
      try{
        const KD = 'jackpotCapBlockDate';
        const KR = 'jackpotCapBlockRoll';
        const KA = 'jackpotActiveCap';
        const today = __todayStr();
        let d  = localStorage.getItem(KD);
        let r  = parseInt(localStorage.getItem(KR),10); if (!Number.isFinite(r)) r = 0;
        let ac = parseFloat(localStorage.getItem(KA));
        // reset when date changes or missing active cap
        if (!d || d !== today || !Number.isFinite(ac)){
          const base = getDailyJackpotCap();
          ac = clamp01_100(base + randInt(-5,5));
          r = 0;
          localStorage.setItem(KD, today);
          localStorage.setItem(KA, String(ac));
          localStorage.setItem(KR, String(r));
        }
        // start a new block every 4 spins
        if (r >= 4){
          const base = getDailyJackpotCap();
          ac = clamp01_100(base + randInt(-5,5));
          r = 0;
          localStorage.setItem(KA, String(ac));
        }
        // consume one spin in this block
        localStorage.setItem(KR, String(r+1));
        return clamp01_100(ac);
      }catch(_){ return getDailyJackpotCap(); }
    }
    // Keep local tokens in sync if pretty.js updates them
    try {
      const __origSetTokens = window.setTokens;
      if (typeof __origSetTokens === 'function' && !__origSetTokens.__gWrap) {
        const wrapped = function(n){
          const r = __origSetTokens(n);
          try {
            tokens = (typeof window.getTokens === 'function') ? window.getTokens(10) : getStoredTokens(10);
          } catch(_) { tokens = r; }
          updateTokenDisplays(tokens);
          try{ if (typeof window.updateProgressTokenCounter === 'function') window.updateProgressTokenCounter(); }catch(_){/* no-op */}
          return r;
        };
        wrapped.__gWrap = true;
        window.setTokens = wrapped;
      }
    } catch(_) { /* no-op */ }
    let spinning = false;
    // use global soundEnabled from pretty.js (avoid redeclare errors)
    // if not present, default to true
    if (typeof soundEnabled === 'undefined') { window.soundEnabled = true; }
    let rewards = [
      { emoji: '🎮', name: 'Play League of Legends', probability: 20 },
      { emoji: '📱', name: 'Scroll Instagram 15 mins', probability: 25 },
      { emoji: '🍕', name: 'Order Pizza', probability: 15 },
      { emoji: '☕', name: 'Coffee Break', probability: 20 },
      { emoji: '🎬', name: 'Watch a Movie', probability: 10 },
      { emoji: '💎', name: 'Free Choice!', probability: 5 },
      { emoji: '🏃', name: 'Go for a Run', probability: 5 }
    ];

    // Persist custom rewards across visits
    const REWARDS_KEY = 'slotRewards';
    function saveRewards(){
      try { localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards)); } catch(_){}
    }
    (function loadRewards(){
      try{
        const raw = localStorage.getItem(REWARDS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)){
          const cleaned = parsed
            .filter(r => r && typeof r === 'object')
            .map(r => ({
              emoji: String(r.emoji || '').slice(0,2),
              name: String(r.name || ''),
              probability: Math.max(0, parseFloat(r.probability)||0),
              rarity: typeof r.rarity === 'string' ? r.rarity : undefined
            }))
            .filter(r => r.emoji && r.name && r.probability > 0);
          if (cleaned.length) { rewards = cleaned; }
        }
      }catch(_){/* ignore invalid stored data */}
    })();

    // Rarity presets (intuitive jackpot %) and colors
    const RARITY_PRESETS = {
      Common:    { pct: 20, color: '#16a34a' },  // green
      Uncommon:  { pct: 10, color: '#0ea5e9' },  // sky blue
      Rare:      { pct:  5, color: '#6366f1' },  // indigo
      Epic:      { pct:  2, color: '#a855f7' },  // violet
      Legendary: { pct:  1, color: '#f59e0b' },  // amber
      Custom:    { pct: null, color: '#6b705c' } // default
    };
    function getNearestRarity(p){
      const x = Math.max(0, parseFloat(p)||0);
      let best = 'Custom';
      let bestDiff = Infinity;
      for (const k of Object.keys(RARITY_PRESETS)){
        const v = RARITY_PRESETS[k].pct;
        if (v == null) continue;
        const d = Math.abs(x - v);
        if (d < bestDiff){ bestDiff = d; best = k; }
      }
      return best;
    }
    function rarityColor(r){
      return (RARITY_PRESETS[r] && RARITY_PRESETS[r].color) || RARITY_PRESETS.Custom.color;
    }

    // Initialize background dots
    function initBgDots() {
  const bgDots = document.getElementById('bgDots');
  if (bgDots) {
    const dot = document.createElement('div');
    dot.className = 'bg-dot';
    dot.style.width = '5px';
    dot.style.height = '5px';
    dot.style.left = '10%';
    dot.style.top = '10%';
    bgDots.appendChild(dot);
  }

  const headerDots = document.getElementById('headerDots');
  if (headerDots) {
    const dot = document.createElement('div');
    dot.className = 'header-dot';
    dot.style.width = '5px';
    dot.style.height = '5px';
    dot.style.left = '10%';
    dot.style.top = '10%';
    headerDots.appendChild(dot);
  }
}

    // Floating +1 indicator near token chip
    function showTokenFloater(text = '+1') {
      try {
        const chip = document.querySelector('.token-chip');
        if (!chip) return;
        const el = document.createElement('span');
        el.className = 'token-floater';
        el.textContent = text;
        chip.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
        setTimeout(() => { if (el && el.parentNode) el.remove(); }, 2000);
      } catch (_) { /* no-op */ }
    }

    // Sound effects
    function playSound(type) {
      if (!soundEnabled) return;

      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        switch(type) {
          case 'spin':
            {
              const osc = audioContext.createOscillator();
              const gain = audioContext.createGain();
              osc.connect(gain);
              gain.connect(audioContext.destination);
              osc.frequency.setValueAtTime(400, audioContext.currentTime);
              osc.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
              gain.gain.setValueAtTime(0.3, audioContext.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
              osc.start(audioContext.currentTime);
              osc.stop(audioContext.currentTime + 0.1);
              setTimeout(() => audioContext.close(), 200);
            }
            break;
          case 'tick':
            {
              const osc = audioContext.createOscillator();
              const gain = audioContext.createGain();
              osc.connect(gain);
              gain.connect(audioContext.destination);
              osc.frequency.setValueAtTime(800, audioContext.currentTime);
              gain.gain.setValueAtTime(0.1, audioContext.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
              osc.start(audioContext.currentTime);
              osc.stop(audioContext.currentTime + 0.05);
              setTimeout(() => audioContext.close(), 100);
            }
            break;
          case 'win':
            {
              const osc = audioContext.createOscillator();
              const gain = audioContext.createGain();
              osc.connect(gain);
              gain.connect(audioContext.destination);
              osc.frequency.setValueAtTime(523.25, audioContext.currentTime);
              osc.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
              osc.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
              gain.gain.setValueAtTime(0.3, audioContext.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
              osc.start(audioContext.currentTime);
              osc.stop(audioContext.currentTime + 0.4);
              setTimeout(() => audioContext.close(), 500);
            }
            break;
          case 'jackpot':
            {
              const notes = [523.25, 659.25, 783.99, 1046.50];
              notes.forEach((freq, i) => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.1);
                gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.3);
                osc.start(audioContext.currentTime + i * 0.1);
                osc.stop(audioContext.currentTime + i * 0.1 + 0.3);
              });
              setTimeout(() => audioContext.close(), 800);
            }
            break;
          case 'lose':
            {
              const osc = audioContext.createOscillator();
              const gain = audioContext.createGain();
              osc.connect(gain);
              gain.connect(audioContext.destination);
              osc.frequency.setValueAtTime(400, audioContext.currentTime);
              osc.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
              gain.gain.setValueAtTime(0.2, audioContext.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
              osc.start(audioContext.currentTime);
              osc.stop(audioContext.currentTime + 0.3);
              setTimeout(() => audioContext.close(), 400);
            }
            break;
        }
      } catch (error) {
        console.error('Audio error:', error);
      }
    }

    // Confetti
    function createConfetti() {
      const colors = ['#ff6b9d', '#c44569', '#feca57', '#ff9ff3', '#48dbfb', '#0abde3'];
      const container = document.getElementById('confettiContainer');
      
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        container.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 3000);
      }
    }

    // Interpret each reward.probability as desired jackpot % (0..100).
    // Derive per-reel selection weights w_i so that jackpot share matches inputs:
    //   Let j_i = prob%/100; r_i = cbrt(j_i); w_i = r_i / sum(r_i)
    function computeReelWeightsFromJackpots(){
      try{
        const js = rewards.map(r => Math.max(0, parseFloat(r.probability) || 0) / 100);
        const roots = js.map(j => Math.cbrt(j));
        const sumRoots = roots.reduce((a,b)=>a+b, 0);
        if (!isFinite(sumRoots) || sumRoots <= 0){
          const n = Math.max(1, rewards.length);
          return Array(n).fill(1/n);
        }
        return roots.map(r => r / sumRoots);
      }catch(_){
        const n = Math.max(1, rewards.length);
        return Array(n).fill(1/n);
      }
    }

    // Weighted random using derived reel weights
    function getWeightedRandom() {
      const weights = computeReelWeightsFromJackpots();
      const rnd = Math.random();
      let acc = 0;
      for (let i=0;i<rewards.length;i++){
        acc += weights[i] || 0;
        if (rnd < acc) return rewards[i];
      }
      return rewards[rewards.length - 1];
    }

    // Spin
    function spin() {
      if (spinning) return;
      // Re-read latest tokens from shared storage/helpers before deciding
      try {
        tokens = (typeof window.getTokens === 'function') ? window.getTokens(tokens) : getStoredTokens(tokens);
        updateTokenDisplays(tokens);
      } catch(_) { /* no-op */ }

      if (tokens <= 0) {
        showMessage('🪙 no tokens left!');
        playSound('lose');
        return;
      }

      setStoredTokens(tokens - 1);
      spinning = true;
      // Jackpot-first with daily base + rolling block cap (±5%) and pity
      const pList = rewards.map(r => Math.max(0, parseFloat(r.probability) || 0));
      const pSum = pList.reduce((a,b)=>a+b, 0);
      const activeCap = getAndBumpActiveCap();
      const pityCap = getJackpotPity();
      const CAP = Math.max(0, Math.min(100, activeCap + pityCap));
      const scale = pSum > CAP ? (CAP / pSum) : 1;
      const pEff = pList.map(v => v * scale);
      const pEffSum = pEff.reduce((a,b)=>a+b, 0);
      const __jackpotHit = (Math.random() * 100) < pEffSum;
      let __jackpotReward = null;
      if (__jackpotHit && pEffSum > 0){
        let rr = Math.random() * pEffSum;
        for (let i=0;i<rewards.length;i++){
          const v = pEff[i];
          if (rr < v){ __jackpotReward = rewards[i]; break; }
          rr -= v;
        }
        if (!__jackpotReward) __jackpotReward = rewards[rewards.length - 1];
      }
      
      const lever = document.getElementById('lever');
      const leverBall = document.getElementById('leverBall');
      const leverContainer = lever.parentElement;
      const spinner = document.getElementById('spinner');
      const leverLabel = document.getElementById('leverLabel');
      const message = document.getElementById('message');
      
      leverContainer.classList.add('disabled');
      leverBall.classList.add('pulling');
      spinner.classList.remove('hidden');
      leverLabel.style.display = 'none';
      message.classList.add('hidden');
      
      playSound('spin');
      
      const reel1 = document.getElementById('reel1');
      const reel2 = document.getElementById('reel2');
      const reel3 = document.getElementById('reel3');
      
      reel1.classList.add('spinning');
      reel2.classList.add('spinning');
      reel3.classList.add('spinning');
      
      let spinCount = 0;
      const spinInterval = setInterval(() => {
        reel1.textContent = rewards[Math.floor(Math.random() * rewards.length)].emoji;
        reel2.textContent = rewards[Math.floor(Math.random() * rewards.length)].emoji;
        reel3.textContent = rewards[Math.floor(Math.random() * rewards.length)].emoji;
        playSound('tick');
        spinCount++;
        
        if (spinCount >= 20) {
          clearInterval(spinInterval);
          
          let result1, result2, result3;
          if (__jackpotHit && __jackpotReward){
            result1 = result2 = result3 = __jackpotReward;
          } else {
            result1 = getWeightedRandom();
            result2 = getWeightedRandom();
            result3 = getWeightedRandom();
            // prevent accidental triple-match in normal spins
            if (result1.emoji === result2.emoji && result2.emoji === result3.emoji) {
              let alt;
              do { alt = getWeightedRandom(); } while (alt.emoji === result1.emoji && rewards.length > 1);
              result3 = alt;
            }
          }
          
          reel1.textContent = result1.emoji;
          reel2.textContent = result2.emoji;
          reel3.textContent = result3.emoji;
          
          reel1.classList.remove('spinning');
          reel2.classList.remove('spinning');
          reel3.classList.remove('spinning');
          
          if (result1.emoji === result2.emoji && result2.emoji === result3.emoji) {
            showMessage(`✨ jackpot! ✨\n${result1.name}!`);
            playSound('jackpot');
            createConfetti();
            try{ setJackpotPity(0); }catch(_){/* no-op */}
          } else if (result1.emoji === result2.emoji || result2.emoji === result3.emoji || result1.emoji === result3.emoji) {
            showMessage('💫 two match! +1 token~');
            setStoredTokens(tokens + 1);
            showTokenFloater('+1');
            playSound('win');
            try{ setJackpotPity(getJackpotPity()+1); }catch(_){/* no-op */}
          } else {
            showMessage('💭 no match... try again!');
            playSound('lose');
            try{ setJackpotPity(getJackpotPity()+1); }catch(_){/* no-op */}
          }
          
          spinning = false;
          leverContainer.classList.remove('disabled');
          leverBall.classList.remove('pulling');
          spinner.classList.add('hidden');
          // Keep the pull tooltip hidden after a spin
          if (leverLabel) leverLabel.style.display = 'none';
          
          if (tokens <= 0) {
            leverContainer.classList.add('disabled');
          }
        }
      }, 100);
    }

    let typingInterval;
    let topTypingInterval;
    function showMessage(text) {
      const message = document.getElementById('message');
      const messageText = document.getElementById('messageText');
      if (!message || !messageText) return;
      message.classList.remove('hidden');
      clearInterval(typingInterval);
      messageText.textContent = '';
      let i = 0;
      typingInterval = setInterval(() => {
        if (i < text.length) {
          messageText.textContent += text[i++];
        } else {
          clearInterval(typingInterval);
          messageText.innerHTML = text + '<span class="cursor"></span>';
        }
      }, 25);

      // Also mirror message to the top-screen dialogue when in casino mode
      const topText = document.getElementById('casinoDialogueText');
      if (topText) {
        clearInterval(topTypingInterval);
        topText.textContent = '';
        let j = 0;
        topTypingInterval = setInterval(() => {
          if (j < text.length) {
            topText.textContent += text[j++];
          } else {
            clearInterval(topTypingInterval);
          }
        }, 25);
      }
    }

    // Spin all remaining tokens without animation; show jackpots only
    function spinAll() {
      if (spinning) return;
      // Refresh tokens before bulk spinning
      try {
        tokens = (typeof window.getTokens === 'function') ? window.getTokens(tokens) : getStoredTokens(tokens);
        updateTokenDisplays(tokens);
      } catch(_) { /* no-op */ }
      if (tokens <= 0) { showMessage('no tokens left!'); return; }

      spinning = true;
      const leverContainer = document.querySelector('.lever-container');
      if (leverContainer) leverContainer.classList.add('disabled');

      const jackpots = [];
      // Precompute raw targets once; apply block cap+pity per spin
      const __pListRaw = rewards.map(r => Math.max(0, parseFloat(r.probability) || 0));
      const __pSumRaw = __pListRaw.reduce((a,b)=>a+b, 0);
      let __pity = getJackpotPity();
      let spins = 0;
      while (tokens > 0) {
        tokens--;
        spins++;
        const __activeCap = getAndBumpActiveCap();
        const __cap0 = Math.max(0, Math.min(100, __activeCap + __pity));
        const __scale = __pSumRaw > __cap0 ? (__cap0 / __pSumRaw) : 1;
        const __pList = __pListRaw.map(v => v * __scale);
        const __pSum = __pList.reduce((a,b)=>a+b, 0);
        if ((__pSum > 0) && (Math.random() * 100) < __pSum) {
          // Jackpot spin: pick which reward proportional to targets
          let rr = Math.random() * __pSum;
          let picked = rewards[rewards.length - 1];
          for (let i=0;i<rewards.length;i++){
            const v = __pList[i];
            if (rr < v){ picked = rewards[i]; break; }
            rr -= v;
          }
          jackpots.push(picked);
          __pity = 0; // reset pity on jackpot
        } else {
          // Normal spin: independent reels, but ensure not triple; refund on two-match
          const r1 = getWeightedRandom();
          const r2 = getWeightedRandom();
          let r3 = getWeightedRandom();
          if (r1.emoji === r2.emoji && r2.emoji === r3.emoji){
            let alt;
            do { alt = getWeightedRandom(); } while (alt.emoji === r1.emoji && rewards.length > 1);
            r3 = alt;
          }
          if (r1.emoji === r2.emoji || r2.emoji === r3.emoji || r1.emoji === r3.emoji){
            tokens++; // refund
          }
          __pity += 1; // no jackpot this spin
        }
      }
      setStoredTokens(tokens);
      try{ setJackpotPity(__pity); }catch(_){/* no-op */}

      if (jackpots.length) {
        const names = jackpots.map(j => j.name).join(', ');
        showMessage(`Jackpots: ${jackpots.length}\n${names}`);
        playSound('jackpot');
        createConfetti();
      } else {
        showMessage('No jackpots this run.');
        playSound('lose');
      }

      spinning = false;
      if (leverContainer) leverContainer.classList.add('disabled');
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
      playSound('tick');
    }

    // resetTokens removed on request

    function openSettings() {
      document.getElementById('modalOverlay').classList.remove('hidden');
      try{ const b = document.getElementById('soundBtn'); if (b) b.textContent = soundEnabled ? '🔊' : '🔇'; }catch(_){/* no-op */}
      renderRewards();
      playSound('tick');
    }

    function closeSettings(event) {
      if (!event || event.target.id === 'modalOverlay') {
        document.getElementById('modalOverlay').classList.add('hidden');
        playSound('tick');
      }
    }

    function renderRewards() {
      const list = document.getElementById('rewardList');
      list.innerHTML = '';
      // Sort by rarity descending: Legendary -> Epic -> Rare -> Uncommon -> Common -> Custom
      try{
        const rank = { Legendary:5, Epic:4, Rare:3, Uncommon:2, Common:1, Custom:0 };
        rewards.forEach(r => { if (!r.rarity) r.rarity = getNearestRarity(r.probability); });
        rewards.sort((a,b)=> (rank[b.rarity||'Custom']||0) - (rank[a.rarity||'Custom']||0));
      }catch(_){/* no-op */}
      
      rewards.forEach((reward, index) => {
        const item = document.createElement('div');
        item.className = 'reward-item';
        item.innerHTML = `
          <input type="text" class="reward-emoji" value="${reward.emoji}" onchange="updateReward(${index}, 'emoji', this.value)" maxlength="2">
          <input type="text" class="reward-name" value="${reward.name}" onchange="updateReward(${index}, 'name', this.value)">
          <input type="number" class="reward-prob" value="${reward.probability}" onchange="updateReward(${index}, 'probability', this.value)" min="0" step="1">
          <button class="delete-btn" onclick="deleteReward(${index})" ${rewards.length <= 1 ? 'disabled' : ''}>🗑️</button>
        `;
        list.appendChild(item);
        try{
          const delBtn = item.querySelector('.delete-btn');
          const nameEl = item.querySelector('.reward-name');
          const probEl = item.querySelector('.reward-prob');
          const sel = document.createElement('select');
          sel.className = 'rarity-select';
          ['Common','Uncommon','Rare','Epic','Legendary','Custom'].forEach(function(k){
            const o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o);
          });
          const r = reward.rarity || getNearestRarity(reward.probability);
          sel.value = r;
          sel.addEventListener('change', function(){ setRewardRarity(index, this.value); });
          if (delBtn) delBtn.insertAdjacentElement('beforebegin', sel);
          const col = rarityColor(r);
          if (nameEl) nameEl.style.color = col;
          if (probEl) probEl.style.borderColor = col;
        }catch(_){/* no-op */}
      });
      
      updateTotalProb();
      // Save any defaults that may have been adjusted elsewhere
      try{ saveRewards(); }catch(_){/* no-op */}
      // Decorate rows: show exact jackpot% per reward (jackpot-first model)
      try{
        const items = document.querySelectorAll('#rewardList .reward-item');
        items.forEach((it, idx)=>{
          const pi = it.querySelector('.reward-prob');
          if (!pi) return;
          let span = it.querySelector('.jackpot-info');
          if (!span){
            span = document.createElement('span');
            span.className = 'jackpot-info';
            span.style.marginLeft = '8px';
            span.style.color = '#6b705c';
            pi.insertAdjacentElement('afterend', span);
          }
          const v = Math.max(0, parseFloat(rewards[idx]?.probability)||0);
          span.textContent = `Jackpot: ${v.toFixed(1)}%`;
        });
      }catch(_){/* no-op */}
      try{ updateTwoMatchOddsDisplay(); }catch(_){/* no-op */}
    }

    function updateReward(index, field, value) {
      if (field === 'probability') {
        rewards[index][field] = parseFloat(value) || 0;
        // manual change -> mark as Custom
        rewards[index].rarity = 'Custom';
      } else {
        rewards[index][field] = value;
      }
      updateTotalProb();
      try{ saveRewards(); }catch(_){/* no-op */}
      try{ renderRewards(); }catch(_){/* no-op */}
    }

    function setRewardRarity(index, rarity){
      try{
        const r = String(rarity||'Custom');
        rewards[index].rarity = r;
        const preset = RARITY_PRESETS[r];
        if (preset && typeof preset.pct === 'number'){
          rewards[index].probability = preset.pct;
        }
        saveRewards();
        renderRewards();
      }catch(_){/* no-op */}
    }

    function deleteReward(index) {
      if (rewards.length > 1) {
        rewards.splice(index, 1);
        renderRewards();
        playSound('tick');
        try{ saveRewards(); }catch(_){/* no-op */}
      }
    }

    function addReward() {
      const emoji = document.getElementById('newEmoji').value;
      const name = document.getElementById('newName').value;
      const raritySel = document.getElementById('newRarity');
      const rarity = raritySel ? String(raritySel.value||'Common') : 'Common';
      const prob = (RARITY_PRESETS[rarity] && typeof RARITY_PRESETS[rarity].pct === 'number')
        ? RARITY_PRESETS[rarity].pct : 20;
      
      if (emoji && name) {
        rewards.push({ emoji, name, probability: prob, rarity });
        document.getElementById('newEmoji').value = '';
        document.getElementById('newName').value = '';
        if (raritySel) raritySel.value = 'Common';
        renderRewards();
        playSound('tick');
        try{ saveRewards(); }catch(_){/* no-op */}
      }
    }

    function updateTotalProb() {
      const total = rewards.reduce((sum, r) => sum + r.probability, 0);
      const el = document.getElementById('totalProb');
      if (el) el.textContent = total;
    }
    
    // Live two-match odds (overall)
    function updateTwoMatchOddsDisplay(){
      try{
        const w = computeReelWeightsFromJackpots();
        let p = 0;
        for (let i=0;i<w.length;i++){
          const wi = w[i] || 0;
          p += 3 * wi * wi * (1 - wi);
        }
        const el = document.getElementById('twoMatchOdds');
        if (el) el.textContent = `${(p*100).toFixed(1)}%`;
      }catch(_){/* no-op */}
    }

    // Set default reel placeholders to an image instead of question marks
    ['reel1','reel2','reel3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<img class="reel-placeholder" src="./assets/icon.ico" alt="coco">';
    });

    // Initialize (bg dots disabled; spacer handles layout)
    // initBgDots();
    // Ensure lever click always triggers spin, even if inline handler fails
    function bindLeverClick(){
      try{
        const lc = document.querySelector('.lever-container');
        if (lc && !lc.__spinBound){
          lc.addEventListener('click', function(e){ e.preventDefault(); spin(); });
          lc.__spinBound = true;
        }
      }catch(_){/* no-op */}
    }
    bindLeverClick();
    setTimeout(bindLeverClick, 0);
    document.addEventListener('DOMContentLoaded', bindLeverClick);
    // Seed counts on load
    (function(){ updateTokenDisplays(tokens); })();
    // removed: symbol count slider binding
