const ACT_KEY = "activities";
const LOG_KEY = "logs";
const THEME_KEY = "theme";

let currentRange = "daily";
const ranges = { daily: 14, weekly: 56, monthly: 180, yearly: 730 };

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

/* ---------- THEME ---------- */
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark"));
}
if (localStorage.getItem(THEME_KEY) === "true") document.body.classList.add("dark");

/* ---------- ACTIVITY ---------- */
function toggleWeekdays() {
  weekdays.classList.toggle("hidden", actFreq.value !== "custom");
}

function saveActivity() {
  const acts = load(ACT_KEY);
  const id = actName.value.toLowerCase().replace(/\s+/g, "_");

  acts[id] = {
    id,
    uid: acts[id]?.uid || crypto.randomUUID(),
    name: actName.value,
    unit: actUnit.value,
    goal: Number(actGoal.value),
    startTime: actStart.value,
    endTime: actEnd.value,
    frequency: actFreq.value,
    days: [...document.querySelectorAll("#weekdays input:checked")].map(i => i.value),
    calendar: {
      startDate: today(),
      endDate: addMonths(today(), Number(actDuration.value))
    },
    active: true,
    streak: 0,
    bestStreak: acts[id]?.bestStreak || 0
  };

  save(ACT_KEY, acts);
  clearActivityForm();
  renderAll();
}

function clearActivityForm() {
  actName.value = "";
  actGoal.value = "";
  actStart.value = "";
  actEnd.value = "";
  actFreq.value = "daily";
  actDuration.value = "3";
  document.querySelectorAll("#weekdays input").forEach(i => i.checked = false);
  toggleWeekdays();
}

function togglePause(id) {
  const acts = load(ACT_KEY);
  acts[id].active = !acts[id].active;
  acts[id].streak = 0;
  save(ACT_KEY, acts);
  renderAll();
}

function renderActivities() {
  const acts = load(ACT_KEY);
  activityList.innerHTML = "";

  Object.values(acts).forEach(a => {
    activityList.innerHTML += `
      <div class="${a.active ? "" : "paused"}">
        <strong>${a.name}</strong><br/>
        ${a.startTime}–${a.endTime}<br/>
        <button onclick="exportCalendar('${a.id}')" ${!a.active ? "disabled" : ""}>
          Export Calendar
        </button>
        <button onclick="togglePause('${a.id}')">
          ${a.active ? "Pause" : "Resume"}
        </button>
      </div>
    `;
  });

  summaryActivity.innerHTML = Object.values(acts)
    .map(a => `<option value="${a.id}">${a.name}</option>`)
    .join("");
}

/* ---------- LOGGING ---------- */
logDate.value = today();

function renderLogInputs() {
  const acts = load(ACT_KEY);
  logInputs.innerHTML = "";

  Object.values(acts).forEach(a => {
    if (!a.active) return;

    logInputs.innerHTML += `
      <label>${a.name}</label>
      <input type="number" placeholder="Enter value" />
      <button onclick="addSet('${a.id}', this)">Add Set</button>
      <div id="sets-${a.id}"></div>
    `;
    renderSets(a.id, logDate.value);
  });
}

function addSet(id, btn) {
  const input = btn.previousElementSibling;
  const val = Number(input.value);
  if (!val) return;

  const logs = load(LOG_KEY);
  const d = logDate.value;
  logs[d] = logs[d] || {};
  logs[d][id] = logs[d][id] || [];
  logs[d][id].push(val);

  save(LOG_KEY, logs);
  input.value = "";
  renderSets(id, d);
}

function renderSets(id, d) {
  const container = document.getElementById(`sets-${id}`);
  const sets = load(LOG_KEY)[d]?.[id] || [];
  container.innerHTML = sets
    .map((v, i) => `<span class="set" onclick="editSet('${id}','${d}',${i})">${v}</span>`)
    .join("");
}

function editSet(id, d, i) {
  const logs = load(LOG_KEY);
  const val = prompt("Edit value or leave empty to delete", logs[d][id][i]);
  if (val === null) return;
  if (val === "") logs[d][id].splice(i, 1);
  else logs[d][id][i] = Number(val);
  save(LOG_KEY, logs);
  renderSets(id, d);
}

/* ---------- SUMMARY ---------- */
document.querySelectorAll(".range").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".range").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentRange = b.dataset.range;
    renderSummary();
  };
});

function renderSummary() {
  const id = summaryActivity.value;
  if (!id) return;

  const logs = load(LOG_KEY);
  const data = [];

  for (let i = ranges[currentRange] - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const sets = logs[key]?.[id] || [];
    data.push(sets.reduce((a, b) => a + b, 0));
  }

  drawGraph(data);
  renderStats(data);
}

function drawGraph(data) {
  const ctx = chart.getContext("2d");
  ctx.clearRect(0, 0, chart.width, chart.height);
  const max = Math.max(...data, 1);
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * chart.width;
    const y = chart.height - (v / max) * chart.height;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--accent");
  ctx.stroke();
}

function renderStats(data) {
  const total = data.reduce((a, b) => a + b, 0);
  const active = data.filter(v => v > 0).length;
  const avg = active ? (total / active).toFixed(1) : 0;
  stats.innerHTML = `
    Total: ${total}<br/>
    Daily Avg: ${avg}<br/>
    Active Days: ${active}
  `;
}

/* ---------- CALENDAR ---------- */
function exportCalendar(id) {
  const a = load(ACT_KEY)[id];
  if (!a.active) return;

  const until = a.calendar.endDate.replace(/-/g,"");
  const rrule =
    a.frequency === "alternate"
      ? "FREQ=DAILY;INTERVAL=2"
      : a.frequency === "custom"
      ? `FREQ=WEEKLY;BYDAY=${a.days.join(",")}`
      : "FREQ=DAILY";

  const ics = `
BEGIN:VCALENDAR
BEGIN:VEVENT
UID:${a.uid}
SUMMARY:${a.name}
DTSTART:${a.calendar.startDate.replace(/-/g,"")}T${a.startTime.replace(":","")}00
DTEND:${a.calendar.startDate.replace(/-/g,"")}T${a.endTime.replace(":","")}00
RRULE:${rrule};UNTIL=${until}
END:VEVENT
END:VCALENDAR
`;

  const blob = new Blob([ics.trim()], { type: "text/calendar" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${a.name}.ics`;
  link.click();
}

/* ---------- BACKUP ---------- */
function downloadBackup() {
  const blob = new Blob(
    [JSON.stringify({ activities: load(ACT_KEY), logs: load(LOG_KEY) }, null, 2)],
    { type: "application/json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup-${today()}.json`;
  a.click();
}

function importBackup(e) {
  const r = new FileReader();
  r.onload = () => {
    const d = JSON.parse(r.result);
    save(ACT_KEY, d.activities || {});
    save(LOG_KEY, d.logs || {});
    renderAll();
  };
  r.readAsText(e.target.files[0]);
}

/* ---------- UTILS ---------- */
function addMonths(date, m) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().split("T")[0];
}

function renderAll() {
  renderActivities();
  renderLogInputs();
  renderSummary();
}

renderAll();
