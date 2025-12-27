document.addEventListener("DOMContentLoaded", () => {

const ACT_KEY = "activities";
const LOG_KEY = "logs";

const load = k => JSON.parse(localStorage.getItem(k)) || {};
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));

/* ---------- NAV ---------- */
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    document.getElementById("screen-"+btn.dataset.target).classList.add("active");
    if(btn.dataset.target==="summary") renderSummary();
  };
});

/* ---------- DARK MODE ---------- */
const themeBtn=document.getElementById("toggleTheme");
if(load("theme")==="dark") document.body.classList.add("dark");
themeBtn.onclick=()=>{
  document.body.classList.toggle("dark");
  save("theme",document.body.classList.contains("dark")?"dark":"light");
};

/* ---------- ACTIVITY FORM ---------- */
let editId=null;
const actName=document.getElementById("actName");
const actUnit=document.getElementById("actUnit");
const actStart=document.getElementById("actStart");
const actEnd=document.getElementById("actEnd");
const actFreq=document.getElementById("actFreq");
const weekdays=document.getElementById("weekdays");
const activityList=document.getElementById("activityList");

actFreq.onchange=()=>weekdays.classList.toggle("hidden",actFreq.value!=="custom");

document.getElementById("saveActivity").onclick=()=>{
  if(!actName.value) return;

  const acts=load(ACT_KEY);
  const id=editId||actName.value.toLowerCase().replace(/\s+/g,"_");

  acts[id]={
    id,
    name:actName.value,
    unit:actUnit.value,
    startTime:actStart.value,
    endTime:actEnd.value,
    frequency:actFreq.value,
    days:[...weekdays.querySelectorAll("input:checked")].map(i=>i.value),
    active:true,
    archived:false
  };

  save(ACT_KEY,acts);
  resetForm();
  renderActivities();
};

document.getElementById("cancelEdit").onclick=resetForm;

function resetForm(){
  editId=null;
  actName.value="";
  actUnit.value="count";
  actStart.value="";
  actEnd.value="";
  actFreq.value="daily";
  weekdays.classList.add("hidden");
  weekdays.querySelectorAll("input").forEach(i=>i.checked=false);
}

function renderActivities(){
  const acts=load(ACT_KEY);
  activityList.innerHTML="";
  Object.values(acts).filter(a=>!a.archived).forEach(a=>{
    const c=document.createElement("div");
    c.className="card";
    c.innerHTML=`
      <strong>${a.name}</strong> (${a.unit})
      <div class="row">
        <button>Edit</button>
        <button>${a.active?"Pause":"Resume"}</button>
        <button>Archive</button>
        <button>Calendar</button>
      </div>
    `;
    const [editBtn,toggleBtn,archiveBtn,calBtn]=c.querySelectorAll("button");
    editBtn.onclick=()=>startEdit(a);
    toggleBtn.onclick=()=>{a.active=!a.active;save(ACT_KEY,acts);renderActivities();populateSelectors();};
    archiveBtn.onclick=()=>{a.archived=true;a.active=false;save(ACT_KEY,acts);renderActivities();populateSelectors();};
    calBtn.onclick=()=>exportCalendar(a);
    activityList.appendChild(c);
  });
  populateSelectors();
}

function startEdit(a){
  editId=a.id;
  actName.value=a.name;
  actUnit.value=a.unit;
  actStart.value=a.startTime;
  actEnd.value=a.endTime;
  actFreq.value=a.frequency;
  weekdays.querySelectorAll("input").forEach(i=>i.checked=a.days.includes(i.value));
  weekdays.classList.toggle("hidden",a.frequency!=="custom");
}

/* ---------- LOG ---------- */
const logDate=document.getElementById("logDate");
const logActivity=document.getElementById("logActivity");
const logEntry=document.getElementById("logEntry");
const logHistory=document.getElementById("logHistory");

logDate.value=new Date().toISOString().split("T")[0];

function populateSelectors(){
  const acts=load(ACT_KEY);
  logActivity.innerHTML=Object.values(acts)
    .filter(a=>a.active&&!a.archived)
    .map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
  document.getElementById("summaryActivity").innerHTML=
    Object.values(acts).filter(a=>!a.archived)
    .map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
}

logActivity.onchange=renderLogEntry;

function renderLogEntry(){
  const acts=load(ACT_KEY);
  const a=acts[logActivity.value];
  if(!a){ logEntry.innerHTML=""; return; }

  logEntry.innerHTML=`
    <input type="number" id="logVal" placeholder="${a.unit}">
    <button>Add</button>
  `;

  logEntry.querySelector("button").onclick=()=>{
    const logs=load(LOG_KEY);
    const d=logDate.value;
    logs[d]=logs[d]||{};
    logs[d][a.id]=logs[d][a.id]||[];
    logs[d][a.id].push(Number(document.getElementById("logVal").value));
    save(LOG_KEY,logs);
    renderHistory();
    renderSummary();
  };
}

function renderHistory(){
  const logs=load(LOG_KEY);
  logHistory.textContent=JSON.stringify(logs,null,2);
}

/* ---------- SUMMARY ---------- */
function renderSummary(){
  const id=document.getElementById("summaryActivity").value;
  if(!id) return;
  const logs=load(LOG_KEY);
  let total=0,days=0,sets=[];
  Object.values(logs).forEach(d=>{
    if(d[id]){
      days++;
      d[id].forEach(v=>{total+=v;sets.push(v);});
    }
  });
  document.getElementById("sTotal").textContent=total;
  document.getElementById("sAvg").textContent=days?Math.round(total/days):0;
  document.getElementById("sBest").textContent=Math.max(...sets,0);
  document.getElementById("sBestSet").textContent=Math.max(...sets,0);
  document.getElementById("sActive").textContent=days;

  let streak=0;
  const dates=Object.keys(logs).sort();
  for(let i=dates.length-1;i>=0;i--){
    if(logs[dates[i]][id]) streak++;
    else break;
  }
  document.getElementById("sStreak").textContent=streak;
}

/* ---------- CALENDAR ---------- */
function exportCalendar(a){
  const start=new Date();
  const until=new Date(); until.setDate(until.getDate()+90);
  const [sh,sm]=a.startTime.split(":");
  const [eh,em]=a.endTime.split(":");
  start.setHours(sh,sm,0);
  const end=new Date(start); end.setHours(eh,em,0);

  let r="FREQ=DAILY";
  if(a.frequency==="alternate") r="FREQ=DAILY;INTERVAL=2";
  if(a.frequency==="custom"){
    const map={Mon:"MO",Tue:"TU",Wed:"WE",Thu:"TH",Fri:"FR",Sat:"SA",Sun:"SU"};
    r="FREQ=WEEKLY;BYDAY="+a.days.map(d=>map[d]).join(",");
  }
  r+=";UNTIL="+until.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";

  const ics=`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:${a.name}
DTSTART:${start.toISOString().replace(/[-:]/g,"").split(".")[0]}Z
DTEND:${end.toISOString().replace(/[-:]/g,"").split(".")[0]}Z
RRULE:${r}
END:VEVENT
END:VCALENDAR`;

  const blob=new Blob([ics],{type:"text/calendar"});
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.download=a.name+".ics";
  link.click();
}

/* ---------- INIT ---------- */
renderActivities();
populateSelectors();
renderLogEntry();

});