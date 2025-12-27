document.addEventListener("DOMContentLoaded", () => {

  /* ------------------ NAVIGATION ------------------ */
  const screens = {
    log: document.getElementById("screen-log"),
    summary: document.getElementById("screen-summary"),
    profile: document.getElementById("screen-profile")
  };

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      Object.values(screens).forEach(s => s.classList.remove("active"));
      screens[btn.dataset.target].classList.add("active");
    };
  });

  /* ------------------ CORE LOGIC (UNCHANGED) ------------------ */

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

  const canvas = document.getElementById("summaryGraph");
  const ctx = canvas.getContext("2d");

  actFreq.onchange = () =>
    weekdays.classList.toggle("hidden", actFreq.value !== "custom");

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
      active: true,
      archived: false
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
    weekdays.classList.add("hidden");
  }

  function renderActivities() {
    const acts = load(ACT_KEY);
    activityList.innerHTML = "";

    Object.values(acts)
      .filter(a => !a.archived)
      .forEach(a => {
        const div = document.createElement("div");
        div.innerHTML = `
          <strong>${a.name}</strong> ${a.active ? "" : "(Paused)"}<br>
          <button>Edit</button>
          <button>${a.active ? "Pause" : "Resume"}</button>
          <button>Archive</button>
        `;

        const [editBtn, toggleBtn, archiveBtn] = div.querySelectorAll("button");

        editBtn.onclick = () => startEdit(a);
        toggleBtn.onclick = () => {
          a.active = !a.active;
          save(ACT_KEY, acts);
          renderAll();
        };
        archiveBtn.onclick = () => {
          if (!confirm("Archive activity?")) return;
          a.archived = true;
          a.active = false;
          save(ACT_KEY, acts);
          renderAll();
        };

        activityList.appendChild(div);
      });

    summaryActivity.innerHTML = Object.values(acts)
      .filter(a => !a.archived)
      .map(a => `<option value="${a.id}">${a.name}</option>`)
      .join("");
  }

  function startEdit(a) {
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
    weekdays.classList.toggle("hidden", a.frequency !== "custom");
  }

  logDate.value = today();

  function renderLog() {
    const acts = load(ACT_KEY);
    logInputs.innerHTML = "";

    Object.values(acts)
      .filter(a => a.active && !a.archived)
      .forEach(a => {
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

    const logs = load(LOG_KEY);

    let days = { daily: 7, weekly: 30, monthly: 180, yearly: 365, all: 3650 }[summaryRange.value];

    let data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      data.push((logs[key]?.[id] || []).reduce((a, b) => a + b, 0));
    }

    drawGraph(data);

    const nonZero = data.filter(v => v > 0);
    sTotal.textContent = nonZero.reduce((a, b) => a + b, 0);
    sActive.textContent = nonZero.length;
    sAvg.textContent = nonZero.length ? Math.round(sTotal.textContent / nonZero.length) : 0;
    sBest.textContent = Math.max(...data, 0);
    sBestSet.textContent = Math.max(...Object.values(logs).flatMap(d => d[id] || []), 0);
    sStreak.textContent = nonZero.length;
  }

  function drawGraph(values) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(...values, 1);
    const stepX = canvas.width / (values.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = "#2aa198";
    ctx.lineWidth = 2;

    values.forEach((v, i) => {
      const x = i * stepX;
      const y = canvas.height - (v / max) * canvas.height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
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