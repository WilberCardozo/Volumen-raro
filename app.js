const INITIAL_VOLUME = 50;

/* ---------------- Estado compartido ---------------- */
let volume = INITIAL_VOLUME;
let needsDraw = true;

const statusEl = document.getElementById("status");
const slingValueEl = document.getElementById("slingValue");
const romanValueEl = document.getElementById("romanValue");

function setVolume(v) {
  volume = Math.max(0, Math.min(100, Math.round(v)));
  applyVolume();
  slingValueEl.textContent = volume;
  romanValueEl.textContent = toRoman(volume);
  needsDraw = true;
}

/* ---------------- Reproductor + Web Audio ----------------
 * El sonido del <video> pasa por un GainNode de Web Audio. Así el volumen
 * funciona en todos lados, incluido iPhone/iPad, donde video.volume es de
 * solo lectura.
 */
const video = document.getElementById("video");
const videoWrap = document.getElementById("videoWrap");
const picker = document.getElementById("picker");
const fileInput = document.getElementById("fileInput");
const controls = document.getElementById("controls");
const playBtn = document.getElementById("playBtn");
const seek = document.getElementById("seek");
const timeEl = document.getElementById("time");
const changeBtn = document.getElementById("changeBtn");

let audioCtx = null;
let gainNode = null;
let currentUrl = null;

// En iPhone, el audio que pasa por Web Audio respeta el interruptor de silencio
// salvo que la sesión se declare como reproducción.
if (navigator.audioSession) {
  try { navigator.audioSession.type = "playback"; } catch (_) {}
}

// El AudioContext solo puede arrancar tras un toque o tecla del usuario.
function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    audioCtx = new AC();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = volume / 100;
    video.volume = 1; // a partir de aquí manda solo la ganancia
    audioCtx.createMediaElementSource(video).connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }
  if (audioCtx.state !== "running") audioCtx.resume();
}
["pointerdown", "touchend", "keydown"].forEach((type) =>
  document.addEventListener(type, ensureAudio, { passive: true })
);

function applyVolume() {
  const level = volume / 100;
  if (gainNode) {
    gainNode.gain.setTargetAtTime(level, audioCtx.currentTime, 0.02);
  } else {
    video.volume = level; // Respaldo sin Web Audio (no funciona en iPhone)
  }
}

function loadFile(file) {
  if (!file) return;
  if (!/^(video|audio)\//.test(file.type) && !/\.(mp4|m4v|mov|webm|ogv|mkv|mp3|m4a|wav|ogg)$/i.test(file.name)) {
    statusEl.textContent = "Ese archivo no parece un video.";
    return;
  }
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(file);
  video.src = currentUrl;
  video.hidden = false;
  picker.hidden = true;
  controls.hidden = false;
  statusEl.textContent = file.name;
}

fileInput.addEventListener("change", () => {
  loadFile(fileInput.files[0]);
  fileInput.value = ""; // permite volver a elegir el mismo archivo
});

videoWrap.addEventListener("dragover", (e) => {
  e.preventDefault();
  videoWrap.classList.add("dragover");
});
videoWrap.addEventListener("dragleave", () => videoWrap.classList.remove("dragover"));
videoWrap.addEventListener("drop", (e) => {
  e.preventDefault();
  videoWrap.classList.remove("dragover");
  loadFile(e.dataTransfer.files[0]);
});

picker.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

changeBtn.addEventListener("click", () => {
  video.pause();
  fileInput.click();
});

function togglePlay() {
  ensureAudio();
  if (video.paused || video.ended) video.play().catch(() => {});
  else video.pause();
}
playBtn.addEventListener("click", togglePlay);
video.addEventListener("click", togglePlay);

video.addEventListener("play", () => {
  playBtn.textContent = "❚❚";
  playBtn.setAttribute("aria-label", "Pausar");
});
video.addEventListener("pause", () => {
  playBtn.textContent = "▶";
  playBtn.setAttribute("aria-label", "Reproducir");
});

function formatTime(s) {
  if (!isFinite(s)) return "0:00";
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : m;
  return (h ? h + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
}

let seeking = false;
function updateTime() {
  if (!seeking && video.duration) seek.value = (video.currentTime / video.duration) * 1000;
  timeEl.textContent = formatTime(video.currentTime) + " / " + formatTime(video.duration);
}
video.addEventListener("timeupdate", updateTime);
video.addEventListener("loadedmetadata", updateTime);

seek.addEventListener("input", () => {
  seeking = true;
  if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
});
seek.addEventListener("change", () => { seeking = false; });

video.addEventListener("error", () => {
  statusEl.textContent = "Este navegador no puede reproducir ese formato. Prueba con un MP4.";
  video.hidden = true;
  controls.hidden = true;
  picker.hidden = false;
});

/* ---------------- Números romanos ---------------- */
const ROMAN_TABLE = [
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n) {
  if (n === 0) return "N"; // "nulla": así escribían el cero los romanos
  let out = "";
  for (const [value, symbol] of ROMAN_TABLE) {
    while (n >= value) { out += symbol; n -= value; }
  }
  return out;
}

// Devuelve 0–100 o null si no es un romano válido y bien formado.
function parseRoman(str) {
  const s = str.trim().toUpperCase();
  if (s === "N") return 0;
  if (s === "C") return 100;
  if (!s || !/^(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s)) return null;
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = values[s[i]];
    const next = values[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

const romanForm = document.getElementById("romanForm");
const romanInput = document.getElementById("romanInput");
const romanError = document.getElementById("romanError");

romanInput.addEventListener("input", () => { romanError.textContent = ""; });

// Se aplica con Enter. Sin pistas: si no es válido, solo se dice que está mal.
romanForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = parseRoman(romanInput.value);
  if (v === null) {
    romanError.textContent = "Incorrecto. Inténtalo de nuevo.";
    romanInput.select();
    return;
  }
  romanError.textContent = "";
  romanInput.value = "";
  romanInput.blur(); // cierra el teclado del celular para ver el resultado
  setVolume(v);
});

/* ---------------- Tirachinas ---------------- */
const canvas = document.getElementById("sling");
const wrap = document.getElementById("slingWrap");
const ctx = canvas.getContext("2d");

let W, H, groundY, anchor, barX0, barX1, maxPull, gravity, launchK, ballR;
const ball = { x: 0, y: 0, vx: 0, vy: 0, state: "idle" }; // idle | drag | fly | landed
let trail = [];
let landedAt = 0;

function resize() {
  // Limitar a 2x ahorra batería y memoria en pantallas 3x sin que se note.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const newW = wrap.clientWidth;
  // En horizontal la altura de la pantalla también manda. Se usa el tamaño de la
  // pantalla (no innerHeight) para que no salte al esconderse la barra del navegador.
  const landscape = window.innerWidth > window.innerHeight;
  const screenLimit = landscape ? Math.min(screen.width, screen.height) * 0.6 : Infinity;
  const newH = Math.round(Math.max(200, Math.min(360, newW * 0.5, screenLimit)));
  if (newW === W && newH === H) return;
  W = newW;
  H = newH;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  groundY = H - 40;
  ballR = Math.max(9, Math.min(14, W * 0.022));
  anchor = { x: Math.max(48, W * 0.1), y: groundY - H * 0.36 };
  barX0 = anchor.x + Math.max(48, W * 0.1);
  barX1 = W - 24;
  maxPull = Math.min(85, H * 0.3);
  gravity = H * 2.2;
  // Con tirón máximo a 45° el pájaro llega un poco más allá del final de la barra.
  const vMax = Math.sqrt(1.1 * (barX1 - anchor.x) * gravity);
  launchK = vMax / maxPull;
  resetBall();
  needsDraw = true;
}

function resetBall() {
  ball.x = anchor.x;
  ball.y = anchor.y;
  ball.vx = ball.vy = 0;
  ball.state = "idle";
  needsDraw = true;
}

function volumeToX(v) { return barX0 + (barX1 - barX0) * (v / 100); }
function xToVolume(x) { return ((x - barX0) / (barX1 - barX0)) * 100; }

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function clampPull(p) {
  let dx = p.x - anchor.x, dy = p.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len > maxPull) { dx *= maxPull / len; dy *= maxPull / len; }
  return { x: anchor.x + dx, y: anchor.y + dy };
}

canvas.addEventListener("pointerdown", (e) => {
  if (ball.state !== "idle") return;
  const p = pointerPos(e);
  // Zona de agarre generosa (≥ 44px) para dedos.
  if (Math.hypot(p.x - ball.x, p.y - ball.y) > Math.max(44, ballR * 3.5)) return;
  e.preventDefault();
  ball.state = "drag";
  canvas.classList.add("dragging");
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (ball.state !== "drag") return;
  const p = clampPull(pointerPos(e));
  ball.x = p.x;
  ball.y = p.y;
});

function release() {
  if (ball.state !== "drag") return;
  canvas.classList.remove("dragging");
  const dx = anchor.x - ball.x, dy = anchor.y - ball.y;
  if (Math.hypot(dx, dy) < 8) { resetBall(); return; }
  ball.vx = dx * launchK;
  ball.vy = dy * launchK;
  ball.state = "fly";
  trail = [];
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

function update(dt) {
  if (ball.state === "fly") {
    ball.vy += gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 60) trail.shift();

    if (ball.y >= groundY - ballR) {
      ball.y = groundY - ballR;
      ball.state = "landed";
      landedAt = performance.now();
      setVolume(xToVolume(ball.x));
    }
  } else if (ball.state === "landed" && performance.now() - landedAt > 900) {
    resetBall();
  }
}

/* ----- Dibujo ----- */
function drawScene() {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#7cc4f0");
  sky.addColorStop(1, "#d8f0fb");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, groundY);

  ctx.fillStyle = "#6fb043";
  ctx.fillRect(0, groundY, W, 8);
  ctx.fillStyle = "#8a6038";
  ctx.fillRect(0, groundY + 8, W, H - groundY - 8);

  // Barra de volumen en el suelo
  const grad = ctx.createLinearGradient(barX0, 0, barX1, 0);
  grad.addColorStop(0, "#3fb950");
  grad.addColorStop(0.6, "#f2c744");
  grad.addColorStop(1, "#e5484d");
  ctx.fillStyle = grad;
  ctx.fillRect(barX0, groundY, barX1 - barX0, 8);

  ctx.fillStyle = "#fff";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let v = 0; v <= 100; v += 10) {
    ctx.fillRect(volumeToX(v) - 0.5, groundY + 8, 1, v % 50 === 0 ? 10 : 5);
  }
  const labels = W > 520 ? [0, 25, 50, 75, 100] : [0, 50, 100];
  labels.forEach((v) => ctx.fillText(v, volumeToX(v), groundY + 30));
}

function drawPig(x) {
  const r = ballR * 1.1, y = groundY - r;
  ctx.fillStyle = "#7ac943";
  ctx.beginPath(); ctx.arc(x - r * 0.6, y - r * 0.8, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.6, y - r * 0.8, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9be06a";
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.15, r * 0.42, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3d6b22";
  ctx.beginPath(); ctx.arc(x - r * 0.15, y + r * 0.15, r * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.15, y + r * 0.15, r * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.4, y - r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.3, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.42, y - r * 0.3, r * 0.09, 0, Math.PI * 2); ctx.fill();
}

function drawSlingPost(side) {
  const off = ballR * 1.1;
  ctx.strokeStyle = "#6b3f1d";
  ctx.lineWidth = Math.max(5, ballR * 0.55);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (side === "back") {
    ctx.moveTo(anchor.x, groundY);
    ctx.lineTo(anchor.x, anchor.y + off * 1.6);
    ctx.lineTo(anchor.x + off, anchor.y);
  } else {
    ctx.moveTo(anchor.x, anchor.y + off * 1.6);
    ctx.lineTo(anchor.x - off, anchor.y);
  }
  ctx.stroke();
}

function drawBand(fromX) {
  if (ball.state !== "drag") return;
  ctx.strokeStyle = "#3a2210";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(fromX, anchor.y);
  ctx.lineTo(ball.x, ball.y);
  ctx.stroke();
}

function drawBird() {
  const { x, y } = ball, r = ballR;
  ctx.fillStyle = "#d62f2f";
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f3d9b1";
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.45, r * 0.6, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(x + r * 0.38, y - r * 0.2, r * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#111";
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.6); ctx.lineTo(x + r * 0.7, y - r * 0.35); ctx.stroke();
  ctx.fillStyle = "#f5a623";
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y);
  ctx.lineTo(x + r * 1.35, y + r * 0.15);
  ctx.lineTo(x + r * 0.7, y + r * 0.35);
  ctx.fill();
}

function drawPreview() {
  if (ball.state !== "drag") return;
  let x = ball.x, y = ball.y;
  let vx = (anchor.x - ball.x) * launchK, vy = (anchor.y - ball.y) * launchK;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  const step = 1 / 30;
  for (let i = 0; i < 14; i++) {
    for (let j = 0; j < 2; j++) { vy += gravity * step; x += vx * step; y += vy * step; }
    if (y > groundY) break;
    ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, 3.5 - i * 0.15), 0, Math.PI * 2); ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawScene();
  drawPig(volumeToX(volume));

  ctx.fillStyle = "rgba(255,255,255,.6)";
  trail.forEach((p, i) => {
    if (i % 3) return;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
  });

  drawSlingPost("back");
  drawBand(anchor.x + ballR * 1.1);
  drawPreview();
  drawBird();
  drawBand(anchor.x - ballR * 1.1);
  drawSlingPost("front");
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  // Solo redibuja cuando algo cambia: ahorra batería en el celular.
  if (needsDraw || ball.state !== "idle") {
    draw();
    needsDraw = false;
  }
  requestAnimationFrame(loop);
}

if ("ResizeObserver" in window) {
  new ResizeObserver(resize).observe(wrap);
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 200));
resize();
setVolume(INITIAL_VOLUME);
requestAnimationFrame(loop);
