const ACT_KEY = "activities";
const LOG_KEY = "logs";
const THEME_KEY = "theme";

let editId = null;
let currentRange = "daily";
const ranges = { daily: 14, weekly: 56, monthly: 180, yearly: 730 };

const chart = document.getElementById("chart");

function today() {
  return new Date().toISOString().split("T")[0];
}

function load(k) {
  return JSON.parse(localStorage.getItem(k)) || {};
}

function save(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}

/* NAV */
document.querySelectorAll(".nav").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".nav, .tab").forEach(e => e.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});

/* THEME */
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark"));
}
if (localStorage.getItem(THEME_KEY) === "true") document.body.classList.add("dark");

/* ACTIVITY */
function toggleWeekdays() {
  weekdays.classList.toggle("hidden", actFreq.value !== "custom");
}

function saveActivity() {
  if (!actName.value) return alert("Activity name required");
  if (!actStart.value || !actEnd.value || actStart.value >= actEnd.value)
    return alert("Invalid time range");

  const acts = load(ACT_KEY);
  const id = editId || actName.value.toLowerCase().replace(/\s+/g, "_");

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
      startDate: acts[id]?.calendar?.startDate || today(),
      endDate: addMonths(today(), Number(actDuration.value))
    },
    active: acts[id]?.active ?? true,
    streak: 0,
    bestStreak: acts[id]?.bestStreak || 0
  };

  save(ACT_KEY, acts);
  resetActivityForm();
  renderAll();
}

function editActivity(id) {
  const a = load(ACT_KEY)[id];
  editId = id;
  activityFormTitle.textContent = "Edit Activity";
  saveActivityBtn.textContent = "Update Activity";

  actName.value = a.name;
  actUnit.value = a.unit;
  actGoal.value = a.goal;
  actStart.value = a.startTime;
  actEnd.value = a.endTime;
  actFreq.value = a.frequency;
  actDuration.value = "3";

  document.querySelectorAll("#weekdays input").forEach(cb => {
    cb.checked = a.days.includes(cb.value);
  });
  toggleWeekdays();
}

function resetActivityForm() {
  editId = null;
  activityFormTitle.textContent = "Add Activity";
  saveActivityBtn.textContent = "Save Activity";

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
      <div class="activity ${a.active ? "" : "paused"}">
        <strong>${a.name}</strong><br/>
        ${a.startTime}–${a.endTime}<br/>
        <button onclick="editActivity('${a.id}')">Edit</button>
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

/* LOG */
logDate.value = today();

function renderLogInputs() {
  const acts = load(ACT_KEY);
  logInputs.innerHTML = "";

  Object.values(acts).forEach(a => {
    if (!a.active) return;

    logInputs.innerHTML += `
      <label>${a.name}</label>
      <input type="number" id="input-${a.id}" placeholder="Enter value" />
      <button onclick="addSet('${a.id}')">Add Set</button>
      <div id="sets-${a.id}"></div>
    `;
    renderSets(a.id, logDate.value);
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
  renderSets(id, d);
}

/* SUMMARY GRAPH */
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
  drawGraph(data, load(ACT_KEY)[id].unit);
}

function drawGraph(data, unit) {
  const ctx = chart.getContext("2d");
  ctx.clearRect(0, 0, chart.width, chart.height);

  const max = Math.max(...data, 1);
  const padding = 40;
  const w = chart.width - padding * 2;
  const h = chart.height - padding * 2;

  ctx.strokeStyle = "#e5e7eb";
  ctx.fillStyle = "#6b7280";
  ctx.font = "12px sans-serif";

  for (let i = 0; i <= 4; i++) {
    const y = padding + (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(chart.width - padding, y);
    ctx.stroke();
    ctx.fillText(Math.round(max - (max / 4) * i), 5, y + 4);
  }

  ctx.beginPath();
  data.forEach((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - (v / max) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--accent");
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillText(unit, chart.width - 30, padding - 10);
}

/* CALENDAR */
function exportCalendar(id) {
  const a = load(ACT_KEY)[id];
  if (!a.active) return;

  const until = a.calendar.endDate.replace(/-/g, "");
  const rrule =
    a.frequency === "alternate"
      ? "FREQ=DAILY;INTERVAL=2"
      : a.frequency === "custom"
      ? `FREQ=WEEKLY;BYDAY=${a.days.join(",")}`
      : "FREQ=DAILY";

  const ics = `
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${a.uid}
SUMMARY:${a.name}
DTSTART:${a.calendar.startDate.replace(/-/g,"")}T${a.startTime.replace(":","")}00
DTEND:${a.calendar.startDate.replace(/-/g,"")}T${a.endTime.replace(":","")}00
RRULE:${rrule};UNTIL=${until}
END:VEVENT
END:VCALENDAR
`;

  const blob = new Blob([ics.trim()], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement("a");
  aEl.href = url;
  aEl.download = `${a.name}-${Date.now()}.ics`;
  document.body.appendChild(aEl);
  aEl.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    aEl.remove();
  }, 500);
}

/* UTILS */
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