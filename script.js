const ACT_KEY = "activities";
const LOG_KEY = "logs";
const THEME_KEY = "theme";

let editId = null;
let currentRange = "weekly";
const ranges = { daily: 7, weekly: 7, monthly: 30, yearly: 365 };

const chart = document.getElementById("chart");

/* ---------- UTIL ---------- */
const today = () => new Date().toISOString().split("T")[0];
const load = k => JSON.parse(localStorage.getItem(k)) || {};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ---------- THEME ---------- */
const themeToggle = document.getElementById("themeToggle");
if (localStorage.getItem(THEME_KEY) === "true") document.body.classList.add("dark");
themeToggle.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark"));
};

/* ---------- NAV ---------- */
document.querySelectorAll(".bottom-nav button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".tab, .bottom-nav button").forEach(x => x.classList.remove("active"));
    document.getElementById(b.dataset.tab).classList.add("active");
    b.classList.add("active");
  };
});

/* ---------- FREQUENCY ---------- */
const actFreq = document.getElementById("actFreq");
const weekdays = document.getElementById("weekdays");
const updateWeekdays = () => {
  weekdays.classList.toggle("hidden", actFreq.value !== "custom");
};
actFreq.onchange = updateWeekdays;
updateWeekdays();

/* ---------- ACTIVITY ---------- */
function saveActivity() {
  if (!actName.value) return alert("Name required");
  if (!actStart.value || !actEnd.value || actStart.value >= actEnd.value)
    return alert("Invalid time");

  const acts = load(ACT_KEY);
  const id = editId || actName.value.toLowerCase().replace(/\s+/g, "_");

  acts[id] = {
    id,
    name: actName.value,
    unit: actUnit.value,
    goal: Number(actGoal.value),
    startTime: actStart.value,
    endTime: actEnd.value,
    frequency: actFreq.value,
    days: [...weekdays.querySelectorAll("input:checked")].map(i => i.value),
    active: true
  };

  save(ACT_KEY, acts);
  resetForm();
  renderAll();
}

saveActivityBtn.onclick = saveActivity;

function resetForm() {
  editId = null;
  activityFormTitle.textContent = "Add Activity";
  saveActivityBtn.textContent = "Save Activity";
  actName.value = "";
  actGoal.value = "";
  actStart.value = "";
  actEnd.value = "";
  actFreq.value = "daily";
  weekdays.querySelectorAll("input").forEach(i => i.checked = false);
  updateWeekdays();
}

function renderActivities() {
  const acts = load(ACT_KEY);
  activityList.innerHTML = "";

  Object.values(acts).forEach(a => {
    activityList.innerHTML += `
      <div>
        <strong>${a.name}</strong><br/>
        ${a.startTime}–${a.endTime}
      </div>
    `;
  });

  summaryActivity.innerHTML = Object.values(acts)
    .map(a => `<option value="${a.id}">${a.name}</option>`)
    .join("");
}

/* ---------- LOG ---------- */
logDate.value = today();

function renderLogInputs() {
  const acts = load(ACT_KEY);
  logInputs.innerHTML = "";

  Object.values(acts).forEach(a => {
    logInputs.innerHTML += `
      <label>${a.name}</label>
      <input type="number" id="input-${a.id}">
      <button onclick="addSet('${a.id}')">Add</button>
    `;
  });
}

function addSet(id) {
  const input = document.getElementById(`input-${id}`);
  const v = Number(input.value);
  if (!v) return;

  const logs = load(LOG_KEY);
  const d = logDate.value;
  logs[d] = logs[d] || {};
  logs[d][id] = logs[d][id] || [];
  logs[d][id].push(v);
  save(LOG_KEY, logs);
  input.value = "";
  renderSummary();
}

/* ---------- SUMMARY ---------- */
rangeBtn.onclick = () => rangeMenu.classList.toggle("hidden");
rangeMenu.querySelectorAll("div").forEach(d => {
  d.onclick = () => {
    currentRange = d.dataset.range;
    rangeMenu.classList.add("hidden");
    renderSummary();
  };
});

function renderSummary() {
  const id = summaryActivity.value;
  if (!id) return;

  const logs = load(LOG_KEY);
  const days = ranges[currentRange];
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const sets = logs[key]?.[id] || [];
    data.push(sets.reduce((a, b) => a + b, 0));
  }

  drawGraph(data);
  updateMetrics(data);
}

/* ---------- GRAPH ---------- */
function drawGraph(data) {
  const ctx = chart.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const w = chart.clientWidth;
  const h = chart.clientHeight;
  chart.width = w * dpr;
  chart.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pad = 36;
  const max = Math.max(...data, 1);

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--accent");
  ctx.lineWidth = 3;
  ctx.beginPath();

  data.forEach((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function updateMetrics(data) {
  mTotal.textContent = data.reduce((a, b) => a + b, 0);
  const active = data.filter(v => v > 0).length;
  mAvg.textContent = active ? Math.round(mTotal.textContent / active) : 0;
  mBest.textContent = Math.max(...data);
  mActive.textContent = active;
}

/* ---------- INIT ---------- */
function renderAll() {
  renderActivities();
  renderLogInputs();
  renderSummary();
}
renderAll();