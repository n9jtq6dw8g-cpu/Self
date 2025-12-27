document.addEventListener("DOMContentLoaded", () => {

  const ACT_KEY = "activities";
  const LOG_KEY = "logs";
  let editId = null;

  const load = k => JSON.parse(localStorage.getItem(k)) || {};
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const today = () => new Date().toISOString().split("T")[0];

  /* ---------- ELEMENTS ---------- */
  const actName = document.getElementById("actName");
  const actUnit = document.getElementById("actUnit");
  const actStart = document.getElementById("actStart");
  const actEnd = document.getElementById("actEnd");
  const actFreq = document.getElementById("actFreq");
  const weekdays = document.getElementById("weekdays");
  const saveBtn = document.getElementById("saveActivity");

  const activityList = document.getElementById("activityList");
  const logDate = document.getElementById("logDate");
  const logInputs = document.getElementById("logInputs");

  const logViewActivity = document.getElementById("logViewActivity");
  const logViewDate = document.getElementById("logViewDate");
  const logViewer = document.getElementById("logViewer");

  const summaryActivity = document.getElementById("summaryActivity");
  const summaryRange = document.getElementById("summaryRange");

  const sTotal = document.getElementById("sTotal");
  const sAvg = document.getElementById("sAvg");
  const sBest = document.getElementById("sBest");
  const sActive = document.getElementById("sActive");

  /* ---------- FREQUENCY ---------- */
  function updateWeekdays() {
    weekdays.classList.toggle("hidden", actFreq.value !== "custom");
  }
  actFreq.onchange = updateWeekdays;
  updateWeekdays();

  /* ---------- ACTIVITIES ---------- */
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
      div.textContent = `${a.name} (${a.startTime}–${a.endTime})`;
      div.onclick = () => loadForEdit(a.id);
      activityList.appendChild(div);
    });

    const options = Object.values(acts)
      .map(a => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    summaryActivity.innerHTML = options;
    logViewActivity.innerHTML = options;
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

  /* ---------- LOGGING ---------- */
  logDate.value = today();
  logViewDate.value = today();

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
    renderLogViewer();
  }

  /* ---------- LOG VIEWER ---------- */
  logViewActivity.onchange = renderLogViewer;
  logViewDate.onchange = renderLogViewer;

  function renderLogViewer() {
    const logs = load(LOG_KEY);
    const d = logViewDate.value;
    const id = logViewActivity.value;

    logViewer.innerHTML = "";
    const sets = logs[d]?.[id] || [];

    sets.forEach((val, idx) => {
      const row = document.createElement("div");
      row.className = "log-row";

      const input = document.createElement("input");
      input.type = "number";
      input.value = val;

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      saveBtn.onclick = () => {
        sets[idx] = Number(input.value);
        save(LOG_KEY, logs);
        renderSummary();
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = () => {
        sets.splice(idx, 1);
        save(LOG_KEY, logs);
        renderLogViewer();
        renderSummary();
      };

      row.append(input, saveBtn, delBtn);
      logViewer.appendChild(row);
    });
  }

  /* ---------- SUMMARY ---------- */
  summaryActivity.onchange = renderSummary;
  summaryRange.onchange = renderSummary;

  function renderSummary() {
    const id = summaryActivity.value;
    if (!id) return;

    const range = summaryRange.value;
    const logs = load(LOG_KEY);
    const days = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[range];

    let total = 0, best = 0, active = 0;

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

  /* ---------- INIT ---------- */
  function renderAll() {
    renderActivities();
    renderLog();
    renderLogViewer();
    renderSummary();
  }

  renderAll();
});