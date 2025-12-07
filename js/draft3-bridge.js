// Bridge to integrate draft3 progress tracker with pretty.js timer
(function(){
  // Public hooks so pretty.js controls tracker
  window.d3AdvanceProgress = function(){
    if (typeof completeSession === 'function') completeSession();
  };
  window.d3ResetProgress = function(){
    if (typeof resetAll === 'function') resetAll();
    if (window.timer) timer.sessions = 0;
    if (typeof stopTimer === 'function') stopTimer();
    if (typeof switchMode === 'function') switchMode('focus');
  };
  window.d3SetTotalSessions = function(n){
    var v = Math.max(1, parseInt(n,10) || 1);
    if (typeof sessions !== 'undefined') sessions = v;
    var sv = document.getElementById('sessionsValue');
    if (sv) sv.textContent = v;
    if (typeof landedDots !== 'undefined'){
      landedDots = Math.min(landedDots, v);
      if (typeof activeLines !== 'undefined') activeLines = landedDots;
      if (typeof spritePosition !== 'undefined') spritePosition = landedDots;
    }
    if (typeof render === 'function') render();
  };

  // Also wire the visible Reset button to reset timer as requested
  document.addEventListener('DOMContentLoaded', function(){
    var rb = document.getElementById('resetBtn');
    if (rb) rb.addEventListener('click', function(){
      if (window.d3ResetProgress) window.d3ResetProgress();
    });
  });
})();
