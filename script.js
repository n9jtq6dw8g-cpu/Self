document.addEventListener("DOMContentLoaded", () => {

const ACT_KEY="activities";
const LOG_KEY="logs";
const load=k=>JSON.parse(localStorage.getItem(k))||{};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

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

/* ---------- ACTIVITIES ---------- */
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

  const summarySelect=document.getElementById("summaryActivity");
  summarySelect.innerHTML=Object.values(acts)
    .filter(a=>!a.archived)
    .map(a=>`<option value="${a.id}">${a.name}</option>`).join("");

  if(!summarySelect.value && summarySelect.options.length){
    summarySelect.value=summarySelect.options[0].value;
  }
}

logActivity.onchange=renderLogEntry;

function renderLogEntry(){
  const acts=load(ACT_KEY);
  const a=acts[logActivity.value];
  if(!a){ logEntry.innerHTML=""; return; }

  logEntry.innerHTML=`<input type="number" id="logVal" placeholder="${a.unit}"><button>Add</button>`;
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
  const acts=load(ACT_KEY);
  logHistory.innerHTML="";

  Object.keys(logs).sort().reverse().forEach(date=>{
    const day=document.createElement("div");
    day.className="history-day";
    day.innerHTML=`<strong>${date}</strong>`;

    Object.keys(logs[date]).forEach(id=>{
      const act=document.createElement("div");
      act.className="history-activity";
      act.textContent=acts[id]?.name||id;

      logs[date][id].forEach((v,idx)=>{
        const set=document.createElement("div");
        set.className="history-set";
        set.innerHTML=`• ${v} ${acts[id]?.unit||""}
          <button>✏️</button>
          <button>🗑️</button>`;

        const [editBtn,delBtn]=set.querySelectorAll("button");

        editBtn.onclick=()=>{
          const nv=prompt("Edit value",v);
          if(nv!==null){
            logs[date][id][idx]=Number(nv);
            save(LOG_KEY,logs);
            renderHistory();
            renderSummary();
          }
        };

        delBtn.onclick=()=>{
          logs[date][id].splice(idx,1);
          if(!logs[date][id].length) delete logs[date][id];
          if(!Object.keys(logs[date]).length) delete logs[date];
          save(LOG_KEY,logs);
          renderHistory();
          renderSummary();
        };

        act.appendChild(set);
      });

      day.appendChild(act);
    });

    logHistory.appendChild(day);
  });
}

/* ---------- SUMMARY (FIXED RANGE LOGIC) ---------- */
const ctx=document.getElementById("summaryGraph").getContext("2d");
document.getElementById("summaryActivity").onchange=renderSummary;
document.getElementById("summaryRange").onchange=renderSummary;

function getBucket(dateStr, range){
  const d=new Date(dateStr);
  if(range==="weekly"){
    const onejan=new Date(d.getFullYear(),0,1);
    return d.getFullYear()+"-W"+Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);
  }
  if(range==="monthly") return d.getFullYear()+"-"+(d.getMonth()+1);
  if(range==="yearly") return d.getFullYear().toString();
  return dateStr;
}

function renderSummary(){
  const id=document.getElementById("summaryActivity").value;
  const range=document.getElementById("summaryRange").value;
  if(!id) return;

  const logs=load(LOG_KEY);
  const buckets={};
  const sets=[];

  Object.keys(logs).forEach(d=>{
    if(logs[d][id]){
      const key = range==="all" ? "all" : getBucket(d,range);
      buckets[key]=buckets[key]||0;
      const sum=logs[d][id].reduce((a,b)=>a+b,0);
      buckets[key]+=sum;
      logs[d][id].forEach(v=>sets.push(v));
    }
  });

  const values=Object.values(buckets);

  const total=values.reduce((a,b)=>a+b,0);
  const days=values.length;

  document.getElementById("sTotal").textContent=total;
  document.getElementById("sAvg").textContent=days?Math.round(total/days):0;
  document.getElementById("sBest").textContent=values.length?Math.max(...values):0;
  document.getElementById("sBestSet").textContent=sets.length?Math.max(...sets):0;
  document.getElementById("sActive").textContent=days;
  document.getElementById("sStreak").textContent=days;

  drawGraph(values);
}

function drawGraph(data){
  ctx.clearRect(0,0,320,180);
  if(!data.length) return;

  const max=Math.max(...data,1);
  ctx.beginPath();
  ctx.strokeStyle="#2aa198";
  ctx.lineWidth=2;

  data.forEach((v,i)=>{
    const x=i*(320/(data.length-1||1));
    const y=180-(v/max)*160;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });

  ctx.stroke();
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
renderHistory();
renderSummary();

});