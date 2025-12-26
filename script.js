const ACT_KEY = "activities";
const LOG_KEY = "logs";

let currentRange = "daily";

const ranges = {
  daily: 14,
  weekly: 56,
  monthly: 180,
  yearly: 730
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function load(key) {
  return JSON.parse(localStorage.getItem(key)) || {};
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ---------- ACTIVITY ---------- */

function toggleWeekdays() {
  weekdays.classList.toggle("hidden", actFreq.value !== "custom");
}

function saveActivity() {
  const acts = load(ACT_KEY);
  const id = actName.value.toLowerCase().replace(/\s+/g, "_");

  let days = [];
  document.querySelectorAll("#weekdays input:checked")
    .forEach(cb => days.push(cb.value));

  const start = today();
  const end = addMonths(start, Number(actDuration.value));

  acts[id] = {
    name: actName.value,
    unit: actUnit.value,
    goal: Number(actGoal.value),
    sets: Number(actSets.value || 1),
    time: actTime.value || "07:00",
    frequency: actFreq.value,
    days,
    calendar: { start, end },
    streak: 0,
    bestStreak: 0
  };

  save(ACT_KEY, acts);
  renderAll();
}

function renderActivities() {
  const acts = load(ACT_KEY);
  activityList.innerHTML = "";

  Object.entries(acts).forEach(([id, a]) => {
    activityList.innerHTML += `
      <div class="activity-item">
        <strong>${a.name}</strong><br/>
        Streak: ${a.streak} | Best: ${a.bestStreak}<br/>
        <button onclick="exportCalendar('${id}')">Export Calendar</button>
      </div>
    `;
  });

  summaryActivity.innerHTML = Object.entries(acts)
    .map(([id, a]) => `<option value="${id}">${a.name}</option>`)
    .join("");
}

/* ---------- DAILY LOG ---------- */

function renderLogInputs() {
  const acts = load(ACT_KEY);
  logForm.innerHTML = "";

  Object.entries(acts).forEach(([id, a]) => {
    const i = document.createElement("input");
    i.type = "number";
    i.placeholder = `${a.name} (${a.unit})`;
    i.dataset.id = id;
    logForm.appendChild(i);
  });
}

function saveLog() {
  const logs = load(LOG_KEY);
  const acts = load(ACT_KEY);
  const d = today();

  logs[d] = logs[d] || {};

  document.querySelectorAll("#logForm input").forEach(i => {
    const v = Number(i.value || 0);
    logs[d][i.dataset.id] = v;

    if (v > 0) {
      acts[i.dataset.id].streak++;
      acts[i.dataset.id].bestStreak = Math.max(
        acts[i.dataset.id].bestStreak,
        acts[i.dataset.id].streak
      );
    } else {
      acts[i.dataset.id].streak = 0;
    }
  });

  save(LOG_KEY, logs);
  save(ACT_KEY, acts);
  renderActivities();
}

/* ---------- SUMMARY GRAPH ---------- */

document.querySelectorAll(".tab").forEach(t => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    t.classList.add("active");
    currentRange = t.dataset.range;
    renderSummary();
  };
});

function renderSummary() {
  const id = summaryActivity.value;
  if (!id) return;

  const logs = load(LOG_KEY);
  const ctx = chart.getContext("2d");
  ctx.clearRect(0, 0, chart.width, chart.height);

  const days = ranges[currentRange];
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    data.push(logs[key]?.[id] || 0);
  }

  drawLine(ctx, data);
  renderStats(data);
}

function drawLine(ctx, data) {
  const w = chart.width;
  const h = chart.height;
  const max = Math.max(...data, 1);

  ctx.beginPath();
  ctx.strokeStyle = "black";

  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function renderStats(data) {
  const total = data.reduce((a, b) => a + b, 0);
  const active = data.filter(v => v > 0).length;
  const avg = active ? (total / active).toFixed(1) : 0;
  const best = Math.max(...data);

  stats.innerHTML = `
    Total: ${total}<br/>
    Daily Average: ${avg}<br/>
    Best Day: ${best}<br/>
    Active Days: ${active}
  `;
}

/* ---------- CALENDAR ---------- */

function exportCalendar(id) {
  const a = load(ACT_KEY)[id];
  const rrule =
    a.frequency === "alternate"
      ? "FREQ=DAILY;INTERVAL=2"
      : a.frequency === "custom"
      ? `FREQ=WEEKLY;BYDAY=${a.days.join(",")}`
      : "FREQ=DAILY";

  const ics = `
BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:${a.name}
DTSTART:${a.calendar.start.replace(/-/g,"")}T${a.time.replace(":","")}00
DTEND:${a.calendar.end.replace(/-/g,"")}T${a.time.replace(":","")}00
RRULE:${rrule}
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
