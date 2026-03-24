const STARTING_COINS = 0;
const MAX_SPINS = 10;

const state = {
  coins: STARTING_COINS,
  lastWin: 0,
  isSpinning: false,
  isStarted: false,
  playerName: "",
  spinsUsed: 0,
  leaderboard: [],
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

boot();

async function boot() {
  renderHud();
  toggleControls();
  renderLeaderboard([]);
  renderDefaultReels();
  await refreshLeaderboard();
}

async function startGame() {
  const playerName = refs.playerEmail.value.trim();
  if (!playerName) {
    refs.statusText.textContent = "請先輸入 Xinyi 能辨識的名字。";
    refs.playerEmail.focus();
    return;
  }

  refs.startButton.disabled = true;
  refs.statusText.textContent = "報到中...";

  try {
    const data = await apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({ name: playerName }),
    });

    state.playerName = data.player.name;
    state.coins = data.player.score;
    state.spinsUsed = data.player.spinsUsed;
    state.lastWin = 0;
    state.isStarted = true;
    state.leaderboard = data.leaderboard;

    refs.gatePanel.classList.add("is-hidden");
    refs.gameArea.classList.remove("is-hidden");

    refs.statusText.textContent =
      state.spinsUsed >= MAX_SPINS
        ? `${state.playerName} 已用完 10 次機會。`
        : `${state.playerName}，你還有 ${MAX_SPINS - state.spinsUsed} 次機會。`;

    playClickSound();
    renderHud();
    renderLeaderboard(state.leaderboard);
    toggleControls();
  } catch (error) {
    refs.statusText.textContent = "報到失敗，請稍後再試。";
    refs.startButton.disabled = false;
  }
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
  state.lastWin = 0;
  clearWinningState();
  renderHud();
  toggleControls();
  refs.statusText.textContent = "訊號解碼中...";

  try {
    const data = await apiRequest("/api/spin", {
      method: "POST",
      body: JSON.stringify({ name: state.playerName }),
    });

    const results = data.results || [];
    for (let index = 0; index < refs.reels.length; index += 1) {
      await spinReel(refs.reels[index], 700 + index * 220, results[index]);
    }

    state.coins = data.player.score;
    state.spinsUsed = data.player.spinsUsed;
    state.lastWin = data.outcome.win;
    state.leaderboard = data.leaderboard;

    applyOutcome(data.outcome);
    renderHud();
    renderLeaderboard(state.leaderboard);

    if (state.spinsUsed >= MAX_SPINS) {
      finalizeRun("10 次拉霸機會已用完，本局結束。");
      return;
    }
  } catch (error) {
    refs.statusText.textContent = "拉霸失敗，請稍後再試。";
  } finally {
    state.isSpinning = false;
    toggleControls();
  }
}

function spinReel(reel, duration, finalSymbol) {
  return new Promise((resolve) => {
    reel.classList.remove("is-winning");
    reel.classList.add("is-spinning");

    const symbolNode = reel.querySelector(".symbol");
    const symbols = ["🍒", "🍋", "🔔", "💎", "7", "⭐"];
    const interval = setInterval(() => {
      symbolNode.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    }, 90);

    setTimeout(() => {
      clearInterval(interval);
      symbolNode.textContent = finalSymbol;
      reel.classList.remove("is-spinning");
      resolve(finalSymbol);
    }, duration);
  });
}

function applyOutcome(outcome) {
  const left = MAX_SPINS - state.spinsUsed;
  refs.statusText.textContent = left > 0 ? `${outcome.message} 還剩 ${left} 次機會。` : `${outcome.message} 10 次機會已用完。`;
  playOutcomeSound(outcome.win > 0, outcome.win >= 500);

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
  refs.startButton.disabled = state.isSpinning;
}

function clearWinningState() {
  refs.reels.forEach((reel) => reel.classList.remove("is-winning"));
}

function renderDefaultReels() {
  const defaultSymbols = ["🍒", "💎", "⭐"];
  refs.reels.forEach((reel, index) => {
    reel.querySelector(".symbol").textContent = defaultSymbols[index];
  });
}

function resetGame() {
  if (state.isSpinning) {
    return;
  }

  state.coins = STARTING_COINS;
  state.lastWin = 0;
  state.isStarted = false;
  state.spinsUsed = 0;
  state.playerName = "";
  refs.playerEmail.value = "";
  refs.gatePanel.classList.remove("is-hidden");
  refs.gameArea.classList.add("is-hidden");
  clearWinningState();
  renderDefaultReels();
  refs.statusText.textContent = "已重置，請輸入名字重新開始。";
  renderHud();
  renderLeaderboard(state.leaderboard);
  toggleControls();
}

function finalizeRun(message) {
  state.isStarted = false;
  refs.gameArea.classList.add("is-hidden");
  refs.gatePanel.classList.remove("is-hidden");
  refs.statusText.textContent = message;
  toggleControls();
}

async function refreshLeaderboard() {
  try {
    const data = await apiRequest("/api/leaderboard");
    state.leaderboard = data.leaderboard || [];
    renderLeaderboard(state.leaderboard);
  } catch (error) {
    refs.leaderboardList.innerHTML = "<li>排行榜暫時讀取失敗。</li>";
  }
}

function renderLeaderboard(leaderboard) {
  refs.leaderboardList.innerHTML = "";

  if (!leaderboard.length) {
    refs.leaderboardList.innerHTML = "<li>還沒有排名，來當第一個上榜的人。</li>";
    return;
  }

  leaderboard.forEach((entry, index) => {
    const item = document.createElement("li");
    const crown = index < 3 ? " 👑" : "";
    item.innerHTML = `<strong>${escapeHtml(entry.name)}</strong>${crown} - ${entry.score} coins`;
    refs.leaderboardList.appendChild(item);
  });
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
