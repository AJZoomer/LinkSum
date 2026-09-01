// ----- CONFIG -----
const BASE_GRID_SIZE = 5;
const MIN_VAL = 1;
const MAX_VAL = 9;

// ----- STATE -----
let grid = [];
let gridSize = BASE_GRID_SIZE;
let targetSum = 0;
let path = [];
let isDragging = false;
let startTime = null;
let timerInterval = null;
let PATH_LENGTH = 0; // now dynamic

// ----- DOM -----
const gridEl = document.getElementById("grid");
const targetEl = document.getElementById("target");
const tilesEl = document.getElementById("tiles");
const streakEl = document.getElementById("streak");
const statusEl = document.getElementById("status");
const timeEl = document.getElementById("time");

// ----- MODE DETECTION -----
const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "classic";

document.getElementById("mode-title").textContent =
  mode === "daily" ? "Daily Challenge" : "Classic Mode";

// ----- RNG -----
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ----- PUZZLE GENERATION -----
function generatePuzzle() {
  const seed = mode === "daily"
    ? parseInt(new Date().toISOString().slice(0,10).replace(/-/g,""))
    : Math.floor(Math.random() * 99999999);

  const rng = mulberry32(seed);

  // RANDOM TILE COUNT (4–8)
  PATH_LENGTH = 4 + Math.floor(rng() * 5);

  gridSize = BASE_GRID_SIZE;
  document.documentElement.style.setProperty("--grid-size", gridSize);

  // Create empty grid
  grid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => 0)
  );

  // Generate path
  path = [];
  let r = Math.floor(rng() * gridSize);
  let c = Math.floor(rng() * gridSize);
  path.push({ r, c });

  while (path.length < PATH_LENGTH) {
    const moves = [];
    if (r > 0) moves.push({ r: r - 1, c });
    if (r < gridSize - 1) moves.push({ r: r + 1, c });
    if (c > 0) moves.push({ r, c: c - 1 });
    if (c < gridSize - 1) moves.push({ r, c: c + 1 });

    const next = moves[Math.floor(rng() * moves.length)];
    r = next.r;
    c = next.c;

    const last = path[path.length - 1];
    if (last.r === r && last.c === c) continue;

    path.push({ r, c });
  }

  // Fill path tiles with numbers
  targetSum = 0;
  path.forEach(({ r, c }) => {
    const val = MIN_VAL + Math.floor(rng() * (MAX_VAL - MIN_VAL + 1));
    grid[r][c] = { type: "normal", value: val };
    targetSum += val;
  });

  // Fill remaining tiles with normal values
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (grid[i][j] === 0) {
        const val = MIN_VAL + Math.floor(rng() * (MAX_VAL - MIN_VAL + 1));
        grid[i][j] = { type: "normal", value: val };
      }
    }
  }

  // Add MULTIPLIER tiles (10% chance)
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (Math.random() < 0.10 && !isPathTile(r, c)) {
        grid[r][c] = {
          type: "mult",
          value: Math.random() < 0.5 ? 2 : 3 // x2 or x3
        };
      }
    }
  }

  // Add BLOCKER tiles (8% chance)
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (Math.random() < 0.08 && !isPathTile(r, c)) {
        grid[r][c] = { type: "block" };
      }
    }
  }

  renderGrid();
  updateHeader();
  resetTimer();
  statusEl.textContent = "";
}

function isPathTile(r, c) {
  return path.some(p => p.r === r && p.c === c);
}

// ----- RENDER -----
function renderGrid() {
  gridEl.innerHTML = "";

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = grid[r][c];
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.r = r;
      tile.dataset.c = c;

      if (cell.type === "normal") {
        tile.textContent = cell.value;
      } else if (cell.type === "mult") {
        tile.textContent = `x${cell.value}`;
        tile.classList.add("mult");
      } else if (cell.type === "block") {
        tile.classList.add("block");
        tile.textContent = "";
      }

      gridEl.appendChild(tile);
    }
  }

  attachInputHandlers();
}

function updateHeader() {
  targetEl.textContent = `Target: ${targetSum}`;
  tilesEl.textContent = `Tiles: ${PATH_LENGTH}`;
  streakEl.textContent = `Streak: ${getStreak()}`;
}

// ----- STREAK -----
function getStreak() {
  return parseInt(localStorage.getItem("nf_streak") || "0", 10);
}

function incrementStreak() {
  const s = getStreak() + 1;
  localStorage.setItem("nf_streak", s);
}

// ----- INPUT -----
let currentPath = [];

function attachInputHandlers() {
  const tiles = Array.from(document.querySelectorAll(".tile"));

  const start = (e, tile) => {
    e.preventDefault();
    isDragging = true;
    currentPath = [];
    clearTileStates();
    addTile(tile);
    startTimer();
  };

  const move = (e) => {
    if (!isDragging) return;
    const touch = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el || !el.classList.contains("tile")) return;
    addTile(el);
  };

  const end = () => {
    if (!isDragging) return;
    isDragging = false;
    checkPath();
  };

  tiles.forEach(tile => {
    tile.addEventListener("mousedown", (e) => start(e, tile));
    tile.addEventListener("touchstart", (e) => start(e, tile), { passive: false });
  });

  document.addEventListener("mousemove", move);
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("mouseup", end);
  document.addEventListener("touchend", end);
}

function addTile(tile) {
  const r = parseInt(tile.dataset.r, 10);
  const c = parseInt(tile.dataset.c, 10);
  const cell = grid[r][c];

  // BLOCKERS cannot be used
  if (cell.type === "block") return;

  // Already used
  if (currentPath.some(p => p.r === r && p.c === c)) return;

  // Must be adjacent
  if (currentPath.length > 0) {
    const last = currentPath[currentPath.length - 1];
    const dr = Math.abs(last.r - r);
    const dc = Math.abs(last.c - c);
    if (dr + dc !== 1) return;
  }

  currentPath.push({ r, c });
  tile.classList.add("active");
}

function clearTileStates() {
  document.querySelectorAll(".tile").forEach(t => {
    t.classList.remove("active", "invalid");
  });
}

// ----- CONFETTI -----
function launchConfetti() {
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const count = 120;

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: 5 + Math.random() * 5,
      speed: 2 + Math.random() * 3,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10
    });
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach(p => {
      p.y += p.speed;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    requestAnimationFrame(update);
  }

  update();

  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 2000);
}

// ----- MODAL -----
function showModal(message) {
  document.getElementById("modal-msg").textContent = message;
  document.getElementById("modal").classList.remove("hidden");
}

document.getElementById("play-again").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
  generatePuzzle();
});

// ----- CHECK -----
function checkPath() {
  let sum = 0;

  currentPath.forEach(({ r, c }) => {
    const cell = grid[r][c];

    if (cell.type === "normal") {
      sum += cell.value;
    } else if (cell.type === "mult") {
      sum *= cell.value;
    }
  });

  if (currentPath.length !== PATH_LENGTH) {
    statusEl.textContent = `Used ${currentPath.length} tiles (need ${PATH_LENGTH}).`;
    markInvalid();
    return;
  }

  if (sum === targetSum) {
    launchConfetti();
    incrementStreak();
    updateHeader();
    showModal(`Solved in ${Math.floor((Date.now() - startTime) / 1000)} seconds!`);
  } else {
    statusEl.textContent = `Sum = ${sum}, target = ${targetSum}.`;
    markInvalid();
  }
}

function markInvalid() {
  currentPath.forEach(({ r, c }) => {
    const tile = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
    if (tile) tile.classList.add("invalid");
  });
}

// ----- TIMER -----
function startTimer() {
  if (startTime !== null) return;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - startTime) / 1000);
    timeEl.textContent = `Time: ${secs}s`;
  }, 500);
}

function resetTimer() {
  startTime = null;
  clearInterval(timerInterval);
  timeEl.textContent = "Time: 0s";
}

// ----- INIT -----
generatePuzzle();