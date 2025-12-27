document.addEventListener("DOMContentLoaded", () => {

  /* ---------------- NAV ---------------- */
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

  /* ---------------- STORAGE ---------------- */
  const ACT_KEY = "activities";
  const LOG_KEY = "logs";

  const load = k => JSON.parse(localStorage.getItem(k)) || {};
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const today = () => new Date().toISOString().split("T")[0];

  /* ---------------- ACTIVITY (PROFILE) ---------------- */
  let editId = null;

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
    resetActivityForm();
    renderAll();
  };

  cancelBtn.onclick = resetActivityForm;

  function resetActivityForm() {
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

  /* ---------------- LOG (INPUT + HISTORY) ---------------- */
  const logActivity = document.getElementById("logActivity");
  const logDate = document.getElementById("logDate");
  const logInputs = document.getElementById("logInputs");
  const logHistory = document.getElementById("logHistory");

  logDate.value = today();

  function renderLogUI() {
    const acts = load(ACT_KEY);
    const activeActs = Object.values(acts).filter(a => a.active && !a.archived);

    logActivity.innerHTML = activeActs
      .map(a => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    renderLogInput();
    renderLogHistory();
  }

  function renderLogInput() {
    logInputs.innerHTML = "";
    if (!logActivity.value) return;

    logInputs.innerHTML = `
      <input type="number" id="logValue" placeholder="Value">
      <button>Add</button>
    `;
    logInputs.querySelector("button").onclick = addLog;
  }

  function addLog() {
    const v = Number(document.getElementById("logValue").value);
    if (!v) return;

    const logs = load(LOG_KEY);
    const d = logDate.value;
    const id = logActivity.value;

    logs[d] = logs[d] || {};
    logs[d][id] = logs[d][id] || [];
    logs[d][id].push(v);

    save(LOG_KEY, logs);
    document.getElementById("logValue").value = "";
    renderLogHistory();
  }

  function renderLogHistory() {
    const logs = load(LOG_KEY);
    const id = logActivity.value;
    logHistory.innerHTML = "";

    Object.keys(logs).sort((a,b)=>b.localeCompare(a)).forEach(date => {
      if (!logs[date][id]) return;

      const day = document.createElement("div");
      day.innerHTML = `<strong>${date}</strong>`;

      logs[date][id].forEach((val, idx) => {
        const row = document.createElement("div");
        row.innerHTML = `
          <input type="number" value="${val}">
          <button>Save</button>
          <button>Delete</button>
        `;

        const [input, saveBtn, delBtn] = row.querySelectorAll("input,button");

        saveBtn.onclick = () => {
          logs[date][id][idx] = Number(input.value);
          save(LOG_KEY, logs);
        };

        delBtn.onclick = () => {
          logs[date][id].splice(idx, 1);
          if (logs[date][id].length === 0) delete logs[date][id];
          save(LOG_KEY, logs);
          renderLogHistory();
        };

        day.appendChild(row);
      });

      logHistory.appendChild(day);
    });
  }

  logActivity.onchange = renderLogHistory;

  /* ---------------- SUMMARY & GRAPH ---------------- */
  // (unchanged from V10.1 – your existing code still works)

  function renderAll() {
    renderActivities();
    renderLogUI();
  }

  renderAll();
});