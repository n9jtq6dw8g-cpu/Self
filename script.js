document.addEventListener("DOMContentLoaded", () => {

  /* ========= STORAGE ========= */
  const ACT_KEY = "activities";
  const LOG_KEY = "logs";
  const load = k => JSON.parse(localStorage.getItem(k)) || {};
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const todayISO = () => new Date().toISOString().split("T")[0];

  /* ========= NAV ========= */
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

  /* ========= SVG ICONS ========= */
  const ICONS = {
    skip: `<svg viewBox="0 0 24 24"><path d="M4 14c4-8 12-8 16 0" stroke="currentColor" fill="none" stroke-width="2"/><circle cx="4" cy="14" r="2" stroke="currentColor" fill="none"/><circle cx="20" cy="14" r="2" stroke="currentColor" fill="none"/></svg>`,
    water: `<svg viewBox="0 0 24 24"><path d="M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    run: `<svg viewBox="0 0 24 24"><path d="M6 21l2-6 3-2 2 2 3-1 2 5" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    push: `<svg viewBox="0 0 24 24"><path d="M4 14h16M6 18h12" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    default: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" stroke="currentColor" fill="none" stroke-width="2"/></svg>`
  };

  function getIcon(name) {
    const n = name.toLowerCase();
    if (n.includes("skip") || n.includes("rope")) return ICONS.skip;
    if (n.includes("water")) return ICONS.water;
    if (n.includes("run") || n.includes("walk")) return ICONS.run;
    if (n.includes("push") || n.includes("pull")) return ICONS.push;
    return ICONS.default;
  }

  /* ========= ACTIVITY FORM ========= */
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
    if (!actName.value.trim()) return alert("Activity name required");
    if (!actStart.value || !actEnd.value || actStart.value >= actEnd.value)
      return alert("Invalid time range");

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

  function renderActivities() {
    const acts = load(ACT_KEY);
    activityList.innerHTML = "";

    Object.values(acts).filter(a => !a.archived).forEach(a => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="row">
          <div class="icon">${getIcon(a.name)}</div>
          <strong>${a.name}</strong>
        </div>
        <div class="row">
          <button class="secondary edit">Edit</button>
          <button class="secondary toggle">${a.active ? "Pause" : "Resume"}</button>
          <button class="secondary archive">Archive</button>
          <button class="secondary calendar">Add to Calendar</button>
        </div>
      `;

      const editBtn = card.querySelector(".edit");
      const toggleBtn = card.querySelector(".toggle");
      const archiveBtn = card.querySelector(".archive");
      const calBtn = card.querySelector(".calendar");

      editBtn.onclick = () => startEdit(a);
      toggleBtn.onclick = () => { a.active = !a.active; save(ACT_KEY, acts); renderAll(); };
      archiveBtn.onclick = () => { a.archived = true; a.active = false; save(ACT_KEY, acts); renderAll(); };
      calBtn.onclick = () => exportCalendar(a);

      activityList.appendChild(card);
    });

    populateSummaryActivities();
  }

  /* ========= CALENDAR ========= */
  function exportCalendar(activity) {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 90);

    const weekdayIndex = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
    const events = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (activity.frequency === "alternate" &&
          Math.floor((d - start) / 86400000) % 2 !== 0) continue;

      if (activity.frequency === "custom" &&
          !activity.days.includes(Object.keys(weekdayIndex).find(k => weekdayIndex[k] === d.getDay())))
        continue;

      const [sh, sm] = activity.startTime.split(":");
      const [eh, em] = activity.endTime.split(":");

      const s = new Date(d); s.setHours(sh, sm, 0);
      const e = new Date(d); e.setHours(eh, em, 0);

      events.push(`
BEGIN:VEVENT
SUMMARY:${activity.name}
DTSTART:${formatICS(s)}
DTEND:${formatICS(e)}
END:VEVENT`);
    }

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
${events.join("\n")}
END:VCALENDAR`;

    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activity.name}-calendar.ics`;
    a.click();
  }

  function formatICS(d) {
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  /* ========= SUMMARY ========= */
  const summaryActivity = document.getElementById("summaryActivity");
  const summaryRange = document.getElementById("summaryRange");
  const ctx = document.getElementById("summaryGraph").getContext("2d");

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

    let data = [], allSets = [], activeDays = 0;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const sets = logs[key]?.[id] || [];
      const sum = sets.reduce((a,b)=>a+b,0);
      data.push(sum);
      if (sets.length) { activeDays++; allSets.push(...sets); }
    }

    ctx.clearRect(0,0,320,180);
    const max = Math.max(...data,1);
    ctx.beginPath();
    ctx.strokeStyle = "#2aa198";
    ctx.lineWidth = 2;
    data.forEach((v,i)=>{
      const x=i*(320/(data.length-1));
      const y=180-(v/max)*160;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke();

    document.getElementById("sTotal").textContent = data.reduce((a,b)=>a+b,0);
    document.getElementById("sAvg").textContent = activeDays ? Math.round(data.reduce((a,b)=>a+b,0)/activeDays) : 0;
    document.getElementById("sBest").textContent = Math.max(...data,0);
    document.getElementById("sBestSet").textContent = allSets.length ? Math.max(...allSets) : 0;
    document.getElementById("sActive").textContent = activeDays;

    let streak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i] > 0) streak++;
      else break;
    }
    document.getElementById("sStreak").textContent = streak;
  }

  /* ========= INIT ========= */
  function renderAll() {
    renderActivities();
    populateSummaryActivities();
    renderSummary();
  }

  renderAll();
});