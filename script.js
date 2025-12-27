const ACT_KEY = "activities";
const LOG_KEY = "logs";

let editId = null;

/* ---------- utils ---------- */
const load = k => JSON.parse(localStorage.getItem(k)) || {};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const today = () => new Date().toISOString().split("T")[0];

/* ---------- frequency ---------- */
const actFreq = document.getElementById("actFreq");
const weekdays = document.getElementById("weekdays");

function updateWeekdays() {
  weekdays.classList.toggle("hidden", actFreq.value !== "custom");
}
actFreq.onchange = updateWeekdays;
updateWeekdays();

/* ---------- activities ---------- */
document.getElementById("saveActivity").onclick = () => {
  if (!actName.value) return alert("Name required");
  if (!actStart.value || !actEnd.value || actStart.value >= actEnd.value)
    return alert("Invalid time");

  const acts = load(ACT_KEY);
  const id = editId || actName.value.toLowerCase().replace(/\s+/g, "_");

  acts[id] = {
    id,
    name: actName.value,
    unit: actUnit.value,
    startTime: actStart.value,
    endTime: actEnd.value,
    frequency: actFreq.value,
    days: [...weekdays.querySelectorAll("input:checked")].map(i => i.value),
    active: true
  };

  save(ACT_KEY, acts);
  resetForm();
  renderAll();
};

function resetForm() {
  editId = null;
  actName.value = "";
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
    const div = document.createElement("div");
    div.innerHTML = `<strong>${a.name}</strong> (${a.startTime}–${a.endTime})`;
    div.onclick = () => loadForEdit(a.id);
    activityList.appendChild(div);
  });

  summaryActivity.innerHTML = Object.values(acts)
    .map(a => `<option value="${a.id}">${a.name}</option>`)
    .join("");
}

function loadForEdit(id) {
  const a = load(ACT_KEY)[id];
  editId = id;
  actName.value = a.name;
  actUnit.value = a.unit;
  actStart.value = a.startTime;
  actEnd.value = a.endTime;
  actFreq.value = a.frequency;
  weekdays.querySelectorAll("input").forEach(
    i => (i.checked = a.days.includes(i.value))
  );
  updateWeekdays();
}

/* ---------- log ---------- */
logDate.value = today();

function renderLog() {
  const acts = load(ACT_KEY);
  logInputs.innerHTML = "";

  Object.values(acts).forEach(a => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label>${a.name}</label>
      <input type="number" id="log-${a.id}">
      <button>Add</button>
    `;
    div.querySelector("button").onclick = () => addLog(a.id);
    logInputs.appendChild(div);
  });
}

function addLog(id) {
  const input = document.getElementById(`log-${id}`);
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

/* ---------- summary ---------- */
function renderSummary() {
  const id = summaryActivity.value;
  if (!id) return;

  const range = summaryRange.value;
  const logs = load(LOG_KEY);
  const days = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[range];

  let total = 0;
  let best = 0;
  let active = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const sum = (logs[key]?.[id] || []).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      total += sum;
      active++;
      best = Math.max(best, sum);
    }
  }

  sTotal.textContent = total;
  sActive.textContent = active;
  sAvg.textContent = active ? Math.round(total / active) : 0;
  sBest.textContent = best;
}

summaryActivity.onchange = renderSummary;
summaryRange.onchange = renderSummary;

/* ---------- init ---------- */
function renderAll() {
  renderActivities();
  renderLog();
  renderSummary();
}
renderAll();