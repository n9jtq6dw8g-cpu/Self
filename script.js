document.addEventListener("DOMContentLoaded", () => {

  /* ---------- NAV ---------- */
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

  /* ---------- STORAGE ---------- */
  const ACT_KEY = "activities";
  const LOG_KEY = "logs";

  const load = k => JSON.parse(localStorage.getItem(k)) || {};
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const today = () => new Date().toISOString().split("T")[0];

  /* ---------- LOG ELEMENTS ---------- */
  const logActivity = document.getElementById("logActivity");
  const logDate = document.getElementById("logDate");
  const logInputs = document.getElementById("logInputs");
  const logHistory = document.getElementById("logHistory");

  logDate.value = today();

  /* ---------- LOG UI ---------- */
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

    const div = document.createElement("div");
    div.innerHTML = `
      <input type="number" id="logValue" placeholder="Value">
      <button>Add</button>
    `;
    div.querySelector("button").onclick = addLog;
    logInputs.appendChild(div);
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

    Object.keys(logs)
      .sort((a, b) => b.localeCompare(a))
      .forEach(date => {
        if (!logs[date][id]) return;

        const dayDiv = document.createElement("div");
        dayDiv.className = "log-day";
        dayDiv.innerHTML = `<strong>${date}</strong>`;

        logs[date][id].forEach((val, idx) => {
          const item = document.createElement("div");
          item.className = "log-item";

          item.innerHTML = `
            <input type="number" value="${val}">
            <button>Save</button>
            <button>Delete</button>
          `;

          const [input, saveBtn, delBtn] = item.querySelectorAll("input,button");

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

          dayDiv.appendChild(item);
        });

        logHistory.appendChild(dayDiv);
      });
  }

  logActivity.onchange = renderLogHistory;
  logDate.onchange = renderLogHistory;

  /* ---------- SUMMARY (UNCHANGED) ---------- */
  // summary + graph code stays exactly the same
  // (uses the same LOG_KEY data)

  renderLogUI();
});