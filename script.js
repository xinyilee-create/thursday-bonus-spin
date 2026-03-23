const SYMBOLS = ["🍒", "🍋", "🔔", "💎", "7", "⭐"];
const STARTING_COINS = 0;
const JACKPOT = 500;
const LEADERBOARD_KEY = "neon-slot-leaderboard-v5";
const ATTEMPT_KEY = "thursday-bonus-spin-attempts-v5";
const MAX_SPINS = 10;

const state = {
  coins: STARTING_COINS,
  lastWin: 0,
  isSpinning: false,
  isStarted: false,
  playerEmail: "",
  bestCoins: STARTING_COINS,
  spinsUsed: 0,
};

const refs = {
  reels: Array.from(document.querySelectorAll(".reel")),
  playerEmail: document.querySelector("#playerEmail"),
  startButton: document.querySelector("#startButton"),
  gatePanel: document.querySelector("#gatePanel"),
  gameArea: document.querySelector("#gameArea"),
  coinsValue: document.querySelector("#coinsValue"),
  winValue: document.querySelector("#winValue"),
  spinsLeftValue: document.querySelector("#spinsLeftValue"),
  statusText: document.querySelector("#statusText"),
  spinButton: document.querySelector("#spinButton"),
  resetButton: document.querySelector("#resetButton"),
  leaderboardList: document.querySelector("#leaderboardList"),
};

refs.startButton.addEventListener("click", startGame);
refs.spinButton.addEventListener("click", spin);
refs.resetButton.addEventListener("click", resetGame);

renderHud();
renderLeaderboard();
toggleControls();

function startGame() {
  const playerName = refs.playerEmail.value.trim();
  if (!playerName) {
    refs.statusText.textContent = "請先輸入 Xinyi 能辨識的名字。";
    refs.playerEmail.focus();
    return;
  }

  state.playerEmail = playerName;
  ensureParticipant(state.playerEmail);
  state.spinsUsed = getAttempts(state.playerEmail);
  state.isStarted = true;
  refs.gatePanel.classList.add("is-hidden");
  refs.gameArea.classList.remove("is-hidden");
  refs.statusText.textContent =
    state.spinsUsed >= MAX_SPINS
      ? `${state.playerEmail} 已用完 10 次機會。`
      : `${state.playerEmail}，你還有 ${MAX_SPINS - state.spinsUsed} 次機會。`;
  playClickSound();
  renderHud();
  renderLeaderboard();
  toggleControls();
}

async function spin() {
  if (state.isSpinning || !state.isStarted) {
    if (!state.isStarted) {
      refs.statusText.textContent = "請先輸入名字並按報到並開始。";
    }
    return;
  }

  if (state.spinsUsed >= MAX_SPINS) {
    finalizeRun("你已用完 10 次拉霸機會，本局結束。");
    return;
  }

  state.isSpinning = true;
  playClickSound();
  state.spinsUsed += 1;
  setAttempts(state.playerEmail, state.spinsUsed);
  state.lastWin = 0;
  clearWinningState();
  renderHud();
  toggleControls();

  refs.statusText.textContent = "訊號解碼中...";

  const targetResults = rollSpinResult();
  const results = [];
  for (let index = 0; index < refs.reels.length; index += 1) {
    const result = await spinReel(refs.reels[index], 700 + index * 220, targetResults[index]);
    results.push(result);
  }

  const outcome = evaluateSpin(results);
  applyOutcome(outcome);

  state.isSpinning = false;
  toggleControls();
  renderHud();

  if (state.spinsUsed >= MAX_SPINS) {
    finalizeRun("10 次拉霸機會已用完，本局結束。");
  }
}

function spinReel(reel, duration, finalSymbol) {
  return new Promise((resolve) => {
    reel.classList.remove("is-winning");
    reel.classList.add("is-spinning");

    const symbolNode = reel.querySelector(".symbol");
    const interval = setInterval(() => {
      symbolNode.textContent = randomSymbol();
    }, 90);

    setTimeout(() => {
      clearInterval(interval);
      symbolNode.textContent = finalSymbol;
      reel.dataset.symbol = finalSymbol;
      reel.classList.remove("is-spinning");
      resolve(finalSymbol);
    }, duration);
  });
}

function evaluateSpin(results) {
  const stars = results.filter((item) => item === "⭐").length;
  const counts = results.reduce((map, symbol) => {
    map[symbol] = (map[symbol] || 0) + 1;
    return map;
  }, {});

  if (stars === 3) {
    return {
      win: JACKPOT,
      message: "JACKPOT! 三顆星星全中！",
      winningSymbols: ["⭐"],
    };
  }

  const pureMatch = Object.entries(counts).find(([symbol, count]) => symbol !== "⭐" && count === 3);
  if (pureMatch) {
    return {
      win: 80,
      message: `${pureMatch[0]} 三連線，中獎 80 金幣！`,
      winningSymbols: [pureMatch[0]],
    };
  }

  const twoPlusStar = Object.entries(counts).find(([symbol, count]) => symbol !== "⭐" && count === 2 && stars === 1);
  if (twoPlusStar) {
    return {
      win: 40,
      message: `星星補位成功，中獎 40 金幣！`,
      winningSymbols: [twoPlusStar[0], "⭐"],
    };
  }

  const plainPair = Object.entries(counts).find(([symbol, count]) => symbol !== "⭐" && count === 2 && stars === 0);
  if (plainPair) {
    return {
      win: 20,
      message: `${plainPair[0]} 兩個相同，中獎 20 金幣！`,
      winningSymbols: [plainPair[0]],
    };
  }

  return {
    win: 0,
    message: "這次沒有連線，再試一次。",
    winningSymbols: [],
  };
}

function applyOutcome(outcome) {
  state.lastWin = outcome.win;
  state.coins += outcome.win;
  state.bestCoins = Math.max(state.bestCoins, state.coins);
  const left = MAX_SPINS - state.spinsUsed;
  refs.statusText.textContent = left > 0 ? `${outcome.message} 還剩 ${left} 次機會。` : `${outcome.message} 10 次機會已用完。`;
  playOutcomeSound(outcome.win > 0, outcome.win >= JACKPOT);

  if (outcome.winningSymbols.length) {
    refs.reels.forEach((reel) => {
      const symbol = reel.querySelector(".symbol").textContent;
      if (outcome.winningSymbols.includes(symbol)) {
        reel.classList.add("is-winning");
      }
    });
  }
}

function renderHud() {
  refs.coinsValue.textContent = String(state.coins);
  refs.winValue.textContent = String(state.lastWin);
  refs.spinsLeftValue.textContent = String(Math.max(0, MAX_SPINS - state.spinsUsed));
}

function toggleControls() {
  refs.spinButton.disabled = state.isSpinning || !state.isStarted || state.spinsUsed >= MAX_SPINS;
  refs.resetButton.disabled = state.isSpinning;
}

function clearWinningState() {
  refs.reels.forEach((reel) => reel.classList.remove("is-winning"));
}

function resetGame() {
  if (state.isSpinning) {
    return;
  }

  if (state.isStarted && state.playerEmail) {
    saveScore(state.playerEmail, state.bestCoins);
  }

  state.coins = STARTING_COINS;
  state.lastWin = 0;
  state.bestCoins = STARTING_COINS;
  state.isStarted = false;
  state.spinsUsed = 0;
  state.playerEmail = "";
  refs.playerEmail.value = "";
  refs.gatePanel.classList.remove("is-hidden");
  refs.gameArea.classList.add("is-hidden");
  clearWinningState();
  refs.statusText.textContent = "已重置，請輸入名字重新開始。";

  const defaultSymbols = ["🍒", "💎", "⭐"];
  refs.reels.forEach((reel, index) => renderReelSymbol(reel, defaultSymbols[index]));

  renderHud();
  renderLeaderboard();
  toggleControls();
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function renderReelSymbol(reel, symbol) {
  reel.dataset.symbol = symbol;
  reel.querySelector(".symbol").textContent = symbol;
}

function randomNonStarSymbol() {
  const pool = SYMBOLS.filter((symbol) => symbol !== "⭐");
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomDifferentNonStarSymbol(excluded) {
  const pool = SYMBOLS.filter((symbol) => symbol !== "⭐" && symbol !== excluded);
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle(items) {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
}

function rollSpinResult() {
  const roll = Math.random();

  if (roll < 0.04) {
    return ["⭐", "⭐", "⭐"];
  }

  if (roll < 0.2) {
    const symbol = randomNonStarSymbol();
    return [symbol, symbol, symbol];
  }

  if (roll < 0.45) {
    const symbol = randomNonStarSymbol();
    return shuffle([symbol, symbol, "⭐"]);
  }

  if (roll < 0.75) {
    const symbol = randomNonStarSymbol();
    const other = randomDifferentNonStarSymbol(symbol);
    return shuffle([symbol, symbol, other]);
  }

  return [randomSymbol(), randomSymbol(), randomSymbol()];
}

function finalizeRun(message) {
  saveScore(state.playerEmail, state.bestCoins);
  state.isStarted = false;
  refs.gameArea.classList.add("is-hidden");
  refs.gatePanel.classList.remove("is-hidden");
  refs.statusText.textContent = message;
  renderLeaderboard();
  toggleControls();
}

function loadLeaderboard() {
  try {
    const saved = localStorage.getItem(LEADERBOARD_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.map((entry) => ({
      ...entry,
      registeredAt: entry.registeredAt || entry.achievedAt || Date.now(),
    }));
  } catch (error) {
    return [];
  }
}

function saveScore(name, score) {
  if (!name) {
    return;
  }

  const now = Date.now();
  const leaderboard = loadLeaderboard();
  const existing = leaderboard.find((entry) => entry.name === name);

  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.achievedAt = now;
    }
  } else {
    leaderboard.push({ name, score, achievedAt: now, registeredAt: now });
  }

  const next = leaderboard.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.achievedAt || 0) - (b.achievedAt || 0);
  });

  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next));
}

function ensureParticipant(name) {
  if (!name) {
    return;
  }

  const leaderboard = loadLeaderboard();
  const existing = leaderboard.find((entry) => entry.name === name);

  if (!existing) {
    const now = Date.now();
    leaderboard.push({ name, score: 0, achievedAt: now, registeredAt: now });
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  }
}

function renderLeaderboard() {
  const leaderboard = loadLeaderboard();
  refs.leaderboardList.innerHTML = "";

  if (!leaderboard.length) {
    refs.leaderboardList.innerHTML = "<li>還沒有排名，來當第一個上榜的人。</li>";
    return;
  }

  leaderboard.forEach((entry, index) => {
    const item = document.createElement("li");
    const crown = index < 3 ? " 👑" : "";
    item.innerHTML = `<strong>${entry.name}</strong>${crown} - ${entry.score} coins`;
    refs.leaderboardList.appendChild(item);
  });
}

function loadAttempts() {
  try {
    const saved = localStorage.getItem(ATTEMPT_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    return {};
  }
}

function getAttempts(email) {
  const attempts = loadAttempts();
  return attempts[email] || 0;
}

function setAttempts(email, count) {
  const attempts = loadAttempts();
  attempts[email] = count;
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts));
}

function playClickSound() {
  playToneSequence([
    [520, 0.04, "square"],
    [660, 0.05, "square"],
  ]);
}

function playOutcomeSound(isWin, isJackpot) {
  if (isJackpot) {
    playToneSequence([
      [660, 0.08, "triangle"],
      [880, 0.08, "triangle"],
      [1180, 0.14, "triangle"],
    ]);
    return;
  }

  if (isWin) {
    playToneSequence([
      [620, 0.06, "sine"],
      [820, 0.09, "sine"],
    ]);
    return;
  }

  playToneSequence([[220, 0.08, "sawtooth"]]);
}

function playToneSequence(notes) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audio = new AudioContextClass();
  let cursor = audio.currentTime;

  notes.forEach(([frequency, duration, type]) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(0.05, cursor + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start(cursor);
    oscillator.stop(cursor + duration);
    cursor += duration;
  });

  setTimeout(() => {
    if (audio.state !== "closed") {
      audio.close().catch(() => {});
    }
  }, 500);
}
