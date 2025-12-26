const ACT_KEY = "activities";
const LOG_KEY = "logs";
const BACKUP_KEY = "lastBackup";

let editId = null;

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
  const id = editId || actName.value.toLowerCase().replace(/\s+/g, "_");

  let days = [];
  if (actFreq.value === "custom") {
    document.querySelectorAll("#weekdays input:checked")
      .forEach(cb => days.push(cb.value));
  }

  acts[id] = {
    name: actName.value,
    unit: actUnit.value,
    goal: Number(actGoal.value),
    sets: Number(actSets.value || 1),
    time: actTime.value || "07:00",
    frequency: actFreq.value,
    days,
    streak: acts[id]?.streak || 0,
    bestStreak: acts[id]?.bestStreak || 0
  };

  save(ACT_KEY, acts);
  resetForm();
  renderActivities();
  renderLogInputs();
}

function editActivity(id) {
  const act = load(ACT_KEY)[id];
  editId = id;
  formTitle.textContent = "Edit Activity";

  actName.value = act.name;
  actUnit.value = act.unit;
  actGoal.value = act.goal;
  actSets.value = act.sets;
  actTime.value = act.time;
  actFreq.value = act.frequency;
  toggleWeekdays();

  document.querySelectorAll("#weekdays input").forEach(cb => {
    cb.checked = act.days.includes(cb.value);
  });
}

function deleteActivity(id) {
  const acts = load(ACT_KEY);
  delete acts[id];
  save(ACT_KEY, acts);
  renderActivities();
  renderLogInputs();
}

function resetForm() {
  editId = null;
  formTitle.textContent = "Add Activity";
  actName.value = actGoal.value = actSets.value = "";
  actTime.value = "07:00";
  actFreq.value = "daily";
  toggleWeekdays();
}

function renderActivities() {
  activityList.innerHTML = "";
  const acts = load(ACT_KEY);

  Object.entries(acts).forEach(([id, act]) => {
    activityList.innerHTML += `
      <div class="activity-item">
        <strong>${act.name}</strong>
        <br/>Streak: ${act.streak} 🔥 | Best: ${act.bestStreak}
        <br/>
        <button onclick="editActivity('${id}')">Edit</button>
        <button onclick="deleteActivity('${id}')">Delete</button>
      </div>
    `;
  });
}

/* ---------- DAILY LOG + STREAK ---------- */

function isScheduled(act, date) {
  const d = new Date(date);
  const day = ["SU","MO","TU","WE","TH","FR","SA"][d.getDay()];

  if (act.frequency === "daily") return true;
  if (act.frequency === "alternate")
    return Math.floor(d / 86400000) % 2 === 0;
  if (act.frequency === "custom")
    return act.days.includes(day);

  return false;
}

function renderLogInputs() {
  logForm.innerHTML = "";
  const acts = load(ACT_KEY);

  Object.entries(acts).forEach(([id, act]) => {
    if (!isScheduled(act, today())) return;

    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = `${act.name} (${act.unit})`;
    input.dataset.id = id;
    logForm.appendChild(input);
  });
}

function saveLog() {
  const logs = load(LOG_KEY);
  const acts = load(ACT_KEY);
  const day = today();

  logs[day] = logs[day] || {};

  document.querySelectorAll("#logForm input").forEach(i => {
    const val = Number(i.value || 0);
    logs[day][i.dataset.id] = val;

    if (val > 0) {
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
  renderSummary("daily");
}

/* ---------- SUMMARY ---------- */

function renderSummary(range) {
  const logs = load(LOG_KEY);
  const acts = load(ACT_KEY);
  summary.innerHTML = "";

  Object.entries(acts).forEach(([id, act]) => {
    let total = 0;
    let days = 0;

    Object.entries(logs).forEach(([date, vals]) => {
      const diff = (Date.now() - new Date(date)) / 86400000;
      if (
        (range === "daily" && diff < 1) ||
        (range === "weekly" && diff < 7) ||
        (range === "monthly" && diff < 30) ||
        (range === "yearly" && diff < 365)
      ) {
        total += vals[id] || 0;
        days++;
      }
    });

    const progress = Math.min(
      (total / (act.goal * Math.max(days, 1))) * 100,
      100
    );

    summary.innerHTML += `
      <p><strong>${act.name}</strong>: ${total} ${act.unit}</p>
      <div class="progress"><div style="width:${progress}%"></div></div>
    `;
  });
}

/* ---------- CALENDAR ---------- */

function generateCalendar() {
  const acts = load(ACT_KEY);
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\n";

  Object.values(acts).forEach(act => {
    let rrule = "FREQ=DAILY";
    if (act.frequency === "alternate") rrule = "FREQ=DAILY;INTERVAL=2";
    if (act.frequency === "custom" && act.days.length)
      rrule = `FREQ=WEEKLY;BYDAY=${act.days.join(",")}`;

    ics += `
BEGIN:VEVENT
SUMMARY:${act.name}
DTSTART:${today().replace(/-/g,"")}T${act.time.replace(":","")}00
DURATION:PT30M
RRULE:${rrule}
END:VEVENT
`;
  });

  ics += "END:VCALENDAR";

  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "health-schedule.ics";
  a.click();
}

/* ---------- BACKUP ---------- */

function downloadBackup() {
  const data = {
    activities: load(ACT_KEY),
    logs: load(LOG_KEY)
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup-${today()}.json`;
  a.click();

  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
}

function importBackup(e) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    save(ACT_KEY, data.activities || {});
    save(LOG_KEY, data.logs || {});
    renderActivities();
    renderLogInputs();
    renderSummary("daily");
  };
  reader.readAsText(e.target.files[0]);
}

/* ---------- INIT ---------- */

renderActivities();
renderLogInputs();
renderSummary("daily");

document.querySelectorAll(".tab").forEach(t => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    renderSummary(t.dataset.range);
  };
});
