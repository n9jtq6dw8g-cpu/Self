document.addEventListener("DOMContentLoaded", () => {

const ACT_KEY="activities";
const LOG_KEY="logs";
const load=k=>JSON.parse(localStorage.getItem(k))||{};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

/* NAV */
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    document.getElementById("screen-"+btn.dataset.target).classList.add("active");
    if(btn.dataset.target==="summary") renderSummary();
  };
});

/* DARK MODE */
const themeBtn=document.getElementById("toggleTheme");
if(load("theme")==="dark") document.body.classList.add("dark");
themeBtn.onclick=()=>{
  document.body.classList.toggle("dark");
  save("theme",document.body.classList.contains("dark")?"dark":"light");
};

/* ACTIVITY FORM */
let editId=null;
const actName=actUnit=actStart=actEnd=actFreq=null; // ← fixed below
const actNameEl=document.getElementById("actName");
const actUnitEl=document.getElementById("actUnit");
const actStartEl=document.getElementById("actStart");
const actEndEl=document.getElementById("actEnd");
const actFreqEl=document.getElementById("actFreq");
const weekdays=document.getElementById("weekdays");
const activityList=document.getElementById("activityList");

actFreqEl.onchange=()=>weekdays.classList.toggle("hidden",actFreqEl.value!=="custom");

document.getElementById("saveActivity").onclick=()=>{
  if(!actNameEl.value) return;
  const acts=load(ACT_KEY);
  const id=editId||actNameEl.value.toLowerCase().replace(/\s+/g,"_");

  acts[id]={
    id,
    name:actNameEl.value,
    unit:actUnitEl.value,
    startTime:actStartEl.value,
    endTime:actEndEl.value,
    frequency:actFreqEl.value,
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
  actNameEl.value="";
  actUnitEl.value="";
  actStartEl.value="";
  actEndEl.value="";
  actFreqEl.value="daily";
  weekdays.classList.add("hidden");
  weekdays.querySelectorAll("input").forEach(i=>i.checked=false);
}

/* ACTIVITIES LIST */
function renderActivities(){
  const acts=load(ACT_KEY);
  activityList.innerHTML="";
  Object.values(acts).filter(a=>!a.archived).forEach(a=>{
    const c=document.createElement("div");
    c.className="card";
    c.innerHTML=`
      <strong>${a.name}</strong>
      <div class="row">
        <button class="edit">Edit</button>
        <button class="toggle">${a.active?"Pause":"Resume"}</button>
        <button class="archive">Archive</button>
        <button class="calendar">Calendar</button>
      </div>
    `;
    c.querySelector(".edit").onclick=()=>startEdit(a);
    c.querySelector(".toggle").onclick=()=>{a.active=!a.active;save(ACT_KEY,acts);renderActivities();populateSelectors();};
    c.querySelector(".archive").onclick=()=>{a.archived=true;a.active=false;save(ACT_KEY,acts);renderActivities();populateSelectors();};
    c.querySelector(".calendar").onclick=()=>exportCalendar(a);
    activityList.appendChild(c);
  });
  populateSelectors();
}

function startEdit(a){
  editId=a.id;
  actNameEl.value=a.name;
  actUnitEl.value=a.unit;
  actStartEl.value=a.startTime;
  actEndEl.value=a.endTime;
  actFreqEl.value=a.frequency;
  weekdays.querySelectorAll("input").forEach(i=>i.checked=a.days.includes(i.value));
  weekdays.classList.toggle("hidden",a.frequency!=="custom");
}

/* LOG */
const logDate=document.getElementById("logDate");
const logActivity=document.getElementById("logActivity");
const logInputs=document.getElementById("logInputs");
const logHistory=document.getElementById("logHistory");

logDate.value=new Date().toISOString().split("T")[0];

function populateSelectors(){
  const acts=load(ACT_KEY);
  logActivity.innerHTML=Object.values(acts).filter(a=>a.active&&!a.archived)
    .map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
  document.getElementById("summaryActivity").innerHTML=logActivity.innerHTML;
}

logActivity.onchange=renderLogInput;

function renderLogInput(){
  logInputs.innerHTML=`<input type="number" id="logVal"><button>Add</button>`;
  logInputs.querySelector("button").onclick=()=>{
    const logs=load(LOG_KEY);
    const d=logDate.value;
    const id=logActivity.value;
    logs[d]=logs[d]||{};
    logs[d][id]=logs[d][id]||[];
    logs[d][id].push(Number(document.getElementById("logVal").value));
    save(LOG_KEY,logs);
    renderHistory();
    renderSummary();
  };
}

function renderHistory(){
  logHistory.textContent=JSON.stringify(load(LOG_KEY),null,2);
}

/* SUMMARY */
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
  document.getElementById("sStreak").textContent=0;
}

/* CALENDAR (RRULE) */
function exportCalendar(a){
  const now=new Date();
  const until=new Date(); until.setDate(until.getDate()+90);
  const [sh,sm]=a.startTime.split(":");
  const [eh,em]=a.endTime.split(":");
  now.setHours(sh,sm,0);
  const end=new Date(now); end.setHours(eh,em,0);

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
DTSTART:${now.toISOString().replace(/[-:]/g,"").split(".")[0]}Z
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

/* INIT */
renderActivities();
populateSelectors();
renderLogInput();

});