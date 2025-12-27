document.addEventListener("DOMContentLoaded", () => {

  /* ================= STORAGE ================= */
  const ACT_KEY = "activities";
  const LOG_KEY = "logs";
  const load = k => JSON.parse(localStorage.getItem(k)) || {};
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const today = () => new Date().toISOString().split("T")[0];

  /* ================= NAVIGATION ================= */
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
      if (btn.dataset.target === "summary") renderSummary();
    };
  });

  /* ================= SVG ICON SYSTEM ================= */
  const ICONS = {
    skip: `
      <svg viewBox="0 0 24 24">
        <path d="M4 14c4-8 12-8 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="4" cy="14" r="2" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="20" cy="14" r="2" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    `,
    water: `
      <svg viewBox="0 0 24 24">
        <path d="M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"
          fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    `,
    run: `
      <svg viewBox="0 0 24 24">
        <path d="M13 5a2 2 0 1 1-4 0a2 2 0 0 1 4 0zM6 21l2-6 3-2 2 2 3-1 2 5"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
    push: `
      <svg viewBox="0 0 24 24">
        <path d="M4 14h16M6 18h12"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
    default: `
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="6"
          fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    `
  };

  function getIcon(name) {
    const n = name.toLowerCase();
    if (n.includes("skip") || n.includes("rope")) return ICONS.skip;
    if (n.includes("water")) return ICONS.water;
    if (n.includes("run") || n.includes("walk")) return ICONS.run;
    if (n.includes("push") || n.includes("pull")) return ICONS.push;
    return ICONS.default;
  }

  /* ================= ACTIVITY (PROFILE) ================= */
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
        div.className = "card";

        div.innerHTML = `
          <div class="row">
            <div class="icon">${getIcon(a.name)}</div>
            <strong>${a.name}</strong>
          </div>
          <div class="row">
            <button>Edit</button>
            <button>${a.active ? "Pause" : "Resume"}</button>
            <button class="secondary">Archive</button>
          </div>
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

    populateSummaryActivities();
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

  /* ================= LOG ================= */
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
    renderSummary();
  }

  function renderLogHistory() {
    const logs = load(LOG_KEY);
    const id = logActivity.value;
    logHistory.innerHTML = "";

    Object.keys(logs)
      .sort((a, b) => b.localeCompare(a))
      .forEach(date => {
        if (!logs[date][id]) return;

        const day = document.createElement("div");
        day.className = "card";
        day.innerHTML = `<strong>${date}</strong>`;

        logs[date][id].forEach((val, idx) => {
          const row = document.createElement("div");
          row.className = "log-item";
          row.innerHTML = `
            <input type="number" value="${val}">
            <button>Save</button>
            <button class="secondary">Delete</button>
          `;

          const [input, saveBtn, delBtn] = row.querySelectorAll("input,button");

          saveBtn.onclick = () => {
            logs[date][id][idx] = Number(input.value);
            save(LOG_KEY, logs);
            renderSummary();
          };

          delBtn.onclick = () => {
            logs[date][id].splice(idx, 1);
            if (logs[date][id].length === 0) delete logs[date][id];
            save(LOG_KEY, logs);
            renderLogHistory();
            renderSummary();
          };

          day.appendChild(row);
        });

        logHistory.appendChild(day);
      });
  }

  logActivity.onchange = () => {
    renderLogInput();
    renderLogHistory();
  };

  /* ================= SUMMARY ================= */
  const summaryActivity = document.getElementById("summaryActivity");
  const summaryRange = document.getElementById("summaryRange");
  const canvas = document.getElementById("summaryGraph");
  const ctx = canvas.getContext("2d");

  summaryActivity.onchange = renderSummary;
  summaryRange.onchange = renderSummary;

  function populateSummaryActivities() {
    const acts = load(ACT_KEY);
    summaryActivity.innerHTML = Object.values(acts)
      .filter(a => !a.archived)
      .map(a => `<option value="${a.id}">${a.name}</option>`)
      .join("");
  }

  function renderSummary() {
    const id = summaryActivity.value;
    if (!id) return;

    const logs = load(LOG_KEY);
    const daysMap = { daily:7, weekly:30, monthly:180, yearly:365, all:3650 };
    const days = daysMap[summaryRange.value];

    let data = [];
    let allSets = [];
    let activeDays = 0;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];

      const sets = logs[key]?.[id] || [];
      const totalForDay = sets.reduce((a,b)=>a+b,0);

      data.push(totalForDay);

      if (sets.length > 0) {
        activeDays++;
        allSets.push(...sets);
      }
    }

    drawGraph(data);

    const total = data.reduce((a,b)=>a+b,0);
    const bestDay = Math.max(...data, 0);
    const bestSet = allSets.length ? Math.max(...allSets) : 0;
    const avg = activeDays ? Math.round(total / activeDays) : 0;

    document.getElementById("sTotal").textContent = total;
    document.getElementById("sAvg").textContent = avg;
    document.getElementById("sBest").textContent = bestDay;
    document.getElementById("sBestSet").textContent = bestSet;
    document.getElementById("sActive").textContent = activeDays;

    let streak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i] > 0) streak++;
      else break;
    }
    document.getElementById("sStreak").textContent = streak;
  }

  function drawGraph(values) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const max = Math.max(...values,1);
    const pad = 30;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;

    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    for (let i = 0; i <= 4; i++) {
      const y = pad + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(canvas.width - pad, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = "#2aa198";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    values.forEach((v, i) => {
      const x = pad + (w / (values.length - 1)) * i;
      const y = pad + h - (v / max) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  /* ================= THEME ================= */
  const themeBtn = document.getElementById("toggleTheme");
  if (themeBtn) {
    themeBtn.onclick = () => {
      document.body.classList.toggle("dark");
      localStorage.setItem(
        "theme",
        document.body.classList.contains("dark") ? "dark" : "light"
      );
    };
  }
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }

  /* ================= INIT ================= */
  function renderAll() {
    renderActivities();
    renderLogUI();
    populateSummaryActivities();
    renderSummary();
  }

  renderAll();
});