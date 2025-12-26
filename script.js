const ACT_KEY = "activities";
const LOG_KEY = "logs";
const THEME_KEY = "theme";

let currentRange = "weekly";
const ranges = { daily: 14, weekly: 7, monthly: 30, yearly: 365 };

const chart = document.getElementById("chart");

/* ---------- BASIC UTILS ---------- */
function today() {
  return new Date().toISOString().split("T")[0];
}
function load(k) {
  return JSON.parse(localStorage.getItem(k)) || {};
}
function save(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}

/* ---------- NAV ---------- */
document.querySelectorAll(".nav").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".nav, .tab").forEach(e => e.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});

/* ---------- RANGE DROPDOWN ---------- */
rangeBtn.onclick = () => rangeMenu.classList.toggle("hidden");
rangeMenu.querySelectorAll("div").forEach(opt => {
  opt.onclick = () => {
    currentRange = opt.dataset.range;
    rangeMenu.classList.add("hidden");
    renderSummary();
  };
});

/* ---------- LOG ---------- */
logDate.value = today();

function renderLogInputs() {
  const acts = load(ACT_KEY);
  logInputs.innerHTML = "";

  Object.values(acts).forEach(a => {
    if (!a.active) return;
    logInputs.innerHTML += `
      <label>${a.name}</label>
      <input type="number" id="input-${a.id}">
      <button onclick="addSet('${a.id}')">Add</button>
    `;
  });
}

function addSet(id) {
  const input = document.getElementById(`input-${id}`);
  const val = Number(input.value);
  if (!val) return;

  const logs = load(LOG_KEY);
  const d = logDate.value;
  logs[d] = logs[d] || {};
  logs[d][id] = logs[d][id] || [];
  logs[d][id].push(val);
  save(LOG_KEY, logs);
  input.value = "";
}

/* ---------- SUMMARY ---------- */
function renderSummary() {
  const id = summaryActivity.value;
  if (!id) return;

  const logs = load(LOG_KEY);
  const data = [];
  const labels = [];
  const days = ranges[currentRange];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const sets = logs[key]?.[id] || [];
    data.push(sets.reduce((a, b) => a + b, 0));

    if (currentRange === "weekly") {
      labels.push(d.toLocaleDateString(undefined, { weekday: "short" }));
    } else if (currentRange === "daily") {
      labels.push(d.getDate());
    } else {
      labels.push(i % 7 === 0 ? d.getDate() : "");
    }
  }

  drawGraph(data, labels);
  updateMetrics(data);
}

function drawGraph(data, labels) {
  const ctx = chart.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const cssW = chart.clientWidth;
  const cssH = chart.clientHeight;

  chart.width = cssW * dpr;
  chart.height = cssH * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, cssW, cssH);

  const pad = 36;
  const w = cssW - pad * 2;
  const h = cssH - pad * 2;
  const max = Math.max(...data, 1);

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--grid");
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
  ctx.font = "12px sans-serif";

  for (let i = 0; i <= 4; i++) {
    const y = pad + (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(cssW - pad, y);
    ctx.stroke();
    ctx.fillText(Math.round(max - (max / 4) * i), 4, y + 4);
  }

  labels.forEach((l, i) => {
    if (!l) return;
    const x = pad + (i / (labels.length - 1)) * w;
    ctx.fillText(l, x - 8, cssH - 6);
  });

  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - (v / max) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--accent");
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function updateMetrics(data) {
  const total = data.reduce((a, b) => a + b, 0);
  const active = data.filter(v => v > 0).length;
  const avg = active ? Math.round(total / active) : 0;
  const best = Math.max(...data);

  mTotal.textContent = total;
  mAvg.textContent = avg;
  mBest.textContent = best;
  mActive.textContent = active;
}

/* ---------- INIT ---------- */
function renderAll() {
  renderLogInputs();
  renderSummary();
}

renderAll();