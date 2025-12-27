document.addEventListener("DOMContentLoaded", () => {

  const ACT_KEY = "activities";
  const LOG_KEY = "logs";

  let editId = null;

  const load = k => JSON.parse(localStorage.getItem(k)) || {};
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const today = () => new Date().toISOString().split("T")[0];

  const actName = document.getElementById("actName");
  const actUnit = document.getElementById("actUnit");
  const actStart = document.getElementById("actStart");
  const actEnd = document.getElementById("actEnd");
  const actFreq = document.getElementById("actFreq");
  const weekdays = document.getElementById("weekdays");
  const saveBtn = document.getElementById("saveActivity");
  const cancelBtn = document.getElementById("cancelEdit");
  const editLabel = document.getElementById("editLabel");

  const activityList = document.getElementById("activityList");
  const logDate = document.getElementById("logDate");
  const logInputs = document.getElementById("logInputs");

  const summaryActivity = document.getElementById("summaryActivity");
  const summaryRange = document.getElementById("summaryRange");

  const sTotal = document.getElementById("sTotal");
  const sAvg = document.getElementById("sAvg");
  const sBest = document.getElementById("sBest");
  const sBestSet = document.getElementById("sBestSet");
  const sActive = document.getElementById("sActive");
  const sStreak = document.getElementById("sStreak");

  function updateWeekdays() {
    weekdays.classList.toggle("hidden", actFreq.value !== "custom");
  }
  actFreq.onchange = updateWeekdays;
  updateWeekdays();

  saveBtn.onclick = () => {
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

  cancelBtn.onclick = resetForm;

  function resetForm() {
    editId = null;
    editLabel.textContent = "";
    cancelBtn.classList.add("hidden");
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

    div.innerHTML = `
      <strong>${a.name}</strong> ${a.active ? "" : "(Paused)"}
      <br>
      <button class="edit-btn">Edit</button>
      <button class="toggle-btn">${a.active ? "Pause" : "Resume"}</button>
    `;

    div.querySelector(".edit-btn").onclick = () => {
      editId = a.id;
      editLabel.textContent = `Editing: ${a.name}`;
      cancelBtn.classList.remove("hidden");

      actName.value = a.name;
      actUnit.value = a.unit;
      actStart.value = a.startTime;
      actEnd.value = a.endTime;
      actFreq.value = a.frequency;

      weekdays.querySelectorAll("input").forEach(
        i => (i.checked = a.days.includes(i.value))
      );
      updateWeekdays();
    };

    div.querySelector(".toggle-btn").onclick = () => {
      a.active = !a.active;
      save(ACT_KEY, acts);
      renderAll();
    };

    activityList.appendChild(div);
  });

  const activeActs = Object.values(acts).filter(a => a.active);
  summaryActivity.innerHTML = activeActs
    .map(a => `<option value="${a.id}">${a.name}</option>`)
    .join("");
}

  logDate.value = today();

  function renderLog() {
    const acts = load(ACT_KEY);
    logInputs.innerHTML = "";

    Object.values(acts).filter(a => a.active).forEach(a => {
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

  summaryActivity.onchange = renderSummary;
  summaryRange.onchange = renderSummary;

  function renderSummary() {
    const id = summaryActivity.value;
    if (!id) return;

    const acts = load(ACT_KEY);
    const a = acts[id];
    const logs = load(LOG_KEY);

    let total = 0, bestDay = 0, bestSet = 0, active = 0;
    let streak = 0;

    let dates = [];
    if (summaryRange.value === "all") {
      dates = Object.keys(logs).sort().reverse();
    } else {
      const days = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[summaryRange.value];
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }
    }

    for (let date of dates) {
      const sets = logs[date]?.[id];
      if (sets?.length) {
        const sum = sets.reduce((a, b) => a + b, 0);
        total += sum;
        active++;
        bestDay = Math.max(bestDay, sum);
        sets.forEach(v => bestSet = Math.max(bestSet, v));
      }
    }

    // STREAK CALCULATION
    let current = new Date();
    while (true) {
      const dStr = current.toISOString().split("T")[0];
      const sets = logs[dStr]?.[id];

      const weekday = ["SU","MO","TU","WE","TH","FR","SA"][current.getDay()];
      const isExpected =
        a.frequency === "daily" ||
        (a.frequency === "alternate" && streak % 2 === 0) ||
        (a.frequency === "custom" && a.days.includes(weekday));

      if (!isExpected) {
        current.setDate(current.getDate() - 1);
        continue;
      }

      if (!sets || !sets.length) break;

      streak++;
      current.setDate(current.getDate() - 1);
    }

    sTotal.textContent = total;
    sActive.textContent = active;
    sAvg.textContent = active ? Math.round(total / active) : 0;
    sBest.textContent = bestDay;
    sBestSet.textContent = bestSet;
    sStreak.textContent = streak;
  }

  document.getElementById("exportData").onclick = () => {
    const data = { activities: load(ACT_KEY), logs: load(LOG_KEY) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "health-tracker-backup.json";
    a.click();
  };

  document.getElementById("importData").onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const data = JSON.parse(r.result);
      save(ACT_KEY, data.activities || {});
      save(LOG_KEY, data.logs || {});
      renderAll();
    };
    r.readAsText(file);
  };

  function renderAll() {
    renderActivities();
    renderLog();
    renderSummary();
  }

  renderAll();
});