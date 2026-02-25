/* script.js - full replacement
   - fixed summary date/week logic
   - responsive HiDPI canvas drawing
   - consistent data flow from logs -> summary
   - improved safety checks for inputs
*/

document.addEventListener("DOMContentLoaded", () => {

  const ARCHIVED_TOGGLE = document.getElementById("archivedToggle");
  const archivedList = document.getElementById("archivedActivityList");
  if (ARCHIVED_TOGGLE) {
    ARCHIVED_TOGGLE.onclick = () => archivedList.classList.toggle("collapsed");
  }

  const ACT = "activities", LOG = "logs";
  const load = k => JSON.parse(localStorage.getItem(k)) || {};
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ELEMENTS */
  const dateEl = document.getElementById("logDate");
  const sel = document.getElementById("logActivity");
  const entry = document.getElementById("logEntry");
  const hist = document.getElementById("logHistory");

  const summaryActivity = document.getElementById("summaryActivity");
  const summaryRange = document.getElementById("summaryRange");
  const sDate = document.getElementById("summaryDate");
  const sMonth = document.getElementById("summaryMonth");
  const sYear = document.getElementById("summaryYear");
  const sWeek = document.getElementById("summaryWeek");
  const canvas = document.getElementById("summaryGraph");

  /* UI Defaults */
  const today = new Date();
  dateEl.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;


  /* Populate years/weeks/months*/
  const currentYear = new Date().getFullYear();
  sYear.innerHTML = "";
  for (let y = currentYear; y >= currentYear - 5; y--) {
    sYear.innerHTML += `<option value="${y}">${y}</option>`;
  }
  sWeek.innerHTML = "";
  for (let w = 1; w <= 52; w++) {
    sWeek.innerHTML += `<option value="${w}">Week ${w}</option>`;
  }
  // month input left as native <input type="month"> (sMonth)

  /* NAV handlers (unchanged) */
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      document.getElementById("screen-" + b.dataset.target).classList.add("active");
      if (b.dataset.target === "summary") renderSummary();
    };
  });

  /* THEME toggle (keeps existing behaviour) */
  const toggleThemeBtn = document.getElementById("toggleTheme");
  if (toggleThemeBtn) toggleThemeBtn.onclick = () => document.body.classList.toggle("dark");

  /* BACKUP buttons (keeps existing behavior, slightly safer revoke) */
  document.getElementById("downloadBackup").onclick = () => {
    const backup = { version: 1, exportedAt: parseDateKey().toISOString(), activities: load(ACT), logs: load(LOG) };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracker-backup-${parseDateKey().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 150);
  };

  document.getElementById("restoreBackup").onclick = () => {
    if (!confirm("This will ERASE all current data and replace it with the backup.\n\nContinue?")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);

          if (!data.activities || !data.logs) {
            alert("Invalid backup file.");
            return;
          }
          
          /* 🧠 Backward compatibility patch */
          Object.values(data.activities).forEach(a => {
            if (a.archived === undefined) a.archived = false;
            if (!a.frequency) a.frequency = "daily";
            if (!a.days) a.days = [];
            if (a.active === undefined) a.active = true;
          });

          const acts = data.activities;
          const logs = data.logs;
          
          Object.keys(logs).forEach(date => {
            Object.keys(logs[date]).forEach(logId => {
              if (!acts[logId]) {
                const match = Object.values(acts).find(a =>
                  a.name.toLowerCase().replace(/\s+/g,"") ===
                  logId.toLowerCase().replace(/[_\s]+/g,"")
                );
                if (match) {
                  logs[date][match.id] = logs[date][logId];
                  delete logs[date][logId];
                }
              }
            });
          });
          
          /* Now save */
          localStorage.setItem(ACT, JSON.stringify(data.activities));
          localStorage.setItem(LOG, JSON.stringify(data.logs));

          initUI();
          alert("Backup restored successfully.");
        } catch (e) {
          alert("Failed to read backup file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  /* Activities UI */
  const actName = document.getElementById("actName");
  const actUnit = document.getElementById("actUnit");
  const actStart = document.getElementById("actStart");
  const actEnd = document.getElementById("actEnd");
  const actFreq = document.getElementById("actFreq");
  const weekdays = document.getElementById("weekdays");
  const activityList = document.getElementById("activityList");
  let edit = null;

  actFreq.onchange = () => weekdays.classList.toggle("hidden", actFreq.value !== "custom");

  document.getElementById("saveActivity").onclick = () => {
    if (!actName.value) return;
    const a = load(ACT);
    const id = edit ?? actName.value.toLowerCase().replace(/\s+/g, "_");

    if (!edit && a[id]) {
      if (!confirm(`An activity named "${actName.value}" already exists. Overwrite?`)) return;
    }

    a[id] = {
      id,
      name: actName.value,
      unit: actUnit.value,
      startTime: actStart.value || "",
      endTime: actEnd.value || "",
      frequency: actFreq.value || "daily",
      days: [...weekdays.querySelectorAll("input:checked")].map(i => i.value),
      active: true
    };
    save(ACT, a);
    resetActivityForm();
    renderActivities();
  };

  document.getElementById("cancelEdit").onclick = resetActivityForm;


  function parseDateKey(a, b, c){
    // no args -> today
    if (a === undefined) return new Date();
  
    // a is a Date
    if (a instanceof Date) return new Date(a.getFullYear(), a.getMonth(), a.getDate());
   
    // called as parseDateKey("yyyy-mm-dd")
    if (typeof a === "string") {
      const parts = a.split("-").map(Number);
      if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) {
        return new Date(parts[0], parts[1]-1, parts[2]);
      }
    }
  
    // called as parseDateKey(year, monthIndex, day)
    if (typeof a === "number" && typeof b === "number") {
      const day = (typeof c === "number") ? c : 1;
      return new Date(a, b, day);
    }
  
    // fallback
    return new Date(a);
  }


  function renderActivities() {
    const acts = load(ACT);
    activityList.innerHTML = "";
    if (archivedList) archivedList.innerHTML = "";

    Object.values(acts).forEach(a => {
      if (a.archived) {
        const arc = document.createElement("div");
        arc.className = "card paused";
        arc.innerHTML = `
          <strong>${a.name}</strong> (${a.unit})
          <div class="row" style="margin-top:10px;">
            <button class="secondary unarchive-btn">Unarchive</button>
          </div>
        `;
        arc.querySelector(".unarchive-btn").onclick = () => {
          a.archived = false;
          a.active = true;
          save(ACT, acts);
          renderActivities();
          populate();
        };
        archivedList.appendChild(arc);
        return;
      }

      const card = document.createElement("div");
      card.className = "card" + (a.active ? "" : " paused");
      card.innerHTML = `
        <strong>${a.name}</strong> (${a.unit})
        <div class="row" style="margin-top:10px;">
          <button class="secondary edit-btn">Edit</button>
          <button class="secondary toggle-btn">${a.active ? "Pause" : "Resume"}</button>
          <button class="secondary archive-btn">Archive</button>
          <button class="secondary cal-btn">Calendar</button>
        </div>
      `;

      card.querySelector(".edit-btn").onclick = () => {
        edit = a.id;
        actName.value = a.name;
        actUnit.value = a.unit;
        actStart.value = a.startTime || "";
        actEnd.value = a.endTime || "";
        actFreq.value = a.frequency || "daily";
        weekdays.classList.toggle("hidden", a.frequency !== "custom");
        weekdays.querySelectorAll("input").forEach(i => i.checked = a.days?.includes(i.value));
        document.getElementById("cancelEdit").classList.remove("hidden");
      };

      card.querySelector(".toggle-btn").onclick = () => {
        a.active = !a.active;
        save(ACT, acts);
        renderActivities();
        populate();
      };

      card.querySelector(".archive-btn").onclick = () => {
        a.archived = true;
        a.active = false;
        save(ACT, acts);
        renderActivities();
        populate();
      };

      card.querySelector(".cal-btn").onclick = () => exportCalendar(a);

      activityList.appendChild(card);
    });

    populate();
  }

  function resetActivityForm() {
    edit = null;
    actName.value = "";
    actUnit.value = "count";
    actStart.value = "";
    actEnd.value = "";
    actFreq.value = "daily";
    weekdays.classList.add("hidden");
    weekdays.querySelectorAll("input").forEach(i => i.checked = false);
    document.getElementById("cancelEdit").classList.add("hidden");
  }

  /* Logging (value validation fixed) */
  function populate() {
    const a = load(ACT);

    sel.innerHTML = Object.values(a)
      .filter(x => x.active && !x.archived)
      .map(x => `<option value="${x.id}">${x.name}</option>`)
      .join("");

    summaryActivity.innerHTML = Object.values(a)
      .map(x => `<option value="${x.id}">${x.name}</option>`)
      .join("");

    // Set sensible defaults if nothing selected
    if (!sel.value && sel.options.length) sel.value = sel.options[0].value;
    if (!summaryActivity.value && summaryActivity.options.length) summaryActivity.value = summaryActivity.options[0].value;

    renderEntry();
  }

  sel.onchange = () => {
    renderEntry();
    renderHistory();
  };

  function renderEntry() {
    const a = load(ACT)[sel.value];
    if (!a) {
      entry.innerHTML = `<div style="color:var(--muted)">Create an activity in Profile first.</div>`;
      return;
    }
    entry.innerHTML = `<div class="log-input" style="display:flex;gap:10px;align-items:center;">
        <input id="val" type="number" placeholder="${a.unit}" style="flex:1;">
        <button id="addBtn">Add</button>
      </div>`;
    document.getElementById("addBtn").onclick = () => {
      const raw = document.getElementById("val").value;
      if (raw === "" || raw === null) return;
      const num = Number(raw);
      if (isNaN(num) || num < 0) return alert("Enter a valid number");
      const l = load(LOG);
      const d = dateEl.value;
      l[d] = l[d] || {};
      l[d][a.id] = l[d][a.id] || [];
      l[d][a.id].push(num);
      save(LOG, l);
      document.getElementById("val").value = "";
      renderHistory();
      renderSummary();
    };
  }

  /* History (document fragment optimization + edit/delete) */
  function renderHistory() {
    hist.innerHTML = "";
    const l = load(LOG);
    const actMap = load(ACT);
    const frag = document.createDocumentFragment();
    const activeId = sel.value;

    const months = {};
    Object.keys(l).forEach(d=>{
      const m = d.slice(0,7); // YYYY-MM
      months[m] = months[m] || [];
      months[m].push(d);
    });
      
    Object.keys(months).sort().reverse().forEach(month=>{
      const monthDiv = document.createElement("div");
      monthDiv.className = "history-month";
    
      const header = document.createElement("h3");
      header.textContent = month;
      header.onclick = () => monthDiv.classList.toggle("month-collapsed");
    
      monthDiv.appendChild(header);
      
      months[month].sort().reverse().forEach(d=>{
        const day = document.createElement("div");
        day.className = "history-day";
        day.innerHTML = `<strong>${formatHistoryDate(d)}</strong>`;
    
        Object.keys(l[d]).forEach(id=>{
          if(id !== sel.value) return; // show only selected activity
    
          const act = actMap[id];
          if(!act) return;
      
          const group = document.createElement("div");
          group.style.marginTop = "8px";
          group.innerHTML = `<strong>${act.name}</strong>`;
    
          l[d][id].forEach((v, idx)=>{
            const s = document.createElement("div");
            s.className = "history-set";
            s.innerHTML = `
              <span>${v} ${act.unit}</span>
              <div style="margin-left:auto; display:flex; gap:5px;">
                <button class="edit-btn" title="Edit">✎</button>
                <button class="delete-btn" title="Delete">×</button>
              </div>
            `;

            s.querySelector(".edit-btn").onclick = () => {
              const newVal = prompt("Edit value:", v);
              if (newVal === null || newVal === "") return;
              const num = Number(newVal);
              if (isNaN(num) || num < 0) return alert("Enter a valid number");

              const logs = load(LOG);
              logs[d][id][idx] = num;
              save(LOG, logs);
              renderHistory();
              renderSummary();
            };

            s.querySelector(".delete-btn").onclick = () => {
              if (!confirm("Delete this entry?")) return;
              const logs = load(LOG);
              logs[d][id].splice(idx, 1);
              if (logs[d][id].length === 0) delete logs[d][id];
              if (Object.keys(logs[d]).length === 0) delete logs[d];
              save(LOG, logs);
              renderHistory();
              renderSummary();
            };

            group.appendChild(s);
          });
    
          day.appendChild(group);
        });
    
        monthDiv.appendChild(day);
      });
      
      frag.appendChild(monthDiv);
    });

    hist.appendChild(frag);
  }

  function formatHistoryDate(d) {
    const date = parseDateKey(d);
    const today = parseDateKey();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  /* SUMMARY (range-aware, robust) */

  // helper: ISO-like week start calculation (Mon start)
  function getWeekStart(year, week){
    const d = new Date(year, 0, 1 + (week - 1) * 7);
    const day = d.getDay();
    if(day <= 4) d.setDate(d.getDate() - d.getDay() + 1);
    else d.setDate(d.getDate() + 8 - d.getDay());
    d.setHours(0,0,0,0);
    return d;
  }

  function dateToKey(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  }



  // get inclusive list of date keys between start and end
  function getDateKeysBetween(start, end) {
    const keys = [];
    const d = parseDateKey(start);
    d.setHours(0, 0, 0, 0);
    const last = parseDateKey(end);
    last.setHours(0, 0, 0, 0);
    while (d <= last) {
      keys.push(dateToKey(d));
      d.setDate(d.getDate() + 1);
    }
    return keys;
  }

  // calculate streak (consecutive days with any entry, counting back from today)
  function calculateStreak(logs, activity){
    if (!activity) return 0;
    let streak = 0;
    let d = parseDateKey();
    d.setHours(0,0,0,0);
  
    while(true){
      const dayName = d.toLocaleDateString('en-US',{weekday:'short'});
      const required =
        activity.frequency === "daily" ||
        (activity.frequency === "alternate") ||
        (activity.frequency === "custom" && activity.days.includes(dayName));
  
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  
      if(!required){
        d.setDate(d.getDate()-1);
        continue;
      }
  
      if(logs[key] && logs[key][activity.id]?.length){
        streak++;
        d.setDate(d.getDate()-1);
      } else {
        // if today and haven't logged yet, don't break the streak
        if (dateToKey(d) === dateToKey(new Date()) && streak === 0) {
          d.setDate(d.getDate() - 1);
          continue;
        }
        break;
      }
    }
    return streak;
  }


  // make canvas hi-dpi and sized to container
  function prepareCanvas() {
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 180;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  function renderSummary() {
    const ctx = prepareCanvas();
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const id = summaryActivity.value;
    if (!id) {
      setMetricsEmpty();
      return;
    }

    // determine range start/end
    const range = summaryRange.value;
    let start, end;
    const now = parseDateKey();
    now.setHours(0, 0, 0, 0);

    if (range === "daily" && sDate.value) {
      start = parseDateKey(sDate.value);
      end = parseDateKey(sDate.value);
    } else if (range === "weekly") {
      if (sYear.value && sWeek.value) {
        start = getWeekStart(Number(sYear.value), Number(sWeek.value));
        end = parseDateKey(start);
        end.setDate(start.getDate() + 6);
      } else {
        // default: current week (Mon-Sun)
        const c = parseDateKey();
        const dow = c.getDay();
        const monday = parseDateKey(c);
        monday.setDate(c.getDate() - (dow === 0 ? 6 : dow - 1));
        monday.setHours(0, 0, 0, 0);
        start = monday;
        end = parseDateKey(start);
        end.setDate(start.getDate() + 6);
      }
    } else if (range === "monthly" && sMonth.value) {
      const [y, m] = sMonth.value.split("-");
      start = parseDateKey(Number(y), Number(m) - 1, 1);
      end = parseDateKey(Number(y), Number(m), 0);
    } else if (range === "yearly" && sYear.value) {
      start = parseDateKey(Number(sYear.value), 0, 1);
      end = parseDateKey(Number(sYear.value), 11, 31);
    } else if (range === "all") {
      start = parseDateKey("1970-01-01");
      end = now;
    } else {
      // default window = last ~30 days
      end = now;
      start = parseDateKey(now);
      start.setDate(now.getDate() - 30);
    }


    // build date keys for the period
    const keys = getDateKeysBetween(start, end);
    const logs = load(LOG);

    // collect data points in chronological order
    const data = [];
    const sets = []; // all individual set values within range (for best set)
    for (const k of keys) {
      if (logs[k] && logs[k][id]) {
        const sum = logs[k][id].reduce((a, b) => a + b, 0);
        data.push({ date: k, value: sum });
        logs[k][id].forEach(v => sets.push(v));
      } else {
        data.push({ date: k, value: 0 });
      }
    }

    // remove leading/trailing zeros for visual compactness while keeping at least 1 point
    // but only if range is "all" or "default" (not fixed ranges like weekly/monthly/etc)
    let displayData = data;
    if (range === "all" || !range) {
      let startIndex = 0, endIndex = data.length - 1;
      while (startIndex < endIndex && data[startIndex].value === 0) startIndex++;
      while (endIndex > startIndex && data[endIndex].value === 0) endIndex--;
      displayData = data.slice(startIndex, endIndex + 1);
    }
    if (displayData.length === 0) displayData.push(data[Math.floor(data.length / 2)]); // ensure at least 1

    const values = data.map(d => d.value);        // metrics use FULL range
    const plotValues = displayData.map(d => d.value); // graph uses trimmed range
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? Math.round(total / values.length) : 0;
    const bestDay = values.length ? Math.max(...values) : 0;
    const bestSet = sets.length ? Math.max(...sets) : 0;
    const activeDays = values.filter(v => v > 0).length;
    const act = load(ACT)[id];
    const streak = calculateStreak(logs, act);


    // set metrics DOM
    document.getElementById("sTotal").textContent = total;
    document.getElementById("sAvg").textContent = avg;
    document.getElementById("sBest").textContent = bestDay;
    document.getElementById("sBestSet").textContent = bestSet;
    document.getElementById("sActive").textContent = activeDays;
    document.getElementById("sStreak").textContent = streak;

    // draw grid + area + line + points
    if (!values.length || values.every(v => v === 0)) {
      // nothing to draw
      ctx.fillStyle = "rgba(128,128,128,0.06)";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      return;
    }

    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 180;
    const padding = { left: 28, right: 12, top: 12, bottom: 36 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const max = Math.max(...values, 1); // keep scale based on full data
    const stepX = plotValues.length > 1 ? plotW / (plotValues.length - 1) : plotW / 2;

    // GRID
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    ctx.font = "11px Nunito";
    ctx.fillStyle = "#9AA0A6";

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (plotH * i / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
      const gridVal = Math.round(max - (max * i / gridLines));
      ctx.fillText(gridVal.toString(), 6, y + 4);
    }

    // compute points from plotValues
    const points = plotValues.map((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + plotH - (v / max) * plotH;
      return { x, y, v };
    });

    // AREA
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
    gradient.addColorStop(0, "rgba(86,150,255,0.25)");
    gradient.addColorStop(1, "rgba(86,150,255,0.02)");
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.lineTo(padding.left, padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // LINE
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = "#2B7DF6";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // POINTS
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#2B7DF6";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // X LABELS
    ctx.fillStyle = "#9AA0A6";
    ctx.font = "11px Nunito";

    if (range === "weekly") {
      displayData.forEach((d, i) => {
        const x = padding.left + (i * stepX);
        const date = parseDateKey(d.date);
        const txt = date.toLocaleDateString(undefined, { weekday: "short" });
        ctx.fillText(txt, x - 12, padding.top + plotH + 20);
      });
    } else if (range === "monthly") {
      displayData.forEach((d, i) => {
        const dayNum = Number(d.date.split("-")[2]);
        if (dayNum === 1 || dayNum % 5 === 0 || i === displayData.length - 1) {
          const x = padding.left + (i * stepX);
          ctx.fillText(dayNum.toString(), x - 6, padding.top + plotH + 20);
        }
      });
    } else if (range === "yearly") {
      displayData.forEach((d, i) => {
        const date = parseDateKey(d.date);
        if (date.getDate() === 1) {
          const x = padding.left + (i * stepX);
          const txt = date.toLocaleDateString(undefined, { month: "short" });
          ctx.fillText(txt, x - 12, padding.top + plotH + 20);
        }
      });
    } else {
      const labelCount = Math.min(4, displayData.length);
      if (labelCount > 0) {
        for (let i = 0; i < displayData.length; i++) {
          if (i % Math.ceil(displayData.length / labelCount) === 0) {
            const x = padding.left + (i * stepX);
            const txt = displayData[i].date.slice(5); // mm-dd
            ctx.fillText(txt, x - 16, padding.top + plotH + 20);
          }
        }
      }
    }
  }

  function setMetricsEmpty() {
    document.getElementById("sTotal").textContent = 0;
    document.getElementById("sAvg").textContent = 0;
    document.getElementById("sBest").textContent = 0;
    document.getElementById("sBestSet").textContent = 0;
    document.getElementById("sActive").textContent = 0;
    document.getElementById("sStreak").textContent = 0;
  }

  /* Calendar export (kept but safer revoke timing) */
  function exportCalendar(a) {
    if (!a.startTime || !a.endTime) {
      alert("Please set start and end time for this activity.");
      return;
    }
    const start = parseDateKey();
    const until = parseDateKey();
    until.setDate(until.getDate() + 90);

    const [sh, sm] = a.startTime.split(":");
    const [eh, em] = a.endTime.split(":");
    start.setHours(sh, sm, 0, 0);
    const end = parseDateKey(start);
    end.setHours(eh, em, 0, 0);

    let r = "FREQ=DAILY";
    if (a.frequency === "alternate") r = "FREQ=DAILY;INTERVAL=2";
    if (a.frequency === "custom") {
      const map = { Mon: "MO", Tue: "TU", Wed: "WE", Thu: "TH", Fri: "FR", Sat: "SA", Sun: "SU" };
      r = "FREQ=WEEKLY;BYDAY=" + (a.days || []).map(d => map[d]).join(",");
    }

    r += ";UNTIL=" + until.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `SUMMARY:${a.name}`,
      `DTSTART:${start.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTEND:${end.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `RRULE:${r}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${a.name}.ics`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 150);
  }

  /* summary control changes trigger redraw */
  summaryRange.onchange = () => {
    sDate.classList.add("hidden");
    sMonth.classList.add("hidden");
    sYear.classList.add("hidden");
    sWeek.classList.add("hidden");

    if (summaryRange.value === "daily") sDate.classList.remove("hidden");
    if (summaryRange.value === "weekly") { sYear.classList.remove("hidden"); sWeek.classList.remove("hidden"); }
    if (summaryRange.value === "monthly") sMonth.classList.remove("hidden");
    if (summaryRange.value === "yearly") sYear.classList.remove("hidden");

    renderSummary();
  };

  [summaryActivity, sDate, sMonth, sYear, sWeek].forEach(i => { if (i) i.onchange = renderSummary; });

  /* STREAK utility (already defined above) */

  /* INIT */
  function initUI() {
    renderActivities();
    populate();
    renderHistory();
    renderSummary();
  }

  initUI();

  /* Re-render on resize so graph stays crisp */
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(renderSummary, 150);
  });

   window.addEventListener("load", () => {
      setTimeout(renderSummary, 80);
   });
   
});
