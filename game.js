/* game.js
- Responsive grid board (serpentine mapping)
- 3D PNG cube (tumble + settle)
- Single source-of-truth final value -> movement steps
- Step-by-step movement and snakes/ladders hooks
- Six-roll rules: accumulate rolls, jump animation on first two sixes, red glow penalty on third six
*/

// CONFIG
const BOARD_SIZE = 10;
const TOTAL = BOARD_SIZE * BOARD_SIZE;
const WIN_RULE = 'exact';

const boardImg = document.getElementById('board-img');
const boardWrapper = document.getElementById('board-wrapper');
const gridEl = document.getElementById('grid');
const token1 = document.getElementById('token1');
const token2 = document.getElementById('token2');
const diceCube = document.getElementById('dice-cube');
const rollBtn = document.getElementById('roll-btn');
const resetBtn = document.getElementById('reset-btn');
const turnText = document.getElementById('turn');
const messageEl = document.getElementById('message');
const p1posEl = document.getElementById('p1-pos');
const p2posEl = document.getElementById('p2-pos');
const controlColumn = document.querySelector('.control-column');

let positions = { 1: 1, 2: 1 };
let currentPlayer = 1;
let isAnimating = false;

// Play mode
let vsComputer = false; // set false for 2-player mode
const COMPUTER_PLAYER = 2;

// Track consecutive sixes and turn totals per player
let consecutiveSixes = { 1: 0, 2: 0 };
let turnTotal = { 1: 0, 2: 0 };

// snakes & ladders
const snakes = { 99: 76, 89: 66, 80: 57, 51: 34, 35: 12, 22: 5 };
const ladders = { 20: 58, 47: 68, 55: 76, 69: 90, 78: 97 };

// AUDIO
const sounds = {
  roll: new Audio('sounds/dice-roll.mp3'),
  move: new Audio('sounds/move.mp3'),
  snake: new Audio('sounds/snake.mp3'),
  ladder: new Audio('sounds/ladder.mp3'),
  win: new Audio('sounds/win.mp3')
};

function playSound(name) {
  const s = sounds[name];
  if (!s) return;
  s.currentTime = 0;
  s.play().catch(() => {});
}

// Dice face rotations
const faceRotations = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 0, y: 180 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 }
};

// Build grid
function buildGrid() {
  gridEl.innerHTML = '';
  for (let i = 0; i < TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    gridEl.appendChild(d);
  }

  const elems = Array.from(gridEl.children);
  elems.forEach((el, idx) => {
    const rowFromTop = Math.floor(idx / BOARD_SIZE);
    const colFromLeft = idx % BOARD_SIZE;
    const rowFromBottom = BOARD_SIZE - 1 - rowFromTop;
    let cellInRow;
    if (rowFromBottom % 2 === 0) {
      cellInRow = colFromLeft;
    } else {
      cellInRow = (BOARD_SIZE - 1 - colFromLeft);
    }
    const cellNumber = rowFromBottom * BOARD_SIZE + (cellInRow + 1);
    el.dataset.cell = cellNumber;
  });

  requestAnimationFrame(() => { updateTokenSize(); placeTokens(); });
}

// Token size
let _tokenSizeRaf = null;
function updateTokenSize() {
  if (_tokenSizeRaf) cancelAnimationFrame(_tokenSizeRaf);
  _tokenSizeRaf = requestAnimationFrame(() => {
    const cell = gridEl.querySelector('.cell');
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    const fraction = 0.58;
    const raw = rect.width * fraction;
    const size = Math.max(10, Math.min(48, Math.round(raw)));
    document.documentElement.style.setProperty('--token-size', `${size}px`);
  });
}

// Cell center
function getCellCenter(cellNumber) {
  const cell = gridEl.querySelector(`[data-cell="${cellNumber}"]`);
  const wrapRect = boardWrapper.getBoundingClientRect();
  if (!cell) {
    console.warn(`getCellCenter: missing cell ${cellNumber}`);
    return { x: wrapRect.width / 2, y: wrapRect.height / 2 };
  }
  const cellRect = cell.getBoundingClientRect();
  return {
    x: (cellRect.left - wrapRect.left) + cellRect.width / 2,
    y: (cellRect.top - wrapRect.top) + cellRect.height / 2
  };
}

// Place tokens
function placeTokens() {
  const same = positions[1] === positions[2];
  const c1 = getCellCenter(positions[1]);
  const c2 = getCellCenter(positions[2]);
  const offset = 18;

  if (same) {
    token1.style.left = `${c1.x - offset}px`;
    token2.style.left = `${c2.x + offset}px`;
  } else {
    token1.style.left = `${c1.x}px`;
    token2.style.left = `${c2.x}px`;
  }

  token1.style.top = `${c1.y}px`;
  token2.style.top = `${c2.y}px`;

  p1posEl.textContent = positions[1];
  p2posEl.textContent = positions[2];
}

// Dice tumble
function throwDiceVisual(finalValue) {
  const extra = 360 * 3;
  const rot = faceRotations[finalValue];
  diceCube.style.transition = 'transform 360ms cubic-bezier(.33,.9,.28,1)';
  const randX = (Math.random() * 720) - 360;
  const randY = (Math.random() * 720) - 360;
  diceCube.style.transform =
    `translateY(-80px) rotateX(${randX}deg) rotateY(${randY}deg)`;
  setTimeout(() => {
    diceCube.style.transition = 'transform 720ms cubic-bezier(.2,.9,.2,1)';
    diceCube.style.transform =
      `translateY(0px) rotateX(${extra + rot.x}deg) rotateY(${extra + rot.y}deg)`;
  }, 360);
}

// Snake/ladder arc
function animateSnakeOrLadder(player, targetCell, type, cb) {
  const token = player === 1 ? token1 : token2;
  const startCell = positions[player];
  const start = getCellCenter(startCell);
  const end = getCellCenter(targetCell);
  const frames = 20;
  let frame = 0;

  if (type === 'ladder') playSound('ladder');
  if (type === 'snake') playSound('snake');

  const jump = setInterval(() => {
    frame++;
    const t = frame / frames;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const x = start.x + (end.x - start.x) * ease;
    const y = start.y + (end.y - start.y) * ease;
    const lift = Math.sin(Math.PI * t) * 18;
    token.style.left = `${x}px`;
    token.style.top = `${y - lift}px`;

    if (frame >= frames) {
      clearInterval(jump);
      positions[player] = targetCell;
      placeTokens();
      messageEl.textContent = type === 'ladder'
        ? `🪜 Ladder! up to ${positions[player]}`
        : `🐍 Snake! down to ${positions[player]}`;
      cb && cb();
    }
  }, 22);
}

// Step-by-step movement with slide
function animateSteps(player, steps, cb) {
  if (steps <= 0) { cb && cb(); return; }
  let count = 0;
  const token = player === 1 ? token1 : token2;

  const tick = setInterval(() => {
    count++;
    positions[player] = Math.min(TOTAL, positions[player] + 1);

    // hop each step using CSS class
    token.classList.add('slide');
    token.addEventListener('animationend', () => {
      token.classList.remove('slide');
    }, { once: true });

    playSound('move');
    placeTokens();

    if (count >= steps) {
      clearInterval(tick);
      const landed = positions[player];
      if (ladders[landed]) {
        animateSnakeOrLadder(player, ladders[landed], 'ladder', cb);
      } else if (snakes[landed]) {
        animateSnakeOrLadder(player, snakes[landed], 'snake', cb);
      } else {
        messageEl.textContent = '';
        cb && cb();
      }
    }
  }, 260);
}

// Unified roll handler with strict exact-win + AI-safe six logic
async function handleRoll() {
  if (isAnimating) return;
  isAnimating = true;
  rollBtn.disabled = true;
  messageEl.textContent = 'Rolling...';

  const final = Math.floor(Math.random() * 6) + 1;
  playSound('roll');
  throwDiceVisual(final);
  await new Promise(r => setTimeout(r, 1150));

  const token = currentPlayer === 1 ? token1 : token2;
  const startPos = positions[currentPlayer];
  const accumulated = turnTotal[currentPlayer];
  const intended = startPos + accumulated + final;

  /* =========================
     SIX HANDLING (STRICT)
  ========================= */

  if (final === 6) {
    // ❌ Six cannot be used at all → no bonus, no move
    if (WIN_RULE === 'exact' && intended > TOTAL) {
      messageEl.textContent = `Need exact roll to reach ${TOTAL}.`;
      turnTotal[currentPlayer] = 0;
      consecutiveSixes[currentPlayer] = 0;
      currentPlayer = currentPlayer === 1 ? 2 : 1;
      turnText.textContent = `${playerName(currentPlayer)}'s Turn`;
      rollBtn.disabled = false;
      isAnimating = false;
      highlightCurrentPlayer();
      if (vsComputer && currentPlayer === COMPUTER_PLAYER) {
        setTimeout(computerMove, 900);
      }
      return;
    }

    // ✅ Apply six
    turnTotal[currentPlayer] += 6;

    // 🎯 Exact win (single or accumulated) → WIN, NO bonus roll
    if (startPos + turnTotal[currentPlayer] === TOTAL) {
      consecutiveSixes[currentPlayer] = 0;
      animateSteps(currentPlayer, turnTotal[currentPlayer], () => {
        messageEl.textContent = `🎉 ${playerName(currentPlayer)} wins!`;
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 250,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#ffd700', '#ff6b6b', '#51cf66', '#2b6ef6']
          });
        }
        playSound('win');
        rollBtn.disabled = true;
        isAnimating = false;
      });
      return;
    }

    // ➕ Count six
    consecutiveSixes[currentPlayer]++;

    // ❌ Third six penalty
    if (consecutiveSixes[currentPlayer] === 3) {
      token.classList.add('penalty');
      setTimeout(() => token.classList.remove('penalty'), 1500);
      messageEl.textContent = `⚠️ ${playerName(currentPlayer)} rolled three sixes! Turn skipped.`;
      turnTotal[currentPlayer] = 0;
      consecutiveSixes[currentPlayer] = 0;
      currentPlayer = currentPlayer === 1 ? 2 : 1;
      turnText.textContent = `${playerName(currentPlayer)}'s Turn`;
      rollBtn.disabled = false;
      isAnimating = false;
      highlightCurrentPlayer();
      if (vsComputer && currentPlayer === COMPUTER_PLAYER) {
        setTimeout(computerMove, 900);
      }
      return;
    }

    // 🎁 Bonus roll (safe)
    token.classList.add('jump');
    token.addEventListener('animationend', () => {
      token.classList.remove('jump');
    }, { once: true });

    messageEl.textContent = `🎁 ${playerName(currentPlayer)} rolled a 6, roll again!`;
    rollBtn.disabled = false;
    isAnimating = false;
    if (vsComputer && currentPlayer === COMPUTER_PLAYER) {
      setTimeout(computerMove, 700);
    }
    return;
  }

  /* =========================
     NON-SIX MOVE
  ========================= */

  turnTotal[currentPlayer] += final;
  const finalIntended = startPos + turnTotal[currentPlayer];

  if (WIN_RULE === 'exact' && finalIntended > TOTAL) {
    messageEl.textContent = `Need exact roll to reach ${TOTAL}.`;
    turnTotal[currentPlayer] = 0;
    consecutiveSixes[currentPlayer] = 0;
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    turnText.textContent = `${playerName(currentPlayer)}'s Turn`;
    rollBtn.disabled = false;
    isAnimating = false;
    highlightCurrentPlayer();
    if (vsComputer && currentPlayer === COMPUTER_PLAYER) {
      setTimeout(computerMove, 900);
    }
    return;
  }

  // ✅ Normal move
  const steps = turnTotal[currentPlayer];
  turnTotal[currentPlayer] = 0;
  consecutiveSixes[currentPlayer] = 0;

  animateSteps(currentPlayer, steps, () => {
    if (positions[currentPlayer] === TOTAL) {
      messageEl.textContent = `🎉 ${playerName(currentPlayer)} wins!`;
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 250,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#ffd700', '#ff6b6b', '#51cf66', '#2b6ef6']
        });
      }
      playSound('win');
      rollBtn.disabled = true;
      isAnimating = false;
      return;
    }

    currentPlayer = currentPlayer === 1 ? 2 : 1;
    turnText.textContent = `${playerName(currentPlayer)}'s Turn`;
    rollBtn.disabled = false;
    isAnimating = false;
    highlightCurrentPlayer();
    if (vsComputer && currentPlayer === COMPUTER_PLAYER) {
      setTimeout(computerMove, 900);
    }
  });
}

function computerMove() {
  if (!vsComputer) return;
  if (currentPlayer !== COMPUTER_PLAYER) return;
  if (isAnimating) return;
  messageEl.textContent = '🤖 AI is rolling...';
  setTimeout(() => { handleRoll(); }, 900);
}

// Highlight current player's token
function highlightCurrentPlayer() {
  token1.classList.toggle('token-active', currentPlayer === 1);
  token2.classList.toggle('token-active', currentPlayer === 2);
}

// Player2 AI in vs mode
function playerName(n) {
  if (vsComputer && n === COMPUTER_PLAYER) {
    return '🤖 AI';
  }
  return `Player ${n}`;
}

// Reset game
function resetGame() {
  positions = { 1: 1, 2: 1 };
  currentPlayer = 1;
  consecutiveSixes = { 1: 0, 2: 0 };
  turnTotal = { 1: 0, 2: 0 };
  p1posEl.textContent = 1;
  p2posEl.textContent = 1;
  turnText.textContent = `${playerName(1)}'s Turn`;
  messageEl.textContent = 'Ready';
  diceCube.style.transform = 'none';
  updateTokenSize();
  placeTokens();
  rollBtn.disabled = false;
  isAnimating = false;
  highlightCurrentPlayer();
}

// Init
function init() {
  buildGrid();
  requestAnimationFrame(() => { updateTokenSize(); placeTokens(); });

  if (boardImg) {
    if (boardImg.complete) {
      requestAnimationFrame(() => { updateTokenSize(); placeTokens(); });
    } else {
      boardImg.addEventListener('load', () =>
        requestAnimationFrame(() => { updateTokenSize(); placeTokens(); })
      );
    }
  }

  resetGame();

  /* =========================
     MODERN MODE TOGGLE (BUTTONS)
  ========================= */
  const btn2P = document.getElementById('mode-2p');
  const btnAI = document.getElementById('mode-ai');

  function setMode(isAI) {
    vsComputer = isAI;
    const p2Label = document.getElementById('p2-label');
    if (p2Label) {
      p2Label.textContent = isAI ? '🤖🟢 AI:' : '🟢 P2:';
    }
    btn2P.classList.toggle('active', !isAI);
    btnAI.classList.toggle('active', isAI);
    btn2P.setAttribute('aria-pressed', String(!isAI));
    btnAI.setAttribute('aria-pressed', String(isAI));

    messageEl.textContent = isAI
      ? '🤖 Playing vs AI'
      : '👥 Two Player Mode';

    highlightCurrentPlayer();
    if (vsComputer && currentPlayer === COMPUTER_PLAYER && !isAnimating) {
      setTimeout(computerMove, 600);
    }
  }

  btn2P.addEventListener('click', () => setMode(false));
  btnAI.addEventListener('click', () => setMode(true));
  setMode(false);

  /* =========================
     PANEL SYNC (DESKTOP ONLY)
  ========================= */
  function syncPanelSize() {
    if (!controlColumn || !boardWrapper) return;
    if (window.matchMedia('(max-width: 900px)').matches) {
      controlColumn.style.width = '';
      controlColumn.style.height = '';
      return;
    }
    const boardRect = boardWrapper.getBoundingClientRect();
    controlColumn.style.width = '';
    controlColumn.style.height = `${Math.round(boardRect.height)}px`;
  }

  syncPanelSize();
  window.addEventListener('resize', () => requestAnimationFrame(syncPanelSize));

  if (boardImg) {
    boardImg.addEventListener('load', () =>
      requestAnimationFrame(syncPanelSize)
    );
  }

  rollBtn.addEventListener('click', handleRoll);
  resetBtn.addEventListener('click', resetGame);
  window.addEventListener('resize', () =>
    requestAnimationFrame(() => { updateTokenSize(); placeTokens(); })
  );
}

// SERVICE WORKER UPDATE UI
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");

      // Show update prompt immediately if waiting already
      if (reg.waiting) {
        showUpdatePrompt(reg);
      }

      // Listen for future updates
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdatePrompt(reg);
          }
        });
      });
    } catch (e) {
      console.warn("Service Worker registration failed", e);
    }
  });

  // When the new SW takes control, hide toast and reload once
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const toast = document.getElementById("update-toast");
    if (toast) toast.hidden = true;
    window.location.reload();
  });
}

function showUpdatePrompt(reg) {
  const toast = document.getElementById("update-toast");
  const btn = document.getElementById("update-refresh-btn");
  if (!toast || !btn) return;

  toast.hidden = false;

  btn.onclick = () => {
    // Always hide banner on click after update
    toast.hidden = true;

    // If there is a waiting worker, trigger activation
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      // Fallback: just reload to pick latest assets
      window.location.reload();
    }
  };
}

init();
