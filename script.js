// ===================== CONSTANTS =====================
const SUITS = ["spades", "hearts", "clubs", "diamonds"];
const SUIT_SYMBOL = { spades: "\u2660", hearts: "\u2665", clubs: "\u2663", diamonds: "\u2666" };
const SUIT_NAME = { spades: "Spar", hearts: "Hjerter", clubs: "Kl\u00f8ver", diamonds: "Ruter" };
const RED_SUITS = ["hearts", "diamonds"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const INITIAL_RACE_DELAY = 14000; // ms before first card is drawn
const DRAW_INTERVAL = 2000;       // ms between each card draw

// track card indices (0-based) that send a horse all the way back to start
const SPECIAL_TRACK_INDEXES = [2, 5]; // = track card 3 and 6

// ===================== STATE =====================
const gameState = {
  players: [],
  horses: {
    spades: { position: 0 },
    hearts: { position: 0 },
    clubs: { position: 0 },
    diamonds: { position: 0 }
  },
  trackCards: [],
  drawPile: [],
  revealedTrackCards: 0,
  currentCard: null,
  winnerSuit: null,
  raceStarted: false
};

let raceTimeoutId = null;
let raceIntervalId = null;
let nextPlayerId = 0;

// ===================== DOM REFS =====================
const screens = {
  players: document.getElementById("screen-players"),
  race: document.getElementById("screen-race"),
  winner: document.getElementById("screen-winner")
};

const playersListEl = document.getElementById("players-list");
const addPlayerBtn = document.getElementById("add-player-btn");
const goToGameBtn = document.getElementById("go-to-game-btn");

const playerCountValueEl = document.getElementById("player-count-value");
const trackCardsRowEl = document.getElementById("track-cards-row");
const horsesColumnEl = document.getElementById("horses-column");
const lanesEl = document.getElementById("lanes");
const drawPileEl = document.getElementById("draw-pile");
const startRaceBtn = document.getElementById("start-race-btn");
const raceMusic = document.getElementById("raceMusic");

const winnersListEl = document.getElementById("winners-list");
const restartBtn = document.getElementById("restart-btn");
const replayBtn = document.getElementById("replay-btn");

// ===================== SCREEN NAVIGATION =====================
function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");
}

// ===================== DECK LOGIC =====================
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function removeAces(deck) {
  return deck.filter((card) => card.value !== "A");
}

function shuffleDeck(deck) {
  const shuffled = deck.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function setupRace() {
  const fullDeck = createDeck();
  const without4Aces = removeAces(fullDeck);
  const shuffled = shuffleDeck(without4Aces);

  gameState.trackCards = shuffled.slice(0, 7);
  gameState.drawPile = shuffled.slice(7);

  gameState.revealedTrackCards = 0;
  gameState.currentCard = null;
  gameState.winnerSuit = null;
  gameState.raceStarted = false;

  for (const suit of SUITS) {
    gameState.horses[suit].position = 0;
  }

  debugCheckDeck();
  renderTrackCards();
  renderHorses();
  renderHorsePositions();
  clearCurrentCardBadge();

  startRaceBtn.disabled = false;
  startRaceBtn.style.display = "inline-flex";
}

function debugCheckDeck() {
  const total = 4 + gameState.trackCards.length + gameState.drawPile.length;
  if (total !== 52) {
    console.warn("Deck check failed: total is", total, "expected 52");
  }
  const allCards = [...gameState.trackCards, ...gameState.drawPile];
  const unique = new Set(allCards.map((c) => c.suit + c.value));
  if (unique.size !== allCards.length) {
    console.warn("Deck check failed: duplicate cards found");
  }
}

// ===================== PLAYERS SCREEN =====================
function createPlayerRow(index, player = null) {
  const row = document.createElement("div");
  row.className = "player-row";
  row.dataset.id = nextPlayerId++;

  const defaultSuit = player?.suit ?? SUITS[index % 4];

  row.innerHTML = `
    <div class="player-index">${index + 1}</div>
    <div class="player-name-field">
      <span class="horse-icon">\u{1F40E}</span>
      <input type="text" class="player-name-input" placeholder="Navn p\u00e5 spiller..." aria-label="Navn p\u00e5 spiller ${index + 1}">
    </div>
    <select class="suit-select suit-${defaultSuit}" aria-label="Type kort for spiller ${index + 1}">
      ${SUITS.map((s) => `<option value="${s}" ${s === defaultSuit ? "selected" : ""}>${SUIT_SYMBOL[s]}</option>`).join("")}
    </select>
    <div class="sip-control">
      <button type="button" class="sip-btn sip-minus" aria-label="F\u00e6rre slurker">\u2212</button>
      <span class="sip-value">${player?.sips ?? 1}</span>
      <button type="button" class="sip-btn sip-plus" aria-label="Flere slurker">+</button>
      <button type="button" class="remove-player-btn" aria-label="Fjern spiller">\u00d7</button>
    </div>
  `;

  if (player) row.querySelector(".player-name-input").value = player.name;

  const suitSelect = row.querySelector(".suit-select");
  suitSelect.addEventListener("change", () => {
    suitSelect.className = "suit-select suit-" + suitSelect.value;
  });

  const sipValueEl = row.querySelector(".sip-value");
  row.querySelector(".sip-minus").addEventListener("click", () => {
    const current = parseInt(sipValueEl.textContent, 10);
    sipValueEl.textContent = Math.max(1, current - 1);
  });
  row.querySelector(".sip-plus").addEventListener("click", () => {
    const current = parseInt(sipValueEl.textContent, 10);
    sipValueEl.textContent = current + 1;
  });

  row.querySelector(".remove-player-btn").addEventListener("click", () => {
    removePlayer(row);
  });

  return row;
}

function addPlayer(player = null) {
  const index = playersListEl.children.length;
  const row = createPlayerRow(index, player);
  playersListEl.appendChild(row);
}

function removePlayer(rowEl) {
  rowEl.remove();
  renumberPlayerRows();
}

function renumberPlayerRows() {
  [...playersListEl.children].forEach((row, i) => {
    row.querySelector(".player-index").textContent = i + 1;
    row.querySelector(".player-name-input").setAttribute("aria-label", `Navn p\u00e5 spiller ${i + 1}`);
    row.querySelector(".suit-select").setAttribute("aria-label", `Type kort for spiller ${i + 1}`);
  });
}

function renderPlayers(players = []) {
  playersListEl.innerHTML = "";
  if (players.length === 0) addPlayer();
  else players.forEach((player) => addPlayer(player));
}

function readPlayers() {
  const rows = [...playersListEl.children];
  const players = [];

  for (const row of rows) {
    const name = row.querySelector(".player-name-input").value.trim();
    const suit = row.querySelector(".suit-select").value;
    const sips = parseInt(row.querySelector(".sip-value").textContent, 10);
    players.push({ name, suit, sips });
  }

  return players;
}

function goToGame() {
  const players = readPlayers();

  if (players.length === 0) {
    alert("Legg til minst \u00e9n spiller.");
    return;
  }
  if (players.some((p) => p.name === "")) {
    alert("Alle spillere m\u00e5 ha et navn.");
    return;
  }
  if (players.some((p) => !SUITS.includes(p.suit))) {
    alert("Alle spillere m\u00e5 velge type kort.");
    return;
  }
  if (players.some((p) => !(p.sips >= 1))) {
    alert("Antall slurker m\u00e5 v\u00e6re minst 1.");
    return;
  }

  gameState.players = players;
  playerCountValueEl.innerHTML = `${players.length} <span class="chev">\u25be</span>`;
  setupRace();
  showScreen("race");
}

// ===================== RACE SCREEN RENDERING =====================
function renderTrackCards() {
  trackCardsRowEl.innerHTML = "";
  gameState.trackCards.forEach((card, i) => {
    const slot = document.createElement("div");
    slot.className = "track-card-slot";

    const num = document.createElement("div");
    num.className = "track-card-num";
    num.textContent = i + 1;

    const cardEl = document.createElement("div");
    cardEl.className = "track-card";
    if (SPECIAL_TRACK_INDEXES.includes(i)) cardEl.classList.add("sideways");
    cardEl.dataset.index = i;

    slot.appendChild(num);
    slot.appendChild(cardEl);
    trackCardsRowEl.appendChild(slot);
  });
}

function flipTrackCardVisual(index) {
  const cardEl = trackCardsRowEl.querySelector(`.track-card[data-index="${index}"]`);
  const card = gameState.trackCards[index];
  cardEl.classList.add("flipped");
  if (RED_SUITS.includes(card.suit)) cardEl.classList.add("red");
  cardEl.textContent = card.value + SUIT_SYMBOL[card.suit];
}

function renderHorses() {
  horsesColumnEl.innerHTML = "";
  lanesEl.innerHTML = "";

  SUITS.forEach((suit) => {
    const isRed = RED_SUITS.includes(suit);

    const horseCard = document.createElement("div");
    horseCard.className = "horse-card" + (isRed ? " red" : "");
    horseCard.innerHTML = `A${SUIT_SYMBOL[suit]} <span class="horse-marker marker-${suit}"></span>`;
    horsesColumnEl.appendChild(horseCard);

    const lane = document.createElement("div");
    lane.className = "lane";
    for (let i = 0; i < 8; i++) {
      const step = document.createElement("div");
      step.className = "lane-step";
      lane.appendChild(step);
    }
    const finish = document.createElement("div");
    finish.className = "finish-flag";
    finish.innerHTML = "M\u00c5L \u{1F3C1}";
    lane.appendChild(finish);

    const horse = document.createElement("div");
    horse.className = "lane-horse" + (isRed ? " red" : " black");
    horse.dataset.suit = suit;
    horse.textContent = SUIT_SYMBOL[suit];
    lane.appendChild(horse);

    lanesEl.appendChild(lane);
  });
}

function renderHorsePositions() {
  SUITS.forEach((suit) => {
    const horseEl = lanesEl.querySelector(`.lane-horse[data-suit="${suit}"]`);
    const position = Math.min(gameState.horses[suit].position, 8);
    const percent = 2 + (position / 8) * 90;
    horseEl.style.left = percent + "%";
  });
}

function clearCurrentCardBadge() {
  const existing = drawPileEl.querySelector(".current-card-badge");
  if (existing) existing.remove();
}

function showCurrentCard(card) {
  clearCurrentCardBadge();
  const badge = document.createElement("div");
  badge.className = "current-card-badge" + (RED_SUITS.includes(card.suit) ? " red" : "");
  badge.textContent = card.value + SUIT_SYMBOL[card.suit];
  drawPileEl.appendChild(badge);
}

// ===================== RACE FLOW =====================
function playMusic() {
  raceMusic.currentTime = 0;
  raceMusic.play().catch(() => {});
}

function stopMusic() {
  raceMusic.pause();
  raceMusic.currentTime = 0;
}

function startRace() {
  if (gameState.raceStarted) return; // prevent multiple timers
  gameState.raceStarted = true;

  startRaceBtn.disabled = true;
  playMusic();

  raceTimeoutId = setTimeout(() => {
    raceIntervalId = setInterval(drawCard, DRAW_INTERVAL);
  }, INITIAL_RACE_DELAY);
}

function drawCard() {
  if (gameState.drawPile.length === 0) {
    clearInterval(raceIntervalId);
    return;
  }

  const card = gameState.drawPile.shift();
  gameState.currentCard = card;
  showCurrentCard(card);

  moveHorse(card.suit, 1);
  renderHorsePositions();

  if (checkWinner()) {
    endRace();
    return;
  }

  checkTrackProgress();
}

function moveHorse(suit, delta) {
  const horse = gameState.horses[suit];
  horse.position = Math.max(0, horse.position + delta);
}

function checkWinner() {
  for (const suit of SUITS) {
    if (gameState.horses[suit].position >= 8) {
      gameState.winnerSuit = suit;
      return true;
    }
  }
  return false;
}

function checkTrackProgress() {
  // sequential: only the next unrevealed track card can flip, and only
  // once ALL four horses have reached/passed that level
  while (gameState.revealedTrackCards < gameState.trackCards.length) {
    const level = gameState.revealedTrackCards + 1;
    const allPassed = SUITS.every((suit) => gameState.horses[suit].position >= level);
    if (!allPassed) break;

    flipTrackCard(gameState.revealedTrackCards);
    gameState.revealedTrackCards++;
  }
}

function flipTrackCard(index) {
  const card = gameState.trackCards[index];
  flipTrackCardVisual(index);
  applyTrackPenalty(index, card.suit);
}

function applyTrackPenalty(index, suit) {
  if (SPECIAL_TRACK_INDEXES.includes(index)) {
    gameState.horses[suit].position = 0; // sent all the way back to start
  } else {
    gameState.horses[suit].position = Math.max(0, gameState.horses[suit].position - 1);
  }
  renderHorsePositions();
}

function endRace() {
  clearTimeout(raceTimeoutId);
  clearInterval(raceIntervalId);
  stopMusic();

  setTimeout(() => {
    showWinnerScreen();
  }, 900);
}

function showWinnerScreen() {
  const winners = gameState.players.filter((p) => p.suit === gameState.winnerSuit);

  winnersListEl.innerHTML = "";

  if (winners.length === 0) {
    const msg = document.createElement("div");
    msg.className = "no-winner-text";
    msg.textContent = "INGEN SATSET P\u00c5 VINNERHESTEN";
    winnersListEl.appendChild(msg);
  } else {
    winners.forEach((p) => {
      const row = document.createElement("div");
      row.className = "winner-row";
      const name = document.createElement("span");
      name.className = "winner-name";
      name.textContent = `\u{1F464} ${p.name.toUpperCase()}`;
      const sips = document.createElement("span");
      sips.className = "winner-sips";
      sips.textContent = p.sips;
      row.append(name, sips);
      winnersListEl.appendChild(row);
    });
  }

  showScreen("winner");
}

// ===================== RESTART / REPLAY =====================
function playAgainSamePlayers() {
  // Keep the names and last bets editable before starting the next race.
  renderPlayers(gameState.players);
  showScreen("players");
}

function restartGame() {
  gameState.players = [];
  renderPlayers();
  setupRace();
  showScreen("players");
}

// ===================== EVENT LISTENERS =====================
addPlayerBtn.addEventListener("click", () => addPlayer());
goToGameBtn.addEventListener("click", goToGame);
startRaceBtn.addEventListener("click", startRace);
restartBtn.addEventListener("click", restartGame);
replayBtn.addEventListener("click", playAgainSamePlayers);

// ===================== INIT =====================
renderPlayers();
setupRace();
