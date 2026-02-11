document.addEventListener("DOMContentLoaded",()=>{

const ACT="activities", LOG="logs";
const load=k=>JSON.parse(localStorage.getItem(k))||{};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

/* NAV */
document.querySelectorAll(".nav-btn").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    document.getElementById("screen-"+b.dataset.target).classList.add("active");
    if(b.dataset.target==="summary") renderSummary();
  };
});

/* THEME */
document.getElementById("toggleTheme").onclick=()=>{
  document.body.classList.toggle("dark");
};

/* BACKUP */
document.getElementById("downloadBackup").onclick=()=>{
  const blob=new Blob([JSON.stringify({activities:load(ACT),logs:load(LOG)},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="tracker-backup.json";
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},100);
};

document.getElementById("restoreBackup").onclick=()=>{
  if(!confirm("Overwrite current data?")) return;
  const input=document.createElement("input");
  input.type="file";input.accept="application/json";
  input.onchange=()=>{
    const r=new FileReader();
    r.onload=()=>{
      const d=JSON.parse(r.result);
      if(!d.activities||!d.logs) return alert("Invalid file");
      save(ACT,d.activities);save(LOG,d.logs);
      initUI();
    };
    r.readAsText(input.files[0]);
  };
  input.click();
};

/* ACTIVITIES */
const actName=document.getElementById("actName");
const actUnit=document.getElementById("actUnit");
const actStart=document.getElementById("actStart");
const actEnd=document.getElementById("actEnd");
const actFreq=document.getElementById("actFreq");
const weekdays=document.getElementById("weekdays");
const list=document.getElementById("activityList");
const archivedList=document.getElementById("archivedActivityList");
let edit=null;

actFreq.onchange=()=>weekdays.classList.toggle("hidden",actFreq.value!=="custom");

document.getElementById("saveActivity").onclick=()=>{
  if(!actName.value) return;
  const a=load(ACT);
  const id=edit??actName.value.toLowerCase().replace(/\s+/g,"_");
  a[id]={id,name:actName.value,unit:actUnit.value,startTime:actStart.value,endTime:actEnd.value,frequency:actFreq.value,days:[...weekdays.querySelectorAll("input:checked")].map(i=>i.value),active:true};
  save(ACT,a);resetActivityForm();renderActivities();
};

function renderActivities(){
  list.innerHTML="";archivedList.innerHTML="";
  Object.values(load(ACT)).forEach(a=>{
    const card=document.createElement("div");
    card.className="card"+(a.active?"":" paused");
    card.innerHTML=`<strong>${a.name}</strong> (${a.unit})
    <div class="row">
      <button class="secondary edit-btn">Edit</button>
      <button class="secondary toggle-btn">${a.active?"Pause":"Resume"}</button>
      <button class="secondary archive-btn">Archive</button>
      <button class="secondary cal-btn">Calendar</button>
    </div>`;
    card.querySelector(".toggle-btn").onclick=()=>{a.active=!a.active;save(ACT,load(ACT));renderActivities();populate();};
    card.querySelector(".archive-btn").onclick=()=>{a.archived=true;a.active=false;save(ACT,load(ACT));renderActivities();populate();};
    card.querySelector(".cal-btn").onclick=()=>exportCalendar(a);
    list.appendChild(card);
  });
  populate();
}

/* LOGGING */
const date=document.getElementById("logDate");
date.value=new Date().toISOString().split("T")[0];
const sel=document.getElementById("logActivity");
const entry=document.getElementById("logEntry");
const hist=document.getElementById("logHistory");

function populate(){
  sel.innerHTML=Object.values(load(ACT)).filter(x=>x.active&&!x.archived).map(x=>`<option value="${x.id}">${x.name}</option>`).join("");
  renderEntry();
}

function renderEntry(){
  const a=load(ACT)[sel.value];
  if(!a) return;
  entry.innerHTML=`<div class="log-input"><input id="val" type="number" placeholder="${a.unit}"><button>Add</button></div>`;
  entry.querySelector("button").onclick=()=>{
    const v=document.getElementById("val").value;
    if(!v||isNaN(v)) return;
    const l=load(LOG);const d=date.value;
    l[d]=l[d]||{};l[d][a.id]=l[d][a.id]||[];
    l[d][a.id].push(Number(v));
    save(LOG,l);renderHistory();renderSummary();
  };
}
sel.onchange=renderEntry;

/* HISTORY (performance optimized) */
function renderHistory(){
  hist.innerHTML="";
  const frag=document.createDocumentFragment();
  const l=load(LOG),a=load(ACT);
  Object.keys(l).sort().reverse().forEach(d=>{
    const day=document.createElement("div");
    day.className="history-day";
    day.innerHTML=`<strong>${d}</strong>`;
    Object.keys(l[d]).forEach(id=>{
      const group=document.createElement("div");
      group.innerHTML=`<strong>${a[id]?.name||""}</strong>`;
      l[d][id].forEach(v=>{
        const s=document.createElement("div");
        s.className="history-set";
        s.textContent=v+" "+a[id].unit;
        group.appendChild(s);
      });
      day.appendChild(group);
    });
    frag.appendChild(day);
  });
  hist.appendChild(frag);
}

/* SUMMARY FIXED WEEK CALC */
function getWeekStart(year,week){
  const simple=new Date(year,0,1+(week-1)*7);
  const dow=simple.getDay();
  if(dow<=4) simple.setDate(simple.getDate()-simple.getDay()+1);
  else simple.setDate(simple.getDate()+8-simple.getDay());
  return simple;
}

/* GRAPH + METRICS */
const ctx=document.getElementById("summaryGraph").getContext("2d");

function renderSummary(){
  ctx.clearRect(0,0,320,180);
  const id=document.getElementById("summaryActivity").value;
  if(!id) return;
  const l=load(LOG);
  let values=[];
  Object.keys(l).forEach(d=>{if(l[d][id]) values.push(l[d][id].reduce((a,b)=>a+b,0));});
  if(values.length===1) values.push(values[0]);
  const max=Math.max(...values,1);
  const step=values.length>1?320/(values.length-1):160;

  ctx.beginPath();
  values.forEach((v,i)=>{const x=i*step,y=170-(v/max)*140;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.strokeStyle="#F57F5B";ctx.lineWidth=3;ctx.stroke();

  document.getElementById("sTotal").textContent=values.reduce((a,b)=>a+b,0);
  document.getElementById("sAvg").textContent=Math.round(values.reduce((a,b)=>a+b,0)/values.length)||0;
  document.getElementById("sBest").textContent=Math.max(...values);
}

/* CALENDAR FIX */
function exportCalendar(a){
  if(!a.startTime||!a.endTime) return alert("Set times first");
  const start=new Date();const until=new Date();until.setDate(until.getDate()+90);
  const [sh,sm]=a.startTime.split(":"),[eh,em]=a.endTime.split(":");
  start.setHours(sh,sm,0,0);const end=new Date(start);end.setHours(eh,em);
  let r="FREQ=DAILY";if(a.frequency==="alternate")r="FREQ=DAILY;INTERVAL=2";
  const ics=`BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:${a.name}\nDTSTART:${start.toISOString().replace(/[-:]/g,"").split(".")[0]}Z\nDTEND:${end.toISOString().replace(/[-:]/g,"").split(".")[0]}Z\nRRULE:${r};UNTIL=${until.toISOString().replace(/[-:]/g,"").split(".")[0]}Z\nEND:VEVENT\nEND:VCALENDAR`;
  const blob=new Blob([ics],{type:"text/calendar"});const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download=a.name+".ics";
  document.body.appendChild(link);link.click();
  setTimeout(()=>{URL.revokeObjectURL(url);link.remove();},100);
}

function resetActivityForm(){edit=null;actName.value="";actUnit.value="count";actStart.value="";actEnd.value="";actFreq.value="daily";weekdays.classList.add("hidden");}

function initUI(){renderActivities();populate();renderHistory();renderSummary();}
initUI();

});
